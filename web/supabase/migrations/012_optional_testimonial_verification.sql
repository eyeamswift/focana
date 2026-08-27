alter table public.testimonials
  add column if not exists submitted_email text null,
  add column if not exists access_verified boolean not null default false;

update public.testimonials
set
  submitted_email = coalesce(submitted_email, verified_email),
  access_verified = true
where verified_email is not null;

alter table public.testimonials
  alter column verification_source drop not null,
  alter column verification_source_id drop not null,
  alter column verified_email drop not null;

create index if not exists testimonials_submitted_email_idx
  on public.testimonials (lower(submitted_email))
  where submitted_email is not null;

comment on column public.testimonials.submitted_email is
  'Optional email supplied after the testimonial. It may be unmatched and is never a publishing attribution.';

comment on column public.testimonials.access_verified is
  'True only when submitted_email matched an existing customer, beta download, or claimed friends-and-family record at submission time.';

comment on table public.testimonials is
  'Manually reviewed testimonials from verified or unverified submitters. Nothing is public solely because a row exists here.';
