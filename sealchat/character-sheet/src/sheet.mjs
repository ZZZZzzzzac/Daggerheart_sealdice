import { TRAITS, numeric, resource, rollCommand, safeImage, GOLD } from './model.mjs';
import { createEmbedAdapter, REQUIRED } from './embed.mjs';
import { createRefreshQueue } from './refresh-queue.mjs';
import { nativeEvent } from './native.mjs';
import {EXPERIENCE_FIELD, readExperiences, experienceRevision} from '../../../sealdice/packages/daggerheart/src/experiences.mjs';

const EMBED_ENABLED=__SEALCHAT_EMBED_ENABLED__;
let api = null, adapter = null, activeSnapshot = null;
let experiences=[], experiencesRevision='';
let epoch = 0, refreshing = false, writing = false, reconnectTimer = 0;
let observedContext='', observedConnection='';
const subscriptions = [];
const refreshQueue=createRefreshQueue(performRefresh);
function refresh() {return refreshQueue.request();}
const contextFingerprint=context=>JSON.stringify([context?.channel?.id,context?.currentUser?.id,context?.currentCharacter?.id,context?.currentCharacter?.activeVariant?.id || '',context?.permissions,context?.capabilities]);

let current = null;
let selectedTrait = null;
let edge = 'normal';
let mode = 'action';
let busyUntil = 0;
let returnFocus = null;
let editValue = null;
const el = id => document.getElementById(id);
const form = el('options');
const modal = el('roll-modal');
const signed = value => value === null ? '—' : (value > 0 ? '+' : '') + value;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function numberButton(field, className, text) {
  const button = element('button', className + ' resource-adjust', text);
  button.type = 'button'; button.dataset.editField = field; button.setAttribute('aria-label','修改'+field);
  return button;
}

function feedback(text, error = false) {
  el('feedback').textContent = text;
  el('feedback').classList.toggle('error', error);
}

function options() {
  return { ...Object.fromEntries(new FormData(form).entries()), mode, edge, experienceIndices:[...el('roll-experiences').querySelectorAll('input:checked')].map(input=>Number(input.value)), experienceRevision:experiencesRevision };
}

function canRoll() {
  return current?.canRoll === true && !current.readOnly;
}

function updateButtons() {
  el('traits').querySelectorAll('button').forEach(button => {
    button.disabled = !canRoll() || current.operationPending || numeric(current.attrs, button.dataset.trait) === null || Date.now() < busyUntil;
  });
  el('confirm-roll').disabled = !canRoll() || current.operationPending || !selectedTrait || numeric(current?.attrs, selectedTrait) === null || Date.now() < busyUntil || !!el('roll-error').textContent;
  document.querySelectorAll('[data-resource]').forEach(button => {
    const item = resource(current?.attrs, button.dataset.resource);
    const next=item.value+Number(button.dataset.delta);
    button.disabled = current?.canOperate !== true || current.readOnly || current.operationPending || item.conflict || item.value === null || item.max === null || next<0 || next>item.max;
  });
  document.querySelectorAll('[data-edit-field]').forEach(button => { button.disabled = current?.canOperate !== true || current.readOnly || current.operationPending || (numeric(current.attrs,button.dataset.editField) === null && !GOLD.some(item=>item.key===button.dataset.editField)); });
  el('refresh').disabled = !adapter || refreshing;
}

function closeModal() {
  modal.close();
  selectedTrait = null;
  returnFocus?.focus();
}

