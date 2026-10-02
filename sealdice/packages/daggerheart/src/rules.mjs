export const TRAITS = {
  敏捷: ['agility', 'agi'], 力量: ['strength', 'str'], 灵巧: ['finesse', 'fin'],
  本能: ['instinct', 'ins'], 风度: ['presence', 'pre'], 知识: ['knowledge', 'knw'],
};
export function canonicalTrait(value) {
  const key = value.toLowerCase();
  return Object.keys(TRAITS).find(name => name === key || TRAITS[name].includes(key));
}
const MAX_DICE = 30;
const integer = (text, max, label) => {
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error(`${label}超出范围（0–${max}）`);
  return n;
};

// A complete parse precedes all rolls and host calls; unrecognized fragments are errors.
export function parseRequest(args, reaction = false) {
  if (args.length > 80 || args.join(' ').length > 1000) throw new Error('指令过长');
  const separator = args.indexOf('--');
  const tokens = separator < 0 ? args : args.slice(0, separator);
  const reason = separator < 0 ? '' : args.slice(separator + 1).join(' ').trim();
  const request = { reaction, reason, trait: null, terms: [], advantages: 0, disadvantages: 0, difficulty: null };
  let diceCount = 0;
  for (const raw of tokens) {
    const token = raw.toLowerCase();
    let match;
    const trait = canonicalTrait(token.replace(/^\+/, ''));
    if (trait) {
      if (request.trait) throw new Error('一次掷骰只能选择一项属性');
      request.trait = trait;
    } else if ((match = /^(adv|优势|优|dis|劣势|劣)(\d*)$/.exec(token))) {
      const count = integer(match[2] || '1', 20, '优劣势来源数');
      if (!count) throw new Error('优劣势来源数至少为1');
      if (['adv', '优势', '优'].includes(match[1])) request.advantages += count;
      else request.disadvantages += count;
      if (request.advantages + request.disadvantages > 40) throw new Error('优劣势来源过多');
    } else if ((match = /^(?:dc(\d+)|\[(\d+)\])$/.exec(token))) {
      if (request.difficulty !== null) throw new Error('难度只能指定一次');
      request.difficulty = integer(match[1] || match[2], 1000, '难度');
    } else {
      const terms = token.match(/[+-]?(?:\d*d\d+|\d+)/g);
      if (!terms || terms.join('') !== token) throw new Error(`无法识别“${raw}”；原因请放在 -- 后`);
      if (terms.length > 1 && terms.slice(1).some(term => !/^[+-]/.test(term))) throw new Error(`修正之间需要 + 或 -：${raw}`);
      for (const term of terms) {
        const sign = term.startsWith('-') ? -1 : 1;
        const value = term.replace(/^[+-]/, '');
        const dice = /^(\d*)d(\d+)$/.exec(value);
        if (dice) {
          const count = integer(dice[1] || '1', MAX_DICE, '附加骰数量');
          const sides = integer(dice[2], 1000, '附加骰面数');
          if (!count || sides < 2) throw new Error('附加骰数量至少为1、面数至少为2');
          diceCount += count;
          if (diceCount > MAX_DICE) throw new Error(`附加骰总数不能超过${MAX_DICE}`);
          request.terms.push({ kind: 'dice', count, sides, sign });
        } else request.terms.push({ kind: 'fixed', value: sign * integer(value, 1000, '固定修正绝对值') });
      }
    }
  }
  return request;
}

export function rollRequest(request, rollDie, traitValue = 0) {
  if (!Number.isSafeInteger(traitValue) || Math.abs(traitValue) > 1000) throw new Error('属性必须为整数');
  const die = sides => {
    const value = rollDie(sides);
    if (!Number.isSafeInteger(value) || value < 1 || value > sides) throw new Error('随机源返回无效出目');
    return value;
  };
  const hope = die(12), fear = die(12);
  const detail = [];
  if (request.trait) detail.push({ label: request.trait, value: traitValue });
  let modifier = traitValue;
  for (const term of request.terms) {
    if (term.kind === 'dice') {
      const rolls = Array.from({ length: term.count }, () => die(term.sides));
      const value = term.sign * rolls.reduce((sum, roll) => sum + roll, 0);
      modifier += value;
      detail.push({ label: `${term.sign < 0 ? '-' : '+'}${term.count}d${term.sides}`, value, rolls });
    } else {
      modifier += term.value;
      detail.push({ label: '固定修正', value: term.value });
    }
  }
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
  return { request, hope, fear, detail, modifier, advantage, total, critical, withHope, success, effects };
}

export function formatRoll(result, name, hints = true) {
  const { request, hope, fear, total, critical, withHope, success, advantage, detail, effects } = result;
  const outcome = critical ? '关键成功' : request.reaction
    ? (success === null ? '待定' : success ? '成功' : '失败')
    : `${withHope ? '希望' : '恐惧'}${success === null ? '' : success ? '成功' : '失败'}`;
  let expression = `希望${hope}+恐惧${fear}`;
  for (const item of detail) {
    const sign = item.value < 0 ? '-' : '+';
    const label = item.label === '固定修正' ? '' : item.label.replace(/^[+-]/, '');
    expression += item.rolls ? `${sign}${label}[${item.rolls.join(',')}]` : `${sign}${label}${Math.abs(item.value)}`;
  }
  if (advantage) expression += `${advantage > 0 ? '+' : '-'}${advantage > 0 ? '优势' : '劣势'}${Math.abs(advantage)}`;
  const lines = [`【${name}】${request.reaction ? '反应掷骰' : '掷骰'} · ${outcome}${request.reason ? ` · ${request.reason}` : ''}`,
    `${expression}=${total}${request.difficulty !== null ? ` / 难度${request.difficulty}` : ''}`];
  if (hints) {
    const resources = [];
    if (effects.hopeGain) resources.push('希望+1');
    if (effects.fearGain) resources.push('恐惧+1');
    if (effects.stressClear) resources.push('压力-1');
    if (resources.length) lines.push(`手动：${resources.join('、')}`);
  }
  return lines.join('\n');
}
export function formatSettlement(before, after, fearBefore, fearAfter, effects) {
  const fields = [];
  const change = (label, a, b, cap) => a === b ? `${label}${b}/${cap}` : `${label}${a}→${b}`;
  if (effects.hopeGain) fields.push(change('希望', before.希望, after.希望, 6));
  if (effects.stressClear) fields.push(before.压力 === after.压力 ? `压力${after.压力}` : `压力${before.压力}→${after.压力}`);
  if (effects.fearGain) fields.push(change('恐惧', fearBefore, fearAfter, 12));
  return fields.join(' ｜ ');
}
