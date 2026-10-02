import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest, rollRequest, formatRoll } from '../src/rules.mjs';

const sequence = (...values) => sides => {
  const next = values.shift();
  assert.ok(next >= 1 && next <= sides, `Unexpected roll d${sides}: ${next}`);
  return next;
};
test('all 144 duality pairs: crit precedes impossible difficulty; Hope/Fear and resources', () => {
  for (let hope = 1; hope <= 12; hope++) for (let fear = 1; fear <= 12; fear++) {
    const result = rollRequest(parseRequest(['dc1000']), sequence(hope, fear));
    assert.equal(result.critical, hope === fear);
    assert.equal(result.success, hope === fear);
    assert.equal(result.total, hope + fear);
    assert.equal(result.effects.hopeGain, hope >= fear ? 1 : 0);
    assert.equal(result.effects.fearGain, fear > hope ? 1 : 0);
    assert.equal(result.effects.stressClear, hope === fear ? 1 : 0);
  }
});
test('difficulty boundary and no-difficulty result do not invent success/failure', () => {
  const equal = rollRequest(parseRequest(['+2', '[15]']), sequence(7, 6));
  assert.equal(equal.success, true);
  const missing = rollRequest(parseRequest([]), sequence(7, 6));
  assert.equal(missing.success, null);
  assert.match(formatRoll(missing, '甲'), /掷骰 · 希望/);
  assert.doesNotMatch(formatRoll(missing, '甲'), /成功|失败|难度/);
});
test('ordinary advantages cancel by source then roll only one die', () => {
  const result = rollRequest(parseRequest(['adv3', 'dis1']), sequence(5, 6, 4));
  assert.equal(result.advantage, 4);
  assert.equal(result.total, 15);
  const canceled = rollRequest(parseRequest(['adv2', 'dis2']), sequence(5, 6));
  assert.equal(canceled.advantage, 0);
  const negative = rollRequest(parseRequest(['dis3', 'adv1']), sequence(5, 6, 6));
  assert.equal(negative.advantage, -6);
});
test('reaction crit gives no resources; experiences still cost Hope', () => {
  const result = rollRequest(parseRequest(['exp2', 'exp3'], true), sequence(2, 2));
  assert.equal(result.success, true);
  assert.deepEqual(result.effects, { hopeGain: 0, fearGain: 0, stressClear: 0, hopeCost: 2 });
});
test('trait aliases, signed dice, repeated experience and explicit reason', () => {
  const request = parseRequest(['agi', '+2-1d4', 'exp2', '[15]', '--', '穿过', '火海']);
  const result = rollRequest(request, sequence(8, 3, 4), 3);
  assert.equal(request.trait, '敏捷');
  assert.equal(request.reason, '穿过 火海');
  assert.equal(result.total, 14);
  assert.equal(result.success, false);
  assert.equal(result.effects.hopeGain, 1);
});
test('reject typos, resource abuse and ambiguous parameters before rolling', () => {
  for (const args of [['adv0'], ['+1001'], ['31d6'], ['1d0'], ['1d1'], ['1d1001'], ['30d6', 'd6'],
    ['dc15', '[16]'], ['agi', 'str'], ['2d6junk'], ['12/20'], ['exp'], ['exp0'], ['破门']]) {
    assert.throws(() => parseRequest(args), args.join(' '));
  }
});
test('invalid random source and invalid trait fail explicitly', () => {
  assert.throws(() => rollRequest(parseRequest([]), () => 0));
  assert.throws(() => rollRequest(parseRequest(['agi']), sequence(2, 3), NaN));
});
