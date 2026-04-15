alter table public.friends_and_family_invites
  add column if not exists email text;

update public.friends_and_family_invites
set email = lower(claimed_email)
where email is null
  and claimed_email is not null;

create unique index if not exists friends_and_family_invites_email_unique_idx
  on public.friends_and_family_invites (lower(email));

do $$
begin
  if exists (
    select 1
    from public.friends_and_family_invites
    where email is null
  ) then
    raise notice 'friends_and_family_invites.email remains nullable until all existing rows have email values.';
  else
    alter table public.friends_and_family_invites
      alter column email set not null;
  end if;
end
$$;
