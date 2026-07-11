export const _uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;

export function timeAgo(ts){
  if(!ts) return "";
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60) return "방금 전";
  if(s<3600) return `${Math.floor(s/60)}분 전`;
  if(s<86400) return `${Math.floor(s/3600)}시간 전`;
  if(s<172800) return "어제";
  return `${Math.floor(s/86400)}일 전`;
}

