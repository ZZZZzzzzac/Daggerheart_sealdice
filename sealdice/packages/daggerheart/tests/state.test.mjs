import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, adjustResource, parseGroupState, validateResources } from '../src/state.mjs';
import { parseRequest, rollRequest } from '../src/rules.mjs';
const values = { 生命: 0, 压力: 2, 护甲: 0, 希望: 2, 金币: 20 };
const caps = { 生命上限: 6, 压力上限: 6, 护甲上限: 2 };
test('all 144 action pairs settle currencies, stress and cap from pure rules', () => {
  for (let h = 1; h <= 12; h++) for (let f = 1; f <= 12; f++) {
    const dice = [h, f], result = rollRequest(parseRequest([]), () => dice.shift());
    const next = settle(values, caps, result.effects, 3);
    assert.equal(next.values.希望, h >= f ? 3 : 2); assert.equal(next.fear, h < f ? 4 : 3);
    assert.equal(next.values.压力, h === f ? 1 : 2); assert.equal(next.values.金币, 20);
  }
});
test('reaction costs only, automatic cap saturation, insufficient funds rejected', () => {
  const effects = { hopeCost: 2, hopeGain: 0, fearGain: 0, stressClear: 0 };
  assert.equal(settle(values, caps, effects, 12).values.希望, 0);
  assert.throws(() => settle(values, caps, { ...effects, hopeCost: 3 }, 0), /希望不足/);
  const next = settle({ ...values, 希望: 6, 压力: 0 }, caps, { hopeCost: 0, hopeGain: 1, fearGain: 1, stressClear: 1 }, 12);
  assert.equal(next.values.希望, 6); assert.equal(next.values.压力, 0); assert.equal(next.fear, 12);
});
test('resource changes are bounded and unknown or missing values never become zero', () => {
  assert.equal(adjustResource(values, caps, '金币', '-10').金币, 10);
  assert.equal(adjustResource(values, caps, '生命', '=3').生命, 3);
  for (const op of ['-1', '=7', '+999999999999999999999']) assert.throws(() => adjustResource(values, caps, '生命', op));
  assert.throws(() => validateResources({ ...values, 希望: null }, caps));
  assert.throws(() => validateResources(values, { ...caps, 生命上限: null }));
  assert.throws(() => parseGroupState('{bad'), /状态损坏/);
});
