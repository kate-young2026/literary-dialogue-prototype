-- Apply once to the existing test project after checking that ld_classes exists.
begin;
alter table public.ld_classes add column school text not null default '' check (length(school)<=100);
grant update (school) on public.ld_classes to authenticated;
create policy classes_update_school on public.ld_classes for update to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
commit;
