import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNative, normalizeExpression } from '../src/expression.mjs';
const returned = v => ({ toJSON: () => Array.from(new TextEncoder().encode(JSON.stringify(v))) });
test('native adapter keeps context config and aliases; serializes before reading error values', () => {
  const config={ marker:true }; let calls=0;
  const ctx={genDefaultRollVmConfig:()=>config,eval:(expr,flags)=>{calls++;assert.equal(expr,'(敏捷+2+1d6-4+2d6k1-3d12kl1)');assert.equal(flags,config);return returned({t:0,v:5});}};
  assert.deepEqual(evaluateNative(ctx,'敏捷+2+1d6-4+2d6k1-3d12l1'),{value:5,expression:'敏捷+2+1d6-4+2d6k1-3d12kl1'});assert.equal(calls,1);
});
test('h/l shorthand preserves both native spellings and quoted or identifier text', () => {
  assert.equal(normalizeExpression('3d12k1+3d12kh1+3d12q1+3d12kl1+3d12h1+3d12l1'), '3d12k1+3d12kh1+3d12q1+3d12kl1+3d12kh1+3d12kl1');
  assert.equal(normalizeExpression(`"3d12h1"+'3d12l1'`), `"3d12h1"+'3d12l1'`);
  assert.equal(normalizeExpression('12D20H10+3D12L2'), '12D20kh10+3D12kl2');
  assert.equal(normalizeExpression('属性2l1+foo2l1'), '属性2l1+foo2l1');
});
test('invalid native values and assignments cannot become zero or write attributes', () => {
  for(const data of [{t:0,v:null},{t:2,v:'3'},{t:4},{t:0,v:Infinity}]) assert.throws(()=>evaluateNative({genDefaultRollVmConfig:()=>({}),eval:()=>returned(data)},'bad'));
  const ctx={eval:()=>{throw Error('must not execute');}};
  assert.throws(()=>evaluateNative(ctx,'敏捷=9'),/掷骰算式/);assert.throws(()=>evaluateNative(ctx,'1;2'),/掷骰算式/);
});
