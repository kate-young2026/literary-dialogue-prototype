-- 별도 교사 작품 자료함. 기존 작품과 과제는 변경하지 않습니다.
begin;
create table public.ld_teacher_works (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.ld_profiles(id),
 title text not null check(length(trim(title)) between 1 and 200),
 author text not null check(length(trim(author)) between 1 and 100),
 genre text not null default '' check(length(genre)<=100),
 description text not null check(length(trim(description)) between 1 and 4000),
 source_url text not null check(source_url ~ '^https://' and length(source_url)<=2000),
 rights_note text not null check(length(trim(rights_note)) between 1 and 500),
 created_at timestamptz not null default now()
);
alter table public.ld_teacher_works enable row level security;
revoke all on public.ld_teacher_works from public,anon,authenticated;
grant select,insert on public.ld_teacher_works to authenticated;
create policy teacher_works_select on public.ld_teacher_works for select to authenticated using (teacher_id=auth.uid() and exists(select 1 from public.ld_profiles p where p.id=auth.uid() and p.role='teacher'));
create policy teacher_works_insert on public.ld_teacher_works for insert to authenticated with check (teacher_id=auth.uid() and exists(select 1 from public.ld_profiles p where p.id=auth.uid() and p.role='teacher'));
commit;
