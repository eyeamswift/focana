create table if not exists public.app_focus_sessions (
  id uuid primary key default gen_random_uuid(),
  local_session_id text not null,
  installation_id uuid not null references public.app_installations (id),
  install_id text not null,
  license_instance_id text null,
  customer_id uuid null references public.customers (id),
  precision text not null default 'segment_v1' check (precision in ('segment_v1', 'session_only_backfill')),
  mode text not null default 'freeflow' check (mode in ('freeflow', 'timed', 'pomodoro')),
  started_at timestamptz not null,
  ended_at timestamptz null,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  wall_clock_seconds integer not null default 0 check (wall_clock_seconds >= 0),
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  break_seconds integer not null default 0 check (break_seconds >= 0),
  outcome text not null default 'unknown' check (outcome in ('started', 'completed', 'kept', 'saved_for_later', 'done_for_now', 'moved_to_next', 'discarded', 'unknown')),
  completed boolean not null default false,
  kept boolean not null default false,
  task_title text null,
  task_hash text not null,
  task_title_included boolean not null default false,
  weekly_emails_enabled boolean not null default true,
  milestone_emails_enabled boolean not null default true,
  app_version text not null default 'unknown',
  os_version text not null default '',
  channel text not null default 'latest',
  timezone text not null default '',
  client_updated_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (installation_id, local_session_id)
);

create table if not exists public.app_focus_segments (
  id uuid primary key default gen_random_uuid(),
  local_segment_id text not null,
  local_session_id text not null,
  focus_session_id uuid not null references public.app_focus_sessions (id) on delete cascade,
  installation_id uuid not null references public.app_installations (id),
  customer_id uuid null references public.customers (id),
  segment_type text not null check (segment_type in ('main_task', 'subtask')),
  parent_task_title text null,
  parent_task_hash text not null,
  focus_title text null,
  focus_hash text not null,
  focus_title_included boolean not null default false,
  subtask_local_id text null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  completed boolean not null default false,
  completion_event_at timestamptz null,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (installation_id, local_segment_id)
);

create table if not exists public.app_focus_checkins (
  id uuid primary key default gen_random_uuid(),
  local_checkin_id text not null,
  local_session_id text not null,
  focus_session_id uuid not null references public.app_focus_sessions (id) on delete cascade,
  installation_id uuid not null references public.app_installations (id),
  customer_id uuid null references public.customers (id),
  shown_at timestamptz not null,
  responded_at timestamptz null,
  missed_at timestamptz null,
  status text not null check (status in ('focused', 'completed', 'detour', 'missed')),
  elapsed_active_seconds integer not null default 0 check (elapsed_active_seconds >= 0),
  task_title text null,
  task_hash text not null,
  subtask_title text null,
  subtask_hash text null,
  focus_title_included boolean not null default false,
  detour_note_present boolean not null default false,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (installation_id, local_checkin_id)
);

create table if not exists public.app_focus_milestones (
  id uuid primary key default gen_random_uuid(),
  analytics_user_key text not null,
  installation_id uuid null references public.app_installations (id),
  customer_id uuid null references public.customers (id),
  customer_email text null,
  milestone_key text not null,
  milestone_value numeric(12, 2) not null default 0,
  display_label text not null,
  reached_at timestamptz not null default timezone('utc', now()),
  email_sent_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (analytics_user_key, milestone_key)
);

create table if not exists public.app_focus_weekly_emails (
  id uuid primary key default gen_random_uuid(),
  analytics_user_key text not null,
  installation_id uuid null references public.app_installations (id),
  customer_id uuid null references public.customers (id),
  customer_email text null,
  week_start date not null,
  email_sent_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (analytics_user_key, week_start)
);

drop trigger if exists app_focus_sessions_set_updated_at on public.app_focus_sessions;
create trigger app_focus_sessions_set_updated_at
before update on public.app_focus_sessions
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists app_focus_segments_set_updated_at on public.app_focus_segments;
create trigger app_focus_segments_set_updated_at
before update on public.app_focus_segments
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists app_focus_checkins_set_updated_at on public.app_focus_checkins;
create trigger app_focus_checkins_set_updated_at
before update on public.app_focus_checkins
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists app_focus_sessions_started_at_idx
  on public.app_focus_sessions (started_at desc);

