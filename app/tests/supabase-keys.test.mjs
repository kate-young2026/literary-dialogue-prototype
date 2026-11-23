import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
process.env.SUPABASE_SECRET_KEY='sb_secret_test';
const {submit}=await import('../server.mjs');
test('새 Supabase 비밀 키는 apikey 헤더에만 넣어 제출한다',async()=>{
  const original=globalThis.fetch;
  const sessionId='11111111-1111-4111-8111-111111111111';
  const messages=Array.from({length:10},(_,i)=>[{turn_index:i+1,role:'student',content:'질문'},{turn_index:i+1,role:'assistant',content:'답'}]).flat();
  const ok=data=>new Response(JSON.stringify(data),{status:200});
  let checked=false;
  try{
    globalThis.fetch=async(url,options={})=>{
      const p=new URL(url).pathname;
      if(p==='/auth/v1/user')return ok({id:'student'});
      if(p.endsWith('/ld_sessions'))return ok([{id:sessionId}]);
      if(p.endsWith('/ld_messages'))return ok(messages);
      if(p.endsWith('/ld_submissions')){
        if(options.method==='POST'){
          assert.equal(options.headers.apikey,'sb_secret_test');
          assert.equal(options.headers.authorization,undefined);
          checked=true;return new Response(null,{status:204});
        }
        return ok([]);
      }
      throw Error(`예상하지 못한 요청: ${p}`);
    };
    const bytes=Buffer.from(JSON.stringify({sessionId,version:1,content:'요약'}));
    const req={headers:{authorization:'Bearer student-token'},async *[Symbol.asyncIterator](){yield bytes;}};
    const res={writeHead(status){this.status=status;},end(text){this.data=JSON.parse(text);}};
    await submit(req,res);assert.equal(res.status,201);assert.equal(checked,true);
  }finally{globalThis.fetch=original;}
});
