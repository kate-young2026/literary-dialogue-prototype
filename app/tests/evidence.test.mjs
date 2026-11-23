import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluationEvidence,clippedText} from '../lib/evidence.mjs';

test('긴 대화는 앞뒤의 차례를 남기고 누락과 발화 잘림을 표시한다',()=>{
  const messages=Array.from({length:30},(_,i)=>({turn_index:i+1,role:'student',content:'가'.repeat(2000),id:'private-id'}));
  const evidence=evaluationEvidence(messages);
  assert.ok(evidence.omitted_messages>0);
  assert.equal(evidence.messages[0].turn_index,1);
  assert.equal(evidence.messages.at(-1).turn_index,30);
  assert.equal(evidence.messages[0].truncated,true);
  assert.equal('id' in evidence.messages[0],false);
  assert.ok(JSON.stringify(evidence.messages).length<=15000);
});
test('짧은 근거는 빠짐없이 전달하고 긴 요약은 잘림을 표시한다',()=>{
  const evidence=evaluationEvidence([{turn_index:1,role:'student',content:'생각'}]);
  assert.equal(evidence.omitted_messages,0);assert.equal(evidence.messages[0].truncated,false);
  assert.equal(clippedText('가'.repeat(3001)).truncated,true);
});
