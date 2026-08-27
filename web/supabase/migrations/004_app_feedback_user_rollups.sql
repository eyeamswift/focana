create or replace view public.app_feedback_user_rollups as
with feedback_enriched as (
  select
    f.id as feedback_id,
    f.session_id,
    f.feedback,
    f.surface,
    f.completion_type,
    f.session_mode,
    f.session_duration_minutes,
    f.client_created_at,
    f.received_at,
    f.app_version,
    f.os_version,
    f.channel,
    nullif(btrim(f.install_id), '') as raw_install_id,
    nullif(btrim(f.license_instance_id), '') as raw_license_instance_id,
    f.installation_id,
    i.install_id as installation_install_id,
    nullif(btrim(i.license_instance_id), '') as installation_license_instance_id,
    cli.customer_id,
    c.email as customer_email,
    c.name as customer_name
  from public.app_session_feedback as f
  left join public.app_installations as i
    on i.id = f.installation_id
  left join public.customer_license_instances as cli
    on cli.license_instance_id = coalesce(
      nullif(btrim(i.license_instance_id), ''),
      nullif(btrim(f.license_instance_id), '')
    )
  left join public.customers as c
    on c.id = cli.customer_id
),
normalized_feedback as (
  select
    feedback_id,
    session_id,
    feedback,
    surface,
    completion_type,
    session_mode,
    session_duration_minutes,
    coalesce(client_created_at, received_at) as event_at,
    app_version,
    os_version,
    channel,
    installation_id,
    coalesce(installation_license_instance_id, raw_license_instance_id) as license_instance_id,
    coalesce(installation_install_id, raw_install_id) as install_id,
    customer_id,
    customer_email,
    customer_name
  from feedback_enriched
),
identified_feedback as (
  select
    *,
    coalesce(
      license_instance_id,
      install_id,
      concat('feedback:', feedback_id)
    ) as analytics_user_key,
    case
      when customer_id is not null and license_instance_id is not null then 'customer_license'
      when customer_id is not null and install_id is not null then 'customer_install'
      when license_instance_id is not null then 'license_instance'
      when install_id is not null then 'install'
      else 'feedback_row'
    end as user_resolution
  from normalized_feedback
)
select
  analytics_user_key,
  user_resolution,
  (array_agg(customer_id order by event_at desc, feedback_id desc) filter (where customer_id is not null))[1] as customer_id,
  (array_agg(customer_email order by event_at desc, feedback_id desc) filter (where customer_email is not null))[1] as customer_email,
  (array_agg(customer_name order by event_at desc, feedback_id desc) filter (where customer_name is not null))[1] as customer_name,
  (array_agg(license_instance_id order by event_at desc, feedback_id desc) filter (where license_instance_id is not null))[1] as license_instance_id,
  (array_agg(install_id order by event_at desc, feedback_id desc) filter (where install_id is not null))[1] as install_id,
  count(distinct installation_id) filter (where installation_id is not null) as installation_count,
  count(*) as feedback_row_count,
  count(*) filter (where feedback = 'up') as thumbs_up_count,
  count(*) filter (where feedback = 'down') as thumbs_down_count,
  count(distinct session_id) filter (where session_id is not null) as distinct_feedback_session_count,
  count(*) filter (where session_mode = 'timed') as timed_feedback_count,
  count(*) filter (where session_mode = 'freeflow') as freeflow_feedback_count,
  count(*) filter (where completion_type = 'completed') as completed_feedback_count,
  count(*) filter (where completion_type = 'kept') as kept_feedback_count,
  round(sum(session_duration_minutes)::numeric, 2) as total_feedback_session_minutes,
  round(avg(session_duration_minutes)::numeric, 2) as avg_feedback_session_minutes,
  min(event_at) as first_feedback_at,
  max(event_at) as last_feedback_at,
  (array_agg(app_version order by event_at desc, feedback_id desc))[1] as last_app_version,
  (array_agg(os_version order by event_at desc, feedback_id desc))[1] as last_os_version,
  (array_agg(channel order by event_at desc, feedback_id desc))[1] as last_channel
from identified_feedback
group by analytics_user_key, user_resolution;

comment on view public.app_feedback_user_rollups is
  'Per-analytics-user feedback rollups. analytics_user_key matches the PostHog distinct_id strategy: license_instance_id first, then install_id, then a feedback-row fallback.';
