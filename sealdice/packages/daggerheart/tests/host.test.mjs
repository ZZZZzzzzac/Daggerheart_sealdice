import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { unzipSync, strFromU8 } from 'fflate';
const bundle = buildSync({ entryPoints: [fileURLToPath(new URL('../src/main.mjs', import.meta.url))], bundle: true,
  write: false, platform: 'neutral', format: 'iife', target: 'es2020' }).outputFiles[0].text;
const complete = { 敏捷: 3, 生命上限: 6, 压力上限: 6, 护甲上限: 2, 生命: 0, 压力: 2, 护甲: 0, 希望: 2, 金币: 0 };
function host(initial = { 敏捷: 3 }, shared = new Map()) {
  let extension, rolls = 0, reads = 0, message = 0, failKey = '', user = 'SEALCHAT:PLAYER', group = 'SEALCHAT:ROOM', privilege = 50;
  const attrs = new Map(Object.entries(initial)), replies = [];
  const sandbox = { Math: Object.assign(Object.create(Math), { random: () => { rolls++; return 0.1; } }),
    seal: { ext: { new: () => ({ cmdMap: {}, storageGet: key => shared.get(key) || '', storageSet: (key, value) => shared.set(key, value) }),
      register: value => { extension = value; }, newCmdItemInfo: () => ({}), newCmdExecuteResult: value => ({ solved: value }) },
      vars: {
        intGet: (_ctx, key) => { reads++; return [attrs.get(key) || 0, Number.isInteger(attrs.get(key))]; },
        strGet: (_ctx, key) => key === '$t游戏模式' ? ['daggerheart-native', true] : [attrs.get(key) || '', typeof attrs.get(key) === 'string'],
        intSet: (_ctx, key, value) => { if (key === failKey) { failKey = ''; throw new Error('Injected write failure'); } attrs.set(key, value); },
        strSet: (_ctx, key, value) => attrs.set(key, value),
      }, replyToSender: (_ctx, _msg, text) => replies.push(text) } };
  const reload = () => vm.runInNewContext(bundle, sandbox);
  reload();
  return { run: (command, args = [], opts = {}) => extension.cmdMap[command].solve({ player: { name: '测试角色', userId: user },
      group: { groupId: group, system: 'daggerheart-native' }, privilegeLevel: privilege, isPrivate: opts.private || false, endPoint: { userId: 'SEALCHAT:BOT' } },
      { rawId: opts.noId ? undefined : opts.id || String(++message) }, { args, at: opts.at || [], kwargs: opts.kwargs || [] }),
    replies, attrs, shared, reload, fail: key => { failKey = key; },
    context: options => { user = options.user || user; group = options.group || group; privilege = options.privilege ?? privilege; },
    get rolls() { return rolls; }, get reads() { return reads; } };
}
test('plain dd and st-style attributes work without Chat, init or resource state', () => {
  const h = host();
  assert.equal(h.run('dd', ['help']).showHelp, true);
  h.run('dd', ['敏捷', 'junk']); assert.equal(h.rolls, 0);
  h.run('dd', ['敏捷', 'dc15']); assert.equal(h.rolls, 2);
  assert.match(h.replies.at(-1), /\+敏捷3/); assert.match(h.replies.at(-1), /手动：/);
  assert.equal(h.attrs.get('希望'), undefined); assert.equal(h.shared.size, 0);
  h.attrs.set('敏捷', 4); h.run('ddr', ['敏捷']); assert.match(h.replies.at(-1), /\+敏捷4/);
});
test('invalid options and other mentions fail before rolling; bot mention works', () => {
  const h = host();
  h.run('dd', [], { at: [{ userId: 'SEALCHAT:OTHER' }] }); assert.equal(h.rolls, 0);
  assert.match(h.replies.at(-1), /自己的角色/);
  h.run('dd', [], { kwargs: [{ name: 'evil' }] }); assert.equal(h.rolls, 0);
  h.run('dd', [], { at: [{ userId: 'SEALCHAT:BOT' }] }); assert.equal(h.rolls, 2);
});
test('complete st resources auto-settle critical and reaction needs no init', () => {
  const h = host(complete);
  h.run('dh', ['gm', 'claim']); h.run('dd', ['敏捷']);
  assert.equal(h.attrs.get('希望'), 3); assert.equal(h.attrs.get('压力'), 1);
  assert.match(h.replies.at(-1), /希望2→3/);
  h.run('ddr', ['敏捷']); assert.equal(h.attrs.get('希望'), 3); assert.equal(h.attrs.get('压力'), 1);
  h.attrs.set('希望', 6); h.run('dd', []); assert.equal(h.attrs.get('希望'), 6); assert.equal(h.attrs.get('压力'), 0);
});
test('no GM still allows ordinary roll, without partial settlement', () => {
  const h = host(complete); h.run('dd', []);
  assert.equal(h.rolls, 2); assert.equal(h.attrs.get('希望'), 2); assert.equal(h.attrs.get('压力'), 2);
  assert.match(h.replies.at(-1), /手动：/);
});
test('resources use current st values; overflow and invalid card fail without mutation', () => {
  const h = host(complete); h.run('dh', ['hope', '+1']); assert.equal(h.attrs.get('希望'), 3);
  h.attrs.set('希望', 5); h.run('dh', ['hope', '-2']); assert.equal(h.attrs.get('希望'), 3);
  h.run('dh', ['hope', '+9']); assert.equal(h.attrs.get('希望'), 3); assert.match(h.replies.at(-1), /必须是/);
  h.run('dh', ['gold', '=40']); assert.equal(h.attrs.get('金币'), 40);
  h.attrs.set('生命', 7); h.run('dh', ['hope', '-1']); assert.equal(h.attrs.get('希望'), 3);
});
test('GM permissions, handover, cap, channel isolation and persistence', () => {
  const h = host(); h.context({ privilege: 0 }); h.run('dh', ['gm', 'claim']); assert.match(h.replies.at(-1), /群管理/);
  h.context({ privilege: 50 }); h.run('dh', ['gm', 'claim']); h.run('dh', ['fear', '=12']);
  h.run('dh', ['fear', '+1']); assert.match(h.replies.at(-1), /0–12/);
  h.context({ user: 'SEALCHAT:OTHER', privilege: 0 }); h.run('dh', ['fear', '-1']); assert.match(h.replies.at(-1), /只有当前GM/);
  h.context({ user: 'SEALCHAT:PLAYER', privilege: 0 }); h.run('dh', ['gm', 'set', 'SEALCHAT:OTHER']);
  h.run('dh', ['fear', '-1']); assert.match(h.replies.at(-1), /只有当前GM/);
  h.context({ user: 'SEALCHAT:OTHER' }); h.run('dh', ['fear', '-1']);
  h.reload(); h.run('dh', ['fear']); assert.match(h.replies.at(-1), /11\/12/);
  h.context({ group: 'SEALCHAT:SECOND' }); h.run('dh', ['fear']); assert.match(h.replies.at(-1), /0\/12/);
  h.run('dh', ['fear'], { private: true }); assert.match(h.replies.at(-1), /群聊/);
});
test('same message ID does not roll or settle twice, including after extension reload', () => {
  const h = host(complete); h.run('dh', ['gm', 'claim']);
  h.run('dd', [], { id: 'unique-roll' }); const count = h.rolls;
  h.reload(); h.run('dd', [], { id: 'unique-roll' });
  assert.equal(h.rolls, count); assert.equal(h.attrs.get('希望'), 3); assert.equal(h.attrs.get('压力'), 1);
  assert.match(h.replies.at(-1), /重复消息/);
});
test('interrupted write freezes group; same owner/card recovery finishes original roll once', () => {
  const h = host(complete); h.run('dh', ['gm', 'claim']); h.fail('压力'); h.run('dd', [], { id: 'interrupted' });
  assert.match(h.replies.at(-1), /保存失败/); const count = h.rolls;
  h.run('dh', ['hope', '-1']); assert.match(h.replies.at(-1), /上次操作未完成/);
  h.context({ user: 'SEALCHAT:OTHER' }); h.run('dh', ['recover']); assert.match(h.replies.at(-1), /原玩家/);
  h.context({ user: 'SEALCHAT:PLAYER' }); const role = h.attrs.get('DH角色标识'); h.attrs.set('DH角色标识', 'other-role');
  h.run('dh', ['recover']); assert.match(h.replies.at(-1), /切回原角色/);
  h.attrs.set('DH角色标识', role); h.reload(); h.run('dh', ['recover']);
  assert.equal(h.rolls, count); assert.equal(h.attrs.get('希望'), 3); assert.equal(h.attrs.get('压力'), 1);
  h.run('dd', [], { id: 'interrupted' }); assert.equal(h.rolls, count);
});
test('recovery refuses intervening external writes rather than overwriting st', () => {
  const h = host(complete); h.run('dh', ['gm', 'claim']); h.fail('压力'); h.run('dd', []);
  h.attrs.set('希望', 0); h.run('dh', ['recover']);
  assert.match(h.replies.at(-1), /已变动/); assert.equal(h.attrs.get('希望'), 0);
});
test('experiences come from imported IDs, cost before gains, and missing funds do not roll', () => {
  const h = host({ ...complete, DH经历: JSON.stringify([{ id: 'e1', name: '山地向导', value: 2 }]) });
  h.run('dh', ['gm', 'claim']); h.run('dd', ['敏捷', 'exp:e1']);
  assert.equal(h.attrs.get('希望'), 2); assert.match(h.replies.at(-1), /\+山地向导2/);
  h.attrs.set('希望', 0); const count = h.rolls; h.run('dd', ['exp:e1']); assert.equal(h.rolls, count);
  h.run('dd', ['exp:no']); assert.equal(h.rolls, count);
  h.run('dd', ['exp2']); assert.equal(h.rolls, count); assert.match(h.replies.at(-1), /经历格式/);
  h.attrs.set('希望', 2); h.run('ddr', ['exp:e1']); assert.equal(h.attrs.get('希望'), 1);
  h.run('dd', ['exp:e1', 'exp:e1']); assert.match(h.replies.at(-1), /重复选择/);
});
test('invalid persisted state fails closed for mutations but plain dd remains usable', () => {
  const h = host(); h.shared.set('dh:v1:SEALCHAT:ROOM', '{bad'); h.run('dh', ['fear', '+1']);
  assert.match(h.replies.at(-1), /状态损坏/); h.run('dd', []); assert.equal(h.rolls, 2);
});
test('archive has only native allowlist and declares no elevated capabilities', () => {
  const zip = unzipSync(readFileSync(new URL('../dist/daggerheart-core-0.2.1.sealpack', import.meta.url)));
  assert.deepEqual(Object.keys(zip).sort(), ['README.md', 'info.toml', 'scripts/daggerheart.js', 'templates/daggerheart.yaml']);
  assert.match(strFromU8(zip['info.toml']), /min_version = "1.6.1"/);
  assert.match(strFromU8(zip['info.toml']), /network = false/);
  assert.match(strFromU8(zip['templates/daggerheart.yaml']), /templateVer: "2.0"/);
  new vm.Script(strFromU8(zip['scripts/daggerheart.js']));
});

test('native st omitted defaults are read only from this explicit game template', () => {
  const h = host({ 敏捷: 3, 生命上限: 6, 压力上限: 6 });
  h.run('dh', ['status']); assert.match(h.replies.at(-1), /生命0\/6/); assert.match(h.replies.at(-1), /希望2\/6/);
  h.attrs.set('希望', 'bad'); h.run('dh', ['status']); assert.match(h.replies.at(-1), /希望必须/);
});
