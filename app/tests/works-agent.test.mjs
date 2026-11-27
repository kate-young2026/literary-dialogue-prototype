import test from 'node:test';
import assert from 'node:assert/strict';
import {worksCatalog} from '../lib/works-agent.mjs';

test('작품 담당자에게 필요한 기본 정보만 전달하고 출처 주소의 비밀값을 제거한다',()=>{
  const result=worksCatalog([{title:'작품',author:'작가',genre:'소설',source_url:'https://example.org/work?token=secret#page',description:'교사 설명',rights_note:'내부 메모'}]);
  assert.deepEqual(result,[{title:'작품',author:'작가',genre:'소설',source_url:'https://example.org/work'}]);
});
test('잘못된 주소와 목록 범위는 안전하게 처리한다',()=>{
  const rows=Array.from({length:101},(_,i)=>({title:String(i),source_url:i===0?'https://user:password@example.org/':'javascript:alert(1)'}));
  const result=worksCatalog(rows);
  assert.equal(result.length,100);
  assert.equal(result[0].source_url,'');
  assert.equal(result[1].source_url,'');
  assert.throws(()=>worksCatalog(null),TypeError);
});
