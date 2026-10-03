export const GOLD = [
  {key:'金币把', label:'把', max:10},
  {key:'金币袋', label:'袋', max:10},
  {key:'金币箱', label:'箱', max:1},
];
export const SHOW_FIELDS = ['敏捷','力量','灵巧','本能','风度','知识','生命','生命上限','压力','压力上限','护甲','护甲上限','希望','希望上限','闪避','重伤阈值','严重阈值',...GOLD.map(item=>item.key),'恐惧'];
const aliases={agility:'敏捷',agi:'敏捷',strength:'力量',str:'力量',finesse:'灵巧',fin:'灵巧',instinct:'本能',ins:'本能',presence:'风度',pre:'风度',knowledge:'知识',knw:'知识',hp:'生命',hpmax:'生命上限',stress:'压力',stressmax:'压力上限',armor:'护甲',armormax:'护甲上限',hope:'希望',hopemax:'希望上限',fear:'恐惧',把:'金币把',袋:'金币袋',箱:'金币箱'};
export const canonicalField=key=>aliases[String(key).toLowerCase()] || key;

// 仅展示白名单中的已录入整数，未知字段及内部恢复标识不进入回复。
export function characterSummary(read, name, args=[]) {
  const limit=args.length===1 && /^\d+$/.test(args[0]) ? Number(args[0]) : null;
  const picks=limit===null && args.length ? new Set(args.map(canonicalField)) : null;
  const items=SHOW_FIELDS.flatMap(key=>{
    if(picks && !picks.has(key)) return [];
    const value=read(key);
    return Number.isSafeInteger(value) && (limit===null || value>=limit) ? [`${key}:${value}`] : [];
  });
  const lines=[];
  for(let i=0;i<items.length;i+=4) lines.push(items.slice(i,i+4).join('  '));
  return `【${name}】的个人属性：\n${lines.join('\n') || '没有可显示的已录入属性'}`;
}
