import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
process.env.SUPABASE_SECRET_KEY='test-server';
process.env.OPENAI_API_KEY='test-openai';
process.env.OPENAI_MODEL='test-model';
const {chat,submit,draft} = await import('../server.mjs');
const sessionId='11111111-1111-4111-8111-111111111111';
const assignmentId='22222222-2222-4222-8222-222222222222';
const classId='33333333-3333-4333-8333-333333333333';
const studentId='44444444-4444-4444-8444-444444444444';
const teacherId='55555555-5555-4555-8555-555555555555';
const idFor = n => `66666666-6666-4666-8666-${String(n).padStart(12,'0')}`;
const ok = data => new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
const noContent = () => new Response(null,{status:204});
function caller(data, token='student-token') {
  const bytes=Buffer.from(JSON.stringify(data));
  const req={headers:{authorization:`Bearer ${token}`},async *[Symbol.asyncIterator](){yield bytes;}};
  const res={writeHead(status){this.status=status;},end(text){this.data=JSON.parse(text);}};
  return {req,res};
}
test('세 학생 유형의 대화, 제출 및 교사 초안 흐름을 모의 저장소로 검사', async () => {
  const originalFetch=globalThis.fetch;
  try {
    for (const type of ['적극적 학생','짧게 답하는 학생','엉뚱한 질문을 하는 학생']) {
      const messages=[], submissions=[], feedback=[]; let openaiCalls=0, drafts=[], openaiInputs=[];
      globalThis.fetch=async (url, options={})=>{
        const u=new URL(url);const token=options.headers?.authorization;
        const who=token==='Bearer teacher-token'?teacherId:studentId;
        if(u.pathname==='/auth/v1/user')return ok({id:who});
        if(u.host==='api.openai.com'){openaiCalls++;openaiInputs.push(JSON.parse(options.body).input);return ok({output:[{content:[{type:'output_text',text:'작품 속 근거와 다른 관점을 함께 생각해 볼까요?'}]}]});}
        if(u.pathname.endsWith('/ld_profiles'))return ok(who===teacherId?[{id:teacherId}]:[]);
        if(u.pathname.endsWith('/ld_classes'))return ok(who===teacherId?[{id:classId}]:[]);
        if(u.pathname.endsWith('/ld_sessions'))return ok([{id:sessionId,student_id:studentId,character:'지민',assignment_id:assignmentId}]);
        if(u.pathname.endsWith('/ld_assignments'))return ok([{id:assignmentId,class_id:classId,title:'관내분실',prompt:'다른 선택은?',material:{summary:'작품 소개'},rubric:[]}]);
        if(u.pathname.endsWith('/ld_messages')){
          if(options.method==='POST'){messages.push(JSON.parse(options.body));return noContent();}
          return ok(messages);
        }
        if(u.pathname.endsWith('/ld_submissions')){
          if(options.method==='POST'){const item=JSON.parse(options.body);submissions.push({...item,id:idFor(item.version)});return noContent();}
          const id=u.searchParams.get('id');const version=u.searchParams.get('version');return ok(id?submissions.filter(s=>s.id===id.slice(3)):version?submissions.filter(s=>s.version<=Number(version.slice(4))):submissions);
        }
        if(u.pathname.endsWith('/ld_feedback'))return ok(feedback);
        if(u.pathname.endsWith('/rpc/ld_has_turn_exception'))return ok(false);
        if(u.pathname.endsWith('/ld_ai_drafts')){drafts.push(JSON.parse(options.body));return noContent();}
        throw Error(`예상하지 못한 요청: ${u.pathname}`);
      };
      let call=caller({sessionId,version:1,content:'마인드와 기억을 생각했다.'});await submit(call.req,call.res);assert.equal(call.res.status,400);
      for(let turn=1;turn<=10;turn++){
        messages.push({turn_index:turn,role:'student',content:`${type}의 ${turn}번째 발화`});
        call=caller({sessionId,turnIndex:turn});await chat(call.req,call.res);assert.equal(call.res.status,200);
      }
      assert.equal(openaiCalls,10);assert.equal(messages.filter(m=>m.role==='assistant').length,10);
      call=caller({sessionId,turnIndex:10});await chat(call.req,call.res);assert.equal(call.res.status,200);assert.equal(openaiCalls,10);
      call=caller({sessionId,version:1,content:'가'.repeat(301)});await submit(call.req,call.res);assert.equal(call.res.status,400);
      messages.push({turn_index:11,role:'student',content:'답변을 기다리는 발화'});
      call=caller({sessionId,version:1,content:'요약'});await submit(call.req,call.res);assert.equal(call.res.status,409);
      messages.pop();
      call=caller({sessionId,version:1,content:'마인드와 기억을 생각했다.'});await submit(call.req,call.res);assert.equal(call.res.status,201);
      messages.push({turn_index:11,role:'student',content:'제출 후 발화'});
      call=caller({sessionId,turnIndex:11});await chat(call.req,call.res);assert.equal(call.res.status,409);assert.equal(openaiCalls,10);
      messages.pop();
      call=caller({sessionId,version:2,content:'수정한 요약'});await submit(call.req,call.res);assert.equal(call.res.status,400);
      call=caller({type:'feedback',submissionId:idFor(1)},'teacher-token');await draft(call.req,call.res);assert.equal(call.res.status,200);assert.equal(drafts.length,1);
      feedback.push({submission_id:idFor(1),teacher_text:'근거를 확인해 보세요.',published_at:'2026-01-01'});
      call=caller({sessionId,version:2,content:'수정한 요약'});await submit(call.req,call.res);assert.equal(call.res.status,201);
      call=caller({type:'feedback',submissionId:idFor(2)},'teacher-token');await draft(call.req,call.res);assert.equal(call.res.status,200);
      assert.match(openaiInputs.at(-1),/마인드와 기억을 생각했다/);
      assert.match(openaiInputs.at(-1),/근거를 확인해 보세요/);
      assert.match(openaiInputs.at(-1),/수정한 요약/);
      assert.doesNotMatch(openaiInputs.at(-1),new RegExp(idFor(1)));
      feedback.push({submission_id:idFor(2),teacher_text:'수정한 근거가 더 명확해졌어요.',published_at:'2026-01-02'});
      assert.equal(submissions.length,2);assert.equal(submissions[0].content,'마인드와 기억을 생각했다.');assert.equal(drafts.length,2);assert.equal(feedback.length,2);
      call=caller({type:'feedback',submissionId:idFor(1)},'teacher-token');await draft(call.req,call.res);assert.equal(call.res.status,200);
      assert.doesNotMatch(openaiInputs.at(-1),/수정한 요약|근거를 확인해 보세요|수정한 근거가 더 명확해졌어요/);
    }
  } finally {globalThis.fetch=originalFetch;}
});
test('교사가 허용한 대화 횟수 예외는 10회 미만 제출에 적용된다', async()=>{
  const originalFetch=globalThis.fetch;let approved=false;
  try{
    globalThis.fetch=async(url,options={})=>{
      const u=new URL(url);
      if(u.pathname==='/auth/v1/user')return ok({id:studentId});
      if(u.pathname.endsWith('/ld_sessions'))return ok([{id:sessionId}]);
      if(u.pathname.endsWith('/ld_messages'))return ok([{turn_index:1,role:'student',content:'질문'},{turn_index:1,role:'assistant',content:'답변'}]);
      if(u.pathname.endsWith('/rpc/ld_has_turn_exception'))return ok(approved);
      if(u.pathname.endsWith('/ld_submissions'))return options.method==='POST'?noContent():ok([]);
      throw Error(`예상하지 못한 요청: ${u.pathname}`);
    };
    let call=caller({sessionId,version:1,content:'요약'});await submit(call.req,call.res);assert.equal(call.res.status,400);
    approved=true;call=caller({sessionId,version:1,content:'요약'});await submit(call.req,call.res);assert.equal(call.res.status,201);
  }finally{globalThis.fetch=originalFetch;}
});
test('로그인 실패나 다른 학생 세션에는 AI와 제출 접근을 차단한다', async()=>{
  const originalFetch=globalThis.fetch;let aiCalls=0;
  try {
    globalThis.fetch=async (url,options={})=>{
      const u=new URL(url);
      if(u.host==='api.openai.com'){aiCalls++;return ok({});}
      if(u.pathname==='/auth/v1/user')return options.headers?.authorization==='Bearer invalid' ? new Response('{}',{status:401}):ok({id:'77777777-7777-4777-8777-777777777777'});
      if(u.pathname.endsWith('/ld_sessions'))return ok([]);
      throw Error('권한 확인 전에 불필요한 요청이 발생했습니다.');
    };
    let call=caller({sessionId,turnIndex:1},'invalid');await chat(call.req,call.res);assert.equal(call.res.status,401);
    call=caller({sessionId,turnIndex:1},'other-student');await chat(call.req,call.res);assert.equal(call.res.status,403);
    call=caller({sessionId,version:1,content:'요약'},'other-student');await submit(call.req,call.res);assert.equal(call.res.status,403);
    assert.equal(aiCalls,0);
  }finally{globalThis.fetch=originalFetch;}
});
test('AI 연결이 끊기면 학생 발화를 유지하고 재시도할 수 있다',async()=>{
  const originalFetch=globalThis.fetch;let fail=true;const messages=[{turn_index:1,role:'student',content:'보존할 발화'}];
  try{
    globalThis.fetch=async(url,options={})=>{
      const u=new URL(url);
      if(u.pathname==='/auth/v1/user')return ok({id:studentId});
      if(u.pathname.endsWith('/ld_sessions'))return ok([{id:sessionId,student_id:studentId,character:'지민',assignment_id:assignmentId}]);
      if(u.pathname.endsWith('/ld_submissions'))return ok([]);
      if(u.pathname.endsWith('/ld_assignments'))return ok([{title:'관내분실',prompt:'다른 선택은?',material:{summary:'작품 소개'}}]);
      if(u.pathname.endsWith('/ld_messages')){
        if(options.method==='POST'){messages.push(JSON.parse(options.body));return noContent();}
        return ok(messages);
      }
      if(u.host==='api.openai.com'){
        if(fail)throw Error('network unavailable');
        return ok({output:[{content:[{type:'output_text',text:'다른 관점은 어떨까요?'}]}]});
      }
      throw Error(`예상하지 못한 요청: ${u.pathname}`);
    };
    let c=caller({sessionId,turnIndex:1});await chat(c.req,c.res);
    assert.equal(c.res.status,502);assert.match(c.res.data.error,/저장된 발화/);assert.equal(messages.length,1);
    fail=false;c=caller({sessionId,turnIndex:1});await chat(c.req,c.res);
    assert.equal(c.res.status,200);assert.equal(messages.length,2);assert.equal(messages[0].content,'보존할 발화');
  }finally{globalThis.fetch=originalFetch;}
});
test('제출 중 DB 상태 충돌은 재확인 안내로 반환한다', async()=>{
  const originalFetch=globalThis.fetch;
  const messages=Array.from({length:10},(_,i)=>[
    {turn_index:i+1,role:'student',content:'질문'},
    {turn_index:i+1,role:'assistant',content:'답변'}
  ]).flat();
  try{
    globalThis.fetch=async(url,options={})=>{
      const u=new URL(url);
      if(u.pathname==='/auth/v1/user')return ok({id:studentId});
      if(u.pathname.endsWith('/ld_sessions'))return ok([{id:sessionId}]);
      if(u.pathname.endsWith('/ld_messages'))return ok(messages);
      if(u.pathname.endsWith('/ld_submissions'))return options.method==='POST'
        ? new Response(JSON.stringify({code:'23514'}),{status:400,headers:{'content-type':'application/json'}})
        : ok([]);
      throw Error(`예상하지 못한 요청: ${u.pathname}`);
    };
    const call=caller({sessionId,version:1,content:'요약'});await submit(call.req,call.res);
    assert.equal(call.res.status,409);assert.match(call.res.data.error,/새로고침/);
  }finally{globalThis.fetch=originalFetch;}
});
