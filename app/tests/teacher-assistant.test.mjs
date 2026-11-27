import test from 'node:test';
import assert from 'node:assert/strict';
import {runAssistant} from '../lib/teacher-assistant.mjs';

test('담당자 초안을 조정자에게 전달하고 검토용 답변을 반환한다', async()=>{
  const calls=[];
  const result=await runAssistant({role:'works',message:'수업 후보를 찾아줘',history:[{role:'teacher',text:'앞선 요청'}],catalog:[{title:'작품'}],call:async(...args)=>{calls.push(args);return ['담당자 초안','점검한 초안','조정자 답변'][calls.length-1];}});
  assert.equal(result,'조정자 답변');
  assert.equal(calls.length,3);
  assert.match(calls[0][1],/작품/);
  assert.match(calls[1][1],/담당자 초안/);
  assert.match(calls[2][1],/점검한 초안/);
  assert.match(calls[0][1],/앞선 요청/);
});
test('잘못된 역할이나 빈 요청은 AI 호출 전에 거부한다', async()=>{
  let called=false;
  for(const [role,message] of [['feedback','평가'],['works',' ']]) {
    await assert.rejects(runAssistant({role,message,catalog:[],call:async()=>{called=true;}}),TypeError);
  }
  assert.equal(called,false);
});
test('담당자 호출이 실패하면 조정자를 호출하지 않는다', async()=>{
  let calls=0;
  await assert.rejects(runAssistant({role:'rubric',message:'설계',catalog:[],call:async()=>{calls++;throw Error('failed');}}));
  assert.equal(calls,1);
});
