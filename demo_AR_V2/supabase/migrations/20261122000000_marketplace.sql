begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  poster_title text not null,
  subtitle text not null default '',
  starts_at timestamptz not null,
  venue text not null,
  city text not null,
  artists text[] not null default '{}',
  transfer_en text not null default '',
  transfer_th text not null default '',
  face_value_thb integer check (face_value_thb between 1 and 1000000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  seller_id uuid not null references public.profiles(id),
  price_thb integer not null check (price_thb > 0),
  face_value_thb integer not null check (price_thb <= face_value_thb),
  ticket_path text not null unique check (ticket_path = seller_id::text || '/' || id::text),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sold', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, seller_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  seller_id uuid not null,
  buyer_id uuid not null references public.profiles(id),
  price_thb integer not null check (price_thb > 0),
  fee_thb integer not null check (fee_thb >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (listing_id, seller_id) references public.listings(id, seller_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.ticket_verifications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  reviewer_id uuid references public.profiles(id) on delete set null,
  result text not null check (result in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists events_published_start_idx on public.events (starts_at) where published;
create index if not exists listings_event_idx on public.listings (event_id);
create index if not exists listings_seller_idx on public.listings (seller_id);
create unique index if not exists orders_active_listing_idx on public.orders (listing_id)
where status in ('reserved', 'completed');
create index if not exists orders_buyer_idx on public.orders (buyer_id);
create index if not exists orders_seller_idx on public.orders (seller_id);
create index if not exists verifications_listing_idx on public.ticket_verifications (listing_id);

create or replace function public.marketplace_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'events', 'listings', 'orders'] loop
    execute format('drop trigger if exists marketplace_updated_at on public.%I', table_name);
    execute format('create trigger marketplace_updated_at before update on public.%I for each row execute function public.marketplace_set_updated_at()', table_name);
  end loop;
end;
$$;

create or replace function public.marketplace_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists marketplace_create_profile on auth.users;
create trigger marketplace_create_profile after insert on auth.users
for each row execute function public.marketplace_create_profile();

insert into public.profiles (id)
select id from auth.users on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.ticket_verifications enable row level security;

revoke all on public.profiles, public.events, public.listings, public.orders, public.ticket_verifications
from public, anon, authenticated;
grant select on public.events to anon, authenticated;
grant select on public.profiles, public.listings, public.orders to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles, public.events, public.listings, public.orders, public.ticket_verifications to service_role;

drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "Edit own profile" on public.profiles;
create policy "Edit own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Read published events" on public.events;
create policy "Read published events" on public.events for select to anon, authenticated using (published);

drop policy if exists "Read own listings" on public.listings;
create policy "Read own listings" on public.listings for select to authenticated using (seller_id = (select auth.uid()));

drop policy if exists "Read own orders" on public.orders;
create policy "Read own orders" on public.orders for select to authenticated
using ((select auth.uid()) in (buyer_id, seller_id));

-- This projection deliberately omits seller identity and object paths.
create or replace view public.marketplace_available_listings with (security_barrier = true) as
select l.id, l.event_id, l.price_thb, l.face_value_thb
from public.listings l join public.events e on e.id = l.event_id
where l.status = 'approved' and e.published and e.starts_at > now();

revoke all on public.marketplace_available_listings from public, anon, authenticated;
grant select on public.marketplace_available_listings to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-tickets', 'marketplace-tickets', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Upload own marketplace ticket" on storage.objects;
create policy "Upload own marketplace ticket" on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketplace-tickets'
  and owner_id = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
);

drop policy if exists "Read own marketplace ticket" on storage.objects;
create policy "Read own marketplace ticket" on storage.objects for select to authenticated
using (bucket_id = 'marketplace-tickets' and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text);

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

revoke execute on function public.marketplace_set_updated_at(), public.marketplace_create_profile(),
  public.marketplace_submit_listing(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.marketplace_submit_listing(uuid, uuid, integer) to authenticated;

commit;
