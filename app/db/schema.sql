-- Run in the project's Supabase SQL editor after reviewing school policies.
-- Does not alter the existing public.literary_works table.
begin;
create table if not exists public.ld_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('student','teacher'))
);
create table if not exists public.ld_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.ld_profiles(id),
  name text not null
);
create table if not exists public.ld_memberships (
  class_id uuid not null references public.ld_classes(id),
  student_id uuid not null references public.ld_profiles(id),
  primary key (class_id, student_id)
);
create table if not exists public.ld_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.ld_classes(id),
  work_id bigint references public.literary_works(id),
  title text not null,
  prompt text not null,
  standard_code text not null default '10공국1-05-02',
  material jsonb not null default '{}'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  rubric_confirmed boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (not published or rubric_confirmed)
);
create table if not exists public.ld_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.ld_assignments(id),
  student_id uuid not null references public.ld_profiles(id),
  character text not null check (character in ('지민','김은하','김초엽 작가 AI')),
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create table if not exists public.ld_turn_exceptions (
  session_id uuid primary key references public.ld_sessions(id),
  teacher_id uuid not null references public.ld_profiles(id),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table if not exists public.ld_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ld_sessions(id),
  turn_index integer not null check (turn_index > 0),
  role text not null check (role in ('student','assistant')),
  content text not null check (length(trim(content)) > 0),
  recording_id uuid,
  transcript_original text,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index, role)
);
create table if not exists public.ld_recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ld_sessions(id),
  turn_index integer not null check (turn_index > 0),
  version integer not null check (version between 1 and 4),
  object_path text not null unique,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index, version)
);
create table if not exists public.ld_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ld_sessions(id),
  message_id uuid not null references public.ld_messages(id),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.ld_messages add constraint ld_message_recording_fk foreign key (recording_id) references public.ld_recordings(id);
create table if not exists public.ld_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ld_sessions(id),
  version integer not null check (version in (1,2)),
  content text not null check (length(trim(content)) > 0),
  character_count integer not null check (character_count between 1 and 300),
  created_at timestamptz not null default now(),
  unique (session_id, version)
);
create table if not exists public.ld_summary_drafts (
  session_id uuid not null references public.ld_sessions(id),
  version integer not null check (version in (1,2)),
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (session_id,version)
);
create table if not exists public.ld_summary_draft_versions (
  session_id uuid not null references public.ld_sessions(id),
  version integer not null check (version between 1 and 3),
  content text not null,
  created_at timestamptz not null default now(),
  primary key (session_id,version)
);
create table if not exists public.ld_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.ld_submissions(id),
  author_id uuid not null references public.ld_profiles(id),
  teacher_text text not null check (length(trim(teacher_text)) > 0),
  published_at timestamptz not null,
  score numeric(6,2),
  score_max numeric(6,2),
  check ((score is null and score_max is null) or (score is not null and score_max is not null and score_max>0 and score>=0 and score<=score_max)),
  created_at timestamptz not null default now()
);
create table if not exists public.ld_teacher_feedback_drafts (
  submission_id uuid not null references public.ld_submissions(id),
  author_id uuid not null references public.ld_profiles(id),
  content text not null default '',
  score_text text not null default '' check (length(score_text)<=7),
  score_max_text text not null default '' check (length(score_max_text)<=7),
  updated_at timestamptz not null default now(),
  primary key (submission_id, author_id)
);
create table if not exists public.ld_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.ld_submissions(id),
  content text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ld_rubric_drafts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.ld_classes(id),
  author_id uuid not null references public.ld_profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ld_assignments add column if not exists rubric_draft_id uuid references public.ld_rubric_drafts(id);

