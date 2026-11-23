export const countCharacters = text => [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].length;
export const countTurns = messages => {
  const turns = new Map();
  for (const message of messages) {
    if (!Number.isInteger(message.turn_index) || message.turn_index < 1) continue;
    const roles = turns.get(message.turn_index) ?? new Set();
    if ((message.role === 'student' || message.role === 'assistant') && message.content?.trim()) roles.add(message.role);
    turns.set(message.turn_index, roles);
  }
  return [...turns.values()].filter(roles => roles.has('student') && roles.has('assistant')).length;
};
export const validSummary = text => typeof text === 'string' && !!text.trim() && countCharacters(text) <= 300;
export const mayRecord = versions => versions >= 0 && versions < 4;
export function optionalScore(value, maximum){
  const raw=value.trim(), rawMax=maximum.trim();
  if(!raw&&!rawMax)return null;
  if(!/^\d{1,4}(\.\d{1,2})?$/.test(raw)||!/^\d{1,4}(\.\d{1,2})?$/.test(rawMax))throw Error('점수와 만점을 모두 올바르게 입력하거나 둘 다 비워 주세요.');
  const score=Number(raw),score_max=Number(rawMax);
  if(score_max<=0||score>score_max)throw Error('점수는 0 이상 만점 이하여야 합니다.');
  return {score,score_max};
}
export const isPilotWork = work => !!work && String(work.title || '').replace(/\s/g, '') === '관내분실' && String(work.author || '').replace(/\s/g, '') === '김초엽';
