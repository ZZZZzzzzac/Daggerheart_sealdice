import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { unzipSync, strFromU8 } from 'fflate';
const bundle = buildSync({ entryPoints: [fileURLToPath(new URL('../src/main.mjs', import.meta.url))], bundle: true,
  write: false, platform: 'neutral', format: 'iife', target: 'es2020' }).outputFiles[0].text;
function host(initial = {}, shared = new Map()) {
  let ext, rolls = 0, id = 0, fail = '', user = 'SEALCHAT:P', group = 'SEALCHAT:ROOM', privilege = 50, dice = [2, 2];
  const cards = new Map(), replies = [];
  const attrs = (u = user, g = group) => { const key = `${g}|${u}`; if (!cards.has(key)) cards.set(key, new Map()); return cards.get(key); };
  for (const [k, v] of Object.entries(initial)) attrs().set(k, v);
  const context = (u = user, g = group) => ({ genDefaultRollVmConfig: () => ({}), eval: expr => {
    const inner=expr.slice(1,-1).trim();
    const values={ '+2':2, 敏捷:attrs(u,g).get('敏捷') ?? 0 };
    const v=Object.prototype.hasOwnProperty.call(values,inner)?values[inner]:null;
    return { toJSON: () => Array.from(new TextEncoder().encode(JSON.stringify({t:0,v}))) };
  }, player: { userId: u, name: '玩家' }, group: { groupId: g }, endPoint: { userId: 'SEALCHAT:BOT' }, privilegeLevel: privilege });
  const data = ctx => attrs(ctx.player.userId, ctx.group.groupId);
  const sandbox = { Math: Object.assign(Object.create(Math), { random: () => { rolls++; return ((dice.shift() ?? 2) - 0.5) / 12; } }),
    seal: { ext: { new: () => ({ cmdMap: {}, storageGet: k => shared.get(k) || '', storageSet: (k,v) => shared.set(k,v) }),
      register: v => { ext=v; }, newCmdItemInfo: () => ({}), newCmdExecuteResult: solved => ({ solved }) },
      vars: { intGet: (c,k) => [data(c).get(k) ?? 0, Number.isInteger(data(c).get(k))],
        strGet: (c,k) => k === '$t游戏模式' ? ['daggerheart', true] : [data(c).get(k) ?? '', typeof data(c).get(k) === 'string'],
        intSet: (c,k,v) => { if (`${c.player.userId}|${k}` === fail) { fail=''; throw Error('write'); } data(c).set(k,v); },
        strSet: (c,k,v) => data(c).set(k,v) },
      newMessage: () => ({ sender: {} }), createTempCtx: (_ep,msg) => context(msg.sender.userId,msg.groupId),
      replyToSender: (_c,_m,s) => replies.push(s) } };
  const reload = () => vm.runInNewContext(bundle,sandbox); reload();
  return { attrs, replies, shared, reload, get rolls() { return rolls; },
    dice: (...v) => { dice=v; }, context: o => { user=o.user ?? user; group=o.group ?? group; privilege=o.privilege ?? privilege; },
    fail: (u,k) => { fail=`${u}|${k}`; },
    run: (name,args=[],opts={}) => ext.cmdMap[name].solve({ ...context(), isPrivate: opts.private ?? false },
      { rawId: opts.noId ? undefined : opts.id ?? String(++id) }, { args, at: opts.at ?? [], kwargs: [] }) };
}
test('plain dd needs no resource fields or GM and never creates optional fields', () => {
  const h=host(); h.run('dd',[]); assert.equal(h.rolls,2); assert.match(h.replies.at(-1),/手动：希望\+1、压力-1/);
  assert.equal(h.attrs().has('希望'),false); assert.equal(h.attrs().has('压力'),false);
  h.dice(8,3); h.run('dd',['敏捷']); assert.match(h.replies.at(-1),/敏捷\)\[0\]/);
});
test('hope and stress settle independently with no GM, caps or unrelated resources', () => {
  const hope=host({ 希望:2 }); hope.run('dd',[]); assert.equal(hope.attrs().get('希望'),3); assert.equal(hope.attrs().has('压力'),false);
  const stress=host({ 压力:2 }); stress.run('dd',[]); assert.equal(stress.attrs().get('压力'),1); assert.equal(stress.attrs().has('希望'),false);
  const both=host({ 希望:6,压力:0 }); both.run('dd',[]); assert.equal(both.attrs().get('希望'),6); assert.equal(both.attrs().get('压力'),0);
  both.run('ddr',[]); assert.equal(both.attrs().get('希望'),6); assert.equal(both.attrs().get('压力'),0);
});
test('GM fear uses GM current card, reflects external st and creates only GM missing fear', () => {
  const h=host({ 恐惧:8,希望:2 }); h.run('dh',['gm','set','SEALCHAT:G']);
  h.dice(3,8); h.run('dd',[]); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),1); assert.equal(h.attrs().get('恐惧'),8);
  h.attrs('SEALCHAT:G').set('恐惧',10); h.dice(3,8); h.run('dd',[]); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),11);
  h.attrs('SEALCHAT:G').set('恐惧',12); h.dice(3,8); h.run('dd',[]); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),12);
  h.reload(); h.dice(3,8); h.run('dd',[]); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),12);
  h.run('dh',['gm','clear']); h.dice(3,8); h.run('dd',[]); assert.match(h.replies.at(-1),/手动：恐惧\+1/);
});
test('GM can be the roller without separate pools or double updates', () => {
  const h=host({ 希望:2 }); h.run('dh',['gm','claim']); h.dice(3,8); h.run('dd',[]);
  assert.equal(h.attrs().get('恐惧'),1); assert.equal(h.attrs().get('希望'),2);
});
test('GM designation permissions and group separation, private rolls never use group GM', () => {
  const h=host({ 希望:2 }); h.context({ privilege:0 }); h.run('dh',['gm','claim']); assert.match(h.replies.at(-1),/群管理/);
  h.context({ privilege:50 }); h.run('dh',['gm','set','SEALCHAT:G']); h.context({ privilege:0 });
  h.run('dh',['gm','clear']); assert.match(h.replies.at(-1),/只有GM/);
  h.context({ user:'SEALCHAT:G' }); h.run('dh',['gm','clear']); assert.match(h.replies.at(-1),/卸任/);
  h.context({ group:'SEALCHAT:SECOND' }); h.run('dh',['gm']); assert.match(h.replies.at(-1),/未指定/);
  h.run('dh',['gm','claim'],{private:true}); assert.match(h.replies.at(-1),/群聊/);
});
test('native st values update the next roll and missing fields stay absent', () => {
  const h=host({ 希望:2,压力:2 }); h.run('dd',[]); h.attrs().set('希望',4); h.attrs().delete('压力'); h.dice(2,2); h.run('dd',[]);
  assert.equal(h.attrs().get('希望'),5); assert.equal(h.attrs().has('压力'),false);
  h.attrs().set('希望',0); h.dice(8,3); h.run('dd',[]); assert.equal(h.attrs().get('希望'),1);
});
test('invalid integers or balances fail before rolling or mutation', () => {
  for (const value of [-1,7,'bad']) { const h=host({ 希望:value }); h.run('dd',[]); assert.equal(h.rolls,0); }
  const h=host(); h.run('dh',['gm','set','SEALCHAT:G']); h.attrs('SEALCHAT:G').set('恐惧',13);
  h.run('dd',[]); assert.equal(h.rolls,0); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),13);
});
test('numeric modifiers never charge hope and old options fail before rolling', () => {
  const h=host({ 希望:2 }); h.dice(3,8); h.run('dd',['+2']); assert.equal(h.attrs().get('希望'),2);
  h.dice(8,3); h.run('ddr',['+2']); assert.equal(h.attrs().get('希望'),2);
  const rolls=h.rolls; for(const arg of ['exp:e1','exp2','经历:e1','经历2']) h.run('dd',[arg]);
  assert.equal(h.rolls,rolls); assert.equal(h.attrs().get('希望'),2);
});
test('repeat message including reload does not reroll or reapply GM fear', () => {
  const h=host(); h.run('dh',['gm','set','SEALCHAT:G']); h.dice(3,8); h.run('dd',[],{id:'one'});
  const rolls=h.rolls; h.reload(); h.run('dd',[],{id:'one'}); assert.equal(h.rolls,rolls); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),1);
});
test('player partial write recovers same roll, refuses external st conflicts', () => {
  const h=host({ 希望:2,压力:2 }); h.fail('SEALCHAT:P','压力'); h.run('dd',[],{id:'one'});
  assert.match(h.replies.at(-1),/保存失败/); const rolls=h.rolls;
  h.run('dd',[]); assert.match(h.replies.at(-1),/未完成/);
  h.attrs().set('希望',0); h.run('dh',['recover']); assert.match(h.replies.at(-1),/已变动/);
  h.attrs().set('希望',3); h.reload(); h.run('dh',['recover']); assert.equal(h.attrs().get('压力'),1); assert.equal(h.rolls,rolls);
});
test('failed GM write recovery verifies original owner and GM current card', () => {
  const h=host(); h.run('dh',['gm','set','SEALCHAT:G']); h.fail('SEALCHAT:G','恐惧'); h.dice(3,8); h.run('dd',[]);
  assert.match(h.replies.at(-1),/保存失败/); const rolls=h.rolls, role=h.attrs('SEALCHAT:G').get('DH角色标识');
  h.context({user:'SEALCHAT:G'}); h.run('dh',['recover']); assert.match(h.replies.at(-1),/原玩家/);
  h.context({user:'SEALCHAT:P'}); h.attrs('SEALCHAT:G').set('DH角色标识','other'); h.run('dh',['recover']); assert.match(h.replies.at(-1),/切回原角色/);
  h.attrs('SEALCHAT:G').set('DH角色标识',role); h.reload(); h.run('dh',['recover']); assert.equal(h.attrs('SEALCHAT:G').get('恐惧'),1); assert.equal(h.rolls,rolls);
});
test('removed resource commands cannot mutate attributes or stored pool', () => {
  const h=host({ 希望:2 }); for (const args of [['hope','-1'],['fear','+1'],['status'],['experience'],['rule']]) h.run('dh',args);
  assert.equal(h.attrs().get('希望'),2); assert.equal(h.attrs().has('恐惧'),false); assert.equal(h.shared.size,0);
});
test('invalid options, other mentions and corrupt state fail before rolling', () => {
  const h=host(); h.run('dd',['junk']); h.run('dd',[],{at:[{userId:'SEALCHAT:G'}]}); assert.equal(h.rolls,0);
  h.shared.set('dh:v1:SEALCHAT:ROOM','{bad'); h.run('dd',[]); assert.equal(h.rolls,0);
});
test('archive includes only native package files and optional fields have no defaults', () => {
  const zip=unzipSync(readFileSync(new URL('../dist/daggerheart-core-0.4.0.sealpack',import.meta.url)));
  assert.deepEqual(Object.keys(zip).sort(),['README.md','info.toml','scripts/daggerheart.js','templates/daggerheart.yaml']);
  const yaml=strFromU8(zip['templates/daggerheart.yaml']); assert.match(yaml,/恐惧: \[fear\]/);
  assert.doesNotMatch(yaml,/    (希望|压力|恐惧): [0-9]/); assert.match(yaml,/希望: "null"/); new vm.Script(strFromU8(zip['scripts/daggerheart.js']));
});
