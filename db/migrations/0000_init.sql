-- =====================================================================
-- Lumen Books — initial schema
-- Supabase (Postgres) + Row Level Security + Storage buckets
--
-- Run this once in the Supabase SQL Editor (or `psql`). It is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums (text + CHECK, so adding values later is a one-line change)
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type promo_kind as enum ('percent', 'fixed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  name_en         text not null,
  name_fr         text,
  name_ar         text,
  description_en  text,
  description_fr  text,
  description_ar  text,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists categories_slug_idx on public.categories (slug);

create table if not exists public.books (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  title             text not null,
  subtitle          text,
  author            text not null,
  description       text not null,
  excerpt           text,
  category_id       uuid references public.categories (id) on delete set null,
  price_cents       integer not null check (price_cents >= 0),
  compare_at_cents  integer check (compare_at_cents is null or compare_at_cents >= 0),
  currency          text not null default 'USD' check (currency = 'USD'),
  language          text not null default 'en',
  formats           text[] not null default array['epub', 'pdf'],
  pages             integer,
  isbn              text,
  published_at      date,
  cover_path        text,
  pdf_path          text,
  pdf_size_bytes    integer,
  pdf_mime_type     text,
  is_featured       boolean not null default false,
  is_active         boolean not null default true,
  is_demo           boolean not null default false,
  sales_count       integer not null default 0,
  rating_avg        numeric(5, 2) not null default 0,
  rating_count      integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists books_slug_idx on public.books (slug);
create index if not exists books_category_idx on public.books (category_id);
create index if not exists books_active_idx on public.books (is_active);
create index if not exists books_published_idx on public.books (published_at);
create index if not exists books_price_idx on public.books (price_cents);
-- Free-text search (title / author / isbn)
create index if not exists books_search_idx on public.books
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(author, '') || ' ' || coalesce(isbn, '')));

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null,
  user_id               uuid references public.profiles (id) on delete set null,
  email                 text not null,
  status                order_status not null default 'pending',
  currency              text not null default 'USD' check (currency = 'USD'),
  locale                text not null default 'en' check (locale in ('en', 'fr', 'ar')),
  subtotal_cents        integer not null check (subtotal_cents >= 0),
  discount_cents        integer not null default 0 check (discount_cents >= 0),
  total_cents           integer not null check (total_cents >= 0),
  promo_code            text,
  paypal_order_id       text,
  paypal_capture_id     text,
  paypal_status         text,
  paypal_payer_email    text,
  webhook_confirmed_at  timestamptz,
  paid_at               timestamptz,
  emailed_at            timestamptz,
  admin_note            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists orders_number_idx on public.orders (order_number);
create unique index if not exists orders_paypal_idx on public.orders (paypal_order_id);
create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at);

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  book_id             uuid not null references public.books (id) on delete restrict,
  title_snapshot      text not null,
  author_snapshot     text not null,
  cover_path_snapshot text,
  unit_price_cents    integer not null check (unit_price_cents >= 0),
  quantity            integer not null default 1 check (quantity > 0),
  line_total_cents    integer not null check (line_total_cents >= 0),
  created_at          timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_book_idx on public.order_items (book_id);

create table if not exists public.downloads (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists downloads_item_idx on public.downloads (order_item_id);
create index if not exists downloads_user_idx on public.downloads (user_id);

create table if not exists public.promo_codes (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null,
  kind               promo_kind not null,
  value              integer not null check (value > 0),
  min_subtotal_cents integer not null default 0,
  max_uses           integer,
  used_count         integer not null default 0,
  starts_at          timestamptz,
  expires_at         timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists promo_codes_code_idx on public.promo_codes (code);

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  author_name text not null,
  rating     integer not null check (rating between 1 and 5),
  title      text,
  body       text not null,
  status     review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_book_idx on public.reviews (book_id);
create index if not exists reviews_status_idx on public.reviews (status);

create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  locale     text,
  source     text default 'home',
  created_at timestamptz not null default now()
);
create unique index if not exists newsletter_email_idx on public.newsletter_subscribers (email);

create table if not exists public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  order_number text,
  subject      text not null,
  body         text not null,
  handled      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists contact_handled_idx on public.contact_messages (handled);

create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','categories','books','orders','promo_codes','reviews','settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Profile bootstrap: creates a row whenever an auth user signs up,
-- and promotes emails listed in app_metadata.admin_emails to admin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admins text[] := current_setting('app.settings.admin_emails', true);
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    case
      when coalesce(new.email, '') = any (admins) then 'admin'::user_role
      else 'customer'::user_role
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep `profiles.role` authoritative but allow the trigger to grant admin once.
create or replace function public.promote_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set role = 'admin' where lower(email) = lower(p_email);
end;
$$;

-- ---------------------------------------------------------------------
-- Aggregate rating helper (kept in SQL so the storefront stays cheap)
-- ---------------------------------------------------------------------
create or replace function public.refresh_book_rating(p_book_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.books
  set rating_avg = coalesce((select round(avg(rating)::numeric, 2)
                              from public.reviews
                              where book_id = p_book_id and status = 'approved'), 0),
      rating_count = (select count(*) from public.reviews
                      where book_id = p_book_id and status = 'approved')
  where id = p_book_id;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- The Next.js server connects as the table owner (`postgres`), which bypasses
-- RLS, so the application keeps full access. Everything coming from a browser
-- uses the `anon` / `authenticated` roles and is therefore restricted by the
-- policies below: the catalogue is readable, and every write goes through a
-- validated server action / route handler.
-- ---------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.books                  enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.downloads              enable row level security;
alter table public.promo_codes            enable row level security;
alter table public.reviews                enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;
alter table public.rate_limits            enable row level security;
alter table public.settings               enable row level security;

-- Profiles: a user may read their own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- Profiles: a user may update only their own non-role fields.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role = (select role from public.profiles p where p.id = auth.uid()));

-- Catalogue: public read of published books only.
drop policy if exists books_public_select on public.books;
create policy books_public_select on public.books
  for select to anon, authenticated
  using (is_active = true);

-- Categories: public read.
drop policy if exists categories_public_select on public.categories;
create policy categories_public_select on public.categories
  for select to anon, authenticated using (true);

-- Reviews: public read of approved ones, signed-in users may submit their own.
drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select on public.reviews
  for select to anon, authenticated using (status = 'approved');

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Newsletter + contact: anonymous visitors may submit (server validates & rate-limits).
drop policy if exists newsletter_public_insert on public.newsletter_subscribers;
create policy newsletter_public_insert on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists contact_public_insert on public.contact_messages;
create policy contact_public_insert on public.contact_messages
  for insert to anon, authenticated with check (true);

-- Orders, order items, downloads, promos, rate limits and settings have no
-- policy on purpose: no direct browser access whatsoever.
drop policy if exists orders_public_select on public.orders;

-- ---------------------------------------------------------------------
-- Storage buckets
--   covers → public read (images, CDN-cacheable)
--   pdfs   → private; only short-lived signed URLs issued by the server work
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 41943040, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Allow public reads of cover images through Storage.
drop policy if exists covers_public_read on storage.objects;
create policy covers_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'covers');

-- PDFs: no select policy at all → the bucket is unreachable from the browser
-- except through server-issued signed URLs.

-- ---------------------------------------------------------------------
-- Useful reporting views
-- ---------------------------------------------------------------------
create or replace view public.sales_daily
with (security_invoker = true) as
select
  date_trunc('day', paid_at)::date as day,
  count(*)::int                 as orders,
  sum(total_cents)::bigint     as revenue_cents
from public.orders
where status = 'paid'
group by 1
order by 1 desc;