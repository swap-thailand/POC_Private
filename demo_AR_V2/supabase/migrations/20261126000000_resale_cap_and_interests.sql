-- JingTix V2: TicketSwap-style resale cap and the Interested button.
--
-- Backward compatible with the code currently in production:
--   * the listings price check is loosened from "at most face value" to "at most 120% of face value",
--     so every existing row and every price the old code allows still passes;
--   * marketplace_submit_listing keeps its exact signature and return type;
--   * events gains a nullable-safe column with a default, and new objects are only added.
-- Matches src/config/settings.js (pricing.maxMarkup = 0.2, buyerPercent = 0.10) and src/lib/fees.js.

begin;

-- 1. Resale cap: sellers may ask up to 20% over face value (price * 5 <= face * 6 is the same rule
--    as price <= floor(face * 1.2) for whole baht, without rounding).
do $$
declare
  old_check text;
begin
  for old_check in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.listings'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%price_thb <= face_value_thb%'
  loop
    execute format('alter table public.listings drop constraint %I', old_check);
  end loop;
end;
$$;

alter table public.listings drop constraint if exists listings_price_cap;
alter table public.listings add constraint listings_price_cap check (price_thb * 5 <= face_value_thb * 6);

-- 2. Strict face-value events: the buyer's total (price + 10% service fee, rounded) stays at or under face value.
alter table public.events add column if not exists strict_face_value boolean not null default false;

create or replace function public.marketplace_submit_listing(
  submission_id uuid, selected_event uuid, asking_price integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  seller uuid := auth.uid();
  object_path text := seller::text || '/' || submission_id::text;
  face integer;
  face_value_only boolean;
  saved_id uuid;
begin
  if seller is null or submission_id is null then
    raise exception 'Authentication and submission ID are required';
  end if;

  select id into saved_id from public.listings
  where id = submission_id and seller_id = seller and event_id = selected_event and price_thb = asking_price;
  if found then
    return saved_id;
  end if;

  select face_value_thb, strict_face_value into face, face_value_only from public.events
  where id = selected_event and published and starts_at > pg_catalog.now()
  for share;

  if face is null or asking_price is null or asking_price < 1
     or (not face_value_only and asking_price * 5 > face * 6)
     or (face_value_only and asking_price + pg_catalog.round(asking_price * 0.10) > face) then
    raise exception 'The event or asking price is unavailable';
  end if;

  perform 1 from storage.objects
  where bucket_id = 'marketplace-tickets' and name = object_path and owner_id = seller::text;
  if not found then
    raise exception 'Upload the ticket before submitting';
  end if;

  insert into public.listings (id, event_id, seller_id, price_thb, face_value_thb, ticket_path)
  values (submission_id, selected_event, seller, asking_price, face, object_path)
  on conflict (id) do nothing;

  select id into saved_id from public.listings
  where id = submission_id and seller_id = seller and event_id = selected_event and price_thb = asking_price;
  if not found then
    raise exception 'Submission ID is already in use';
  end if;
  return saved_id;
end;
$$;

revoke execute on function public.marketplace_submit_listing(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.marketplace_submit_listing(uuid, uuid, integer) to authenticated;

-- 3. Interested: one row per fan per event. Fans see and change only their own rows;
--    everyone can read the per-event totals through the view below.
create table if not exists public.event_interests (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_interests_user_idx on public.event_interests (user_id);

alter table public.event_interests enable row level security;
revoke all on public.event_interests from public, anon, authenticated;
grant select, insert, delete on public.event_interests to authenticated;
grant select, insert, update, delete on public.event_interests to service_role;

drop policy if exists "Read own interests" on public.event_interests;
create policy "Read own interests" on public.event_interests for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Add own interest in published events" on public.event_interests;
create policy "Add own interest in published events" on public.event_interests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.events e where e.id = event_id and e.published)
);

drop policy if exists "Remove own interest" on public.event_interests;
create policy "Remove own interest" on public.event_interests for delete to authenticated
using (user_id = (select auth.uid()));

-- Totals only: no user ids leave the database.
create or replace view public.marketplace_event_interest_counts with (security_barrier = true) as
select i.event_id, count(*)::integer as interested_count
from public.event_interests i join public.events e on e.id = i.event_id
where e.published
group by i.event_id;

revoke all on public.marketplace_event_interest_counts from public, anon, authenticated;
grant select on public.marketplace_event_interest_counts to anon, authenticated;

commit;
