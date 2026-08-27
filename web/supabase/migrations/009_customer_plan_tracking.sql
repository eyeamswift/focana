alter table public.customers
  add column if not exists plan_type text null,
  add column if not exists variant_id_ls text null,
  add column if not exists subscription_id_ls text null,
  add column if not exists subscription_status text null;

create index if not exists customers_plan_type_idx
  on public.customers (plan_type)
  where plan_type is not null;

create index if not exists customers_variant_id_ls_idx
  on public.customers (variant_id_ls)
  where variant_id_ls is not null;

create index if not exists customers_subscription_id_ls_idx
  on public.customers (subscription_id_ls)
  where subscription_id_ls is not null;

create index if not exists customers_subscription_status_idx
  on public.customers (subscription_status)
  where subscription_status is not null;
