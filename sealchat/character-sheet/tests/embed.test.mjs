import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbedAdapter, stCommand } from '../src/embed.mjs';

function harness() {
  const h={context:{channel:{id:'channel'},currentUser:{id:'user'},currentCharacter:{id:'identity',activeVariant:null},permissions:{canSendMessage:true},capabilities:['messages.send'],connection:{state:'connected'}},card:{name:'角色',sheetType:'daggerheart',attrs:{敏捷:2,希望:2,希望上限:6}},sent:[],docs:new Map()};
  h.api={context:{get:async()=>structuredClone(h.context)},characterCard:{getCurrent:async()=>({status:{available:true},card:structuredClone(h.card)})},messages:{send:async params=>{h.sent.push(params);}},storage:{get:async key=>structuredClone(h.docs.get(key) || null),set:async(key,value,options)=>{const old=h.docs.get(key);if(options && options.ifRevision!==old?.revision)throw Error('REVISION_CONFLICT');const saved={key,value,revision:(old?.revision || 0)+1};h.docs.set(key,saved);return saved;}}};
  h.adapter=createEmbedAdapter(h.api); return h;
}

test('resource delta stays relative and roll resolves the named trait in Dice',async()=>{
  const h=harness(), expected=await h.adapter.read();
  h.card.attrs.希望=3;
  assert.equal(await h.adapter.send('st',{field:'希望',delta:-1},expected),'.st 希望-1');
  assert.equal(await h.adapter.send('roll',{trait:'敏捷',options:{edge:'adv'}},expected),'.dd 敏捷 adv');
  assert.deepEqual(h.sent.map(item=>item.identityId),['identity','identity']);
  assert.equal(h.card.attrs.希望,3); // Sending is not an optimistic resource update.
});

test('st validates fields, injection, missing data and fresh resource bounds',()=>{
  for(const input of [{field:'$daggerheart',value:2},{field:'希望\n.st',value:2},{field:'生命',delta:2},{field:'力量',value:1.5},{field:'希望',value:-1}]) assert.throws(()=>stCommand(input,{}));
  assert.throws(()=>stCommand({field:'希望',delta:-1},{希望:0,希望上限:6}));
  assert.throws(()=>stCommand({field:'希望',delta:1},{希望:6,希望上限:6}));
  assert.equal(stCommand({field:'力量',value:-1},{}),'.st 力量=-1');
  assert.equal(stCommand({field:'希望',value:0},{}),'.st 希望0');
});

test('observed card/channel/user/identity changes prevent stale commands',async()=>{
  for(const mutate of [h=>h.card.name='另一张卡',h=>h.context.channel.id='other',h=>h.context.currentUser.id='other',h=>h.context.currentCharacter.id='other',h=>h.context.currentCharacter.activeVariant={id:'variant'},h=>h.adapter.invalidate(),h=>h.context.permissions.canSendMessage=false]) {
    const h=harness(), old=await h.adapter.read(); mutate(h);
    await assert.rejects(h.adapter.send('roll',{trait:'敏捷'},old)); assert.equal(h.sent.length,0);
  }
});

test('another ruleset cannot receive daggerheart commands',async()=>{
  const h=harness();h.card.sheetType='coc7';const old=await h.adapter.read();
  await assert.rejects(h.adapter.send('st',{field:'希望',delta:-1},old),/不是匕首之心/);
  assert.equal(h.sent.length,0);
});

test('context change during read and A to B to A invalidation discard stale requests',async()=>{
  const h=harness(), old=await h.adapter.read();
  h.api.characterCard.getCurrent=async()=>{h.adapter.invalidate();return {status:{available:true},card:h.card};};
  await assert.rejects(h.adapter.send('st',{field:'希望',delta:-1},old),/变化/);
  assert.equal(h.sent.length,0);
});

test('duplicate in-flight clicks rejected; a message timeout is never retried',async()=>{
  const h=harness(), old=await h.adapter.read(); let release;
  h.api.messages.send=async params=>{h.sent.push(params);await new Promise(resolve=>{release=resolve;});throw Error('TIMEOUT');};
  const first=h.adapter.send('roll',{trait:'敏捷'},old);
  while(!release) await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(h.adapter.send('roll',{trait:'敏捷'},old),/尚未返回/);
  release();await assert.rejects(first,/TIMEOUT/);assert.equal(h.sent.length,1);
});
