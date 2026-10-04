import {parseExperienceToken} from './experiences.mjs';
import {canonicalField} from './fields.mjs';
// Only .dd options are parsed here; arithmetic belongs to the host .r engine.
export function parseRequest(args, reaction = false) {
  if (args.length > 80 || args.join(' ').length > 1000) throw new Error('指令过长');
  const separator = args.indexOf('--');
  const tokens = separator < 0 ? args : args.slice(0, separator);
  const reason = separator < 0 ? '' : args.slice(separator + 1).join(' ').trim();
  const request = { reaction, reason, expression: '', advantages: 0, disadvantages: 0, difficulty: null };
  const parts = [];
  let depth = 0, quote = '', escaped = false;
  for (const raw of tokens) {
    let match;
    if (!depth && !quote && raw.startsWith('exp=')) {
      if (request.experiences) throw Error('经历只能选择一次');
      request.experiences = parseExperienceToken(raw);
    } else if (!depth && !quote && raw.startsWith('hope=')) {
      if (request.hopeCost !== undefined) throw Error('希望费用只能指定一次');
      if (!/^hope=[0-5]$/.test(raw)) throw Error('希望费用须为0–5的整数');
      request.hopeCost = Number(raw.slice(5));
    } else if (!depth && !quote && raw.startsWith('pbdh=')) {
      if (request.pbdh) throw Error('PbDH 关联只能指定一次');
      if (!/^pbdh=[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(raw)) throw Error('PbDH 存档标识无效');
      request.pbdh = raw.slice(5);
    } else if (!depth && !quote && (match = /^(adv|优势|优|dis|劣势|劣)(\d*)$/i.exec(raw))) {
      const count = Number(match[2] || 1);
      if (!Number.isSafeInteger(count) || count < 1 || count > 20) throw new Error('优劣势来源数须为1–20');
      if (['adv', '优势', '优'].includes(match[1].toLowerCase())) request.advantages += count;
      else request.disadvantages += count;
      if (request.advantages + request.disadvantages > 40) throw new Error('优劣势来源过多');
    } else if (!depth && !quote && (match = /^(?:dc(\d+)|\[(\d+)\])$/i.exec(raw))) {
      if (request.difficulty !== null) throw new Error('难度只能指定一次');
      request.difficulty = Number(match[1] || match[2]);
      if (!Number.isSafeInteger(request.difficulty)) throw new Error('难度超出范围');
    } else {
      parts.push(raw);
      for (const char of raw) {
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) quote = '';
        } else if (char === '"' || char === "'") quote = char;
        else if ('([{'.includes(char)) depth++;
        else if (')]}'.includes(char)) depth--;
      }
    }
  }
  if (request.experiences && request.hopeCost !== undefined) throw Error('经历编号与希望费用不能同时指定');
  request.expression = parts.join(' ').trim();
  return request;
}

export function rollRequest(request, rollDie, evaluateExpression = () => ({ value: 0, expression: '' })) {
  // Evaluate exactly once before duality dice. Failures cannot settle resources.
  const evaluated = request.expression ? evaluateExpression(request.expression) : { value: 0, expression: '' };
  if (typeof evaluated.value !== 'number' || !Number.isFinite(evaluated.value)) throw new Error('算式结果必须为数字');
  const modifier = evaluated.value;
  const die = sides => {
    const value = rollDie(sides);
    if (!Number.isSafeInteger(value) || value < 1 || value > sides) throw new Error('随机源返回无效出目');
    return value;
  };
  const hope = die(12), fear = die(12);
  const net = request.advantages - request.disadvantages;
  // Ordinary sources cancel pairwise and collapse to ONE d6, not a best-of-N pool.
  const advantage = net === 0 ? 0 : die(6) * Math.sign(net);
  const total = hope + fear + modifier + advantage;
  const critical = hope === fear;
  const withHope = hope >= fear;
  const success = critical ? true : request.difficulty === null ? null : total >= request.difficulty;
  const effects = {
    hopeGain: !request.reaction && withHope ? 1 : 0,
    fearGain: !request.reaction && !withHope ? 1 : 0,
    stressClear: !request.reaction && critical ? 1 : 0,
  };
  return { request, hope, fear, expression: evaluated.expression || request.expression, modifier, advantage, total, critical, withHope, success, effects };
}

export function formatRoll(result, name, hints = true, experiences = []) {
  const { request, hope, fear, total, critical, withHope, success, advantage, modifier, effects } = result;
  const polarity = withHope ? '希望' : '恐惧';
  const outcome = critical ? '✨【关键成功】' : success === null ? `◆【${polarity} · 成败待定】`
    : `${success ? '✅' : '❌'}【${polarity}${success ? '成功' : '失败'}】`;
  const traits = [...new Set((request.expression.match(/[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*/g) || [])
    .map(canonicalField).filter(key => ['敏捷','力量','灵巧','本能','风度','知识'].includes(key)))];
  const net = request.advantages - request.disadvantages;
  const edge = net > 0 ? '优势' : net < 0 ? '劣势' : request.advantages ? '优劣势抵消' : '普通';
  const labels = [`【${name}】${request.reaction ? '反应掷骰' : '动作掷骰'}`, ...traits,
    experiences.length ? '经历：' + experiences.map(item => item.name + '(' + (item.modifier >= 0 ? '+' : '') + item.modifier + ')').join('、') : '',
    request.reason, edge].filter(Boolean);
  // 保留实际面值的海豹注解，供固定 SealChat 公开解析器生成 3D 骰子。
  let expression = `希望${hope}[1d12]+恐惧${fear}[1d12]`;
  if (request.expression) expression += `+(${result.expression})[${modifier}]`;
  if (advantage) expression += `${advantage > 0 ? '+' : '-'}${advantage > 0 ? '优势' : '劣势'}${Math.abs(advantage)}[1d6]`;
  const lines = [labels.join(' · '),
    `${expression}=${total}${request.difficulty !== null ? ` ${total > request.difficulty ? '>' : total < request.difficulty ? '<' : '='} 难度${request.difficulty}` : ''} ⇒ **${outcome}**`];
  if (hints) {
    const resources = [];
    if (effects.hopeGain) resources.push('希望+1');
    if (effects.fearGain) resources.push('恐惧+1');
    if (effects.stressClear) resources.push('压力-1');
    lines.push(resources.length ? `资源：手动：${resources.join('、')}` : '资源：无变化');
  }
  return lines.join('\n');
}
export function formatSettlement(before, after, fearBefore, fearAfter, effects, hopeMaximum = 6) {
  const fields = [];
  const change = (label, a, b, cap) => a === b ? `${label}${b}/${cap}` : `${label}${a}→${b}`;
  if (effects.hopeGain || effects.hopeSpend) fields.push(change('希望', before.希望, after.希望, hopeMaximum));
  if (effects.stressClear) fields.push(before.压力 === after.压力 ? `压力${after.压力}` : `压力${before.压力}→${after.压力}`);
  if (effects.fearGain) fields.push(change('恐惧', fearBefore, fearAfter, 12));
  return fields.join(' ｜ ');
}
