import { stCommand } from './embed.mjs';
import { rollCommand } from './model.mjs';

export function nativeEvent(snapshot, kind, input) {
  if(!snapshot?.windowId || !snapshot.name) throw Error('请先打开人物卡');
  const command=kind==='roll' ? rollCommand(input.trait,input.options) : kind==='st' ? stCommand(input,snapshot.attrs) : null;
  if(!command) throw Error('无效指令');
  return {type:'SEALCHAT_EVENT',version:1,windowId:snapshot.windowId,action:'ROLL_DICE',payload:{roll:{template:command,label:kind==='roll' ? input.trait+' · '+(input.options?.mode==='reaction' ? '反应掷骰' : '动作掷骰') : input.field+'调整',args:{},dispatchMode:'template'}}};
}

// Build from the original template, never serialize a rendered card or attrs.
export function characterHtml(source) {
  if(!source?.markup?.includes('/* STYLES */') || !source.markup.includes('/* SCRIPT */') || !source.script) throw Error('缺少人物卡模板');
  const script=source.script.replace(/<\/script/gi,'<\\/script');
  return source.markup.replace('/* STYLES */',()=>source.styles).replace('/* SCRIPT */',()=>script);
}
