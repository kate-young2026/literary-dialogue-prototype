import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='public-key';
process.env.SUPABASE_SECRET_KEY='secret-key';
const {teacherWorks}=await import('../server.mjs');
function call(token,page='1') {return [{headers:token?{authorization:`Bearer ${token}`} : {}},{writeHead(status){this.status=status},end(text){this.body=JSON.parse(text)}},new URL(`http://localhost/api/teacher/works?page=${page}`)];}
test('작품 목록은 교사에게만 제공하며 페이지 범위와 총 건수를 전달한다',async()=>{
  const original=globalThis.fetch;let workRequests=0;
  try {
    globalThis.fetch=async (url,opts)=>{
      if(url.endsWith('/auth/v1/user'))return opts.headers.authorization==='Bearer teacher'?new Response(JSON.stringify({id:'teacher'})):opts.headers.authorization==='Bearer student'?new Response(JSON.stringify({id:'student'})):new Response('',{status:401});
      if(url.includes('/ld_profiles'))return new Response(JSON.stringify(url.includes('id=eq.teacher')?[{id:'teacher'}]:[]));
      if(url.includes('/literary_works')){workRequests++;assert.match(url,/limit=25&offset=25/);return new Response(JSON.stringify([{id:26,title:'작품',content:{cards:[],private:'검토 전 원문'}}]),{headers:{'content-range':'25-25/26'}});}
      throw Error('Unexpected URL');
    };
    let c=call();await teacherWorks(...c);assert.equal(c[1].status,401);
    c=call('student');await teacherWorks(...c);assert.equal(c[1].status,403);
    c=call('teacher','-1');await teacherWorks(...c);assert.equal(c[1].status,400);
    c=call('teacher','2');await teacherWorks(...c);assert.equal(c[1].status,200);assert.equal(c[1].body.total,26);assert.equal(c[1].body.items[0].title,'작품');assert.equal(c[1].body.items[0].content,undefined);assert.ok(c[1].body.items[0].missingFields.includes('소개 카드'));assert.equal(workRequests,1);
  } finally {globalThis.fetch=original;}
});

