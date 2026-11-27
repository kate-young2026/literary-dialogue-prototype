-- Server-only lookup. Apply only after testing the complete login and issuance flow.
begin;
create function public.ld_find_student_code(p_class uuid,p_digest text)
returns table(credential_id bigint,student_id uuid)
language sql stable security definer set search_path = '' as $$
  select l.id,l.student_id from public.ld_student_code_ledger l
  where l.class_id=p_class and l.code_digest=p_digest and l.revoked_at is null
$$;
revoke all on function public.ld_find_student_code(uuid,text) from public,anon,authenticated;
grant execute on function public.ld_find_student_code(uuid,text) to service_role;
commit;