create index if not exists app_focus_sessions_installation_started_idx
  on public.app_focus_sessions (installation_id, started_at desc);

create index if not exists app_focus_sessions_customer_started_idx
  on public.app_focus_sessions (customer_id, started_at desc)
  where customer_id is not null;

create index if not exists app_focus_segments_session_idx
  on public.app_focus_segments (focus_session_id);

create index if not exists app_focus_segments_task_hash_idx
  on public.app_focus_segments (parent_task_hash, focus_hash);

create index if not exists app_focus_checkins_session_idx
  on public.app_focus_checkins (focus_session_id);

create index if not exists app_focus_checkins_status_idx
  on public.app_focus_checkins (status);

alter table public.app_focus_sessions enable row level security;
alter table public.app_focus_segments enable row level security;
alter table public.app_focus_checkins enable row level security;
alter table public.app_focus_milestones enable row level security;
alter table public.app_focus_weekly_emails enable row level security;

create or replace view public.app_focus_user_rollups as
with session_identity as (
  select
    s.*,
    c.email as customer_email,
    c.name as customer_name,
    coalesce(
      nullif(btrim(s.license_instance_id), ''),
      nullif(btrim(i.license_instance_id), ''),
      nullif(btrim(s.install_id), ''),
      concat('focus-session:', s.id::text)
    ) as analytics_user_key
  from public.app_focus_sessions as s
  left join public.app_installations as i
    on i.id = s.installation_id
  left join public.customers as c
    on c.id = s.customer_id
),
subtask_completions as (
  select
    focus_session_id,
    count(*) filter (where segment_type = 'subtask' and completed) as completed_subtasks
  from public.app_focus_segments
  group by focus_session_id
),
checkin_counts as (
  select
    focus_session_id,
    count(*) as checkins_shown,
    count(*) filter (where status = 'missed') as missed_checkins,
    count(*) filter (where status = 'detour') as detour_checkins
  from public.app_focus_checkins
  group by focus_session_id
)
select
  analytics_user_key,
  (array_agg(customer_id order by started_at desc, id desc) filter (where customer_id is not null))[1] as customer_id,
  (array_agg(customer_email order by started_at desc, id desc) filter (where customer_email is not null))[1] as customer_email,
  (array_agg(customer_name order by started_at desc, id desc) filter (where customer_name is not null))[1] as customer_name,
  (array_agg(installation_id order by started_at desc, id desc))[1] as installation_id,
  (array_agg(install_id order by started_at desc, id desc))[1] as install_id,
  (array_agg(license_instance_id order by started_at desc, id desc) filter (where license_instance_id is not null))[1] as license_instance_id,
  count(*) as sessions_count,
  count(*) filter (where completed) as completed_tasks_count,
  count(*) filter (where kept) as kept_sessions_count,
  coalesce(sum(active_seconds), 0)::bigint as total_active_seconds,
  coalesce(sum(subtask_completions.completed_subtasks), 0)::bigint as completed_subtasks_count,
  coalesce(sum(checkin_counts.checkins_shown), 0)::bigint as checkins_shown_count,
  coalesce(sum(checkin_counts.missed_checkins), 0)::bigint as missed_checkins_count,
  coalesce(sum(checkin_counts.detour_checkins), 0)::bigint as detour_checkins_count,
  min(started_at) as first_focus_at,
  max(coalesce(ended_at, started_at)) as last_focus_at,
  (array_agg(app_version order by started_at desc, id desc))[1] as last_app_version,
  (array_agg(channel order by started_at desc, id desc))[1] as last_channel,
  (array_agg(weekly_emails_enabled order by started_at desc, id desc))[1] as weekly_emails_enabled,
  (array_agg(milestone_emails_enabled order by started_at desc, id desc))[1] as milestone_emails_enabled
