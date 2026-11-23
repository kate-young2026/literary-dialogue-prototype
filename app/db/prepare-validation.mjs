import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Generate from the current migration so the test does not drift from it.
const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
if (!/^begin;/m.test(schema) || !/commit;\s*$/.test(schema)) {
  throw new Error('트랜잭션 경계를 확인할 수 없어 검증 파일을 만들지 않았습니다.');
}
const assertions = `
do $$
declare missing text;
begin
  select string_agg(name, ', ') into missing
  from unnest(array['ld_sessions','ld_turn_exceptions','ld_messages','ld_recordings','ld_reports',
                    'ld_submissions','ld_feedback','ld_teacher_feedback_drafts','ld_ai_drafts']) name
  where not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=name and c.relrowsecurity);
  if missing is not null then raise exception 'Missing tables or RLS: %', missing; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.ld_messages'::regclass
      and tgname='ld_guard_messages' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.ld_submissions'::regclass
      and tgname='ld_guard_submissions' and not tgisinternal) then
    raise exception 'Session guard triggers are missing';
  end if;
  if has_table_privilege('authenticated','public.ld_submissions','INSERT')
     or has_table_privilege('authenticated','public.ld_assignments','UPDATE') then
    raise exception 'Unexpected authenticated write privilege';
  end if;
end $$;
rollback;
`;
const output = new URL('./schema-validation.sql', import.meta.url);
// A fresh test project may not have the app's pre-existing works table. This
// minimal placeholder is created inside the same transaction and rolled back.
const bootstrap = `begin;
create table if not exists public.literary_works (id bigint primary key);
`;
await writeFile(output, schema.replace(/^begin;/m, bootstrap).replace(/commit;\s*$/, assertions), 'utf8');
console.log(`시험용 SQL 생성: ${fileURLToPath(output)}`);
console.log('테스트 전용 Supabase 프로젝트의 SQL Editor에서 전체 실행하세요. 정상 종료 시 ROLLBACK됩니다.');
