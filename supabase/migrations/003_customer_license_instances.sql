create index if not exists customers_customer_id_ls_idx
  on public.customers (customer_id_ls)
  where customer_id_ls is not null;

create table if not exists public.customer_license_instances (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  license_instance_id text not null,
  order_id text null,
  customer_id_ls text null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists customer_license_instances_license_instance_id_unique_idx
  on public.customer_license_instances (license_instance_id);

create index if not exists customer_license_instances_customer_id_idx
  on public.customer_license_instances (customer_id);

create index if not exists customer_license_instances_order_id_idx
  on public.customer_license_instances (order_id)
  where order_id is not null;

create index if not exists customer_license_instances_customer_id_ls_idx
  on public.customer_license_instances (customer_id_ls)
  where customer_id_ls is not null;

drop trigger if exists customer_license_instances_set_updated_at on public.customer_license_instances;

create trigger customer_license_instances_set_updated_at
before update on public.customer_license_instances
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.customer_license_instances enable row level security;
