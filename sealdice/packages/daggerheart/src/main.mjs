import { parseRequest, rollRequest, formatRoll, formatSettlement } from './rules.mjs';
import { RESOURCES, canonicalResource, bounded, validateResources, adjustResource, settle, resourceSummary, parseGroupState } from './state.mjs';

const VERSION = '0.2.1';
const HELP = `.dd [属性] [修正] [adv/dis] [dc难度] [exp:经历ID] [-- 原因]
例：.dd 敏捷 +2 adv dc15 -- 攀爬
.ddr：反应掷骰；.st：属性与资源；.dh help：资源指令。`;
const RESOURCE_HELP = `.dh status：查看资源；.dh 希望 -1：增减资源（生命/压力/护甲/希望/金币）
.dh fear [+N/-N/=N]：恐惧池；.st：属性与资源
.dh gm claim：认领GM；.dh gm set 用户ID：交接；.dh gm clear：解除
.dh experience：查看经历；.dh rule 核心：规则速查
.dh recover：恢复上次操作`;
const ext = seal.ext.new('daggerheart-native', 'Daggerheart workspace', VERSION);
const keyFor = ctx => {
  if (ctx.isPrivate || !ctx.group?.groupId) throw new Error('请在群聊中使用');
  if (!ctx.player?.userId) throw new Error('无法确认玩家身份');
  return `dh:v1:${ctx.group.groupId}`;
};
const DEFAULTS = { 敏捷: 0, 力量: 0, 灵巧: 0, 本能: 0, 风度: 0, 知识: 0, 生命: 0, 压力: 0, 护甲: 0, 希望: 2, 金币: 0, 护甲上限: 0 };
const read = (ctx, key, type = 'int') => {
  const [value, exists] = type === 'str' ? seal.vars.strGet(ctx, key) : seal.vars.intGet(ctx, key);
  if (exists) return value;
  if (type === 'int' && seal.vars.strGet(ctx, '$t游戏模式')[0] === 'daggerheart-native' && Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    const [, isString] = seal.vars.strGet(ctx, key);
    const [, isComputed] = seal.vars.computedGet ? seal.vars.computedGet(ctx, key) : [null, false];
    if (!isString && !isComputed && (!seal.format || String(seal.format(ctx, `{${key}}`)).trim() === String(DEFAULTS[key]))) return DEFAULTS[key];
  }
  return null;
};
const write = (ctx, key, value, type) => type === 'str' ? seal.vars.strSet(ctx, key, value) : seal.vars.intSet(ctx, key, value);
const load = ctx => parseGroupState(ext.storageGet(keyFor(ctx)));
const save = (ctx, state) => ext.storageSet(keyFor(ctx), JSON.stringify(state));
function readyResources(ctx) {
  try { return readResources(ctx); } catch { return null; }
}
function readResources(ctx, initialize = false) {
  const caps = {};
  const values = {};
  for (const [key, spec] of Object.entries(RESOURCES)) {
    if (spec.max) caps[spec.max] = read(ctx, spec.max);
    values[key] = read(ctx, key);
    if (initialize && values[key] === null) values[key] = key === '希望' ? 2 : 0;
  }
  return { values: validateResources(values, caps), caps };
}
function changes(ctx, after, types = {}) {
  return Object.entries(after).map(([key, value]) => ({ key, before: read(ctx, key, types[key] || 'int'), after: value, type: types[key] || 'int' }));
}
function requestKey(ctx, msg) {
  // No fabricated ID: adapters without stable message IDs cannot guarantee retry deduplication.
  const id = msg.rawId;
  return id === undefined || id === null || id === '' ? '' : JSON.stringify([ctx.player.userId, String(id)]);
}
function mutation(ctx, msg, build) {
  const state = load(ctx);
  const id = requestKey(ctx, msg);
  if (id) {
    const receipt = state.receipts.find(item => item.id === id);
    if (receipt) return receipt.reply + '（重复消息）';
  }
  if (state.pending) throw new Error('上次操作未完成，请原玩家执行 .dh recover');
  const plan = build(state);
  const patch = plan.writes || [];
  // A durable intent bridges the separately persisted attribute and extension stores.
  // This is not a database transaction/CAS with external .st or character.set writers.
  if (patch.length && !read(ctx, 'DH角色标识', 'str')) {
    // Metadata identifies the current attribute sheet for interrupted-operation recovery.
    seal.vars.strSet(ctx, 'DH角色标识', `${ctx.group.groupId}|${ctx.player.userId}|${Date.now()}|${state.revision}`);
  }
  const pending = { owner: ctx.player.userId, role: read(ctx, 'DH角色标识', 'str'), writes: patch, id,
    gm: plan.gm ?? state.gm, fear: plan.fear ?? state.fear, reply: plan.reply };
  save(ctx, { ...state, pending });
  try {
    for (const item of patch) write(ctx, item.key, item.after, item.type);
    const receipts = id ? [...state.receipts, { id, reply: plan.reply }].slice(-100) : state.receipts;
    save(ctx, { ...state, gm: pending.gm, fear: pending.fear, revision: state.revision + 1, receipts, pending: null });
  } catch { throw new Error('保存失败，请执行 .dh recover，勿重投'); }
  return plan.reply;
}
function recover(ctx) {
  const state = load(ctx), pending = state.pending;
  if (!pending) return '没有待恢复操作。';
  if (pending.owner !== ctx.player.userId) throw new Error('请由原玩家恢复');
  const currentRole = read(ctx, 'DH角色标识', 'str');
  const newRole = pending.writes.find(item => item.key === 'DH角色标识')?.after;
  if (currentRole !== pending.role && currentRole !== newRole) throw new Error('请切回原角色后恢复');
  for (const item of pending.writes) {
    const current = read(ctx, item.key, item.type);
    if (current !== item.before && current !== item.after) throw new Error(`${item.key}已变动，请联系骰主恢复`);
  }
  for (const item of pending.writes) write(ctx, item.key, item.after, item.type);
  const receipts = pending.id ? [...state.receipts, { id: pending.id, reply: pending.reply }].slice(-100) : state.receipts;
  save(ctx, { ...state, gm: pending.gm, fear: pending.fear, revision: state.revision + 1, receipts, pending: null });
  return pending.reply + '（已恢复）';
}
function experiences(ctx) {
  const raw = read(ctx, 'DH经历', 'str');
  if (!raw) throw new Error('尚无经历');
  let entries;
  try { entries = JSON.parse(raw); } catch { throw new Error('经历数据有误'); }
  if (!Array.isArray(entries) || entries.length > 50) throw new Error('经历数据有误');
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || !/^[a-zA-Z0-9_-]{1,40}$/.test(entry.id) || ids.has(entry.id) || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100) throw new Error('经历标识或名称无效');
    bounded(entry.value, 20, '经历值');
    if (entry.value < 1) throw new Error('经历值至少为1');
    ids.add(entry.id);
  }
  return entries;
}
function prepareRoll(ctx, args, reaction) {
  const request = parseRequest(args, reaction);
  if (request.terms.some(item => item.kind === 'experience' && !item.id)) throw new Error('经历格式：exp:ID（.dh experience 查看）');
  if (request.experienceIds.length) {
    const entries = experiences(ctx);
    for (const id of request.experienceIds) {
      const entry = entries.find(item => item.id === id);
      if (!entry) throw new Error(`当前角色没有经历“${id}”`);
      request.terms.push({ kind: 'experience', id, value: entry.value, name: entry.name });
    }
  }
  let traitValue = 0;
  if (request.trait) {
    traitValue = read(ctx, request.trait);
    if (traitValue === null) throw new Error(`请用.st设置属性“${request.trait}”`);
  }
  return { request, traitValue };
}
function doRoll(ctx, msg, args, reaction) {
  // Parse first, including invalid parameters, before checking state or rolling.
  const { request, traitValue } = prepareRoll(ctx, args, reaction);
  const resources = readyResources(ctx);
  const inGroup = !ctx.isPrivate && !!ctx.group?.groupId;
  const state = resources && inGroup ? load(ctx) : null;
  const automatic = resources && inGroup && (reaction || state.gm);
  if (!automatic) {
    if (request.experienceCosts) throw new Error('请先用.st设置资源，并在群聊中使用经历');
    const result = rollRequest(request, sides => Math.floor(Math.random() * sides) + 1, traitValue);
    return formatRoll(result, ctx.player.name, true);
  }
  return mutation(ctx, msg, state => {
    const { values, caps } = readResources(ctx);
    if (!reaction && !state.gm) throw new Error('请先指定GM：.dh gm claim / set');
    if (values.希望 < request.experienceCosts) throw new Error('希望不足');
    const result = rollRequest(request, sides => Math.floor(Math.random() * sides) + 1, traitValue);
    const next = settle(values, caps, result.effects, state.fear);
    const summary = formatSettlement(values, next.values, state.fear, next.fear, result.effects);
    return { writes: changes(ctx, { 希望: next.values.希望, 压力: next.values.压力 }), fear: next.fear,
      reply: formatRoll(result, ctx.player.name, false) + (summary ? '\n' + summary : '') };
  });
}
function canManageGM(ctx, state) { return ctx.player.userId === state.gm || ctx.privilegeLevel >= 50; }
function canManageFear(ctx, state) { return ctx.player.userId === state.gm || ctx.privilegeLevel >= 100; }
function resourceCommand(ctx, msg, args) {
  const sub = (args[0] || 'status').toLowerCase();
  if (sub === 'help' || sub === '帮助') return RESOURCE_HELP;
  if (sub === 'rule' || sub === '规则') {
    if (args.length > 2 || (args[1] && !['核心', 'core'].includes(args[1]))) throw new Error('用法：.dh rule 核心');
    return '正式版核心速查：二元骰为希望d12+恐惧d12。相同出目关键成功；否则与难度比较，希望骰较高则获得希望，恐惧骰较高则GM获得恐惧。普通优劣势来源抵消后至多一枚d6。关键成功获得1希望并清除1压力；反应不产生希望/恐惧，也不清压力。每项经历先消耗1希望。希望上限6，GM恐惧上限12。\n依据：官方SRD 2.0核心第47–49页 https://www.daggerheart.com/srd/';
  }
  if (sub === 'recover') {
    if (args.length !== 1) throw new Error('格式：.dh recover');
    return recover(ctx);
  }
  if (sub === 'gm') {
    const state = load(ctx);
    if (args.length === 1) return `当前GM：${state.gm || '未指定'} ｜ 恐惧 ${state.fear}/12`;
    if (args.length > 3) throw new Error('格式：.dh gm claim / set 用户ID / clear');
    return mutation(ctx, msg, current => {
      let gm;
      if (args[1] === 'claim' && args.length === 2) {
        if (current.gm && current.gm !== ctx.player.userId) throw new Error('已有GM，请由GM或管理员交接');
        if (!current.gm && ctx.privilegeLevel < 50) throw new Error('认领GM需要群管理权限');
        gm = ctx.player.userId;
      } else if (args[1] === 'set' && args.length === 3) {
        if (!canManageGM(ctx, current)) throw new Error('只有GM或群管理员可以指定GM');
        if (!/^[A-Z][A-Z0-9_-]*:[^\s]{1,100}$/.test(args[2])) throw new Error('请输入平台完整用户ID，如 SEALCHAT:xxx');
        gm = args[2];
      } else if (args[1] === 'clear' && args.length === 2) {
        if (!canManageGM(ctx, current)) throw new Error('只有GM或群管理员可以解除GM');
        gm = '';
      } else throw new Error('格式：.dh gm claim / set 用户ID / clear');
      return { gm, reply: `GM${gm ? '：' + gm : '已解除'} ｜ 恐惧${current.fear}/12` };
    });
  }
  if (sub === 'fear' || sub === '恐惧') {
    if (args.length === 1) return `GM恐惧 ${load(ctx).fear}/12`;
    if (args.length !== 2 || !/^(?:[+-]\d+|=\d+)$/.test(args[1])) throw new Error('格式：.dh fear +N / -N / =N');
    return mutation(ctx, msg, state => {
      if (!canManageFear(ctx, state)) throw new Error('只有当前GM或骰主可修改恐惧');
      const fear = args[1][0] === '=' ? Number(args[1].slice(1)) : state.fear + Number(args[1]);
      bounded(fear, 12, 'GM恐惧');
      return { fear, reply: `GM恐惧 ${state.fear} → ${fear}/12` };
    });
  }
  if (sub === 'experience' || sub === '经历') {
    if (args.length !== 1) throw new Error('用法：.dh experience');
    return experiences(ctx).map(item => `${item.id}：${item.name} +${item.value}`).join('\n') || '尚无经历';
  }
  if (sub === 'status' || sub === '状态') {
    if (args.length !== 1) throw new Error('格式：.dh status');
    const state = load(ctx), { values, caps } = readResources(ctx);
    return resourceSummary(values, caps) + ` ｜ GM恐惧 ${state.fear}/12` + (state.pending ? ' ｜ 待恢复：.dh recover' : '');
  }
  const resource = canonicalResource(sub);
  if (!resource || args.length !== 2) throw new Error('用法：.dh 资源 +N/-N/=N');
  return mutation(ctx, msg, state => {
    const { values, caps } = readResources(ctx);
    const next = adjustResource(values, caps, resource, args[1]);
    return { writes: changes(ctx, { [resource]: next[resource] }), reply: `${resource}${values[resource]}→${next[resource]}` };
  });
}
function register(name, help, execute) {
  const cmd = seal.ext.newCmdItemInfo();
  cmd.name = name; cmd.help = help;
  cmd.solve = (ctx, msg, cmdArgs) => {
    const args = Array.from(cmdArgs.args || []);
    if (args.length === 1 && ['help', '帮助'].includes(args[0].toLowerCase())) {
      const result = seal.ext.newCmdExecuteResult(true); result.showHelp = true; return result;
    }
    try {
      if (args.length > 80 || args.join(' ').length > 1000) throw new Error('指令过长');
      if (cmdArgs.kwargs?.length) throw new Error('原因前加独立的 --');
      if (Array.from(cmdArgs.at || []).some(at => at.userId !== ctx.endPoint?.userId)) throw new Error('请用自己的角色掷骰');
      if (ctx.privilegeLevel < 0) throw new Error('无权执行此操作');
      seal.replyToSender(ctx, msg, execute(ctx, msg, args));
    } catch (error) { seal.replyToSender(ctx, msg, error.message); }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[name] = cmd;
}
register('dd', HELP, (ctx, msg, args) => doRoll(ctx, msg, args, false));
register('ddr', HELP, (ctx, msg, args) => doRoll(ctx, msg, args, true));
register('dh', RESOURCE_HELP, resourceCommand);
seal.ext.register(ext);
