create extension if not exists pgcrypto;

create table if not exists public."Beta_Downloads" (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists beta_downloads_email_unique_idx
  on public."Beta_Downloads" (lower(email));

create table if not exists public."Windows_Waitlist" (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists windows_waitlist_email_unique_idx
  on public."Windows_Waitlist" (lower(email));

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text null,
  name text null,
  status text null,
  source text null,
  order_id text null,
  customer_id_ls text null,
  amount_paid numeric(10, 2) null,
  currency text null,
  purchased_at timestamptz null,
  refunded_at timestamptz null,
  beta_user boolean not null default false,
  email_opted_in boolean not null default false,
  how_found text null,
  focus_struggles text[] not null default '{}'::text[],
  tools_tried text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists customers_order_id_unique_idx
  on public.customers (order_id)
  where order_id is not null;

create index if not exists customers_email_idx
  on public.customers (lower(email));

create table if not exists public.app_session_feedback (
  id text primary key,
  session_id text null,
  feedback text not null check (feedback in ('up', 'down')),
  surface text not null,
  completion_type text not null,
  session_mode text not null check (session_mode in ('freeflow', 'timed')),
  session_duration_minutes numeric(8, 2) not null default 0,
  client_created_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  app_version text not null,
  os_version text not null default '',
  channel text not null default 'latest',
  install_id text not null default '',
  license_instance_id text null
);

create index if not exists app_session_feedback_received_at_idx
  on public.app_session_feedback (received_at desc);

create index if not exists app_session_feedback_session_id_idx
  on public.app_session_feedback (session_id);

create index if not exists app_session_feedback_install_id_idx
  on public.app_session_feedback (install_id);

create index if not exists app_session_feedback_license_instance_id_idx
  on public.app_session_feedback (license_instance_id);

alter table public.app_session_feedback enable row level security;
