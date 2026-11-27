import test from 'node:test';
import assert from 'node:assert/strict';
import {rubricDesignPrompt} from '../lib/rubric-design.mjs';

const context={standardCode:'10공국1-05-02',title:'수업 과제',question:'다른 선택을 했다면?',material:'교사가 확인한 수업 설명'};
test('선택한 성취기준과 교사가 작성한 과제 맥락을 평가 설계에 제공한다',()=>{
  const prompt=rubricDesignPrompt({...context,standardText:'위조된 원문'});
  for(const value of [context.title,context.question,context.material,context.standardCode,'공통국어1','판단을 보류','재녹음 횟수'])assert.ok(prompt.includes(value));
  assert.doesNotMatch(prompt,/위조된 원문/);
});
test('미등록 성취기준과 누락되거나 지나치게 긴 자료는 거부한다',()=>{
  for(const input of [{...context,standardCode:'임의'}, {...context,material:'  '}, {...context,question:'가'.repeat(4001)}])assert.throws(()=>rubricDesignPrompt(input),TypeError);
});
