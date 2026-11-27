import test from 'node:test';
import assert from 'node:assert/strict';
import { hostingSettings, allowsOrigin } from '../lib/hosting.mjs';

test('로컬 기본 설정은 외부 공개 출처를 허용하지 않는다', () => {
  const settings = hostingSettings({});
  assert.equal(settings.host, '127.0.0.1');
  assert.equal(allowsOrigin('http://localhost:4173', settings), true);
  assert.equal(allowsOrigin('http://127.0.0.1:4173', settings), true);
  assert.equal(allowsOrigin('https://example.com', settings), false);
});
test('공개 바인딩은 명시된 정확한 HTTPS 출처만 허용한다', () => {
  assert.throws(() => hostingSettings({HOST:'0.0.0.0'}));
  for (const origin of ['http://example.com', 'https://example.com/path', 'https://example.com/', 'https://127.0.0.1', '*', 'null']) {
    assert.throws(() => hostingSettings({HOST:'0.0.0.0',ALLOWED_ORIGIN:origin}));
  }
  const settings = hostingSettings({HOST:'0.0.0.0', PORT:'5000', ALLOWED_ORIGIN:'https://school.example.com'});
  assert.equal(allowsOrigin('https://school.example.com', settings), true);
  assert.equal(allowsOrigin('https://school.example.com.evil.test', settings), false);
  assert.equal(allowsOrigin('http://localhost:5000', settings), false);
});
test('잘못된 포트와 바인딩 주소는 실행하지 않는다', () => {
  for (const port of ['0','65536','not-a-port']) assert.throws(() => hostingSettings({PORT:port}));
  assert.throws(() => hostingSettings({HOST:'::'}));
});
