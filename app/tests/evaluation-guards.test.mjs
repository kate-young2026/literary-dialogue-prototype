import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='public';
process.env.SUPABASE_SECRET_KEY='secret';
process.env.OPENAI_API_KEY='test';
process.env.OPENAI_MODEL='test';
const {draft}=await import('../server.mjs');
const uuid='11111111-1111-4111-8111-111111111111';
test('미확정 루브릭과 1차 공개 피드백이 없는 수정본은 평가를 요청하지 않는다',async()=>{
  const original=globalThis.fetch; let confirmed=false, hasFeedback=false, calls=0;
  try {
    globalThis.fetch=async(url,opts)=>{
      if(url.endsWith('/auth/v1/user'))return Response.json({id:'teacher'});
      if(url.includes('/ld_profiles'))return Response.json([{id:'teacher'}]);
      if(url.includes('/ld_submissions?id='))return Response.json([{id:uuid,session_id:uuid,version:2,content:'수정'}]);
      if(url.includes('/ld_sessions?'))return Response.json([{id:uuid,assignment_id:uuid}]);
      if(url.includes('/ld_assignments?'))return Response.json([{id:uuid,class_id:uuid,rubric:[{text:'기준'}],rubric_confirmed:confirmed}]);
      if(url.includes('/ld_classes?'))return Response.json([{id:uuid}]);
      if(url.includes('/ld_messages?'))return Response.json([]);
      if(url.includes('/ld_submissions?'))return Response.json([{id:uuid,version:1,content:'첫 요약'},{id:'second',version:2,content:'수정'}]);
      if(url.includes('/ld_feedback?'))return Response.json(hasFeedback?[{submission_id:uuid,teacher_text:'교사 의견',published_at:'2026-01-01'}]:[]);
      if(url.includes('api.openai.com')){calls++;return Response.json({output:[{content:[{type:'output_text',text:'초안'}]}]});}
      if(url.includes('/ld_ai_drafts'))return new Response(null,{status:204});
      throw Error('unexpected '+url);
    };
    const call=async()=>{const req=Readable.from([Buffer.from(JSON.stringify({type:'feedback',submissionId:uuid}))]);req.headers={authorization:'Bearer teacher'};const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};await draft(req,res);return res;};
    assert.equal((await call()).status,409);confirmed=true;
    assert.equal((await call()).status,409);assert.equal(calls,0);hasFeedback=true;
    assert.equal((await call()).status,200);assert.equal(calls,1);
  } finally {globalThis.fetch=original;}
});
