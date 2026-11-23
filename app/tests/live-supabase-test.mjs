import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL(process.env.SUPABASE_URL||'');
if(base.hostname!=='mwaswnytzcoasriduqeo.supabase.co'||base.protocol!=='https:')throw Error('지정된 별도 시험 프로젝트에서만 실행할 수 있습니다.');
const secret=process.env.SUPABASE_SECRET_KEY, publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!secret||!publicKey)throw Error('시험 프로젝트 키가 필요합니다.');
const serviceHeaders={apikey:secret,...(secret.startsWith('sb_secret_')?{}:{authorization:`Bearer ${secret}`})};
const password=randomBytes(24).toString('base64url');
const runId=randomUUID().slice(0,8);
// The database and auth calls are real; only OpenAI responses are simulated.
process.env.OPENAI_API_KEY='test-simulated-openai';process.env.OPENAI_MODEL='test-simulated-model';
const realFetch=globalThis.fetch;let failOnce=true;let aiCalls=0;const aiInputs=[];
globalThis.fetch=async(url,options)=>{if(new URL(url).hostname==='api.openai.com'){aiCalls++;aiInputs.push(JSON.parse(options.body));if(failOnce){failOnce=false;return new Response(null,{status:503});}return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'가상 AI 응답: 근거를 살펴봅시다.'}]}]}),{status:200,headers:{'content-type':'application/json'}});}return realFetch(url,options);};
const {server}=await import('../server.mjs');
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
const appUrl=`http://127.0.0.1:${server.address().port}`;
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
    const ask=()=>fetch(`${appUrl}/api/chat`,{method:'POST',headers:{authorization:`Bearer ${student.token}`,'content-type':'application/json'},body:JSON.stringify({sessionId:sid,turnIndex:turn})});
    if(turn===1){const failed=await ask();assert.equal(failed.status,502);assert.equal((await userRead(`ld_messages?session_id=eq.${sid}&turn_index=eq.1`,student.token)).length,1);}
    const answer=await ask();assert.equal(answer.status,200);assert.match((await answer.json()).reply,/가상 AI 응답/);
    if(turn===1){const repeated=await ask();assert.equal(repeated.status,200);assert.equal(aiCalls,2);}
  }
  for(let version=1;version<=3;version++)assert.equal((await userPost('ld_summary_draft_versions',student.token,{session_id:sid,version,content:`시험 초안 ${version}`})).status,201);
  assert.equal((await userPost('ld_summary_draft_versions',student.token,{session_id:sid,version:4,content:'초과 초안'})).status>=400,true);
  assert.equal((await userRead(`ld_messages?session_id=eq.${sid}`,otherStudent.token)).length,0);
  assert.equal((await userRead(`ld_messages?session_id=eq.${sid}`,otherTeacher.token)).length,0);
  assert.equal((await userRead(`ld_messages?session_id=eq.${sid}`,teacher.token)).length,20);
  assert.equal((await userRead(`ld_summary_draft_versions?session_id=eq.${sid}`,teacher.token)).length,3);
  assert.equal((await userPost('ld_submissions',student.token,{session_id:sid,version:1,content:'직접 제출 우회',character_count:8})).status>=400,true);
  const firstResponse=await fetch(`${appUrl}/api/submission`,{method:'POST',headers:{authorization:`Bearer ${student.token}`,'content-type':'application/json'},body:JSON.stringify({sessionId:sid,version:1,content:'가상 1차 요약'})});assert.equal(firstResponse.status,201);
  const first=(await userRead(`ld_submissions?session_id=eq.${sid}&version=eq.1`,student.token))[0];
  const draftRequest=(token,submissionId)=>fetch(`${appUrl}/api/draft`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({type:'feedback',submissionId})});
  assert.equal((await draftRequest(student.token,first.id)).status,403);
  assert.equal((await draftRequest(otherTeacher.token,first.id)).status,403);
  assert.equal((await draftRequest(teacher.token,first.id)).status,200);
  assert.equal((await userPost('ld_teacher_feedback_drafts',teacher.token,{submission_id:first.id,author_id:teacher.id,content:'비공개 교사 초안'})).status,201);
  assert.equal((await userRead(`ld_ai_drafts?submission_id=eq.${first.id}`,teacher.token)).length,1);
  assert.equal((await userRead(`ld_ai_drafts?submission_id=eq.${first.id}`,student.token)).length,0);
  assert.equal((await userRead(`ld_teacher_feedback_drafts?submission_id=eq.${first.id}`,student.token)).length,0);
  const early=await call('/rest/v1/ld_submissions',{method:'POST',service:true,data:{session_id:sid,version:2,content:'이른 수정',character_count:5}});assert.equal(early.status>=400,true);
  const feedback=await userPost('ld_feedback',teacher.token,{submission_id:first.id,author_id:teacher.id,teacher_text:'가상 1차 피드백',published_at:new Date().toISOString()});assert.equal(feedback.status,201);
  const secondResponse=await fetch(`${appUrl}/api/submission`,{method:'POST',headers:{authorization:`Bearer ${student.token}`,'content-type':'application/json'},body:JSON.stringify({sessionId:sid,version:2,content:'가상 수정 요약'})});assert.equal(secondResponse.status,201);
  const second=(await userRead(`ld_submissions?session_id=eq.${sid}&version=eq.2`,student.token))[0];
  assert.equal((await draftRequest(teacher.token,second.id)).status,200);
  assert.match(String(aiInputs.at(-1).input),/가상 1차 피드백/);
  assert.match(String(aiInputs.at(-1).input),/가상 1차 요약/);
  assert.match(String(aiInputs.at(-1).input),/가상 수정 요약/);
  const feedback2=await userPost('ld_feedback',teacher.token,{submission_id:second.id,author_id:teacher.id,teacher_text:'가상 2차 피드백',published_at:new Date().toISOString()});assert.equal(feedback2.status,201);
  assert.equal((await userRead(`ld_feedback?submission_id=in.(${first.id},${second.id})`,student.token)).length,2);
  assert.equal((await userRead(`ld_feedback?submission_id=in.(${first.id},${second.id})`,otherStudent.token)).length,0);
  console.log('성공: 앱 대화 10차례, 응답 장애 후 재시도·중복 방지, 초안 3개, 앱 경유 1·2차 제출·평가 초안, 피드백과 접근 차단');
  console.log('시험 데이터는 별도 시험 프로젝트에 남아 있으며 실제 AI와 음성 기능은 시험하지 않았습니다.');
}catch(error){console.error(`시험 중단: ${error.message}`);console.error('이미 생성된 가상 데이터는 시험 프로젝트에 남아 있을 수 있습니다.');process.exitCode=1;}finally{globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));}

