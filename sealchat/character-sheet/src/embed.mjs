import { TRAITS, numeric, resource, rollCommand, GOLD } from './model.mjs';

export const FIELDS = new Set([...TRAITS.map(([key]) => key), ...['生命','压力','护甲','希望'].flatMap(key => [key,key+'上限']), '闪避','重伤阈值','严重阈值',...GOLD.map(item=>item.key)]);
export const REQUIRED = ['context.read','characters.read','characterCard.read'];
const scope = context => JSON.stringify([context?.channel?.id, context?.currentUser?.id, context?.currentCharacter?.id, context?.currentCharacter?.activeVariant?.id || '']);
const cardKey = card => JSON.stringify([card?.name,card?.sheetType]);

export function stCommand(operation, attrs) {
  const { field, delta, value } = operation;
  if (!FIELDS.has(field)) throw Error('只允许修改既有数值字段');
  if (delta !== undefined) {
    if (!['生命','压力','护甲','希望',...GOLD.map(item=>item.key)].includes(field) || ![-1,1].includes(delta)) throw Error('无效资源增减');
    const {value:current,max} = resource(attrs,field);
    if (!Number.isSafeInteger(current) || !Number.isSafeInteger(max) || current < 0 || current > max || current+delta < 0 || current+delta > max) throw Error('资源未知或超出上限，请用 .st 核对');
    return '.st ' + field + (delta > 0 ? '+' : '') + delta;
  }
  if (!Number.isSafeInteger(value) || Math.abs(value) > 1000000 || (!TRAITS.some(([key]) => key === field) && value < 0)) throw Error('无效数值');
  const gold=GOLD.find(item=>item.key===field);
  if(gold && value>gold.max) throw Error('金币数量超过上限');
  return '.st ' + field + (value < 0 ? '=' : '') + value;
}

// All reads and writes use the official Channel Embed SDK. This guard detects
// observed context changes; the host API has no atomic expected-card condition.
export function createEmbedAdapter(api) {
  let generation = 0, snapshot = null, busy = false;
  function invalidate() { generation++; snapshot = null; }
  async function read() {
    const revision = generation;
    const context = await api.context.get();
    const result = await api.characterCard.getCurrent();
    const after = await api.context.get();
    if (revision !== generation || scope(context) !== scope(after)) throw Error('角色或频道已变化，请刷新');
    snapshot = { context: after, card: result.card, status: result.status, generation: revision };
    return snapshot;
  }
  async function guard(expected) {
    if (!expected?.card || expected.generation !== generation) throw Error('角色已变化，请刷新');
    const fresh = await read();
    if (scope(fresh.context) !== scope(expected.context) || cardKey(fresh.card) !== cardKey(expected.card)) throw Error('当前绑定卡已变化，请刷新后操作');
    return fresh;
  }
  async function send(kind, input, expected = snapshot) {
    if (busy) throw Error('上一项请求尚未返回');
    busy = true;
    try {
      const fresh = await guard(expected);
      const context = fresh.context;
      if (fresh.card?.sheetType !== 'daggerheart') throw Error('当前卡不是匕首之心规则，请核对 .set dh 和 .st fmt');
      if (!fresh.status?.available || !fresh.card || !context.currentUser || !context.currentCharacter || context.permissions?.canSendMessage !== true || !context.capabilities?.includes('messages.send') || context.connection?.state !== 'connected') throw Error('当前频道或角色无法发送指令');
      const command = kind === 'roll' ? rollCommand(input.trait,input.options) : kind === 'st' ? stCommand(input,fresh.card.attrs) : null;
      if (!command) throw Error('无效操作');
      // A timeout may occur after message creation. Never retry a write here.
      await api.messages.send({ text:command, identityId:context.currentCharacter.id, ...(context.currentCharacter.activeVariant?.id ? { identityVariantId:context.currentCharacter.activeVariant.id } : {}) });
      return command;
    } finally { busy = false; }
  }
  return { read, guard, send, invalidate, get snapshot() { return snapshot; } };
}
