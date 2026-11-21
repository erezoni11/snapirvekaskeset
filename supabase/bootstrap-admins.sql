-- Run only in Supabase SQL Editor after the migration and after both users
-- have accepted their site Auth invitations. Replace the two placeholders.
-- An organization/team invitation does not create a site Auth user.
do $$
declare
  sariel_email text := 'REPLACE_WITH_SARIEL_EMAIL';
  erez_email text := 'REPLACE_WITH_EREZ_EMAIL';
begin
  if sariel_email=erez_email or
    (select count(*) from auth.users where lower(email) in (lower(sariel_email),lower(erez_email)) and email_confirmed_at is not null) <> 2 then
    raise exception 'Provide two different, confirmed Auth user emails. No roles were changed.';
  end if;
  insert into public.svk_staff(user_id,display_name,role,active)
  select id,case when lower(email)=lower(sariel_email) then 'Sariel' else 'Erez' end,'admin',true
  from auth.users where lower(email) in (lower(sariel_email),lower(erez_email))
  on conflict(user_id) do update set role='admin',active=true;
end $$;
