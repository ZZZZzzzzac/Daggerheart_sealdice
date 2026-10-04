import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest, rollRequest, formatRoll, formatSettlement } from '../src/rules.mjs';
const rolled = (args, dice, reaction = false, evaluated = {value:0,expression:''}) =>
  rollRequest(parseRequest(args,reaction),()=>dice.shift(),()=>evaluated);

test('three lines put roll context first, annotated dice and emphasized outcome second, resources last', () => {
  const result=rolled(['敏捷+2-1d4','adv','dc15','--','攀爬'],[9,5,4],false,{value:2,expression:'敏捷+2-1d4'});
  assert.equal(formatRoll(result,'林'), '【林】动作掷骰 · 敏捷 · 攀爬 · 优势\n希望9[1d12]+恐惧5[1d12]+(敏捷+2-1d4)[2]+优势4[1d6]=20 > 难度15 ⇒ **✅【希望成功】**\n资源：手动：希望+1');
  assert.equal(formatRoll(result,'林',false).split('\n').length,2);
});
test('reaction shows polarity but no invented pass/fail or automatic resource reward without difficulty', () => {
  const text=formatRoll(rolled([],[3,7],true),'林');
  assert.equal(text,'【林】反应掷骰 · 普通\n希望3[1d12]+恐惧7[1d12]=10 ⇒ **◆【恐惧 · 成败待定】**\n资源：无变化');
});
test('all four Hope/Fear success/failure outcomes appear emphasized at the end of the dice line',()=>{
  for(const [dice,dc,label,icon] of [[[9,5],14,'希望成功','✅'],[[9,5],15,'希望失败','❌'],[[5,9],14,'恐惧成功','✅'],[[5,9],15,'恐惧失败','❌']]) {
    const lines=formatRoll(rolled(['dc'+dc],dice),'林').split('\n');
    assert.equal(lines.length,3); assert.ok(lines[1].endsWith('**'+icon+'【'+label+'】**'));
    assert.doesNotMatch(lines[0],/成功|失败|希望|恐惧/);
  }
});
test('reaction uses the same prominent polarity/outcome while retaining no automatic rewards',()=>{
  const lines=formatRoll(rolled(['dc14'],[5,9],true),'林').split('\n');
  assert.match(lines[0],/反应掷骰/);assert.match(lines[1],/\*\*✅【恐惧成功】\*\*$/);assert.equal(lines[2],'资源：无变化');
});
test('native aliases, selected experiences and net advantage belong on the context line',()=>{
  const result=rolled(['agi+2','adv2','dis2','--','攀爬'],[9,5],false,{value:3,expression:'agi+2'});
  const lines=formatRoll(result,'林',true,[{name:'旅行者',modifier:2},{name:'侦察',modifier:-1}]).split('\n');
  assert.equal(lines[0],'【林】动作掷骰 · 敏捷 · 经历：旅行者(+2)、侦察(-1) · 攀爬 · 优劣势抵消');
  assert.doesNotMatch(lines[1],/1d6/);
});
test('settlement only shows affected resources, including saturated gains', () => {
  assert.equal(formatSettlement({ 希望: 2, 压力: 2 }, { 希望: 3, 压力: 1 }, 5, 5,
    { hopeGain: 1, stressClear: 1, fearGain: 0 }), '希望2→3 ｜ 压力2→1');
  assert.equal(formatSettlement({ 希望: 6, 压力: 0 }, { 希望: 6, 压力: 0 }, 12, 12,
    { hopeGain: 1, stressClear: 1, fearGain: 0 }), '希望6/6 ｜ 压力0');
  assert.equal(formatSettlement({}, {}, 5, 5, { hopeGain: 0, stressClear: 0, fearGain: 0 }), '');
});
test('difficulty comparison remains correct and critical success takes precedence', () => {
  for (const [difficulty, sign, label] of [[19,'>','希望成功'],[33,'=','希望成功'],[34,'<','希望失败']]) {
    const result=rolled(['+2+4d6','dc'+difficulty],[12,7],false,{value:14,expression:'+2+4d6'});
    const line=formatRoll(result,'林',false).split('\n')[1];
    assert.ok(line.startsWith('希望12[1d12]+恐惧7[1d12]+(+2+4d6)[14]=33 '+sign+' 难度'+difficulty+' ⇒ '));
    assert.ok(line.includes('【'+label+'】'));
  }
  const text=formatRoll(rolled(['dc19'],[2,2]),'林',false);
  assert.match(text,/=4 < 难度19 ⇒ \*\*✨【关键成功】\*\*$/);
});