from session_identity
left join subtask_completions
  on subtask_completions.focus_session_id = session_identity.id
left join checkin_counts
  on checkin_counts.focus_session_id = session_identity.id
group by analytics_user_key;

create or replace view public.app_focus_task_rollups as
with segment_identity as (
  select
    coalesce(
      nullif(btrim(s.license_instance_id), ''),
      nullif(btrim(i.license_instance_id), ''),
      nullif(btrim(s.install_id), ''),
      concat('focus-session:', s.id::text)
    ) as analytics_user_key,
    s.customer_id,
    c.email as customer_email,
    s.installation_id,
    g.segment_type,
    g.parent_task_hash,
    g.parent_task_title,
    g.focus_hash,
    g.focus_title,
    g.focus_title_included,
    g.subtask_local_id,
    g.active_seconds,
    g.completed,
    g.started_at,
    coalesce(g.ended_at, g.started_at) as ended_at
  from public.app_focus_segments as g
  join public.app_focus_sessions as s
    on s.id = g.focus_session_id
  left join public.app_installations as i
    on i.id = s.installation_id
  left join public.customers as c
    on c.id = s.customer_id
)
select
  analytics_user_key,
  (array_agg(customer_id order by ended_at desc) filter (where customer_id is not null))[1] as customer_id,
  (array_agg(customer_email order by ended_at desc) filter (where customer_email is not null))[1] as customer_email,
  (array_agg(installation_id order by ended_at desc))[1] as installation_id,
  segment_type,
  parent_task_hash,
  (array_agg(parent_task_title order by ended_at desc) filter (where parent_task_title is not null))[1] as parent_task_title,
  focus_hash,
  (array_agg(focus_title order by ended_at desc) filter (where focus_title is not null))[1] as focus_title,
  bool_or(focus_title_included) as focus_title_included,
  subtask_local_id,
  coalesce(sum(active_seconds), 0)::bigint as total_active_seconds,
  count(*) as segment_count,
  count(*) filter (where completed) as completed_count,
  min(started_at) as first_seen_at,
  max(ended_at) as last_seen_at
from segment_identity
group by
  analytics_user_key,
  segment_type,
  parent_task_hash,
  focus_hash,
  subtask_local_id;

