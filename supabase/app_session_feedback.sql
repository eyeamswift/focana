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
