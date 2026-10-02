import test from 'node:test';
import assert from 'node:assert/strict';
import { settleOptional, parseGroupState } from '../src/state.mjs';
import { parseRequest, rollRequest } from '../src/rules.mjs';
test('all 144 outcomes settle only requested fields and cap hope/fear', () => {
  for(let h=1;h<=12;h++) for(let f=1;f<=12;f++) {
    const dice=[h,f], result=rollRequest(parseRequest([]),()=>dice.shift());
    const next=settleOptional({希望:2,压力:2},result.effects,3);
    assert.equal(next.values.希望,h>=f?3:2); assert.equal(next.fear,h<f?4:3); assert.equal(next.values.压力,h===f?1:2);
  }
});
test('independent fields, cost validation and saturation', () => {
  const empty={hopeCost:0,hopeGain:0,stressClear:0,fearGain:0};
  assert.equal(settleOptional({希望:null,压力:null},empty,null).values.希望,null);
  assert.equal(settleOptional({希望:6,压力:0},{...empty,hopeGain:1,stressClear:1,fearGain:1},12).fear,12);
  assert.throws(()=>settleOptional({希望:0},{...empty,hopeCost:1},null),/希望不足/);
});
test('legacy state keeps GM but never copies retired fear pool; unfinished writes block upgrade', () => {
  const old={schema:1,gm:'SEALCHAT:G',fear:8,revision:3,receipts:[],pending:null};
  const next=parseGroupState(JSON.stringify(old)); assert.equal(next.gm,old.gm); assert.equal(next.schema,2); assert.equal('fear' in next,false);
  assert.throws(()=>parseGroupState(JSON.stringify({...old,pending:{owner:'x'}})),/0.2.1/);
  assert.throws(()=>parseGroupState('{bad'),/状态损坏/);
});
