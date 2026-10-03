import {experienceToken} from '../../../sealdice/packages/daggerheart/src/experiences.mjs';
import {GOLD} from '../../../sealdice/packages/daggerheart/src/fields.mjs';
export {GOLD};
export const TRAITS = [
  ['敏捷', 'Agility', '冲刺 · 跳跃 · 机动'],
  ['力量', 'Strength', '举起 · 击碎 · 擒抱'],
  ['灵巧', 'Finesse', '控制 · 隐藏 · 巧手'],
  ['本能', 'Instinct', '感知 · 生存 · 导航'],
  ['风度', 'Presence', '魅力 · 表演 · 欺骗'],
  ['知识', 'Knowledge', '回忆 · 分析 · 理解'],
];

// These are the canonical fields emitted by PbDH's sealdice text export.
// Only own, finite numeric fields are shown; absent data is never coerced to zero.
export function numeric(attrs, key) {
  if (!Object.hasOwn(attrs || {}, key)) return null;
  const raw = attrs[key];
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function resource(attrs, key) {
  const value = numeric(attrs, key);
  const max = GOLD.find(item=>item.key===key)?.max ?? numeric(attrs, key + '上限');
  const validValue = value !== null && Number.isSafeInteger(value) && value >= 0;
  const validMax = max !== null && Number.isSafeInteger(max) && max >= 0;
  return {
    key, value: validValue ? value : null, max: validMax ? max : null,
    conflict: validValue && validMax && value > max,
  };
}

function numberOption(raw, label, integer = false) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw new Error(label + '必须是数字');
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > 1000000 || (integer && !Number.isSafeInteger(value))) {
    throw new Error(label + (integer ? '必须是范围内的整数' : '超出范围'));
  }
  return value;
}

export function rollCommand(trait, options = {}) {
  if (!TRAITS.some(([name]) => name === trait)) throw new Error('未知特质');
  if (!['action', 'reaction'].includes(options.mode || 'action')) throw new Error('未知掷骰模式');
  if (!['normal', 'adv', 'dis'].includes(options.edge || 'normal')) throw new Error('未知优劣势');
  const modifier = numberOption(options.modifier, '修正');
  const difficulty = numberOption(options.difficulty, '难度', true);
  if (difficulty !== null && difficulty < 0) throw new Error('难度不能为负数');
  const reason = String(options.reason || '').trim();
  if (/[\r\n\u0000-\u001f\u007f]/.test(reason) || reason.length > 200) throw new Error('原因须为不超过200字的单行文字');
  const parts = [options.mode === 'reaction' ? '.ddr' : '.dd', trait];
  if (modifier) parts.push((modifier > 0 ? '+' : '') + modifier);
  if (options.edge && options.edge !== 'normal') parts.push(options.edge);
  if (options.experienceIndices?.length) parts.push(experienceToken(options.experienceIndices,options.experienceRevision));
  if (difficulty !== null) parts.push('dc' + difficulty);
  if (reason) parts.push('--', reason);
  return parts.join(' ');
}

export function safeImage(raw) {
  try {
    const url = new URL(typeof raw === 'string' ? raw : '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
