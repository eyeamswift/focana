create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid null references public.customers (id) on delete set null,
  verification_source text not null
    check (verification_source in ('customer', 'beta', 'friends_family')),
  verification_source_id uuid not null,
  verified_email text not null,
  first_name text not null,
  last_name text null,
  attribution_preference text not null
    check (attribution_preference in ('first_name', 'first_last_initial', 'anonymous')),
  selected_features text[] not null,
  other_feature text null,
  feature_story text not null,
  recommendation_quote text null,
  consent_website boolean not null default false,
  consent_social boolean not null default false,
  consent_launch_materials boolean not null default false,
  editing_consent boolean not null default false,
  consent_version text not null,
  consented_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'superseded', 'withdrawn')),
  approved_feature_story text null,
  approved_recommendation_quote text null,
  approved_at timestamptz null,
  published_at timestamptz null,
  withdrawn_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(first_name)) between 1 and 80),
  check (last_name is null or char_length(btrim(last_name)) between 1 and 80),
  check (char_length(feature_story) between 20 and 4000),
  check (recommendation_quote is null or char_length(recommendation_quote) <= 2000),
  check (other_feature is null or char_length(other_feature) <= 160),
  check (cardinality(selected_features) between 1 and 2),
  check (
    selected_features <@ array[
      'always_visible',
      'gentle_checkins',
      'parking_lot',
      'session_history',
      'quick_start',
      'other'
    ]::text[]
  ),
  check (not ('other' = any(selected_features)) or nullif(btrim(other_feature), '') is not null),
  check (consent_website or consent_social or consent_launch_materials)
);

create index if not exists testimonials_verified_email_idx
  on public.testimonials (lower(verified_email));

create index if not exists testimonials_customer_id_idx
  on public.testimonials (customer_id)
  where customer_id is not null;

create index if not exists testimonials_status_submitted_idx
  on public.testimonials (status, created_at desc);

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
before update on public.testimonials
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.testimonial_consent_events (
  id uuid primary key default gen_random_uuid(),
  testimonial_id uuid not null references public.testimonials (id) on delete cascade,
  event_type text not null check (event_type in ('granted', 'updated', 'withdrawn')),
  consent_version text not null,
  consent_website boolean not null,
  consent_social boolean not null,
  consent_launch_materials boolean not null,
  editing_consent boolean not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists testimonial_consent_events_testimonial_created_idx
  on public.testimonial_consent_events (testimonial_id, created_at desc);

alter table public.testimonials enable row level security;
alter table public.testimonial_consent_events enable row level security;

comment on table public.testimonials is
  'Verified, manually reviewed customer testimonials. Nothing is public solely because a row exists here.';

comment on table public.testimonial_consent_events is
  'Append-only history of testimonial publishing and editing permissions.';
