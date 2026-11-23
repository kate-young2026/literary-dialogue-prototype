import test from 'node:test';
import assert from 'node:assert/strict';
import {createAiLimiter} from '../lib/ai-limiter.mjs';

test('학생별 AI 요청을 제한하고 시간이 지나면 다시 허용한다',()=>{
  let clock=0;const allow=createAiLimiter({limit:2,windowMs:1000,now:()=>clock});
  assert.equal(allow('student-a'),true);assert.equal(allow('student-a'),true);
  assert.equal(allow('student-a'),false);assert.equal(allow('student-b'),true);
  clock=1000;assert.equal(allow('student-a'),true);
});
test('사용자 수 한도를 넘으면 기존 제한을 유지하고 만료 후 공간을 회수한다',()=>{
  let clock=0;const allow=createAiLimiter({limit:1,windowMs:1000,maxUsers:1,now:()=>clock});
  assert.equal(allow('a'),true);assert.equal(allow('b'),false);assert.equal(allow('a'),false);
  clock=1000;assert.equal(allow('b'),true);
});

