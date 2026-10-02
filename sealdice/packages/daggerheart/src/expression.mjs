// Host adapter for the same DiceScript VM and character-load hooks as native .r.
// Do not implement dice arithmetic, functions, aliases or attribute substitution here.
export function normalizeExpression(expression) {
  // User shorthand l1 means keep low; native syntax is kl1/q1.
  let quote = '', escaped = false, output = '';
  for (let i = 0; i < expression.length; i++) {
    const c = expression[i];
    if (quote) {
      output += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") { quote = c; output += c; }
    else if ((c === 'l' || c === 'L') && /(^|[^A-Za-z0-9_\u0080-\uffff])\d*[dD]\d+$/.test(output) && /\d/.test(expression[i + 1] || '')) output += 'kl';
    else output += c;
  }
  return output;
}
export function evaluateNative(ctx, expression) {
  const normalized = normalizeExpression(expression);
  // .dd accepts calculations, never statements or attribute assignments.
  // Wrapping the whole expression prevents partial parsing with a trailing reason.
  let unquoted = '', quote = '', escaped = false;
  for (const c of normalized) {
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else unquoted += c;
  }
  if (/;/.test(unquoted) || /(^|[^=!<>])=(?!=)/.test(unquoted)) throw new Error('请使用掷骰算式，原因放在 -- 后');
  const result = ctx.eval(`(${normalized})`, ctx.genDefaultRollVmConfig());
  // Failed Eval returns a zero-initialized VMValue (t=0,v=null), not a JS exception.
  // readInt/toString on that object panic in Go; serialize first to inspect safely.
  const bytes = result.toJSON();
  const data = JSON.parse(String.fromCharCode(...Array.from(bytes)));
  if (![0, 1].includes(data.t) || typeof data.v !== 'number' || !Number.isFinite(data.v)) throw new Error('算式无效或结果不是数字');
  return { value: data.v, expression: normalized };
}
