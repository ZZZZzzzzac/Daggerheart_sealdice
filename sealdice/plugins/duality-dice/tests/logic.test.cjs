const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../src/dice-logic.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
function load(random) {
  const math = Object.create(Math); math.random = random;
  const context = { exports: {}, module: { exports: {} }, Math: math };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}
test('duality dice: critical result retains modifier and user name', () => {
  const result = load(() => 0).parseArgsAndRoll(['+4'], '测试玩家');
  assert.equal(result.hope, 1); assert.equal(result.fear, 1);
  assert.equal(result.value, 6); assert.match(result.reply, /关键成功/);
  assert.match(result.reply, /测试玩家/);
});
test('feast rejects invalid pool', () => {
  assert.match(load(() => 0).calculateFeastRoll(['invalid'], '测试').reply, /无效/);
});
test('feast matching dice produce total and extra matching bonus', () => {
  const result = load(() => 0).calculateFeastRoll(['3d6'], '测试');
  assert.equal(result.totalValue, 1); assert.equal(result.bonusValue, 1);
});
