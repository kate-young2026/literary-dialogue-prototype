// Local UI fixture only. It is not a Supabase emulator or an authorization test.
import http from 'node:http';
const teacher='11111111-1111-4111-8111-111111111111';
const student='22222222-2222-4222-8222-222222222222';
const classId='33333333-3333-4333-8333-333333333333';
const assignment='44444444-4444-4444-8444-444444444444';
const session='55555555-5555-4555-8555-555555555555';
const submission='66666666-6666-4666-8666-666666666666';
const datasets={
  ld_profiles:[{id:teacher,role:'teacher',display_name:'시험 교사'},{id:student,role:'student',display_name:'시험 학생'}],
  ld_classes:[{id:classId,name:'시험 학급',school:'시험 고등학교',teacher_id:teacher}],
  literary_works:[{id:1,title:'관내분실',author:'김초엽',category:'현대소설',period:'2010년대 이후',content:{}}],
  ld_assignments:[{id:assignment,class_id:classId,title:'시험 과제',rubric:[{text:'교사 확인 루브릭'}]}],
  ld_sessions:[{id:session,student_id:student,assignment_id:assignment}],
  ld_submissions:[{id:submission,session_id:session,version:1,content:'시험 요약',ld_sessions:{student_id:student,assignment_id:assignment,character:'지민'}}],
  ld_messages:[{turn_index:1,role:'student',content:'시험 질문'},{turn_index:1,role:'assistant',content:'시험 답변'}],
  ld_memberships:[{class_id:classId,student_id:student}],
  ld_feedback:[],ld_teacher_feedback_drafts:[],ld_summary_draft_versions:[],ld_student_details:[{user_id:student,grade:'1',class_name:'1',student_number:'2',student_name:'시험 학생'}],ld_voice_consent:[],ld_ai_drafts:[],ld_turn_exceptions:[],ld_reports:[]
};
const server=http.createServer(async (req,res)=>{
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('access-control-allow-headers','apikey,authorization,content-type,prefer');
  res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const u=new URL(req.url,'http://127.0.0.1:4311');
  let result;
  if(u.pathname==='/auth/v1/token')result={access_token:'test-token',user:{id:teacher}};
  else if(u.pathname==='/auth/v1/user')result={id:teacher};
  else if(u.pathname.startsWith('/rest/v1/')){
    const table=u.pathname.split('/').pop();
    if(!(table in datasets)){res.writeHead(404);return res.end();}
    if(table==='ld_teacher_feedback_drafts'&&req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const draft=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const index=datasets.ld_teacher_feedback_drafts.findIndex(d=>d.submission_id===draft.submission_id&&d.author_id===draft.author_id);
      if(index<0)datasets.ld_teacher_feedback_drafts.push(draft);else datasets.ld_teacher_feedback_drafts[index]=draft;
      res.writeHead(204);return res.end();
    }
    if(table==='ld_feedback'&&req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const feedback=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(datasets.ld_feedback.some(f=>f.submission_id===feedback.submission_id)){res.writeHead(409);return res.end();}
      datasets.ld_feedback.push(feedback);res.writeHead(204);return res.end();
    }
    result=datasets[table];
    if(table==='ld_profiles'&&u.searchParams.has('id'))result=result.filter(row=>row.id===teacher);
  } else {res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
});
server.listen(4311,'127.0.0.1',()=>console.log('Local teacher fixture: 4311'));
