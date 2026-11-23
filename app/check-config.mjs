// Read-only checks: never log credentials, project URLs, or response bodies.
const present=value=>!!value?.trim()&&!/^(YOUR_|시험용_|OpenAI_API_)/.test(value.trim());
const entries=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','OPENAI_API_KEY','OPENAI_MODEL'];
const missing=entries.filter(name=>!present(process.env[name]));
if(missing.length){console.log(`설정이 필요한 항목: ${missing.join(', ')}`);process.exitCode=1;}
const checks=[];
if(present(process.env.SUPABASE_URL)&&present(process.env.SUPABASE_PUBLISHABLE_KEY)){
  let base;
  try {base=new URL(process.env.SUPABASE_URL);} catch {console.error('Supabase URL 형식이 올바르지 않습니다.');process.exitCode=1;}
  if(base){
    if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/'||!base.hostname.endsWith('.supabase.co')){
      console.error('시험용 Supabase 프로젝트의 HTTPS URL을 입력해 주세요.');process.exitCode=1;
    }else if(base.hostname==='kygvdfvzpwpchhwczifo.supabase.co'){
      console.error('기존 프로젝트가 설정돼 있습니다. 별도의 테스트 프로젝트로 확인해 주세요.');process.exitCode=1;
    }else checks.push(['Supabase Auth',new URL('/auth/v1/health',base),{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}]);
  }
}
if(present(process.env.OPENAI_API_KEY)&&present(process.env.OPENAI_MODEL)){
  const model=process.env.OPENAI_MODEL.trim();
  if(!/^[a-zA-Z0-9._-]+$/.test(model)){console.error('OpenAI 모델 이름이 올바르지 않습니다.');process.exitCode=1;}
  else checks.push(['OpenAI 모델',`https://api.openai.com/v1/models/${encodeURIComponent(model)}`,{authorization:`Bearer ${process.env.OPENAI_API_KEY}`}]);
}
for(const [label,url,headers] of checks){
  try{
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(10000)});
    console.log(`${label}: ${response.ok?'연결 확인':`확인 실패 (HTTP ${response.status})`}`);
    if(!response.ok)process.exitCode=1;
  }catch{console.log(`${label}: 네트워크 연결 실패`);process.exitCode=1;}
}
console.log('Supabase 비밀 키 유효성, DB 권한·스키마와 실제 대화는 이 검사에 포함되지 않습니다.');
