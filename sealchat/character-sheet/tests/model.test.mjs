import test from 'node:test';
import assert from 'node:assert/strict';
import { numeric, resource, rollCommand, safeImage, TRAITS } from '../src/model.mjs';
import { parseRequest } from '../../../sealdice/packages/daggerheart/src/rules.mjs';
import { FIELDS, stCommand } from '../src/embed.mjs';

test('missing, null and malformed resources never become zero', () => {
  for (const raw of [undefined,null,'',false,{},'no',Infinity]) {
    assert.equal(numeric({希望:raw},'希望'),null);
  }
  assert.equal(numeric({},'生命'),null);
  assert.equal(numeric({生命:0},'生命'),0);
  assert.equal(resource({生命:0,生命上限:6},'生命').value,0);
  assert.equal(resource({生命:9,生命上限:6},'生命').conflict,true);
  assert.equal(resource({生命:2.5,生命上限:6},'生命').value,null);
  assert.equal(resource({生命上限:6},'生命').value,null);
  assert.equal(resource({生命:3,生命上限:1000000000},'生命').max,1000000000);
});

test('three gold quantities use fixed caps, preserve zero and send relative native st commands',()=>{
  for(const [field,max] of [['金币把',10],['金币袋',10],['金币箱',1]]) {
    assert.equal(resource({[field]:0,[field+'上限']:999},field).max,max);
    assert.equal(stCommand({field,delta:1},{[field]:0}),'.st '+field+'+1');
    assert.throws(()=>stCommand({field,delta:1},{[field]:max}));
    assert.throws(()=>stCommand({field,delta:-1},{[field]:0}));
    assert.throws(()=>stCommand({field,value:max+1},{}));
    assert.equal(stCommand({field,value:0},{}),'.st '+field+'0');
    assert.equal(resource({},field).value,null);
  }
  assert.throws(()=>stCommand({field:'恐惧',value:0},{}));
});

test('every supported numeric field preserves explicit zero, including traits and limits',()=>{
  const attrs=Object.fromEntries([...FIELDS].map(field=>[field,0]));
  for(const field of FIELDS) {
    assert.equal(numeric(attrs,field),0);
    assert.equal(stCommand({field,value:0},attrs),'.st '+field+'0');
  }
  for(const field of ['生命','压力','护甲','希望']) {
    assert.equal(resource(attrs,field).value,0);assert.equal(resource(attrs,field).max,0);
    const next={...attrs,[field+'上限']:6};
    assert.equal(stCommand({field,delta:1},next),'.st '+field+'+1');
  }
});

test('commands read named traits and match the actual Dice parser', () => {
  for (const [trait] of TRAITS) {
    for (const mode of ['action','reaction']) {
      const command=rollCommand(trait,{mode,edge:'adv',modifier:'-2.5',difficulty:'15',reason:'攀爬'});
      const body=command.slice(command.indexOf(' ')+1);
      const parsed=parseRequest(body.split(/\s+/),mode==='reaction');
      assert.equal(parsed.expression,trait+' -2.5');
      assert.equal(parsed.difficulty,15);
      assert.equal(parsed.advantages,1);
      assert.equal(parsed.reason,'攀爬');
      assert.equal(parsed.reaction,mode==='reaction');
    }
  }
  assert.equal(rollCommand('本能',{modifier:0} ),'.dd 本能');
  assert.equal(rollCommand('力量',{edge:'dis',difficulty:'0'}),'.dd 力量 dis dc0');
});

test('options cannot inject commands or expressions', () => {
  for (const options of [{modifier:'2 adv'},{modifier:'1d6'},{difficulty:'15\n.st 希望6'},{difficulty:'1.5'},{difficulty:'-1'},{reason:'a\n.st 希望6'},{mode:'bad'},{edge:'bad'}]) {
    assert.throws(()=>rollCommand('敏捷',options));
  }
  assert.throws(()=>rollCommand('敏捷+99'));
});

test('avatars use hosted images and reject embedded images or local files', () => {
  assert.equal(safeImage('https://example.test/card.png'),'https://example.test/card.png');
  assert.equal(safeImage('file:///C:/private.png'),'');
  assert.equal(safeImage('data:image/png;base64,AA'),'');
  assert.equal(safeImage('javascript:alert(1)'),'');
});
