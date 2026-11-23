import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.VOICE_STORAGE_APPROVED;
delete process.env.VOICE_RETENTION_NOTICE;
const {transcribe}=await import('../server.mjs');
test('학교의 저장 조건이 확정되지 않으면 음성 인식은 기본 차단된다',async()=>{
  const res={writeHead(status){this.status=status;},end(text){this.data=JSON.parse(text);}};
  await transcribe({headers:{}},res);
  assert.equal(res.status,403);
  assert.match(res.data.error,/이용 조건/);
});