function renderExperiences() {
  let items=[], error='';
  try {items=readExperiences(current.attrs[EXPERIENCE_FIELD]);} catch (failure) {error=failure.message;}
  const revision=experienceRevision(items);
  experiences=items;
  el('experiences').replaceChildren(...(items.length ? items.map(item=>{
    const node=element('div','exp-card');node.append(element('span','exp-name',item.name),element('span','exp-mod',signed(item.modifier)));return node;
  }) : [element('p','empty-state',error || '尚未导入经历')]));
  if (revision !== experiencesRevision) {
    experiencesRevision=revision;
    el('roll-experiences').replaceChildren(...items.map((item,i)=>{
      const label=element('label','experience-choice');const input=element('input');input.type='checkbox';input.name='experience';input.value=String(i+1);
      label.append(input,element('span','exp-name',item.name),element('span','exp-mod',signed(item.modifier)));return label;
    }));
  }
  el('experience-options').hidden=!items.length;
}

function render(data) {
  const previous = current;
  // Replace snapshots instead of retaining fields from another card.
  current = { ...data, attrs: data.attrs && typeof data.attrs === 'object' ? data.attrs : {} };
  if (previous?.windowId && (previous.windowId !== current.windowId || previous.cardId !== current.cardId || previous.channelId !== current.channelId || !canRoll())) {
    el('value-modal').close(); editValue = null;
    if (modal.open) closeModal();
    form.reset();
    edge = 'normal'; mode = 'action';
    if (previous.cardId !== current.cardId || previous.channelId !== current.channelId) feedback('已切换人物卡，掷骰选项已清空。');
  }
  el('name').textContent = data.name || '未命名角色';
  el('evasion').textContent = numeric(current.attrs,'闪避') ?? '—';
  el('thresholds').replaceChildren(numberButton('重伤阈值','',numeric(current.attrs,'重伤阈值') ?? '—'),element('span','',' / '),numberButton('严重阈值','',numeric(current.attrs,'严重阈值') ?? '—'));
  const avatar = el('avatar');
  const avatarUrl = safeImage(data.avatarUrl);
  avatar.hidden = !avatarUrl;
  el('avatar-placeholder').hidden = !!avatarUrl;
  if (avatarUrl) avatar.src = avatarUrl;
  else avatar.removeAttribute('src');
  el('connection').parentElement.classList.toggle('warning', !canRoll());
  el('connection').textContent = data.connectionText || '等待 SealChat 人物卡数据…';
  el('connection').hidden=canRoll();
  el('connection').parentElement.hidden=!EMBED_ENABLED && canRoll();
  el('traits').replaceChildren(...TRAITS.map(([name]) => {
    const node = element('div','cell');
    const row = element('div','cell-main');
    const value = numeric(current.attrs,name);
    const button = element('button','attr-roll-btn','🎲');
    button.type = 'button'; button.dataset.trait = name;
    button.setAttribute('aria-label',name + '动作掷骰');
    const valueButton = element('button','cell-val resource-adjust',signed(value));
    valueButton.type='button'; valueButton.dataset.editField=name; valueButton.setAttribute('aria-label','修改'+name);
    row.append(valueButton,button);
    node.append(element('span','cell-label',name),row);
    return node;
  }));
  const resourceStyles = ['hp','stress','armor','hope'];
  el('resources').replaceChildren(...['生命','压力','护甲','希望'].map((key,index) => {
    const item = resource(current.attrs,key);
    const node = element('div','resource-card res-' + resourceStyles[index]);
    const row = element('div','res-row');
    row.append(element('span','res-label',key),numberButton(key,'res-val',item.value ?? '—'),numberButton(key+'上限','res-max',' / ' + (item.max ?? '?')));
    const controls = element('div','resource-controls');
    for (const delta of [-1,1]) {
      const button = element('button','resource-adjust',delta < 0 ? '−' : '+');
      button.type = 'button'; button.dataset.resource = key; button.dataset.delta = String(delta);
      button.setAttribute('aria-label',key + (delta < 0 ? '减一' : '加一')); controls.append(button);
    }
    row.append(controls);node.append(row);
    if (item.conflict) node.append(element('p','conflict','当前值超过上限，请核对'));
    return node;
  }));
  el('gold').replaceChildren(...GOLD.map(({key,label}) => {
    const item=resource(current.attrs,key),node=element('div','resource-card res-gold');
    const row=element('div','res-row');
    row.append(element('span','res-label',label),numberButton(key,'res-val',item.value ?? '—'),element('span','res-max','/'+item.max));
    const controls=element('div','resource-controls');
    for(const delta of [-1,1]) {
      const button=element('button','resource-adjust',delta<0 ? '−' : '+');
      button.type='button';button.dataset.resource=key;button.dataset.delta=String(delta);
      button.setAttribute('aria-label',label+(delta<0 ? '减一' : '加一'));controls.append(button);
    }
    row.append(controls);node.append(row);
    if(item.conflict) node.title='当前值超过上限，请修改数量';
    return node;
  }));
  renderExperiences();
  updateOptions(); updateButtons();
}

