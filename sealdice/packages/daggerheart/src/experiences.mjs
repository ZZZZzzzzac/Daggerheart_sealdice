export const EXPERIENCE_FIELD = 'DH经历';

export function validateExperiences(items) {
  if (!Array.isArray(items) || items.length > 5) throw Error('经历最多5项');
  return items.map(item => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const raw = item?.modifier;
    const modifier = typeof raw === 'number' ? raw : typeof raw === 'string' && /^[+-]?\d+$/.test(raw.trim()) ? Number(raw) : NaN;
    if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) throw Error('经历名称须为1–60字的单行文字');
    if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 20) throw Error('经历修正须为-20至20的整数');
    return {name, modifier};
  });
}

export function encodeExperiences(items) {
  return JSON.stringify({schemaVersion:1, experiences:validateExperiences(items)});
}
export function readExperiences(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  if (typeof raw !== 'string' || raw.length > 4096) throw Error('经历数据无效，请重新导入');
  let doc;
  try { doc = JSON.parse(raw); } catch { throw Error('经历数据无效，请重新导入'); }
  if (doc?.schemaVersion !== 1) throw Error('经历版本无效，请重新导入');
  return validateExperiences(doc.experiences);
}

// A content revision catches a changed list between checkbox selection and dispatch.
// This is not a cryptographic identity or an atomic card-binding guarantee.
export function experienceRevision(items) {
  let hash = 5381;
  const text=encodeExperiences(items);
  for (let i=0;i<text.length;i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
export function experienceToken(indices, revision) {
  if (!Array.isArray(indices) || !indices.length || indices.length > 5 || new Set(indices).size !== indices.length || indices.some(n => !Number.isInteger(n) || n < 1 || n > 5) || !/^[a-f0-9]{8}$/.test(revision || '')) throw Error('经历选择无效');
  return 'exp=' + indices.join(',') + '@' + revision;
}
export function parseExperienceToken(token) {
  const match = /^exp=([1-5](?:,[1-5]){0,4})@([a-f0-9]{8})$/.exec(token);
  if (!match) throw Error('经历选择无效，请从人物卡勾选');
  const indices = match[1].split(',').map(Number);
  experienceToken(indices, match[2]);
  return {indices, revision:match[2]};
}
export function selectedExperiences(raw, selection) {
  if (!selection) return [];
  const items = readExperiences(raw);
  if (experienceRevision(items) !== selection.revision) throw Error('经历已变化，请刷新人物卡后重新勾选');
  return selection.indices.map(n => {
    if (!items[n - 1]) throw Error('所选经历不存在，请重新勾选');
    return items[n - 1];
  });
}
export function experienceImportCommand(items) {
  return '.dh exp set ' + encodeURIComponent(encodeExperiences(items));
}
