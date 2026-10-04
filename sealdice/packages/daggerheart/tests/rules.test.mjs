import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest, rollRequest, formatRoll } from '../src/rules.mjs';
const sequence = (...values) => sides => { const value=values.shift(); assert.ok(value>=1 && value<=sides); return value; };
test('all 144 duality pairs: critical first, Hope/Fear and resources', () => {
  for(let h=1;h<=12;h++) for(let f=1;f<=12;f++) {
    const result=rollRequest(parseRequest(['dc1000']),sequence(h,f));
    assert.equal(result.success,h===f);assert.equal(result.effects.hopeGain,h>=f?1:0);
    assert.equal(result.effects.fearGain,h<f?1:0);assert.equal(result.effects.stressClear,h===f?1:0);
  }
});
test('native evaluator receives full unmodified arithmetic once; outcome uses its value', () => {
  const input='敏捷+2+1d6-4+2d6k1-3d12l1';let calls=0;
  const request=parseRequest([input,'dc15','--','攀爬']);
  const result=rollRequest(request,sequence(7,6),expression=>{calls++;assert.equal(expression,input);return {value:2,expression};});
  assert.equal(calls,1);assert.equal(result.total,15);assert.equal(result.success,true);assert.equal(request.reason,'攀爬');
});
test('optional flags outside grouping preserve original expression and native spaces', () => {
  const request=parseRequest(['(', '敏捷', '+', '力量', ')', '*', '2','adv2','dis1','[15]']);
  assert.equal(request.expression,'( 敏捷 + 力量 ) * 2');assert.equal(request.advantages,2);assert.equal(request.disadvantages,1);
  assert.equal(parseRequest(['[1,2,3].kh(1).sum()']).expression,'[1,2,3].kh(1).sum()');
});
test('one ordinary advantage after source cancellation; no difficulty invents no outcome', () => {
  const result=rollRequest(parseRequest(['adv3','dis1']),sequence(5,6,4));assert.equal(result.advantage,4);assert.equal(result.total,15);
  const text=formatRoll(rollRequest(parseRequest([]),sequence(7,6)),'甲');assert.doesNotMatch(text,/成功|失败|难度/);
});
test('reaction critical gives no rewards; floats remain native numbers', () => {
  const result=rollRequest(parseRequest(['0.5'],true),sequence(2,2),()=>({value:0.5,expression:'0.5'}));
  assert.equal(result.total,4.5);assert.deepEqual(result.effects,{hopeGain:0,fearGain:0,stressClear:0});
});
test('expression failures precede duality dice; bad options and random sources reject', () => {
  let rolls=0;assert.throws(()=>rollRequest(parseRequest(['bad']),()=>{rolls++;return 2;},()=>{throw Error('bad');}));assert.equal(rolls,0);
  for(const args of [['adv0'],['adv21'],['dc15','[16]']]) assert.throws(()=>parseRequest(args));
  assert.throws(()=>rollRequest(parseRequest([]),()=>0));
});

test('explicit Hope cost is transient, bounded, unique and incompatible with experience indices',()=>{
  const id='01234567-89ab-4cde-8fab-0123456789ab';const r=parseRequest(['3+2','hope=1','pbdh='+id,'adv','--','经历']);
  assert.equal(r.expression,'3+2');assert.equal(r.hopeCost,1);assert.equal(r.pbdh,id);assert.equal(r.reason,'经历');
  for(const args of [['hope=-1'],['hope=6'],['hope=1.5'],['hope=1','hope=2'],['exp=1@12345678','hope=1'],['pbdh=bad'],['pbdh='+id,'pbdh='+id]]) assert.throws(()=>parseRequest(args));
  assert.equal(parseRequest(['--','hope=1']).hopeCost,undefined);
});