function updateOptions() {
  el('modal-title').textContent = (selectedTrait ? selectedTrait + ' · ' : '') + (mode === 'reaction' ? '反应掷骰' : '动作掷骰');
  document.querySelectorAll('[data-edge]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.edge === edge)));
  el('reaction').setAttribute('aria-pressed',String(mode === 'reaction'));
  el('trait-mod').textContent = selectedTrait ? signed(numeric(current?.attrs,selectedTrait)) : '—';
  const cost=options().experienceIndices.length;
  const bonus=options().experienceIndices.reduce((sum,i)=>sum+(experiences[i-1]?.modifier || 0),0);
  el('experience-cost').textContent=cost ? `经历修正 ${signed(bonus)} · 消耗 ${cost} 希望` : '每项经历消耗 1 希望';
  try {
    if(selectedTrait) rollCommand(selectedTrait,options());
    if(cost && (!Number.isInteger(numeric(current?.attrs,'希望')) || numeric(current?.attrs,'希望')<cost)) throw Error('希望不足，无法使用所选经历');
    el('roll-error').textContent = '';
  }
  catch (error) { el('roll-error').textContent = error.message; }
  updateButtons();
}

form.addEventListener('input',updateOptions);
form.addEventListener('click',event => {
  const button = event.target.closest('[data-edge]');
  if (!button) return;
  edge = edge === button.dataset.edge ? 'normal' : button.dataset.edge;
  updateOptions();
});
el('reaction').addEventListener('click',() => { mode = mode === 'action' ? 'reaction' : 'action'; updateOptions(); });
el('cancel-roll').addEventListener('click',closeModal);
modal.addEventListener('cancel',() => { selectedTrait = null; });
el('traits').addEventListener('click',event => {
  const button = event.target.closest('button[data-trait]');
  if (!button || button.disabled || !canRoll()) return;
  selectedTrait = button.dataset.trait; returnFocus = button;
  form.reset(); edge = 'normal'; mode = 'action';
  updateOptions(); updateButtons(); modal.showModal();
});
async function requestRoll(event) {
  event.preventDefault();
  if (!selectedTrait || !canRoll() || numeric(current?.attrs, selectedTrait) === null || Date.now() < busyUntil) return;
  try {
    const input = {trait:selectedTrait,options:options()}, expected=EMBED_ENABLED ? activeSnapshot : current;
    busyUntil = Date.now() + 1200;
    closeModal(); updateButtons(); setTimeout(updateButtons,1250);
    await sendCommand('roll',input,expected);
  } catch (error) { feedback(error.message,true); }
}
// SealChat uses sandbox="allow-scripts" without allow-forms. Explicit click
// handling works there; native form submission is disabled by the sandbox.
form.addEventListener('submit', requestRoll);
el('confirm-roll').addEventListener('click', requestRoll);
document.addEventListener('click',event => {
  const button = event.target.closest('[data-resource]');
  if (!button || button.disabled || current?.canOperate !== true || current.operationPending) return;
  // srcdoc has an opaque origin; do not depend on crypto.randomUUID support.
  submitOperation({field:button.dataset.resource,delta:Number(button.dataset.delta)});
});
function submitOperation(operation, expected=EMBED_ENABLED ? activeSnapshot : current) {
  void sendCommand('st',operation,expected).catch(error=>feedback(error.message,true));
}
document.addEventListener('click',event => {
  const button = event.target.closest('[data-edit-field]');
  if (!button || button.disabled || current?.canOperate !== true || current.operationPending) return;
  editValue = {field:button.dataset.editField,snapshot:EMBED_ENABLED ? activeSnapshot : current};
  el('value-title').textContent = '修改'+editValue.field;
  el('value-input').value = numeric(current.attrs,editValue.field) ?? '';
  el('value-modal').showModal();
});
el('cancel-value').addEventListener('click',()=>{ el('value-modal').close(); editValue=null; });
el('save-value').addEventListener('click',()=>{
  const text=el('value-input').value.trim(), value=Number(text);
  if (!editValue || !/^[+-]?\d+$/.test(text) || !Number.isSafeInteger(value) || current.canOperate!==true) return;
  submitOperation({field:editValue.field,value},editValue.snapshot); el('value-modal').close(); editValue=null;
});
window.addEventListener('message',event => {
  if (event.source !== window.parent || event.data?.type !== 'SEALCHAT_UPDATE') return;
  const data = event.data.payload;
  if (!data || typeof data.windowId !== 'string' || !data.windowId) return;
  if (api || embedConfig()) return;
  // Use the standard native route. It sends as the current chat identity;
  // the window contract cannot atomically verify the displayed card binding.
  if(current?.windowId && (current.windowId!==data.windowId || current.name!==data.name)) {
    epoch++;
  }
  render({windowId:data.windowId,cardId:data.name,name:data.name,attrs:data.attrs,avatarUrl:data.avatarUrl,canRoll:true,canOperate:true});
});
render({name:'等待人物卡',attrs:{},canRoll:false});

function embedConfig() {
  if(!EMBED_ENABLED) return null;
  const config=window.__SEALCHAT_EMBED_CONFIG__ || {}, query=new URLSearchParams(location.search);
  const hostOrigin=config.hostOrigin || query.get('hostOrigin'), sdkUrl=config.sdkUrl || query.get('sdkUrl');
  return hostOrigin && sdkUrl ? {hostOrigin,sdkUrl} : null;
}

async function performRefresh() {
  if (!adapter) return;
  refreshing=true; updateButtons();
  const token=epoch, active=adapter, client=api;
  try {
    const snapshot=await active.read();
    if (token!==epoch) return;
    activeSnapshot=snapshot;
    const context=snapshot.context;
    observedContext=contextFingerprint(context);
    observedConnection=context.connection?.state || '';
    const canSend=snapshot.card?.sheetType==='daggerheart' && snapshot.status?.available && context.permissions?.canSendMessage===true && context.capabilities.includes('messages.send') && context.connection?.state==='connected';
    render({windowId:'embed',cardId:snapshot.card?.name,channelId:context.channel?.id,name:snapshot.card?.name || '没有活动人物卡',attrs:snapshot.card?.attrs || {},avatarUrl:snapshot.card?.avatar,canRoll:canSend,canOperate:canSend,operationPending:writing,connectionText:canSend ? '' : snapshot.status?.reason || (snapshot.card && snapshot.card.sheetType!=='daggerheart' ? '当前卡不是匕首之心规则，请核对 .set dh 和 .st fmt。' : '请绑定自己的 Dice 人物卡，开启频道人物卡 API 和指令发送权限。')});
  } catch(error) {
    if(token===epoch) { activeSnapshot=null; render({name:'暂时无法读取人物卡',attrs:{},canRoll:false,canOperate:false,connectionText:error.code ? error.code+'：'+error.message : error.message}); feedback('读取失败，已停用操作；请重连或刷新。',true); }
  } finally { refreshing=false; updateButtons(); }
}

async function sendCommand(kind,input,expected) {
  if(!EMBED_ENABLED) {
    if(!expected || expected.windowId!==current?.windowId || expected.name!==current?.name) throw Error('展示卡已变化，请重新操作');
    if(writing) throw Error('请勿连续重复点击');
    const event=nativeEvent(current,kind,input);
    window.parent.postMessage(event,'*');
    // The native bridge has no dispatch receipt. Never claim Dice committed it.
    feedback('');
    writing=true; current.operationPending=true;updateButtons();
    setTimeout(()=>{writing=false;current.operationPending=false;updateButtons();},1200);
    return;
  }
  if (!adapter || writing) throw Error('未连接或上一项操作尚未返回');
  writing=true; current.operationPending=true; updateButtons();
  feedback('');
  try {
    await adapter.send(kind,input,expected);
  } catch(error) {
    feedback('未确认结果：'+(error.code || '')+' '+error.message+'。请先核对聊天，勿直接重复点击。',true);
  } finally { writing=false; current.operationPending=false; updateButtons(); }
}

function invalidate() {
  epoch++; adapter?.invalidate(); activeSnapshot=null;
  el('value-modal').close(); editValue=null;
  if(modal.open) closeModal();
  render({name:'正在读取当前角色',attrs:{},canRoll:false,canOperate:false,connectionText:'上下文已变化，正在重新读取…'});
}

async function connect() {
  if(!EMBED_ENABLED) {
    el('refresh').hidden=true;el('reconnect').hidden=true;
    feedback('');
    return;
  }
  clearTimeout(reconnectTimer);
  for(const off of subscriptions.splice(0)) off();
  try { api?.close(); } catch {}
  invalidate(); api=null; adapter=null;
  const config=embedConfig();
  if(!config) { feedback('此 HTML 可作为只读模板；完整人物卡需安装到频道 iForm。'); return; }
  try {
    if(!window.SealChatEmbed) await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timer=setTimeout(()=>{script.remove();reject(Error('加载宿主 Embed SDK 超时，请检查嵌入窗配置'));},10000);
      script.src=config.sdkUrl;script.onload=()=>{clearTimeout(timer);resolve();};
      script.onerror=()=>{clearTimeout(timer);reject(Error('无法加载宿主 Embed SDK'));};document.head.append(script);
    });
    const client=await window.SealChatEmbed.connect({targetOrigin:config.hostOrigin,timeoutMs:10000});
    if(!REQUIRED.every(cap=>client.capabilities.includes(cap))) { client.close(); throw Error('iForm 缺少 context.read、characters.read 或 characterCard.read 权限'); }
    api=client; adapter=createEmbedAdapter(client);
    subscriptions.push(client.context.onChanged(context=>{
      const next=contextFingerprint(context);
      if(next===observedContext) return;
      observedContext=next;observedConnection=context.connection?.state || '';
      invalidate();void refresh();
    }));
    subscriptions.push(client.connection.onChanged(state=>{
      if(state.state===observedConnection) return;
      observedConnection=state.state;invalidate();void refresh();
    }));
    subscriptions.push(client.session.onClosed(()=>{invalidate(); api=null;adapter=null;feedback('连接已关闭，等待重连…');reconnectTimer=setTimeout(()=>void connect(),1500);}));
    await client.connection.getState();
    await refresh();
  } catch(error) {
    const message='连接失败：'+(error.code || '')+' '+error.message;
    render({name:'无法连接嵌入窗',attrs:{},canRoll:false,canOperate:false,connectionText:message});
    feedback('检查嵌入窗权限后点击重连。',true);
  }
}

el('refresh').addEventListener('click',()=>void refresh());
el('reconnect').addEventListener('click',()=>void connect());
setInterval(()=>{if(api && !writing && !document.hidden) void refresh();},10000);
window.addEventListener('beforeunload',()=>{clearTimeout(reconnectTimer);for(const off of subscriptions.splice(0))off();try{api?.close();}catch{}});
void connect();
