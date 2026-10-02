import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest, rollRequest, formatRoll, formatSettlement } from '../src/rules.mjs';
test('compact roll retains native expression, numeric subtotal, advantage, difficulty and result', () => {
  const dice=[9,5,4];
  const result=rollRequest(parseRequest(['敏捷+2-1d4','adv','dc15','--','攀爬']),()=>dice.shift(),()=>({value:2,expression:'敏捷+2-1d4'}));
  assert.equal(formatRoll(result,'林'),'【林】掷骰 · 希望成功 · 攀爬\n希望9+恐惧5+(敏捷+2-1d4)[2]+优势4=20 / 难度15\n手动：希望+1');
  assert.equal(formatRoll(result,'林',false).split('\n').length,2);
});
test('reaction and no difficulty do not invent outcomes or append explanations', () => {
  const dice = [3, 7];
  const text = formatRoll(rollRequest(parseRequest([], true), () => dice.shift()), '林');
  assert.equal(text, '【林】反应掷骰 · 待定\n希望3+恐惧7=10');
  assert.doesNotMatch(text, /特质|检定|本版本|尚未|不接受|未接入/);
});
test('settlement only shows affected resources, including saturated gains', () => {
  assert.equal(formatSettlement({ 希望: 2, 压力: 2 }, { 希望: 3, 压力: 1 }, 5, 5,
    { hopeGain: 1, stressClear: 1, fearGain: 0 }), '希望2→3 ｜ 压力2→1');
  assert.equal(formatSettlement({ 希望: 6, 压力: 0 }, { 希望: 6, 压力: 0 }, 12, 12,
    { hopeGain: 1, stressClear: 1, fearGain: 0 }), '希望6/6 ｜ 压力0');
  assert.equal(formatSettlement({}, {}, 5, 5, { hopeGain: 0, stressClear: 0, fearGain: 0 }), '');
});
