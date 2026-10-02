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
  const request = { reaction, reason, trait: null, terms: [], advantages: 0, disadvantages: 0, difficulty: null, experienceCosts: 0, experienceIds: [] };
  let diceCount = 0;
  for (const raw of tokens) {
    const token = raw.toLowerCase();
    let match;
    const trait = canonicalTrait(token.replace(/^\+/, ''));
    if (trait) {
      if (request.trait) throw new Error('一次检定只能选择一项特质');
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
    } else if ((match = /^(?:exp|经历):([a-zA-Z0-9_-]{1,40})$/.exec(raw))) {
      if (request.experienceIds.includes(match[1])) throw new Error('同一经历不能重复选择');
      if (request.experienceIds.length >= 10) throw new Error('一次检定最多选择10项经历');
      request.experienceIds.push(match[1]);
      request.experienceCosts += 1;
    } else if ((match = /^(?:exp|经历)(\d+)$/.exec(token))) {
      const value = integer(match[1], 20, '经历修正');
      if (!value) throw new Error('经历修正至少为1');
      request.terms.push({ kind: 'experience', value });
      request.experienceCosts += 1;
    } else {
      const terms = token.match(/[+-]?(?:\d*d\d+|\d+)/g);
      if (!terms || terms.join('') !== token) throw new Error(`无法识别“${raw}”；检定原因请放在 -- 后`);
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
  if (!Number.isSafeInteger(traitValue) || Math.abs(traitValue) > 1000) throw new Error('特质必须为有效整数');
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
      detail.push({ label: term.kind === 'experience' ? (term.name || '经历') : '固定修正', value: term.value });
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
    hopeCost: request.experienceCosts,
  };
  return { request, hope, fear, detail, modifier, advantage, total, critical, withHope, success, effects };
}

export function formatRoll(result, name, hints = true) {
  const { request, hope, fear, total, critical, withHope, success, advantage, detail, effects } = result;
  const outcome = critical ? '关键成功' : request.reaction
    ? (success === null ? '待GM判定' : success ? '成功' : '失败')
    : `${withHope ? '希望' : '恐惧'}${success === null ? '结果（未指定难度）' : success ? '成功' : '失败'}`;
  const lines = [`【${name}】${request.reaction ? '反应检定' : '行动检定'}${request.reason ? ` · ${request.reason}` : ''}`,
    `希望 d12=${hope} ｜ 恐惧 d12=${fear}`];
  if (detail.length) lines.push(detail.map(item => `${item.label}${item.rolls ? `[${item.rolls.join(',')}]` : ''}=${item.value >= 0 ? '+' : ''}${item.value}`).join(' ｜ '));
  if (advantage) lines.push(`${advantage > 0 ? '优势' : '劣势'} d6=${Math.abs(advantage)}（来源抵消后取一枚）`);
  else if (request.advantages || request.disadvantages) lines.push('优劣势来源完全抵消');
  lines.push(`总计 ${total}${request.difficulty !== null ? ` / 难度 ${request.difficulty}` : ''} → ${outcome}`);
  if (hints) {
    const resources = [];
    if (effects.hopeCost) resources.push(`使用经历先消耗希望${effects.hopeCost}`);
    if (effects.hopeGain) resources.push('玩家希望+1（上限6）');
    if (effects.fearGain) resources.push('GM恐惧+1（上限12）');
    if (effects.stressClear) resources.push('清除1压力');
    if (request.reaction) resources.push('反应检定不产生希望／恐惧，不触发额外GM行动');
    if (resources.length) lines.push(`结算提示：${resources.join('；')}。请手动结算。`);
  }
  return lines.join('\n');
}
