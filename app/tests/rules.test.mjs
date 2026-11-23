import test from 'node:test';
import assert from 'node:assert/strict';
import {countCharacters, countTurns, validSummary, mayRecord, isPilotWork, optionalScore} from '../lib/rules.mjs';
test('요약 글자 수는 공백, 줄바꿈과 사용자에게 보이는 문자를 센다', () => {
  assert.equal(countCharacters('가 나\n👩‍👧'), 5);
  assert.equal(countCharacters('가'), 1);
  assert.equal(validSummary('가'.repeat(299)), true);
  assert.equal(validSummary('가'.repeat(300)), true);
  assert.equal(validSummary('가'.repeat(301)), false);
  assert.equal(validSummary('   '), false);
});
test('대화는 학생과 정상 AI 응답 쌍만 세고 중복은 제외한다', () => {
  const records = [{turn_index:1,role:'student',content:'질문'}, {turn_index:1,role:'assistant',content:'답'}, {turn_index:1,role:'assistant',content:'답'}, {turn_index:2,role:'student',content:'질문'}, {turn_index:2,role:'assistant',content:'  '}];
  assert.equal(countTurns(records), 1);
});
test('녹음은 차례당 최초와 수정 세 번까지만 허용한다', () => {
  assert.deepEqual([0,1,2,3,4].map(mayRecord), [true,true,true,true,false]);
});
test('시범 인물과 자료는 김초엽의 관내분실에만 적용한다', () => {
  assert.equal(isPilotWork({title:'관내 분실',author:'김초엽'}),true);
  assert.equal(isPilotWork({title:'관내분실',author:'다른 작가'}),false);
  assert.equal(isPilotWork({title:'다른 작품',author:'김초엽'}),false);
  assert.equal(isPilotWork(null),false);
});
test('교사 점수는 선택 사항이며 만점과 함께 유효한 범위로 입력한다',()=>{
  assert.equal(optionalScore('',''),null);
  assert.deepEqual(optionalScore('17.5','20'),{score:17.5,score_max:20});
  assert.throws(()=>optionalScore('','20'));
  assert.throws(()=>optionalScore('21','20'));
  assert.throws(()=>optionalScore('1','0'));
});
