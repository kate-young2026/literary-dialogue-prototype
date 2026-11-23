import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pilotRubric} from '../lib/rubric.mjs';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
const rubric=JSON.stringify(pilotRubric).replaceAll('<','\\u003c');
const previewScript=`<script>
document.getElementById('rubric-guide').textContent=${rubric};
document.querySelectorAll('button').forEach(b=>{if(!b.closest('#quiz'))b.disabled=true;});
document.querySelectorAll('#login-form input, #chat-form textarea').forEach(e=>e.disabled=true);
document.getElementById('status').textContent='공개 화면 시안입니다. 로그인과 데이터 저장은 연결되지 않았습니다.';
document.getElementById('summary').addEventListener('input',e=>{document.getElementById('counter').textContent=[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(e.target.value)].length+' / 300자';});
document.getElementById('quiz-form').addEventListener('submit',e=>{e.preventDefault();const answers=['0','1','2'],notes=['지민은 어머니의 마인드를 찾습니다.','기술이 인물과 사건에 미치는 영향을 생각합니다.','작품 근거와 여러 관점을 살핍니다.'];document.getElementById('quiz-result').textContent=answers.map((a,i)=>{const v=document.querySelector('input[name="q'+(i+1)+'"]:checked');return (i+1)+'번: '+(!v?'선택해 보세요':v.value===a?'잘 살펴봤어요':'다시 생각해 보세요')+' · '+notes[i];}).join(' / ');});
</script>`;
const banner='<div class="preview-notice" role="status"><strong>공개 시안</strong> · 화면과 퀴즈를 미리 살펴볼 수 있습니다. AI 대화·로그인·녹음·학생 데이터 저장은 아직 연결되지 않았습니다.</div>';
let output=html.replace('<link rel="stylesheet" href="/style.css"><script type="module" src="/app.js"></script>',`<style>${css}\n.preview-notice{background:#fff0d5;color:#593c0a;padding:14px 5vw;font-size:.95rem}</style>`)
  .replace('</header>','</header>'+banner).replace('</body>',previewScript+'</body>');
if(output.includes('src="/app.js"')||!output.includes('공개 시안'))throw Error('시안 생성에 실패했습니다.');
await mkdir(new URL('../public-preview/',import.meta.url),{recursive:true});
await writeFile(new URL('../public-preview/index.html',import.meta.url),output,'utf8');
console.log('Public preview built without application secrets or live API calls.');
