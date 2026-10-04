import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { unzipSync, strFromU8 } from 'fflate';
import {EXPERIENCE_FIELD, encodeExperiences, experienceRevision, experienceToken, experienceImportCommand} from '../src/experiences.mjs';
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
    const combination=/^\((敏捷|0|\+2)\)\+\((-?\d+)\)$/.exec(inner);
    const v=combination ? (combination[1]==='0' ? 0 : values[combination[1]])+Number(combination[2]) : Object.prototype.hasOwnProperty.call(values,inner)?values[inner]: /^-?\d+(?:[+-]\d+)*$/.test(inner) ? inner.match(/[+-]?\d+/g).reduce((sum,n)=>sum+Number(n),0) : null;
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
      getCtxProxyFirst: (ctx,args)=>args.at?.find(at=>at.userId!==ctx.endPoint.userId) ? context(args.at.find(at=>at.userId!==ctx.endPoint.userId).userId,ctx.group.groupId) : ctx,
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

test('st show whitelist hides internal and arbitrary fields, preserves zero and delegates only read access',()=>{
  const h=host({敏捷:0,希望:2,金币把:10,金币袋:0,金币箱:1,DH角色标识:'secret',DH经历:encodeExperiences([{name:'向导',modifier:2}]),任意私密字段:99});
  const before=JSON.stringify([...h.attrs()]);h.run('st',['show']);
  assert.match(h.replies.at(-1),/敏捷:0/);assert.match(h.replies.at(-1),/金币袋:0/);
  assert.doesNotMatch(h.replies.at(-1),/DH角色标识|secret|DH经历|任意私密字段|99/);
  h.run('st',['show','DH角色标识']);assert.doesNotMatch(h.replies.at(-1),/secret|DH角色标识/);
  h.run('st',['show','agi','把']);assert.match(h.replies.at(-1),/敏捷:0/);assert.match(h.replies.at(-1),/金币把:10/);
  h.attrs('SEALCHAT:G').set('希望',4);h.run('st',['show'],{at:[{userId:'SEALCHAT:G'}]});assert.match(h.replies.at(-1),/希望:4/);
  assert.equal(JSON.stringify([...h.attrs()]),before);assert.equal(h.rolls,0);
  const count=h.replies.length;assert.equal(h.run('st',['希望+1']).solved,false);assert.equal(h.replies.length,count);
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
const experienceItems=[{name:'山野向导',modifier:2},{name:'守望者',modifier:3},{name:'零值经历',modifier:0}];
const experienceArgs=(indices=[1])=>['敏捷',experienceToken(indices,experienceRevision(experienceItems))];
test('experience import changes only the bounded current-card string field and survives reload',()=>{
  const h=host({希望:4,压力:2,敏捷:1});
  h.run('dh',experienceImportCommand(experienceItems).split(' ').slice(1));
  assert.deepEqual([...h.attrs().entries()], [['希望',4],['压力',2],['敏捷',1],[EXPERIENCE_FIELD,encodeExperiences(experienceItems)]]);
  h.reload();h.run('dh',['exp']);assert.match(h.replies.at(-1),/山野向导 \+2/);
  h.context({user:'SEALCHAT:OTHER'});h.run('dh',['exp']);assert.match(h.replies.at(-1),/尚未导入/);
  h.context({user:'SEALCHAT:P'});h.run('dh',['exp','set','bad']);assert.equal(h.attrs().get(EXPERIENCE_FIELD),encodeExperiences(experienceItems));
  h.run('dh',['exp','clear']);assert.equal(h.attrs().get('希望'),4);assert.equal(h.attrs().get(EXPERIENCE_FIELD),encodeExperiences([]));
});
test('multiple experiences add their current modifiers and spend one Hope each before rewards',()=>{
  const h=host({希望:3,压力:2,敏捷:1,[EXPERIENCE_FIELD]:encodeExperiences(experienceItems)});
  h.dice(3,8);h.run('dd',experienceArgs([1,2]));
  assert.equal(h.attrs().get('希望'),1);assert.match(h.replies.at(-1),/\[6\]/);assert.match(h.replies.at(-1),/希望消耗2/);assert.match(h.replies.at(-1),/希望3→1/);
  h.attrs().set('希望',6);h.dice(8,3);h.run('dd',experienceArgs());assert.equal(h.attrs().get('希望'),6);
  h.dice(2,2);h.run('dd',experienceArgs());assert.equal(h.attrs().get('希望'),6);assert.equal(h.attrs().get('压力'),1);
});
test('reaction and zero-modifier experiences still spend Hope; a repeated message never charges twice',()=>{
  const h=host({希望:2,压力:2,[EXPERIENCE_FIELD]:encodeExperiences(experienceItems)});
  h.run('ddr',experienceArgs([3]),{id:'experience-once'});assert.equal(h.attrs().get('希望'),1);assert.equal(h.attrs().get('压力'),2);
  const rolls=h.rolls;h.reload();h.run('ddr',experienceArgs([3]),{id:'experience-once'});assert.equal(h.rolls,rolls);assert.equal(h.attrs().get('希望'),1);
});
test('missing/insufficient Hope, stale experience selection and invalid expressions fail before dice or spending',()=>{
  for(const hope of [undefined,0,1]) {
    const h=host({[EXPERIENCE_FIELD]:encodeExperiences(experienceItems),...(hope===undefined?{}:{希望:hope})});h.run('dd',experienceArgs([1,2]));assert.equal(h.rolls,0);assert.equal(h.attrs().get('希望'),hope);assert.match(h.replies.at(-1),/希望不足/);
  }
  const h=host({希望:3,[EXPERIENCE_FIELD]:encodeExperiences([{name:'新经历',modifier:9}])});h.run('dd',experienceArgs());assert.equal(h.rolls,0);assert.match(h.replies.at(-1),/经历已变化/);
  h.attrs().set(EXPERIENCE_FIELD,encodeExperiences(experienceItems));h.run('dd',['bad',experienceArgs()[1]]);assert.equal(h.rolls,0);assert.equal(h.attrs().get('希望'),3);
});
test('failed experience payment recovers the same roll once and cannot re-import during pending writes',()=>{
  const h=host({希望:3,压力:2,[EXPERIENCE_FIELD]:encodeExperiences(experienceItems)});h.fail('SEALCHAT:P','压力');h.run('dd',experienceArgs([1,2]),{id:'paid'});
  assert.match(h.replies.at(-1),/保存失败/);assert.equal(h.attrs().get('希望'),2);const rolls=h.rolls;
  h.run('dh',['exp','clear']);assert.match(h.replies.at(-1),/recover/);
  h.reload();h.run('dh',['recover']);assert.equal(h.attrs().get('希望'),2);assert.equal(h.attrs().get('压力'),1);assert.equal(h.rolls,rolls);
  h.run('dd',experienceArgs([1,2]),{id:'paid'});assert.equal(h.attrs().get('希望'),2);assert.equal(h.rolls,rolls);
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
  const version=/^version = "([0-9.]+)"$/m.exec(readFileSync(new URL('../info.toml',import.meta.url),'utf8'))[1];
  const zip=unzipSync(readFileSync(new URL(`../dist/daggerheart-${version}.sealpack`,import.meta.url)));
  assert.deepEqual(Object.keys(zip).sort(),['README.md','assets/LICENSE','assets/NOTICE.md','assets/banner.png','assets/icon.png','info.toml','scripts/daggerheart.js','templates/daggerheart.yaml']);
  const allowedRoots = new Set(['info.toml','README.md','assets','decks','helpdoc','reply','scripts','templates']);
  for (const entry of Object.keys(zip)) assert.ok(allowedRoots.has(entry.split('/')[0]),`Unsupported sealpack root: ${entry}`);
  for (const asset of ['assets/icon.png','assets/banner.png']) {
    assert.deepEqual(Buffer.from(zip[asset]),readFileSync(new URL(`../${asset}`,import.meta.url)));
  }
  const yaml=strFromU8(zip['templates/daggerheart.yaml']); assert.match(yaml,/恐惧: \[fear\]/);
  for(const field of ['敏捷','力量','灵巧','本能','风度','知识','生命','压力','护甲','希望','恐惧','金币','生命上限','压力上限','护甲上限','希望上限','闪避','重伤阈值','严重阈值']) {
    assert.match(yaml,new RegExp(`^    ${field}: "null"$`,'m'));
    assert.doesNotMatch(yaml,new RegExp(`^    ${field}: [0-9]`,'m'));
  }
  new vm.Script(strFromU8(zip['scripts/daggerheart.js']));
});

const pbdhId = '01234567-89ab-4cde-8fab-0123456789ab';
test('iframe numeric modifiers and explicit fee do not read persisted traits or experiences',()=>{
  const h=host({力量:99,希望:2,压力:2,DHPbDH来源:pbdhId,DH角色标识:'iframe-role',DH经历:'invalid old data'});
  h.dice(8,3);h.run('dd',['3+2','hope=1','pbdh='+pbdhId,'--','知识 · 经历']);
  assert.equal(h.rolls,2);assert.equal(h.attrs().get('希望'),2);assert.equal(h.attrs().get('DH经历'),'invalid old data');
  assert.match(h.replies.at(-1),/\(3\+2\)\[5\]/);assert.match(h.replies.at(-1),/希望消耗1/);
});
test('iframe fee insufficiency or wrong source rejects before dice or writes',()=>{
  for (const initial of [{希望:0,DHPbDH来源:pbdhId},{希望:3,DHPbDH来源:'other'},{希望:3}]) {
    const h=host(initial);const before=JSON.stringify([...h.attrs()]);h.run('dd',['0','hope=1','pbdh='+pbdhId]);
    assert.equal(h.rolls,0);assert.equal(JSON.stringify([...h.attrs()]),before);
  }
});
test('iframe explicit fee uses existing recovery and duplicate receipts across reload',()=>{
  const h=host({希望:3,压力:2,DHPbDH来源:pbdhId});const args=['0','hope=2','pbdh='+pbdhId];
  h.fail('SEALCHAT:P','压力');h.run('dd',args,{id:'iframe-paid'});assert.match(h.replies.at(-1),/保存失败/);
  assert.equal(h.attrs().get('希望'),2);const rolls=h.rolls;h.reload();h.run('dh',['recover']);
  assert.equal(h.attrs().get('希望'),2);assert.equal(h.attrs().get('压力'),1);assert.equal(h.rolls,rolls);
  h.run('dd',args,{id:'iframe-paid'});assert.equal(h.attrs().get('希望'),2);assert.equal(h.rolls,rolls);
});
test('resource mirror maximum is respected while plain Dice defaults remain compatible',()=>{
  const h=host({希望:8,希望上限:8,DH角色标识:'iframe-role'});h.run('dd',[]);assert.equal(h.attrs().get('希望'),8);assert.equal(h.rolls,2);assert.match(h.replies.at(-1),/希望8\/8/);
});
