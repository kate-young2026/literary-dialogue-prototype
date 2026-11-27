// Explicitly limited to the existing disposable test project. Never overwrite rows.
const base = new URL(process.env.SUPABASE_URL || '');
if (base.protocol !== 'https:' || base.hostname !== 'mwaswnytzcoasriduqeo.supabase.co') throw Error('지정된 시험 프로젝트에서만 실행할 수 있습니다.');
const key=process.env.SUPABASE_SECRET_KEY;
if(!key)throw Error('시험 프로젝트의 서버 키가 필요합니다.');
const headers={apikey:key,...(key.startsWith('sb_secret_')?{}:{authorization:`Bearer ${key}`})};
const source='https://ibook.vivasam.com/CBS_iBook/936/contents/index.html';
const records=[
  ['산속에서','나희덕','서정 갈래','본문'],
  ['연필로 쓰기','정진규','서정 갈래','활동'],
  ['관내 분실','김초엽','서사 갈래','본문'],
  ['결혼','이강백','극 갈래','본문'],
  ['화단','이태준','교술 갈래','본문'],
  ['광화문, 겨울, 불꽃, 나무','이문재','교술 갈래','활동']
];
const response=await fetch(`${base.origin}/rest/v1/literary_works?select=id,title,author&limit=1000`,{headers,signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error(`작품 조회 실패 HTTP ${response.status}`);
const existing=await response.json();
const normalize=value=>String(value||'').replace(/\s/g,'');
const additions=records.filter(([title,author])=>!existing.some(row=>normalize(row.title)===normalize(title)&&normalize(row.author)===normalize(author))).map(([title,author,genre,kind])=>({
  title,author,category:'교과서 수록',genre,
  content:{textbook_reference:{book:'2022 개정 비상교육 공통국어1 (박영민)',unit:'1. 네 가지 빛깔로 만나는 문학',section:genre,kind,source,location:'뷰어 목차 (쪽 미확인)',checked_by:'AI 목차 확인; 담당 교사 미확인',checked_at:'2026-11-27',status:'작품명·작가·단원 목차만 확인. 본문 분석·이용 조건 교사 확인 필요'}}
}));
if(!additions.length){console.log('추가할 작품 없음');process.exit(0);}
const saved=await fetch(`${base.origin}/rest/v1/literary_works`,{method:'POST',headers:{...headers,'content-type':'application/json',prefer:'return=representation'},body:JSON.stringify(additions),signal:AbortSignal.timeout(15000)});
if(!saved.ok)throw Error(`작품 추가 실패 HTTP ${saved.status}`);
console.log(JSON.stringify({added:(await saved.json()).map(({id,title,author})=>({id,title,author})),skipped:records.length-additions.length}));
