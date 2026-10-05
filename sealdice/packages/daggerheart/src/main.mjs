import { readPbDHBinding, PBDH_SOURCE, PBDH_NAME } from './pbdh.mjs';
import { parseRequest, rollRequest, formatRoll, formatSettlement } from './rules.mjs';
import { evaluateNative } from './expression.mjs';
import { bounded, settleOptional, parseGroupState } from './state.mjs';
import {characterSummary} from './fields.mjs';

const VERSION = '0.5.0';
const HELP = `.dd / .ddr [算式] [adv/dis] [dc难度] [hope费用] [-- 原因]
例：.dd 敏捷+2+2d6h1 adv dc15 hope -- 攀爬
.dd：动作掷骰；.ddr：反应掷骰。
hope 花费1希望，hope2 花费2希望；费用为0–5，先支付再结算。
经历在 iframe 中选择；手输时把经历加进算式并写希望费用。
取高 k/kh/h，取低 q/kl/l。属性与资源用 .st；GM 用 .dh gm；失败恢复用 .dh recover。`;
const GM_HELP = `.dh gm：查看GM昵称与恐惧
.dh gm me：自己担任GM
.dh gm set 用户ID：指定GM；.dh gm clear：卸任
.st 恐惧+1：调整GM自己的恐惧
.dh recover：恢复未完成的操作，勿重投
.dh pbdh：由 iframe 初始化关联，无需 .dh init。`;
const ext = seal.ext.new('daggerheart', 'Daggerheart workspace', VERSION);
const read = (ctx, key, type = 'int') => {
  const [value, exists] = type === 'str' ? seal.vars.strGet(ctx, key) : seal.vars.intGet(ctx, key);
  return exists ? value : null;
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
  if (read(ctx, 'DH角色标识', 'str') !== pending.role) throw new Error('请切回原人物卡后恢复');
  const targets = pending.writes.map(item => ({ item, ctx: target(ctx, item.user) }));
  for (const { item, ctx: dest } of targets) {
    if (read(dest, 'DH角色标识', 'str') !== item.role) throw new Error('请让GM和玩家切回原人物卡后恢复');
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
    const cost = request.hopeCost ?? 0;
    const hopeMaximum = !reaction || cost ? optional(ctx, '希望上限', 60) ?? 6 : 6;
    const hope = !reaction || cost ? optional(ctx, '希望', hopeMaximum) : null;
    if (cost && (hope === null || hope < cost)) throw Error(`希望不足：本次掷骰需要${cost}点希望`);
    const stress = !reaction ? optional(ctx, '压力', Number.MAX_SAFE_INTEGER) : null;
    const gm = !reaction && state.gm && !ctx.isPrivate && ctx.group?.groupId ? target(ctx, state.gm) : null;
    const fear = gm ? optional(gm, '恐惧', 12) ?? 0 : null;
    const result = rollRequest(request, sides => Math.floor(Math.random() * sides) + 1, expression => evaluateNative(ctx, expression));
    const effects = { ...result.effects, hopeGain: hope === null ? 0 : result.effects.hopeGain,
      stressClear: stress === null ? 0 : result.effects.stressClear, fearGain: gm ? result.effects.fearGain : 0 };
    const before = { 希望: hope, 压力: stress }, next = settleOptional({...before, 希望:hope === null ? null : hope - cost}, effects, fear, hopeMaximum);
    const values = {};
    if (cost || effects.hopeGain) values.希望 = next.values.希望;
    if (effects.stressClear) values.压力 = next.values.压力;
    const writes = changes(ctx, values);
    if (effects.fearGain) writes.push(...changes(gm, { 恐惧: next.fear }));
    const summary = formatSettlement(before, next.values, fear, next.fear, {...effects, hopeSpend:cost}, hopeMaximum);
    const manual = [];
    if (result.effects.hopeGain && hope === null) manual.push('希望+1');
    if (result.effects.stressClear && stress === null) manual.push('压力-1');
    if (result.effects.fearGain && !gm) manual.push('恐惧+1');
    const tail = [cost ? `希望消耗${cost}` : '', summary, manual.length ? `手动：${manual.join('、')}` : ''].filter(Boolean).join(' ｜ ');
    return { writes, reply: formatRoll(result, ctx.player.name, false) + '\n资源：' + (tail || '无变化') };
  });
}
function pbDHCommand(ctx, rawArgs) {
  // 官方 rawArgs 保留姓名中的空格；args/cleanArgs 会拆词并提取 -- 参数。
  const data = rawArgs.replace(/^\s*pbdh(?:\s+|$)/, '').trim();
  if (!data) throw Error('请在 PbDH iframe 中关联当前人物卡');
  if (read(ctx,'$t游戏模式','str') !== 'daggerheart') throw Error('请先执行 .set dh');
  if (load(ctx).pending) throw Error('上次操作未完成，请先执行 .dh recover');
  const payload = readPbDHBinding(data);
  // Player.Name 是官方 Goja 公开的角色昵称；不访问人物卡管理器或改写绑卡元数据。
  if (!ctx.player || (ctx.group && typeof ctx.group.markDirty !== 'function')) throw Error('当前宿主不支持人物卡昵称保存');
  for (const [key,value] of Object.entries(payload.values)) seal.vars.intSet(ctx,key,value);
  ctx.player.name = payload.name;
  ctx.player.updatedAtTime = Math.floor(Date.now()/1000);
  if (ctx.group) ctx.group.markDirty(ctx.dice);
  seal.vars.strSet(ctx,'$t玩家', '<'+payload.name+'>');
  seal.vars.strSet(ctx,'$t玩家_RAW',payload.name);
  seal.vars.strSet(ctx,PBDH_NAME,payload.name);
  // 最后写入来源；只有姓名和所有同步字段均回读一致，iframe 才确认关联。
  seal.vars.strSet(ctx,PBDH_SOURCE,payload.source);
  return 'PbDH 已关联：'+payload.name+'；资源已初始化';
}
function gmSummary(ctx, user) {
  if (!user) return 'GM：未指定';
  const gm = target(ctx, user), fear = optional(gm, '恐惧', 12) ?? 0;
  return `GM：${gm.player.name || '未命名人物卡'} ｜ 恐惧${fear}/12`;
}
function gmCommand(ctx, msg, args, rawArgs) {
  if (args[0] === 'pbdh') return pbDHCommand(ctx,rawArgs);
  if (args[0] === 'recover' && args.length === 1) return recover(ctx);
  if (ctx.isPrivate || !ctx.group?.groupId) throw new Error('请在群聊中指定GM');
  if (args[0] !== 'gm') throw new Error('用法：.dh gm me / set 用户ID / clear');
  if (args.length === 1) return gmSummary(ctx, load(ctx).gm);
  return mutation(ctx, msg, state => {
    let gm;
    const manager = state.gm === ctx.player.userId || ctx.privilegeLevel >= 50;
    if (args[1] === 'me' && args.length === 2) {
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
    } else throw new Error('用法：.dh gm me / set 用户ID / clear');
    return { gm, reply: gm ? gmSummary(ctx, gm) : 'GM已卸任' };
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
      const maxLength = name === 'dh' && args[0] === 'pbdh' ? 4096 : 1000;
      const bindingRequest = name === 'dh' && args[0] === 'pbdh';
      const rawArgs = typeof cmdArgs.rawArgs === 'string' ? cmdArgs.rawArgs : args.join(' ');
      if ((!bindingRequest && args.length > 80) || (bindingRequest ? rawArgs : args.join(' ')).length > maxLength) throw new Error('指令过长');
      // 姓名内的 --word 是 JSON 数据；关联协议整串解析，尾随指令仍拒绝。
      if (!bindingRequest && cmdArgs.kwargs?.length) throw new Error('原因前加独立的 --');
      if (Array.from(cmdArgs.at || []).some(at => at.userId !== ctx.endPoint?.userId)) throw new Error('请用自己的当前人物卡执行此操作');
      if (ctx.privilegeLevel < 0) throw new Error('无权执行此操作');
      seal.replyToSender(ctx, msg, execute(ctx, msg, args, rawArgs));
    } catch (error) { seal.replyToSender(ctx, msg, error.message); }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[name] = cmd;
}
register('dd', HELP, (ctx, msg, args) => doRoll(ctx, msg, args, false));
register('ddr', HELP, (ctx, msg, args) => doRoll(ctx, msg, args, true));
register('dh', GM_HELP, gmCommand);
// 通过自有指令扩展只接管 dh 的 show/list；其余 .st 仍交给原生处理。
const st=seal.ext.newCmdItemInfo();st.name='st';st.allowDelegate=true;
st.solve=(ctx,msg,cmdArgs)=>{
  const args=Array.from(cmdArgs.args || []);
  if(read(ctx,'$t游戏模式','str')!=='daggerheart' || !['show','list'].includes(args[0]?.toLowerCase())) return seal.ext.newCmdExecuteResult(false);
  if(ctx.privilegeLevel<0) return seal.ext.newCmdExecuteResult(true);
  const target=seal.getCtxProxyFirst(ctx,cmdArgs);
  seal.replyToSender(ctx,msg,characterSummary(key=>read(target,key),target.player.name,args.slice(1)));
  return seal.ext.newCmdExecuteResult(true);
};
ext.cmdMap.st=st;
seal.ext.register(ext);
