// Real Supabase test with fictitious accounts only. Leaves test records for review.
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createStudentCode,codeDigest} from '../lib/student-code.mjs';
const base=new URL(process.env.SUPABASE_URL||'');
if(base.hostname!=='mwaswnytzcoasriduqeo.supabase.co'||base.protocol!=='https:')throw Error('별도 시험 프로젝트에서만 실행할 수 있습니다.');
const secret=process.env.SUPABASE_SECRET_KEY,anon=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!secret||!anon)throw Error('시험 프로젝트 설정을 확인해 주세요.');
const adminHeaders={apikey:secret,...(secret.startsWith('sb_secret_')?{}:{authorization:`Bearer ${secret}`})};
const teacherPassword=createStudentCode(),run=randomUUID().slice(0,8);
async function api(path,{method='GET',data,admin=false,token}={}){
  const r=await fetch(base.origin+path,{method,headers:{...(admin?adminHeaders:{apikey:anon,...(token?{authorization:`Bearer ${token}`}:{})}),'content-type':'application/json',prefer:'return=representation'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(15000)});
  const raw=await r.text();let value;try{value=raw?JSON.parse(raw):null;}catch{value=null;}
  return {status:r.status,value};
}
async function must(path,options={}){const r=await api(path,options);if(r.status<200||r.status>=300)throw Error(`${path.split('?')[0]} HTTP ${r.status}`);return r.value;}
const adminPost=(path,data)=>must('/rest/v1/'+path,{method:'POST',admin:true,data});
const createUser=(label,password)=>must('/auth/v1/admin/users',{method:'POST',admin:true,data:{email:`code-test-${run}-${label}@example.invalid`,password,email_confirm:true}});
const {server}=await import('../server.mjs');
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
try{
  const teacher=await createUser('teacher',teacherPassword),student=await createUser('student',createStudentCode());
  await adminPost('ld_profiles',[{id:teacher.id,display_name:'가상 코드 교사',role:'teacher'},{id:student.id,display_name:'가상 코드 학생',role:'student'}]);
  const klass=(await adminPost('ld_classes',{teacher_id:teacher.id,name:`가상 코드 학급 ${run}`}))[0];
  await adminPost('ld_memberships',{class_id:klass.id,student_id:student.id});
  await adminPost('ld_student_details',{user_id:student.id,student_name:'가상 코드 학생'});
  const app=process.env.CODE_TEST_PUBLIC_APP==='true'?'https://literary-dialogue-class-test.onrender.com':`http://127.0.0.1:${server.address().port}`;
  const teacherAuth=await must('/auth/v1/token?grant_type=password',{method:'POST',data:{email:teacher.email,password:teacherPassword}});
  const issue=async()=>{const r=await fetch(app+'/api/teacher/student-code',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${teacherAuth.access_token}`},body:JSON.stringify({classId:klass.id,studentId:student.id})});assert.equal(r.status,200,'교사 코드 발급');return (await r.json()).code;};
  const code1=await issue();
  const login=async code=>{const r=await fetch(app+'/api/student/code-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({classId:klass.id,code})});return {status:r.status,value:await r.json()};};
  const first=await login(code1);assert.equal(first.status,200,'기존 코드 로그인');
  const forbidden=await fetch(app+'/api/teacher/student-code',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${first.value.access_token}`},body:JSON.stringify({classId:klass.id,studentId:student.id})});assert.equal(forbidden.status,403,'학생의 코드 발급 차단');
  const read=token=>api(`/rest/v1/ld_student_details?user_id=eq.${student.id}&select=student_name`,{token});
  assert.equal((await read(first.value.access_token)).value.length,1,'기존 세션 접근');
  const direct=await api('/rest/v1/rpc/ld_find_student_code',{method:'POST',token:first.value.access_token,data:{p_class:klass.id,p_digest:codeDigest(code1).toString('hex')}});assert.ok(direct.status>=400,'학생의 코드 조회 차단');
  const code2=await issue();
  const old=await read(first.value.access_token);assert.equal(old.status,200);assert.equal(old.value.length,0,'이전 세션 접근 차단');
  assert.equal((await login(code1)).status,401,'이전 코드 차단');
  const second=await login(code2);assert.equal(second.status,200,'재발급 코드 로그인');
  assert.equal((await read(second.value.access_token)).value.length,1,'새 세션 접근');
  console.log('성공: 실제 Supabase 코드 로그인, 재발급 후 이전 코드·세션 차단, 새 세션 접근 및 학생의 코드 조회 차단. 가상 계정과 기록은 시험 프로젝트에 남습니다.');
}finally{await new Promise(resolve=>server.close(resolve));}

