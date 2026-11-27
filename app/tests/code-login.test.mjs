import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='public-key';
process.env.SUPABASE_SECRET_KEY='sb_secret_test';
const {studentCodeLogin}=await import('../server.mjs');
const student='11111111-1111-4111-8111-111111111111',klass='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333';
const code='1234567890123456789012';
const jwt=claims=>`header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const call=async data=>{const req=Readable.from([Buffer.from(JSON.stringify(data))]);req.socket={remoteAddress:'127.0.0.1'};const res={writeHead(status){this.status=status},end(text){this.body=JSON.parse(text)}};await studentCodeLogin(req,res);return res;};
test('코드 로그인은 활성 코드와 일치하는 Auth 세션을 등록한 뒤에만 토큰을 돌려준다',async()=>{
  const original=globalThis.fetch;let allowRegistration=true,lookupFound=true,returnedSub=student,registered=0;
  try {
    globalThis.fetch=async(url,opts)=>{
      if(url.endsWith('/rpc/ld_find_student_code')) {const data=JSON.parse(opts.body);assert.equal(data.p_class,klass);assert.match(data.p_digest,/^[0-9a-f]{64}$/);assert.equal(opts.headers.apikey,'sb_secret_test');return response(lookupFound?[{credential_id:7,student_id:student}]:[]);}
      if(url.includes('/auth/v1/admin/users/'))return response({id:student,email:'internal@example.invalid'});
      if(url.includes('/auth/v1/token')){assert.equal(JSON.parse(opts.body).password,code);return response({access_token:jwt({sub:returnedSub,session_id:sid}),refresh_token:'must-not-leak',user:{id:student,email:'internal@example.invalid'}});}
      if(url.endsWith('/rpc/ld_register_code_session')){registered++;assert.deepEqual(JSON.parse(opts.body),{p_credential:7,p_student:student,p_session:sid});return response(allowRegistration);}
      throw Error(`Unexpected request: ${url}`);
    };
    let r=await call({classId:klass,code});assert.equal(r.status,200);assert.equal(r.body.user.id,student);assert.equal('refresh_token' in r.body,false);assert.equal('email' in r.body.user,false);
    allowRegistration=false;r=await call({classId:klass,code});assert.equal(r.status,409);assert.equal(r.body.access_token,undefined);
    const count=registered;returnedSub=klass;r=await call({classId:klass,code});assert.equal(r.status,502);assert.equal(registered,count);
    lookupFound=false;r=await call({classId:klass,code});assert.equal(r.status,401);
    r=await call({classId:'invalid',code});assert.equal(r.status,400);
  } finally {globalThis.fetch=original;}
});
