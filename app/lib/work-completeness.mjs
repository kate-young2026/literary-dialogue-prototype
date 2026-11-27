const hasText=value=>typeof value==='string'&&value.trim().length>0;
const hasEntries=value=>Array.isArray(value)&&value.some(entry=>hasText(entry)||(entry&&typeof entry==='object'&&Object.values(entry).some(hasText)));

// Structured fields only: a mention inside an introduction card does not establish
// that the teacher has reviewed a complete field or that it is applicable.
export function missingWorkFields(content) {
  const data=content && typeof content==='object' && !Array.isArray(content)?content:{};
  const checks=[
    ['소개 카드',Array.isArray(data.cards)&&data.cards.length===3&&data.cards.every(c=>hasText(c?.title)&&hasText(c?.detail))],
    ['인물·화자',hasEntries(data.characters)],
    ['사건·내용',hasEntries(data.events)],
    ['배경',hasEntries(data.settings)],
    ['핵심 어휘',hasEntries(data.keywords)],
    ['학습 질문',hasEntries(data.questions)],
    ['근거 자료·위치',hasEntries(data.evidence)],
    ['자료 이용 조건',hasText(data.rights_note)]
  ];
  return checks.filter(([,present])=>!present).map(([label])=>label);
}
