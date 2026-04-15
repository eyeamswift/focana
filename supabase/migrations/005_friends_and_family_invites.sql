create table if not exists public.friends_and_family_invites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'active'
    check (status in ('active', 'claimed', 'revoked')),
  claimed_email text null,
  claimed_order_id text null,
  claimed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists friends_and_family_invites_slug_unique_idx
  on public.friends_and_family_invites (lower(slug));
create unique index if not exists friends_and_family_invites_claimed_order_id_unique_idx
  on public.friends_and_family_invites (claimed_order_id)
  where claimed_order_id is not null;
create index if not exists friends_and_family_invites_status_idx
  on public.friends_and_family_invites (status);
create index if not exists friends_and_family_invites_claimed_email_idx
  on public.friends_and_family_invites (lower(claimed_email))
  where claimed_email is not null;
drop trigger if exists friends_and_family_invites_set_updated_at
  on public.friends_and_family_invites;
create trigger friends_and_family_invites_set_updated_at
before update on public.friends_and_family_invites
for each row
execute function public.set_current_timestamp_updated_at();
alter table public.friends_and_family_invites enable row level security;
