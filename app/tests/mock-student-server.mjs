// Local, in-memory UI fixture. Not a Supabase emulator or security test.
import http from 'node:http';
const uid='11111111-1111-4111-8111-111111111111';
const aid='22222222-2222-4222-8222-222222222222';
const sid='33333333-3333-4333-8333-333333333333';
const messages=Array.from({length:10},(_,i)=>[
  {id:`student-${i}`,turn_index:i+1,role:'student',content:'작품에 대한 시험 질문'},
  {id:`ai-${i}`,turn_index:i+1,role:'assistant',content:'근거를 함께 살펴볼까요?'}
]).flat();
const state={details:[],consent:[],drafts:[],submissions:[],feedback:[],revision:[]};
const datasets={
  ld_profiles:[{id:uid,role:'student',display_name:'시험 학생'}],
  literary_works:[{id:1,title:'관내분실',author:'김초엽',category:'현대소설',period:'2010년대 이후',content:{}}],
  ld_classes:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',school:'시험 고등학교'}],
  ld_assignments:[{id:aid,class_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',work_id:1,title:'시험 과제',rubric:[{text:'교사가 확정한 시험 평가 기준'}],prompt:'다른 선택을 했다면?',material:{summary:'교사가 확인한 작품 설명'}}],
  ld_sessions:[{id:sid,assignment_id:aid,student_id:uid,character:'지민'}],ld_messages:messages,ld_recordings:[]
};
const tableState={ld_student_details:'details',ld_voice_consent:'consent',ld_summary_draft_versions:'drafts',ld_submissions:'submissions',ld_feedback:'feedback',ld_summary_drafts:'revision'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','apikey,authorization,content-type,prefer');res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const u=new URL(req.url,'http://127.0.0.1:4314');let result;
  if(u.pathname==='/auth/v1/token')result={access_token:'test-token',user:{id:uid}};
  else if(u.pathname==='/auth/v1/user')result={id:uid};
  else if(u.pathname==='/rest/v1/rpc/ld_has_turn_exception')result=false;
  else if(u.pathname==='/rest/v1/rpc/ld_voice_allowed')result=!!state.consent[0]?.enabled;
  else if(u.pathname.startsWith('/rest/v1/')){
    const table=u.pathname.split('/').pop(),key=tableState[table];
    if(req.method==='POST'&&key){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const item=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(key==='drafts')state.drafts.push({...item,created_at:'2026-11-24T00:00:00Z'});
      else if(key==='submissions'){
        const saved={...item,id:`submission-${item.version}`};state.submissions.push(saved);
        if(item.version===1)state.feedback.push({submission_id:saved.id,teacher_text:'시험 피드백',published_at:'2026-11-24T00:00:00Z',ld_submissions:{session_id:sid,version:1}});
      } else state[key]=[item];
      res.writeHead(204);return res.end();
    }
    if(key)result=state[key];else if(table in datasets)result=datasets[table];else{res.writeHead(404);return res.end();}
  }else{res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
});
server.listen(4314,'127.0.0.1',()=>console.log('Local student fixture: 4314'));
