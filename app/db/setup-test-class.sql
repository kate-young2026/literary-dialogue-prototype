-- TEST PROJECT ONLY. First create two distinct, fictional email/password users
-- in Supabase Authentication. Replace only the two placeholders below.
-- Never put real student information or passwords in this file.
begin;
do $$
declare
  teacher_email text := 'teacher@example.invalid';
  student_email text := 'student@example.invalid';
  teacher_uuid uuid;
  student_uuid uuid;
  class_uuid uuid;
  class_count integer;
begin
  if teacher_email like '%@example.invalid' or student_email like '%@example.invalid'
     or lower(teacher_email)=lower(student_email) then
    raise exception 'Replace the two placeholders with distinct test account emails';
  end if;
  select id into strict teacher_uuid from auth.users where lower(email)=lower(teacher_email);
  select id into strict student_uuid from auth.users where lower(email)=lower(student_email);
  if exists(select 1 from public.ld_profiles where id=teacher_uuid and role<>'teacher')
     or exists(select 1 from public.ld_profiles where id=student_uuid and role<>'student') then
    raise exception 'An existing profile has a different role; no changes were made';
  end if;
  insert into public.ld_profiles(id,display_name,role)
    values (teacher_uuid,'시험 교사','teacher'),(student_uuid,'시험 학생','student')
    on conflict (id) do nothing;
  select count(*) into class_count from public.ld_classes
    where teacher_id=teacher_uuid and name='프로토타입 시험 학급';
  if class_count>1 then raise exception 'Multiple matching test classes exist'; end if;
  if class_count=0 then
    insert into public.ld_classes(teacher_id,name)
      values (teacher_uuid,'프로토타입 시험 학급') returning id into class_uuid;
  else
    select id into strict class_uuid from public.ld_classes
      where teacher_id=teacher_uuid and name='프로토타입 시험 학급';
  end if;
  insert into public.ld_memberships(class_id,student_id) values (class_uuid,student_uuid)
    on conflict (class_id,student_id) do nothing;
end $$;
commit;
