create table if not exists public."Email_Captures" (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null,
  source_history text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists email_captures_email_unique_idx
  on public."Email_Captures" (lower(email));