create or replace view public.app_focus_weekly_rollups as
with weekly_sessions as (
  select
    coalesce(
      nullif(btrim(s.license_instance_id), ''),
      nullif(btrim(i.license_instance_id), ''),
      nullif(btrim(s.install_id), ''),
      concat('focus-session:', s.id::text)
    ) as analytics_user_key,
    date_trunc('week', s.started_at)::date as week_start,
    (date_trunc('week', s.started_at)::date + 6) as week_end,
    s.id,
    s.installation_id,
    s.customer_id,
    c.email as customer_email,
    c.name as customer_name,
    s.active_seconds,
    s.completed,
    s.kept,
    s.started_at,
    s.app_version,
    s.channel,
    s.weekly_emails_enabled,
    s.milestone_emails_enabled
  from public.app_focus_sessions as s
  left join public.app_installations as i
    on i.id = s.installation_id
  left join public.customers as c
    on c.id = s.customer_id
),
weekly_checkins as (
  select
    weekly_sessions.analytics_user_key,
    weekly_sessions.week_start,
    count(ch.id) as checkins_shown,
    count(ch.id) filter (where ch.status = 'missed') as missed_checkins,
    count(ch.id) filter (where ch.status = 'detour') as detour_checkins
  from weekly_sessions
  left join public.app_focus_checkins as ch
    on ch.focus_session_id = weekly_sessions.id
  group by weekly_sessions.analytics_user_key, weekly_sessions.week_start
),
weekly_subtasks as (
  select
    weekly_sessions.analytics_user_key,
    weekly_sessions.week_start,
    count(g.id) filter (where g.segment_type = 'subtask' and g.completed) as completed_subtasks
  from weekly_sessions
  left join public.app_focus_segments as g
    on g.focus_session_id = weekly_sessions.id
  group by weekly_sessions.analytics_user_key, weekly_sessions.week_start
),
task_totals as (
  select
    weekly_sessions.analytics_user_key,
    weekly_sessions.week_start,
    g.parent_task_hash,
    (array_agg(g.parent_task_title order by coalesce(g.ended_at, g.started_at) desc) filter (where g.parent_task_title is not null))[1] as task_title,
    sum(g.active_seconds)::bigint as active_seconds
  from weekly_sessions
  join public.app_focus_segments as g
    on g.focus_session_id = weekly_sessions.id
  group by weekly_sessions.analytics_user_key, weekly_sessions.week_start, g.parent_task_hash
),
ranked_tasks as (
  select
    *,
    row_number() over (
      partition by analytics_user_key, week_start
      order by active_seconds desc, parent_task_hash asc
    ) as task_rank
  from task_totals
)
select
  weekly_sessions.analytics_user_key,
  weekly_sessions.week_start,
  weekly_sessions.week_end,
  (array_agg(weekly_sessions.customer_id order by weekly_sessions.started_at desc) filter (where weekly_sessions.customer_id is not null))[1] as customer_id,
  (array_agg(weekly_sessions.customer_email order by weekly_sessions.started_at desc) filter (where weekly_sessions.customer_email is not null))[1] as customer_email,
  (array_agg(weekly_sessions.customer_name order by weekly_sessions.started_at desc) filter (where weekly_sessions.customer_name is not null))[1] as customer_name,
  (array_agg(weekly_sessions.installation_id order by weekly_sessions.started_at desc))[1] as installation_id,
  count(*) as sessions_count,
  count(*) filter (where weekly_sessions.completed) as completed_tasks_count,
  count(*) filter (where weekly_sessions.kept) as kept_sessions_count,
  coalesce(sum(weekly_sessions.active_seconds), 0)::bigint as total_active_seconds,
  coalesce(max(weekly_subtasks.completed_subtasks), 0)::bigint as completed_subtasks_count,
  coalesce(max(weekly_checkins.checkins_shown), 0)::bigint as checkins_shown_count,
  coalesce(max(weekly_checkins.missed_checkins), 0)::bigint as missed_checkins_count,
  coalesce(max(weekly_checkins.detour_checkins), 0)::bigint as detour_checkins_count,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'taskHash', ranked_tasks.parent_task_hash,
      'taskTitle', ranked_tasks.task_title,
      'activeSeconds', ranked_tasks.active_seconds
    ) order by ranked_tasks.task_rank)
    from ranked_tasks
    where ranked_tasks.analytics_user_key = weekly_sessions.analytics_user_key
      and ranked_tasks.week_start = weekly_sessions.week_start
      and ranked_tasks.task_rank <= 3
  ), '[]'::jsonb) as top_tasks,
  max(weekly_sessions.started_at) as last_focus_at,
  (array_agg(weekly_sessions.app_version order by weekly_sessions.started_at desc))[1] as last_app_version,
  (array_agg(weekly_sessions.channel order by weekly_sessions.started_at desc))[1] as last_channel,
  (array_agg(weekly_sessions.weekly_emails_enabled order by weekly_sessions.started_at desc))[1] as weekly_emails_enabled
from weekly_sessions
left join weekly_checkins
  on weekly_checkins.analytics_user_key = weekly_sessions.analytics_user_key
  and weekly_checkins.week_start = weekly_sessions.week_start
left join weekly_subtasks
  on weekly_subtasks.analytics_user_key = weekly_sessions.analytics_user_key
  and weekly_subtasks.week_start = weekly_sessions.week_start
group by weekly_sessions.analytics_user_key, weekly_sessions.week_start, weekly_sessions.week_end;

comment on table public.app_focus_sessions is
  'Privacy-aware session ledger synced from Focana desktop after Focus Insights consent.';

comment on table public.app_focus_segments is
  'Active-time segments for main task and visible subtask focus; historical backfills may not have segment precision.';

comment on table public.app_focus_checkins is
  'Check-in outcomes synced without raw detour note text.';
