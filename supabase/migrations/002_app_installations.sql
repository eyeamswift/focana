create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.app_installations (
  id uuid primary key default gen_random_uuid(),
  install_id text not null,
  license_instance_id text null,
  app_version text null,
  os_version text null,
  channel text not null default 'latest',
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists app_installations_install_id_unique_idx
  on public.app_installations (install_id);

create unique index if not exists app_installations_license_instance_id_unique_idx
  on public.app_installations (license_instance_id)
  where license_instance_id is not null;

drop trigger if exists app_installations_set_updated_at on public.app_installations;

create trigger app_installations_set_updated_at
before update on public.app_installations
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.app_session_feedback
  add column if not exists installation_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_session_feedback_installation_id_fkey'
  ) then
    alter table public.app_session_feedback
      add constraint app_session_feedback_installation_id_fkey
      foreign key (installation_id)
      references public.app_installations (id);
  end if;
end
$$;

create index if not exists app_session_feedback_installation_id_idx
  on public.app_session_feedback (installation_id)
  where installation_id is not null;

with normalized_feedback as (
  select
    nullif(btrim(install_id), '') as install_id,
    nullif(btrim(license_instance_id), '') as license_instance_id,
    coalesce(client_created_at, received_at) as event_at,
    app_version,
    os_version,
    channel
  from public.app_session_feedback
  where nullif(btrim(install_id), '') is not null
),
unique_license_candidates as (
  select
    install_id,
    min(license_instance_id) as license_instance_id
  from normalized_feedback
  where license_instance_id is not null
  group by install_id
  having count(distinct license_instance_id) = 1
     and min(license_instance_id) in (
       select license_instance_id
       from normalized_feedback
       where license_instance_id is not null
       group by license_instance_id
       having count(distinct install_id) = 1
     )
),
latest_feedback as (
  select distinct on (install_id)
    install_id,
    app_version,
    os_version,
    channel,
    event_at
  from normalized_feedback
  order by install_id, event_at desc, app_version desc
),
aggregated_feedback as (
  select
    normalized_feedback.install_id,
    unique_license_candidates.license_instance_id,
    min(normalized_feedback.event_at) as first_seen_at,
    max(normalized_feedback.event_at) as last_seen_at,
    latest_feedback.app_version,
    latest_feedback.os_version,
    latest_feedback.channel
  from normalized_feedback
  join latest_feedback
    on latest_feedback.install_id = normalized_feedback.install_id
  left join unique_license_candidates
    on unique_license_candidates.install_id = normalized_feedback.install_id
  group by
    normalized_feedback.install_id,
    unique_license_candidates.license_instance_id,
    latest_feedback.app_version,
    latest_feedback.os_version,
    latest_feedback.channel
)
insert into public.app_installations (
  install_id,
  license_instance_id,
  app_version,
  os_version,
  channel,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  install_id,
  license_instance_id,
  app_version,
  os_version,
  channel,
  first_seen_at,
  last_seen_at,
  first_seen_at,
  last_seen_at
from aggregated_feedback
on conflict (install_id) do update
set
  first_seen_at = least(public.app_installations.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(public.app_installations.last_seen_at, excluded.last_seen_at),
  app_version = case
    when excluded.last_seen_at >= public.app_installations.last_seen_at then excluded.app_version
    else public.app_installations.app_version
  end,
  os_version = case
    when excluded.last_seen_at >= public.app_installations.last_seen_at then excluded.os_version
    else public.app_installations.os_version
  end,
  channel = case
    when excluded.last_seen_at >= public.app_installations.last_seen_at then excluded.channel
    else public.app_installations.channel
  end,
  license_instance_id = coalesce(public.app_installations.license_instance_id, excluded.license_instance_id),
  updated_at = timezone('utc', now());

update public.app_session_feedback as feedback
set installation_id = installation.id
from public.app_installations as installation
where feedback.installation_id is null
  and nullif(btrim(feedback.install_id), '') is not null
  and installation.install_id = btrim(feedback.install_id);
