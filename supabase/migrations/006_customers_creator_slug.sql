alter table public.customers
  add column if not exists creator_slug text null;
create index if not exists customers_creator_slug_idx
  on public.customers (lower(creator_slug))
  where creator_slug is not null;
