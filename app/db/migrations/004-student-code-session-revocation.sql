-- Test-only until the server registers verified Supabase session IDs on code login.
-- Applying this without that server integration locks out code-issued students.
begin;
create table public.ld_student_code_sessions (
  session_id uuid primary key,
  credential_id bigint not null references public.ld_student_code_ledger(id),
  student_id uuid not null references public.ld_profiles(id),
  created_at timestamptz not null default now()
);
alter table public.ld_student_code_sessions enable row level security;
revoke all on public.ld_student_code_sessions from public, anon, authenticated;

-- Only a trusted server may register a session, after verifying the Auth response.
-- The row lock serializes registration with code reissuance.
create function public.ld_register_code_session(p_credential bigint,p_student uuid,p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_session is null then return false; end if;
  perform 1 from public.ld_student_code_ledger l
    where l.id=p_credential and l.student_id=p_student and l.revoked_at is null for update;
  if not found then return false; end if;
  insert into public.ld_student_code_sessions(session_id,credential_id,student_id)
    values(p_session,p_credential,p_student) on conflict do nothing;
  return found;
end $$;
revoke all on function public.ld_register_code_session(bigint,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ld_register_code_session(bigint,uuid,uuid) to service_role;

-- A code-issued account can only use a session registered for its current code.
-- No ledger history preserves the existing Auth flow for non-code accounts.
create function public.ld_code_session_valid()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    not exists (select 1 from public.ld_student_code_ledger l where l.student_id=auth.uid())
    or exists (
      select 1 from public.ld_student_code_sessions s
      join public.ld_student_code_ledger l on l.id=s.credential_id and l.student_id=s.student_id
      where s.student_id=auth.uid() and l.revoked_at is null
        and s.session_id::text=auth.jwt()->>'session_id'
    )
  )
$$;
revoke all on function public.ld_code_session_valid() from public,anon;
grant execute on function public.ld_code_session_valid() to authenticated;

-- These existing SECURITY DEFINER helpers are also callable through RPC and
-- bypass table RLS; gate them before they expose student session metadata.
create or replace function public.ld_owns_session(p_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.ld_code_session_valid() and exists(
    select 1 from ld_sessions where id=p_session and student_id=auth.uid())
$$;
create or replace function public.ld_member_of(p_class uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.ld_code_session_valid() and exists(
    select 1 from ld_memberships where class_id=p_class and student_id=auth.uid())
$$;

-- Restrictive policies combine with, rather than replace, existing ownership policies.
do $$
declare t record;
begin
  for t in select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and c.relname like 'ld\_%' escape '\'
      and c.relname not in ('ld_student_code_ledger','ld_student_code_sessions')
  loop
    execute format('create policy ld_code_session_gate on public.%I as restrictive for all to authenticated using (public.ld_code_session_valid()) with check (public.ld_code_session_valid())',t.relname);
  end loop;
end $$;
create policy ld_voice_code_session_gate on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'ld-voice' or public.ld_code_session_valid())
  with check (bucket_id <> 'ld-voice' or public.ld_code_session_valid());
commit;
