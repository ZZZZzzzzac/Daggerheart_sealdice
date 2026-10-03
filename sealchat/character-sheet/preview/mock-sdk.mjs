import { fixture } from './fixture.mjs';
// Local test double only; never included in the deliverable HTML.
let card={name:fixture.name,sheetType:'daggerheart',attrs:structuredClone(fixture.attrs)};
let context={channel:{id:'preview-channel'},currentUser:{id:'preview-user'},currentCharacter:{id:'preview-identity',activeVariant:null},permissions:{canSendMessage:true},capabilities:['context.read','characters.read','characterCard.read','messages.send'],connection:{state:'connected'}};
let status={available:true};
const handlers=new Map();
function on(name,callback) { if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(callback);return ()=>handlers.get(name).delete(callback); }
function emit(name,value) { for(const callback of handlers.get(name)||[]) callback(structuredClone(value)); }
const api={
  capabilities:context.capabilities,
  context:{get:async()=>structuredClone(context),onChanged:callback=>on('context',callback)},
  connection:{getState:async()=>context.connection,onChanged:callback=>on('connection',callback)},
  characterCard:{getCurrent:async()=>({status,card:status.available?structuredClone(card):null})},
  session:{onClosed:callback=>on('closed',callback)},
  messages:{send:async params=>{window.parent.postMessage({type:'DH_PREVIEW_COMMAND',payload:params},'*');}},
  close:()=>{},
};
window.SealChatEmbed={connect:async()=>api};
window.addEventListener('message',event=>{
  if(event.source!==window.parent || event.data?.type!=='DH_PREVIEW_SCENARIO')return;
  card={name:fixture.name,sheetType:'daggerheart',attrs:structuredClone(fixture.attrs)};status={available:true};context.permissions.canSendMessage=true;
  context.currentCharacter.id='preview-identity';
  switch(event.data.scenario) {
    case 'missing':card.attrs={敏捷:0,生命:0,希望:null};break;
    case 'readonly':context.permissions.canSendMessage=false;break;
    case 'unbound':status={available:false,reason:'当前频道没有活动人物卡'};break;
    case 'switch':card.name='另一测试角色';context.currentCharacter.id='second-preview-identity';card.attrs={力量:3,生命:0,生命上限:8};break;
    case 'updated':card.attrs.希望=3;card.attrs.压力=0;break;
  }
  emit('context',context);
  // Fixed upstream publishes both notifications for one context change.
  emit('connection',context.connection);
});
