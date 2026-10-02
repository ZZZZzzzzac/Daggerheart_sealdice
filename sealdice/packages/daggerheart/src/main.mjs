import { parseRequest, rollRequest, formatRoll, formatSettlement } from './rules.mjs';
import { evaluateNative } from './expression.mjs';
import { bounded, settleOptional, parseGroupState } from './state.mjs';

const VERSION = '0.4.1';
const HELP = `.dd [算式] [adv/dis] [dc难度] [-- 原因]
例：.dd 敏捷+2+2d6k1 adv dc15 -- 攀爬
.ddr：反应掷骰；.st：属性与资源；.dh gm：指定GM。`;
const GM_HELP = `.dh gm claim：自己担任GM
.dh gm set 用户ID：指定GM；.dh gm clear：卸任
.st 恐惧+1：调整GM自己的恐惧`;
const ext = seal.ext.new('daggerheart', 'Daggerheart workspace', VERSION);
const DEFAULTS = { 敏捷: 0, 力量: 0, 灵巧: 0, 本能: 0, 风度: 0, 知识: 0 };
const read = (ctx, key, type = 'int') => {
  const [value, exists] = type === 'str' ? seal.vars.strGet(ctx, key) : seal.vars.intGet(ctx, key);
  if (exists) return value;
  if (type === 'int' && seal.vars.strGet(ctx, '$t游戏模式')[0] === 'daggerheart' && Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    const [, isString] = seal.vars.strGet(ctx, key);
    const [, isComputed] = seal.vars.computedGet ? seal.vars.computedGet(ctx, key) : [null, false];
    if (!isString && !isComputed && (!seal.format || String(seal.format(ctx, `{${key}}`)).trim() === String(DEFAULTS[key]))) return DEFAULTS[key];
  }
  return null;
};
function optional(ctx, key, cap) {
  const value = read(ctx, key);
  if (value !== null) return bounded(value, cap, key);
  if (seal.vars.strGet(ctx, key)[1] || (seal.vars.computedGet && seal.vars.computedGet(ctx, key)[1])) throw new Error(`${key}必须为整数`);
  return null;
}
const keyFor = ctx => ctx.isPrivate || !ctx.group?.groupId ? `dh:v1:private:${ctx.player.userId}` : `dh:v1:${ctx.group.groupId}`;
const load = ctx => parseGroupState(ext.storageGet(keyFor(ctx)));
const save = (ctx, state) => ext.storageSet(keyFor(ctx), JSON.stringify(state));
function target(ctx, user) {
  if (ctx.player.userId === user) return ctx;
  const message = seal.newMessage();
  message.messageType = 'group'; message.groupId = ctx.group.groupId; message.sender.userId = user;
  const result = seal.createTempCtx(ctx.endPoint, message);
  if (!result?.player || result.player.userId !== user || result.group?.groupId !== ctx.group.groupId) throw new Error('无法定位GM人物卡');
  return result;
}
function role(ctx) {
  let value = read(ctx, 'DH角色标识', 'str');
  if (!value) {
    value = `${keyFor(ctx)}|${ctx.player.userId}|${Date.now()}|${Math.random()}`;
    seal.vars.strSet(ctx, 'DH角色标识', value);
  }
  return value;
}
const changes = (ctx, values) => Object.entries(values).map(([key, after]) => ({ user: ctx.player.userId, role: role(ctx), key, before: read(ctx, key), after }));
const requestKey = (ctx, msg) => msg.rawId === undefined || msg.rawId === null || msg.rawId === '' ? '' : JSON.stringify([ctx.player.userId, String(msg.rawId)]);
function mutation(ctx, msg, build) {
  const state = load(ctx), id = requestKey(ctx, msg);
  const receipt = id && state.receipts.find(item => item.id === id);
  if (receipt) return receipt.reply + '（重复消息）';
  if (state.pending) throw new Error('上次操作未完成，请原玩家执行 .dh recover');
  const plan = build(state), writes = plan.writes || [];
  const pending = { owner: ctx.player.userId, role: writes.length ? role(ctx) : read(ctx, 'DH角色标识', 'str'), writes, id,
    gm: plan.gm ?? state.gm, reply: plan.reply };
  save(ctx, { ...state, pending });
  try {
    for (const item of writes) seal.vars.intSet(target(ctx, item.user), item.key, item.after);
    const receipts = id ? [...state.receipts, { id, reply: plan.reply }].slice(-100) : state.receipts;
    save(ctx, { ...state, gm: pending.gm, revision: state.revision + 1, receipts, pending: null });
  } catch { throw new Error('保存失败，请执行 .dh recover，勿重投'); }
  return plan.reply;
}
function recover(ctx) {
  const state = load(ctx), pending = state.pending;
  if (!pending) return '没有待恢复操作';
  if (pending.owner !== ctx.player.userId) throw new Error('请由原玩家恢复');
  if (read(ctx, 'DH角色标识', 'str') !== pending.role) throw new Error('请切回原角色后恢复');
  const targets = pending.writes.map(item => ({ item, ctx: target(ctx, item.user) }));
  for (const { item, ctx: dest } of targets) {
    if (read(dest, 'DH角色标识', 'str') !== item.role) throw new Error('请让GM和玩家切回原角色后恢复');
    const value = read(dest, item.key);
    if (value !== item.before && value !== item.after) throw new Error(`${item.key}已变动，请联系骰主恢复`);
  }
  for (const { item, ctx: dest } of targets) seal.vars.intSet(dest, item.key, item.after);
  const receipts = pending.id ? [...state.receipts, { id: pending.id, reply: pending.reply }].slice(-100) : state.receipts;
  save(ctx, { ...state, gm: pending.gm, revision: state.revision + 1, receipts, pending: null });
  return pending.reply + '（已恢复）';
}
function doRoll(ctx, msg, args, reaction) {
  const request = parseRequest(args, reaction);
  return mutation(ctx, msg, state => {
    const hope = !reaction ? optional(ctx, '希望', 6) : null;
    const stress = !reaction ? optional(ctx, '压力', Number.MAX_SAFE_INTEGER) : null;
    const gm = !reaction && state.gm && !ctx.isPrivate && ctx.group?.groupId ? target(ctx, state.gm) : null;
    const fear = gm ? optional(gm, '恐惧', 12) ?? 0 : null;
    const result = rollRequest(request, sides => Math.floor(Math.random() * sides) + 1, expression => evaluateNative(ctx, expression));
    const effects = { ...result.effects, hopeGain: hope === null ? 0 : result.effects.hopeGain,
      stressClear: stress === null ? 0 : result.effects.stressClear, fearGain: gm ? result.effects.fearGain : 0 };
    const before = { 希望: hope, 压力: stress }, next = settleOptional(before, effects, fear);
    const values = {};
    if (effects.hopeGain) values.希望 = next.values.希望;
    if (effects.stressClear) values.压力 = next.values.压力;
    const writes = changes(ctx, values);
    if (effects.fearGain) writes.push(...changes(gm, { 恐惧: next.fear }));
    const summary = formatSettlement(before, next.values, fear, next.fear, effects);
    const manual = [];
    if (result.effects.hopeGain && hope === null) manual.push('希望+1');
    if (result.effects.stressClear && stress === null) manual.push('压力-1');
    if (result.effects.fearGain && !gm) manual.push('恐惧+1');
    const tail = [summary, manual.length ? `手动：${manual.join('、')}` : ''].filter(Boolean).join(' ｜ ');
    return { writes, reply: formatRoll(result, ctx.player.name, false) + (tail ? '\n' + tail : '') };
  });
}
function gmCommand(ctx, msg, args) {
  if (args[0] === 'recover' && args.length === 1) return recover(ctx);
  if (ctx.isPrivate || !ctx.group?.groupId) throw new Error('请在群聊中指定GM');
  if (args[0] !== 'gm') throw new Error('用法：.dh gm claim / set 用户ID / clear');
  if (args.length === 1) return `GM：${load(ctx).gm || '未指定'}`;
  return mutation(ctx, msg, state => {
    let gm;
    const manager = state.gm === ctx.player.userId || ctx.privilegeLevel >= 50;
    if (args[1] === 'claim' && args.length === 2) {
      if (state.gm && state.gm !== ctx.player.userId) throw new Error('已有GM，请由GM或管理员交接');
      if (!state.gm && ctx.privilegeLevel < 50) throw new Error('指定GM需要群管理权限');
      gm = ctx.player.userId;
    } else if (args[1] === 'set' && args.length === 3) {
      if (!manager) throw new Error('只有GM或群管理员可以指定GM');
      if (!/^[A-Z][A-Z0-9_-]*:[^\s]{1,100}$/.test(args[2])) throw new Error('请输入完整用户ID，如 SEALCHAT:xxx');
      gm = args[2];
    } else if (args[1] === 'clear' && args.length === 2) {
      if (!manager) throw new Error('只有GM或群管理员可以卸任GM');
      gm = '';
    } else throw new Error('用法：.dh gm claim / set 用户ID / clear');
    return { gm, reply: gm ? `GM：${gm}` : 'GM已卸任' };
  });
}
function register(name, help, execute) {
  const cmd = seal.ext.newCmdItemInfo(); cmd.name = name; cmd.help = help;
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
register('dh', GM_HELP, gmCommand);
seal.ext.register(ext);