-- Serialize message and submission inserts for each session. Server checks alone
-- cannot prevent a message and a summary racing in separate transactions.
create or replace function public.ld_guard_session_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.session_id::text, 0));
  if tg_table_name='ld_messages' then
    if exists(select 1 from ld_submissions where session_id=new.session_id) then
      raise exception 'Cannot add a message after submission' using errcode='23514';
    end if;
    if new.role='assistant' and not exists(select 1 from ld_messages
        where session_id=new.session_id and turn_index=new.turn_index and role='student') then
      raise exception 'Assistant reply requires a student message' using errcode='23514';
    end if;
  elsif tg_table_name='ld_submissions' then
    if (select count(*) from ld_messages s join ld_messages a
        on a.session_id=s.session_id and a.turn_index=s.turn_index and a.role='assistant'
        where s.session_id=new.session_id and s.role='student') < 10
        and not exists(select 1 from ld_turn_exceptions where session_id=new.session_id) then
      raise exception 'At least ten completed turns are required' using errcode='23514';
    end if;
    if exists(select 1 from ld_messages s where s.session_id=new.session_id and s.role='student'
        and not exists(select 1 from ld_messages a where a.session_id=s.session_id
          and a.turn_index=s.turn_index and a.role='assistant')) then
      raise exception 'An assistant reply is still pending' using errcode='23514';
    end if;
    if new.version=2 and not exists(select 1 from ld_submissions first
        join ld_feedback f on f.submission_id=first.id and f.published_at is not null
        where first.session_id=new.session_id and first.version=1) then
      raise exception 'Published first feedback is required' using errcode='23514';
    end if;
  end if;
  return new;
end
$$;
create trigger ld_guard_messages before insert on public.ld_messages
  for each row execute function public.ld_guard_session_insert();
create trigger ld_guard_submissions before insert on public.ld_submissions
  for each row execute function public.ld_guard_session_insert();

-- Non-recursive membership checks execute as the function owner.
create or replace function public.ld_teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from ld_memberships m join ld_classes c on c.id=m.class_id
    where m.student_id=p_student and c.teacher_id=auth.uid())
$$;
create or replace function public.ld_member_of(p_class uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from ld_memberships where class_id=p_class and student_id=auth.uid())
$$;
create or replace function public.ld_teaches_class(p_class uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from ld_classes where id=p_class and teacher_id=auth.uid())
$$;
create or replace function public.ld_owns_session(p_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from ld_sessions where id=p_session and student_id=auth.uid())
$$;
create or replace function public.ld_teaches_session(p_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from ld_sessions s join ld_assignments a on a.id=s.assignment_id
    join ld_classes c on c.id=a.class_id where s.id=p_session and c.teacher_id=auth.uid())
