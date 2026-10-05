// iframe 直接传中文 JSON；兼容旧 URI 编码，避免原生 .st 的人物名简写解析。
export const PBDH_SOURCE = 'DH来源';
export const PBDH_NAME = 'DH姓名';
const pairs = [['生命','生命上限'],['压力','压力上限'],['护甲','护甲上限'],['希望','希望上限']];
const gold = {金币把:9,金币袋:9,金币箱:1};
const fields = pairs.flat().concat(Object.keys(gold));
const defenses = ['闪避','重伤阈值','严重阈值'];
export function readPbDHBinding(encoded) {
  let payload;
  try { payload = JSON.parse(encoded.trimStart().startsWith("{") ? encoded : decodeURIComponent(encoded)); } catch { throw Error('PbDH 关联数据编码无效'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.keys(payload).sort().join(',') !== 'name,source,values'
      || typeof payload.source !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(payload.source)) throw Error('PbDH 存档标识无效');
  if (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.length > 100 || /[\u0000-\u001f\u007f]/.test(payload.name)) throw Error('PbDH 人物卡姓名无效');
  const values = payload.values;
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => !fields.includes(key) && !defenses.includes(key))
      || fields.some(key => !Object.hasOwn(values,key) || !Number.isSafeInteger(values[key]) || values[key] < 0)) throw Error('PbDH 资源数据无效');
  // 旧关联协议没有徽标字段，保留兼容；新字段仍严格白名单与非负整数校验。
  for (const key of defenses) if (Object.hasOwn(values,key) && (!Number.isSafeInteger(values[key]) || values[key] < 0 || values[key] > 1000000)) throw Error('PbDH 闪避或阈值无效');
  for (const [current,max] of pairs) if (values[current] > values[max] || values[max] > 60) throw Error('PbDH 资源当前值或上限越界');
  for (const [key,max] of Object.entries(gold)) if (values[key] > max) throw Error('PbDH 金币数量越界');
  return {source:payload.source,name:payload.name.trim(),values};
}
