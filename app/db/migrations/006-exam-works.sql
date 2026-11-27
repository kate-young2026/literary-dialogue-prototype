-- Run only on the intended Supabase project after reviewing permissions.
-- Separate teacher-owned index; existing literary_works is not modified.
begin;
create table if not exists public.ld_exam_works (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.ld_profiles(id),
  exam_year integer not null check (exam_year between 1994 and 2100),
  exam_variant text not null default '' check (length(exam_variant)<=30),
  genre text not null check (genre in ('현대시','현대소설','현대극·수필','고전운문','고전산문','기타')),
  title text not null check (length(trim(title)) between 1 and 200),
  author text not null default '' check (length(author)<=100),
  source_url text not null check (source_url ~ '^https://' and length(source_url)<=2000),
  source_note text not null default '' check (length(source_note)<=300),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ld_exam_works enable row level security;
revoke all on public.ld_exam_works from public,anon,authenticated;
grant select,insert,update on public.ld_exam_works to authenticated;
create policy exam_works_teacher_read on public.ld_exam_works for select to authenticated using (teacher_id=auth.uid() and exists(select 1 from public.ld_profiles p where p.id=auth.uid() and p.role='teacher'));
create policy exam_works_teacher_insert on public.ld_exam_works for insert to authenticated with check (teacher_id=auth.uid() and exists(select 1 from public.ld_profiles p where p.id=auth.uid() and p.role='teacher'));
create policy exam_works_teacher_update on public.ld_exam_works for update to authenticated using (teacher_id=auth.uid() and exists(select 1 from public.ld_profiles p where p.id=auth.uid() and p.role='teacher')) with check (teacher_id=auth.uid());
commit;