$$;
create or replace function public.ld_has_turn_exception(p_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select (public.ld_owns_session(p_session) or public.ld_teaches_session(p_session))
    and exists(select 1 from ld_turn_exceptions where session_id=p_session)
$$;
revoke all on function public.ld_has_turn_exception(uuid) from public, anon;
grant execute on function public.ld_has_turn_exception(uuid) to authenticated;
create or replace function public.ld_can_start_turn(p_session uuid,p_turn integer)
returns boolean language sql stable security definer set search_path=public as $$
  select public.ld_owns_session(p_session)
    and not exists(select 1 from ld_submissions where session_id=p_session)
    and p_turn=coalesce((select max(turn_index) from ld_messages where session_id=p_session),0)+1
    and (p_turn=1 or exists(select 1 from ld_messages where session_id=p_session and turn_index=p_turn-1 and role='assistant'))
$$;
create or replace function public.ld_next_recording_version(p_session uuid,p_turn integer)
returns integer language sql stable security definer set search_path=public as $$
  select case when public.ld_owns_session(p_session) then coalesce(max(version),0)+1 else null end
    from ld_recordings where session_id=p_session and turn_index=p_turn
$$;
create or replace function public.ld_next_summary_draft(p_session uuid)
returns integer language sql stable security definer set search_path=public as $$
  select case when public.ld_owns_session(p_session)
    and not exists(select 1 from ld_submissions where session_id=p_session)
    then coalesce(max(version),0)+1 else null end
    from ld_summary_draft_versions where session_id=p_session
$$;

alter table public.ld_profiles enable row level security;
alter table public.ld_classes enable row level security;
alter table public.ld_memberships enable row level security;
alter table public.ld_assignments enable row level security;
alter table public.ld_sessions enable row level security;
alter table public.ld_turn_exceptions enable row level security;
alter table public.ld_messages enable row level security;
alter table public.ld_recordings enable row level security;
alter table public.ld_reports enable row level security;
alter table public.ld_submissions enable row level security;
alter table public.ld_summary_drafts enable row level security;
alter table public.ld_summary_draft_versions enable row level security;
alter table public.ld_feedback enable row level security;
alter table public.ld_teacher_feedback_drafts enable row level security;
alter table public.ld_ai_drafts enable row level security;
alter table public.ld_rubric_drafts enable row level security;
revoke all on public.ld_profiles, public.ld_classes, public.ld_memberships, public.ld_assignments,
  public.ld_sessions, public.ld_turn_exceptions, public.ld_messages, public.ld_recordings, public.ld_reports, public.ld_submissions, public.ld_summary_drafts, public.ld_summary_draft_versions, public.ld_feedback, public.ld_teacher_feedback_drafts, public.ld_ai_drafts, public.ld_rubric_drafts from public, anon, authenticated;
grant select on public.ld_profiles, public.ld_classes, public.ld_memberships, public.ld_assignments to authenticated;
grant select, insert on public.ld_sessions, public.ld_messages, public.ld_recordings to authenticated;
grant select, insert on public.ld_turn_exceptions to authenticated;
grant select, insert on public.ld_reports to authenticated;
grant select on public.ld_submissions to authenticated;
grant select, insert, update on public.ld_summary_drafts to authenticated;
grant select, insert on public.ld_summary_draft_versions to authenticated;
grant select, insert on public.ld_feedback to authenticated;
grant select, insert, update on public.ld_teacher_feedback_drafts to authenticated;
grant select on public.ld_ai_drafts to authenticated;
grant select on public.ld_rubric_drafts to authenticated;
-- Published assignments are immutable: changes require a new assignment/version.
grant insert on public.ld_assignments to authenticated;

create policy profiles_read on public.ld_profiles for select to authenticated using (id=auth.uid() or public.ld_teaches_student(id));
create policy classes_read on public.ld_classes for select to authenticated using (teacher_id=auth.uid() or public.ld_member_of(id));
create policy memberships_read on public.ld_memberships for select to authenticated using (student_id=auth.uid() or public.ld_teaches_class(class_id));
create policy assignments_read on public.ld_assignments for select to authenticated using (exists(select 1 from public.ld_classes c where c.id=class_id and c.teacher_id=auth.uid()) or (published and exists(select 1 from public.ld_memberships m where m.class_id=ld_assignments.class_id and m.student_id=auth.uid())));
create policy assignments_create on public.ld_assignments for insert to authenticated with check (
  public.ld_teaches_class(class_id)
  and (rubric_draft_id is null or exists(select 1 from public.ld_rubric_drafts d where d.id=rubric_draft_id and d.class_id=ld_assignments.class_id))
);
create policy sessions_read on public.ld_sessions for select to authenticated using (student_id=auth.uid() or public.ld_teaches_session(id));
create policy sessions_create on public.ld_sessions for insert to authenticated with check (student_id=auth.uid() and exists(select 1 from public.ld_assignments a join public.ld_memberships m on m.class_id=a.class_id where a.id=assignment_id and a.published and m.student_id=auth.uid()));
create policy turn_exceptions_read on public.ld_turn_exceptions for select to authenticated using (public.ld_teaches_session(session_id));
create policy turn_exceptions_create on public.ld_turn_exceptions for insert to authenticated with check (teacher_id=auth.uid() and public.ld_teaches_session(session_id));
create policy messages_read on public.ld_messages for select to authenticated using (public.ld_owns_session(session_id) or public.ld_teaches_session(session_id));
create policy messages_create on public.ld_messages for insert to authenticated with check (
  role='student' and public.ld_can_start_turn(session_id,turn_index)
  and (recording_id is null or exists(select 1 from public.ld_recordings r where r.id=recording_id and r.session_id=ld_messages.session_id and r.turn_index=ld_messages.turn_index and r.version=(select max(v.version) from public.ld_recordings v where v.session_id=r.session_id and v.turn_index=r.turn_index)))
);
create policy recordings_read on public.ld_recordings for select to authenticated using (public.ld_owns_session(session_id) or public.ld_teaches_session(session_id));
create policy reports_read on public.ld_reports for select to authenticated using (public.ld_owns_session(session_id) or public.ld_teaches_session(session_id));
create policy reports_create on public.ld_reports for insert to authenticated with check (
  public.ld_owns_session(session_id) and exists(select 1 from public.ld_messages m
    where m.id=message_id and m.session_id=ld_reports.session_id and m.role='assistant')
);
create policy recordings_create on public.ld_recordings for insert to authenticated with check (
  public.ld_can_start_turn(session_id,turn_index)
  and version=public.ld_next_recording_version(session_id,turn_index)
  and object_path like (auth.uid()::text || '/' || session_id::text || '/' || turn_index::text || '/' || version::text || '-%')
  and exists(select 1 from storage.objects o where o.bucket_id='ld-voice' and o.name=ld_recordings.object_path)
);
create policy submissions_read on public.ld_submissions for select to authenticated using (public.ld_owns_session(session_id) or public.ld_teaches_session(session_id));
create policy summary_draft_read on public.ld_summary_drafts for select to authenticated using (public.ld_owns_session(session_id));
create policy summary_versions_read on public.ld_summary_draft_versions for select to authenticated using (public.ld_owns_session(session_id) or public.ld_teaches_session(session_id));
create policy summary_versions_insert on public.ld_summary_draft_versions for insert to authenticated with check (version=public.ld_next_summary_draft(session_id));
create policy summary_draft_insert on public.ld_summary_drafts for insert to authenticated with check (public.ld_owns_session(session_id));
create policy summary_draft_update on public.ld_summary_drafts for update to authenticated using (public.ld_owns_session(session_id)) with check (public.ld_owns_session(session_id));
create policy feedback_read on public.ld_feedback for select to authenticated using (exists(select 1 from public.ld_submissions s where s.id=submission_id and (public.ld_teaches_session(s.session_id) or (published_at is not null and public.ld_owns_session(s.session_id)))));
create policy feedback_create on public.ld_feedback for insert to authenticated with check (author_id=auth.uid() and exists(select 1 from public.ld_submissions s where s.id=submission_id and public.ld_teaches_session(s.session_id)));
create policy teacher_feedback_drafts_read on public.ld_teacher_feedback_drafts for select to authenticated using (author_id=auth.uid() and exists(select 1 from public.ld_submissions s where s.id=submission_id and public.ld_teaches_session(s.session_id)));
create policy teacher_feedback_drafts_insert on public.ld_teacher_feedback_drafts for insert to authenticated with check (author_id=auth.uid() and exists(select 1 from public.ld_submissions s where s.id=submission_id and public.ld_teaches_session(s.session_id)));
create policy teacher_feedback_drafts_update on public.ld_teacher_feedback_drafts for update to authenticated using (author_id=auth.uid() and exists(select 1 from public.ld_submissions s where s.id=submission_id and public.ld_teaches_session(s.session_id))) with check (author_id=auth.uid() and exists(select 1 from public.ld_submissions s where s.id=submission_id and public.ld_teaches_session(s.session_id)));
create policy drafts_read on public.ld_ai_drafts for select to authenticated using (exists(select 1 from public.ld_submissions s where s.id=submission_id and public.ld_teaches_session(s.session_id)));
create policy rubric_drafts_read on public.ld_rubric_drafts for select to authenticated using (public.ld_teaches_class(class_id));

commit;
