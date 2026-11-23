import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL(process.env.SUPABASE_URL||'');
if(base.hostname!=='mwaswnytzcoasriduqeo.supabase.co'||base.protocol!=='https:')throw Error('지정된 별도 시험 프로젝트에서만 실행할 수 있습니다.');
const secret=process.env.SUPABASE_SECRET_KEY, publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!secret||!publicKey)throw Error('시험 프로젝트 키가 필요합니다.');
const serviceHeaders={apikey:secret,...(secret.startsWith('sb_secret_')?{}:{authorization:`Bearer ${secret}`})};
const password=randomBytes(24).toString('base64url');
const runId=randomUUID().slice(0,8);
async function call(path,{method='GET',data,token,service=false,prefer}={}){
  const headers={...(service?serviceHeaders:{apikey:publicKey,...(token?{authorization:`Bearer ${token}`}:{})}),'content-type':'application/json',...(prefer?{prefer}:{})};
  const response=await fetch(base.origin+path,{method,headers,...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(15000)});
  const text=await response.text();let body;try{body=text?JSON.parse(text):null}catch{body=null}
  return {status:response.status,body};
}
async function must(path,options,allowed=[200,201,204]){const r=await call(path,options);if(!allowed.includes(r.status))throw Error(`${options?.label||path.split('?')[0]} HTTP ${r.status}`);return r.body;}
async function makeUser(label){
  const email=`ldtest-${runId}-${label}@example.com`;
  const account=await must('/auth/v1/admin/users',{method:'POST',service:true,data:{email,password,email_confirm:true},label:'시험 계정 생성'});
  const login=await must('/auth/v1/token?grant_type=password',{method:'POST',data:{email,password},label:'시험 계정 로그인'});
  return {id:account.id,token:login.access_token};
}
const admin=(path,data)=>must('/rest/v1/'+path,{method:'POST',service:true,data,prefer:'return=representation'});
const userPost=(path,token,data)=>call('/rest/v1/'+path,{method:'POST',token,data,prefer:'return=representation'});
const userRead=(path,token)=>must('/rest/v1/'+path,{token});
try{
  const teacher=await makeUser('teacher'),student=await makeUser('student'),otherStudent=await makeUser('otherstudent'),otherTeacher=await makeUser('otherteacher');
  await admin('ld_profiles',[{id:teacher.id,display_name:'가상 교사',role:'teacher'},{id:student.id,display_name:'가상 학생',role:'student'},{id:otherStudent.id,display_name:'다른 가상 학생',role:'student'},{id:otherTeacher.id,display_name:'다른 가상 교사',role:'teacher'}]);
  const klass=(await admin('ld_classes',{teacher_id:teacher.id,name:`자동 시험 ${runId}`}))[0];
  await admin('ld_memberships',{class_id:klass.id,student_id:student.id});
  const work=await must('/rest/v1/literary_works?select=id&title=eq.%EA%B4%80%EB%82%B4%EB%B6%84%EC%8B%A4&limit=1',{service:true});assert.equal(work.length,1);
  const assignment=(await admin('ld_assignments',{class_id:klass.id,work_id:work[0].id,title:'가상 시험 과제',prompt:'다른 선택을 했다면?',material:{summary:'교사 확인 시험 설명'},rubric:[{text:'근거와 형상화를 살핍니다.'}],rubric_confirmed:true,published:true}))[0];
  assert.equal((await userRead(`ld_assignments?id=eq.${assignment.id}`,student.token)).length,1);
  assert.equal((await userRead(`ld_assignments?id=eq.${assignment.id}`,otherStudent.token)).length,0);
  const session=(await userPost('ld_sessions',student.token,{assignment_id:assignment.id,student_id:student.id,character:'지민'}));assert.equal(session.status,201);const sid=session.body[0].id;
  for(let turn=1;turn<=10;turn++){
    assert.equal((await userPost('ld_messages',student.token,{session_id:sid,turn_index:turn,role:'student',content:`가상 학생 질문 ${turn}`})).status,201);
    await admin('ld_messages',{session_id:sid,turn_index:turn,role:'assistant',content:'가상 AI 응답: 근거를 살펴봅시다.'});
  }
  for(let version=1;version<=3;version++)assert.equal((await userPost('ld_summary_draft_versions',student.token,{session_id:sid,version,content:`시험 초안 ${version}`})).status,201);
  assert.equal((await userPost('ld_summary_draft_versions',student.token,{session_id:sid,version:4,content:'초과 초안'})).status>=400,true);
  assert.equal((await userRead(`ld_messages?session_id=eq.${sid}`,otherStudent.token)).length,0);
  assert.equal((await userRead(`ld_messages?session_id=eq.${sid}`,otherTeacher.token)).length,0);
  assert.equal((await userRead(`ld_messages?session_id=eq.${sid}`,teacher.token)).length,20);
  assert.equal((await userRead(`ld_summary_draft_versions?session_id=eq.${sid}`,teacher.token)).length,3);
  assert.equal((await userPost('ld_submissions',student.token,{session_id:sid,version:1,content:'직접 제출 우회',character_count:8})).status>=400,true);
  const first=(await admin('ld_submissions',{session_id:sid,version:1,content:'가상 1차 요약',character_count:8}))[0];
  const early=await call('/rest/v1/ld_submissions',{method:'POST',service:true,data:{session_id:sid,version:2,content:'이른 수정',character_count:5}});assert.equal(early.status>=400,true);
  const feedback=await userPost('ld_feedback',teacher.token,{submission_id:first.id,author_id:teacher.id,teacher_text:'가상 1차 피드백',published_at:new Date().toISOString()});assert.equal(feedback.status,201);
  const second=(await admin('ld_submissions',{session_id:sid,version:2,content:'가상 수정 요약',character_count:8}))[0];
  const feedback2=await userPost('ld_feedback',teacher.token,{submission_id:second.id,author_id:teacher.id,teacher_text:'가상 2차 피드백',published_at:new Date().toISOString()});assert.equal(feedback2.status,201);
  assert.equal((await userRead(`ld_feedback?submission_id=in.(${first.id},${second.id})`,student.token)).length,2);
  assert.equal((await userRead(`ld_feedback?submission_id=in.(${first.id},${second.id})`,otherStudent.token)).length,0);
  console.log('성공: 가상 계정 4개, 학급·과제, 10차례, 초안 3개, 1·2차 제출과 교사 피드백, 다른 사용자 접근 차단');
  console.log('시험 데이터는 별도 시험 프로젝트에 남아 있으며 실제 AI와 음성 기능은 시험하지 않았습니다.');
}catch(error){console.error(`시험 중단: ${error.message}`);console.error('이미 생성된 가상 데이터는 시험 프로젝트에 남아 있을 수 있습니다.');process.exitCode=1;}

