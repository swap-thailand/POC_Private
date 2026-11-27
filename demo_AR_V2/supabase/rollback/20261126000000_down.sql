-- Rollback for 20261126000000_resale_cap_and_interests.sql. Restores the production schema as it was
-- on 2026-11-27 09:31 UTC (checked against the live database before the migration was applied).
--
-- Run only together with a code rollback to a release that does not use the new features
-- (settings.dbFeatures both false, e.g. tag v2-2026-11-26b). Notes:
--   * Interested taps (event_interests) are deleted.
--   * Restoring the "price at or under face value" rule fails if any listing is priced above face value.
--     Withdraw or reprice those listings first (the check at the top stops before changing anything).

begin;

do $$
begin
  if exists (select 1 from public.listings where price_thb > face_value_thb) then
    raise exception 'Listings above face value exist; reprice or withdraw them before rolling back';
  end if;
end;
$$;

drop view if exists public.marketplace_event_interest_counts;
drop table if exists public.event_interests;

alter table public.listings drop constraint if exists listings_price_cap;
alter table public.listings add constraint listings_check check (price_thb <= face_value_thb);

create or replace function public.marketplace_submit_listing(
  submission_id uuid, selected_event uuid, asking_price integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  seller uuid := auth.uid();
  object_path text := seller::text || '/' || submission_id::text;
  face integer;
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

  select face_value_thb into face from public.events
  where id = selected_event and published and starts_at > pg_catalog.now()
  for share;

  if face is null or asking_price is null or asking_price < 1 or asking_price > face then
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

alter table public.events drop column if exists strict_face_value;

commit;
