export const RESOURCES = {
  生命: { max: '生命上限', label: '已标记生命' },
  压力: { max: '压力上限', label: '已标记压力' },
  护甲: { max: '护甲上限', label: '已标记护甲' },
  希望: { limit: 6, label: '可用希望' },
  金币: { limit: 999999, label: '金币计数' },
};
export const RESOURCE_ALIASES = { hp: '生命', stress: '压力', armor: '护甲', hope: '希望', gold: '金币' };
export function canonicalResource(value) { return RESOURCES[value] ? value : RESOURCE_ALIASES[value.toLowerCase()]; }
export function bounded(value, maximum, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`${label}必须是0–${maximum}的整数`);
  return value;
}
export function validateResources(values, caps) {
  for (const [key, spec] of Object.entries(RESOURCES)) {
    const maximum = spec.max ? bounded(caps[spec.max], 100, spec.max) : spec.limit;
    if (spec.max && maximum < (key === '护甲' ? 0 : 1)) throw new Error(`${spec.max}尚未初始化`);
    bounded(values[key], maximum, key);
  }
  return { ...values };
}
export function adjustResource(values, caps, key, operation) {
  if (!/^(?:[+-]\d+|=\d+)$/.test(operation)) throw new Error('操作必须为 +N、-N 或 =N');
  const current = validateResources(values, caps);
  const next = operation[0] === '=' ? Number(operation.slice(1)) : current[key] + Number(operation);
  const spec = RESOURCES[key];
  current[key] = bounded(next, spec.max ? caps[spec.max] : spec.limit, key);
  return current;
}
export function settle(values, caps, effects, fear) {
  const next = validateResources(values, caps);
  bounded(fear, 12, 'GM恐惧');
  if (next.希望 < effects.hopeCost) throw new Error(`希望不足：需要${effects.hopeCost}，当前${next.希望}`);
  next.希望 = Math.min(6, next.希望 - effects.hopeCost + effects.hopeGain);
  next.压力 = Math.max(0, next.压力 - effects.stressClear);
  return { values: next, fear: Math.min(12, fear + effects.fearGain) };
}
export function resourceSummary(values, caps) {
  return Object.entries(RESOURCES).map(([key, spec]) => `${spec.label} ${values[key]}${spec.max ? '/' + caps[spec.max] : key === '希望' ? '/6' : ''}`).join(' ｜ ');
}
export function parseGroupState(raw) {
  if (!raw) return { schema: 1, gm: '', fear: 0, revision: 0, receipts: [], pending: null };
  let state;
  try { state = JSON.parse(raw); } catch { throw new Error('频道状态损坏；停止写入，请从备份恢复'); }
  if (!state || state.schema !== 1 || typeof state.gm !== 'string' || !Array.isArray(state.receipts) || state.receipts.length > 100 || !Number.isSafeInteger(state.revision) || state.revision < 0) throw new Error('频道状态版本或结构无效；停止写入');
  bounded(state.fear, 12, 'GM恐惧');
  return state;
}
