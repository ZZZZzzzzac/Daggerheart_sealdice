import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseRequest, rollRequest, formatRoll} from '../src/rules.mjs';

// 只读取固定宿主的公开机器人规则，不构建或改动宿主。
const source=fs.readFileSync(new URL('../../../../reference/sealchat/service/dice3d.go',import.meta.url),'utf8');
const pattern=/annotDice3DBotPattern = `([^`]+)`/.exec(source)[1];
const regexp=new RegExp(pattern.replace('(?i)','').replaceAll('(?P<','(?<'),'gi');
const groups=text=>[...text.matchAll(regexp)].map(match=>({type:'d'+match.groups.sides,results:[Number(match.groups.values)]}));

test('both action and reaction expose the two actual d12 results to the fixed Chat parser',()=>{
  for(const reaction of [false,true]) for(let hope=1;hope<=12;hope++) for(let fear=1;fear<=12;fear++) {
    const dice=[hope,fear];
    const result=rollRequest(parseRequest([],reaction),()=>dice.shift());
    assert.deepEqual(groups(formatRoll(result,'测试',false)),[{type:'d12',results:[hope]},{type:'d12',results:[fear]}]);
  }
});

test('advantage and disadvantage expose the actual d6 without treating the subtotal as a die',()=>{
  for(const flag of ['adv','dis']) {
    const dice=[12,7,3];
    const result=rollRequest(parseRequest(['敏捷+4',flag]),()=>dice.shift(),()=>({value:5,expression:'敏捷+4'}));
    assert.deepEqual(groups(formatRoll(result,'测试',false)),[{type:'d12',results:[12]},{type:'d12',results:[7]},{type:'d6',results:[3]}]);
  }
});
