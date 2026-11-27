import test from 'node:test';
import assert from 'node:assert/strict';
import {missingWorkFields} from '../lib/work-completeness.mjs';

test('카드만 있는 작품은 다른 구조화 항목을 미등록으로 표시한다',()=>{
  const cards=Array.from({length:3},()=>({title:'항목',detail:'설명'}));
  const missing=missingWorkFields({cards});
  assert.ok(!missing.includes('소개 카드'));
  assert.ok(missing.includes('인물·화자'));
  assert.ok(missing.includes('자료 이용 조건'));
});
test('빈 객체와 빈 문자열은 등록된 근거로 간주하지 않는다',()=>{
  assert.ok(missingWorkFields({cards:[{title:' ',detail:'내용'}],questions:[{}],rights_note:' '}).includes('학습 질문'));
  assert.ok(missingWorkFields(null).includes('소개 카드'));
});
