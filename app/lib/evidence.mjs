// Keep whole, numbered excerpts from both ends and disclose every omission.
export function evaluationEvidence(messages, maxChars=15000, maxEntry=1200){
  const items=messages.map(({turn_index,role,content})=>{
    const original=String(content||'');
    return {turn_index,role,content:original.slice(0,maxEntry),truncated:original.length>maxEntry};
  });
  if(JSON.stringify(items).length<=maxChars)return {messages:items,omitted_messages:0};
  const selected=[];let left=0,right=items.length-1,used=2,fromStart=true;
  while(left<=right){
    const index=fromStart?left++:right--;fromStart=!fromStart;
    const cost=JSON.stringify(items[index]).length+1;
    if(used+cost>maxChars)break;
    selected.push({index,item:items[index]});used+=cost;
  }
  selected.sort((a,b)=>a.index-b.index);
  return {messages:selected.map(x=>x.item),omitted_messages:items.length-selected.length};
}
export function clippedText(text,maxChars=3000){
  const value=String(text||'');
  return {text:value.slice(0,maxChars),truncated:value.length>maxChars};
}
