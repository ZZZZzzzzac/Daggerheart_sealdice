export function bounded(value, maximum, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`${label}必须是0–${maximum}的整数`);
  return value;
}
export function settleOptional(values, effects, fear) {
  const next = { ...values };
  if (effects.hopeCost || effects.hopeGain) {
    bounded(next.希望, 6, '希望');
    if (next.希望 < effects.hopeCost) throw new Error('希望不足');
    next.希望 = Math.min(6, next.希望 - effects.hopeCost + effects.hopeGain);
  }
  if (effects.stressClear) next.压力 = Math.max(0, bounded(next.压力, Number.MAX_SAFE_INTEGER, '压力') - effects.stressClear);
  if (effects.fearGain) fear = Math.min(12, bounded(fear, 12, 'GM恐惧') + effects.fearGain);
  return { values: next, fear };
}
export function parseGroupState(raw) {
  if (!raw) return { schema: 2, gm: '', revision: 0, receipts: [], pending: null };
  let state;
  try { state = JSON.parse(raw); } catch { throw new Error('群状态损坏，请从备份恢复'); }
  if (!state || ![1, 2].includes(state.schema) || typeof state.gm !== 'string' || !Array.isArray(state.receipts) || state.receipts.length > 100 || !Number.isSafeInteger(state.revision) || state.revision < 0) throw new Error('群状态结构无效');
  if (state.schema === 1) {
    if (state.pending) throw new Error('请先用0.2.1完成 .dh recover，再升级');
    // Preserve GM identity, never silently copy the retired group pool into a character.
    return { schema: 2, gm: state.gm, revision: state.revision, receipts: [], pending: null };
  }
  return state;
}
