import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest, rollRequest, formatRoll, formatSettlement } from '../src/rules.mjs';
test('compact roll retains native expression, numeric subtotal, advantage, difficulty and result', () => {
  const dice=[9,5,4];
  const result=rollRequest(parseRequest(['敏捷+2-1d4','adv','dc15','--','攀爬']),()=>dice.shift(),()=>({value:2,expression:'敏捷+2-1d4'}));
  assert.equal(formatRoll(result,'林'),'【林】动作掷骰 · 希望成功 · 攀爬\n希望9[1d12]+恐惧5[1d12]+(敏捷+2-1d4)[2]+优势4[1d6]=20 > 难度15\n手动：希望+1');
  assert.equal(formatRoll(result,'林',false).split('\n').length,2);
});
test('reaction and no difficulty do not invent outcomes or append explanations', () => {
  const dice = [3, 7];
  const text = formatRoll(rollRequest(parseRequest([], true), () => dice.shift()), '林');
  assert.equal(text, '【林】反应掷骰 · 待定\n希望3[1d12]+恐惧7[1d12]=10');
  assert.doesNotMatch(text, /特质|本版本|尚未|不接受|未接入/);
});
test('settlement only shows affected resources, including saturated gains', () => {
  assert.equal(formatSettlement({ 希望: 2, 压力: 2 }, { 希望: 3, 压力: 1 }, 5, 5,
    { hopeGain: 1, stressClear: 1, fearGain: 0 }), '希望2→3 ｜ 压力2→1');
  assert.equal(formatSettlement({ 希望: 6, 压力: 0 }, { 希望: 6, 压力: 0 }, 12, 12,
    { hopeGain: 1, stressClear: 1, fearGain: 0 }), '希望6/6 ｜ 压力0');
  assert.equal(formatSettlement({}, {}, 5, 5, { hopeGain: 0, stressClear: 0, fearGain: 0 }), '');
});

test('difficulty shows numeric comparison independently of critical success', () => {
  for (const [difficulty, sign] of [[19,'>'],[33,'='],[34,'<']]) {
    const dice=[12,7];
    const result=rollRequest(parseRequest(['+2+4d6', 'dc'+difficulty]),()=>dice.shift(),()=>({value:14,expression:'+2+4d6'}));
    assert.equal(formatRoll(result,'林',false).split('\n')[1], '希望12[1d12]+恐惧7[1d12]+(+2+4d6)[14]=33 '+sign+' 难度'+difficulty);
  }
  const dice=[2,2];
  const text=formatRoll(rollRequest(parseRequest(['dc19']),()=>dice.shift()),'林',false);
  assert.match(text,/关键成功/);assert.match(text,/=4 < 难度19/);
});
