import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='public';
process.env.OPENAI_API_KEY='test';
process.env.OPENAI_MODEL='test';
const {teacherAssistant}=await import('../server.mjs');
test('교사만 도우미를 호출하고 작품 목록은 사용자 토큰으로 조회한다',async()=>{
  const original=globalThis.fetch; let aiCalls=0;
  try {
    globalThis.fetch=async(url,opts)=>{
      if(url.endsWith('/auth/v1/user'))return opts.headers.authorization==='Bearer invalid'?new Response('',{status:401}):Response.json({id:opts.headers.authorization==='Bearer teacher'?'teacher':'student'});
      if(url.includes('/ld_profiles'))return Response.json(url.includes('id=eq.teacher')?[{id:'teacher'}]:[]);
      if(url.includes('/ld_teacher_works')){assert.equal(opts.headers.authorization,'Bearer teacher');return Response.json([{title:'등록 작품'}]);}
      if(url.includes('api.openai.com')){aiCalls++;return Response.json({output:[{content:[{type:'output_text',text:'검토용 제안'}]}]});}
      throw Error('unexpected URL');
    };
    const call=async token=>{const req=Readable.from([Buffer.from(JSON.stringify({role:'works',message:'추천'}))]);req.headers={authorization:`Bearer ${token}`};const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};await teacherAssistant(req,res);return res;};
    assert.equal((await call('invalid')).status,401);
    assert.equal((await call('student')).status,403);
    assert.equal((await call('teacher')).status,200);
    assert.equal(aiCalls,3);
  } finally {globalThis.fetch=original;}
});
