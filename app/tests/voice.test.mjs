import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
process.env.OPENAI_API_KEY='test-openai';
process.env.OPENAI_TRANSCRIBE_MODEL='test-transcription';
process.env.VOICE_STORAGE_APPROVED='true';
process.env.VOICE_RETENTION_NOTICE='시험 전용 안내';
const {transcribe}=await import('../server.mjs');
const sessionId='11111111-1111-4111-8111-111111111111';
const studentId='44444444-4444-4444-8444-444444444444';
const filename='4-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webm';
const objectPath=`${studentId}/${sessionId}/1/${filename}`;
const ok=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
function call(){
  const bytes=Buffer.from(JSON.stringify({sessionId,turnIndex:1}));
  return {req:{headers:{authorization:'Bearer student-token'},async *[Symbol.asyncIterator](){yield bytes;}},
    res:{writeHead(status){this.status=status;},end(text){this.data=JSON.parse(text);}}};
}
test('가장 마지막 녹음만 가져와 음성 인식한다',async()=>{
  const original=globalThis.fetch;const calls=[];
  try{
    globalThis.fetch=async(url,options={})=>{
      const u=new URL(url);calls.push(u);
      if(u.pathname==='/auth/v1/user')return ok({id:studentId});
      if(u.pathname.endsWith('/ld_sessions'))return ok([{id:sessionId}]);
      if(u.pathname.endsWith('/rpc/ld_voice_allowed'))return ok(true);
      if(u.pathname.endsWith('/ld_recordings')){
        assert.equal(u.searchParams.get('order'),'version.desc');
        assert.equal(u.searchParams.get('limit'),'1');
        return ok([{object_path:objectPath,version:4}]);
      }
      if(u.pathname.startsWith('/storage/v1/'))return new Response(new Blob(['fake'],{type:'audio/webm'}));
      if(u.host==='api.openai.com'){
        assert.equal(options.body.get('model'),'test-transcription');
        return ok({text:'학생의 말'});
      }
      throw Error(`예상하지 못한 요청: ${u.pathname}`);
    };
    const c=call();await transcribe(c.req,c.res);
    assert.equal(c.res.status,200);assert.equal(c.res.data.version,4);assert.equal(c.res.data.text,'학생의 말');
    assert.equal(calls.filter(u=>u.pathname.startsWith('/storage/v1/')).length,1);
    assert.ok(calls.some(u=>u.pathname.endsWith(objectPath)));
  }finally{globalThis.fetch=original;}
});
test('이용 비활성 상태에서는 음성 파일을 읽거나 인식하지 않는다',async()=>{
  const original=globalThis.fetch;let read=false;
  try{
    globalThis.fetch=async(url)=>{const u=new URL(url);
      if(u.pathname==='/auth/v1/user')return ok({id:studentId});
      if(u.pathname.endsWith('/ld_sessions'))return ok([{id:sessionId}]);
      if(u.pathname.endsWith('/rpc/ld_voice_allowed'))return ok(false);
      read=true;throw Error('비활성 상태에서 녹음에 접근했습니다.');
    };
    const c=call();await transcribe(c.req,c.res);assert.equal(c.res.status,403);assert.equal(read,false);
  }finally{globalThis.fetch=original;}
});
test('다른 학생의 세션은 녹음 조회 전에 차단한다',async()=>{
  const original=globalThis.fetch;let storageOrAi=false;
  try{
    globalThis.fetch=async(url)=>{
      const u=new URL(url);
      if(u.pathname==='/auth/v1/user')return ok({id:'77777777-7777-4777-8777-777777777777'});
      if(u.pathname.endsWith('/ld_sessions'))return ok([]);
      storageOrAi=true;throw Error('권한 확인 전에 외부 요청이 발생했습니다.');
    };
    const c=call();await transcribe(c.req,c.res);
    assert.equal(c.res.status,403);assert.equal(storageOrAi,false);
  }finally{globalThis.fetch=original;}
});
