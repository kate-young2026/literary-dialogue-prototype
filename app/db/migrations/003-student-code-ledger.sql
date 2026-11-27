-- Preparation only: this ledger does not enable code login or revoke Auth sessions.
-- Apply only to a test database after review; it is not an operational migration yet.
begin;
create table public.ld_student_code_ledger (
  id bigint generated always as identity primary key,
  class_id uuid not null,
  student_id uuid not null,
  issued_by uuid not null references public.ld_profiles(id),
  code_digest text not null check (code_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (class_id, student_id) references public.ld_memberships(class_id, student_id)
);
create unique index ld_student_code_active_student on public.ld_student_code_ledger(class_id,student_id) where revoked_at is null;
create unique index ld_student_code_active_digest on public.ld_student_code_ledger(code_digest) where revoked_at is null;
alter table public.ld_student_code_ledger enable row level security;
revoke all on public.ld_student_code_ledger from public, anon, authenticated;
revoke all on sequence public.ld_student_code_ledger_id_seq from public, anon, authenticated;

-- Server-side callers must authenticate the teacher; no student can call this directly.
-- Reissuing serializes on the membership row and revokes the prior ledger entry.
create function public.ld_record_student_code(p_teacher uuid,p_class uuid,p_student uuid,p_digest text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid code digest' using errcode='22023';
  end if;
  perform 1 from public.ld_memberships m join public.ld_classes c on c.id=m.class_id
    join public.ld_profiles p on p.id=c.teacher_id
    where m.class_id=p_class and m.student_id=p_student and c.teacher_id=p_teacher and p.role='teacher'
    for update of m;
  if not found then raise exception 'Not a teacher for this student' using errcode='42501'; end if;
  update public.ld_student_code_ledger set revoked_at=now()
    where class_id=p_class and student_id=p_student and revoked_at is null;
  insert into public.ld_student_code_ledger(class_id,student_id,issued_by,code_digest)
    values(p_class,p_student,p_teacher,p_digest);
end $$;
revoke all on function public.ld_record_student_code(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ld_record_student_code(uuid,uuid,uuid,text) to service_role;
commit;
