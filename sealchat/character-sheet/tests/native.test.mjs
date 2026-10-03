import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeEvent, characterHtml} from '../src/native.mjs';
const snapshot={windowId:'sheet-window',name:'测试角色',attrs:{希望:2,希望上限:6}};

test('native roll and relative resource command use the official template dispatch contract',()=>{
  const roll=nativeEvent(snapshot,'roll',{trait:'敏捷',options:{edge:'adv',difficulty:15}});
  assert.equal(roll.action,'ROLL_DICE');assert.equal(roll.payload.roll.dispatchMode,'template');assert.equal(roll.payload.roll.template,'.dd 敏捷 adv dc15');
  const st=nativeEvent(snapshot,'st',{field:'希望',delta:-1});assert.equal(st.payload.roll.template,'.st 希望-1');assert.equal(st.windowId,'sheet-window');
  assert.equal(Object.hasOwn(st.payload,'attrs'),false);assert.equal(snapshot.attrs.希望,2);
});

test('native route rejects unsafe fields, bad arguments and missing window data',()=>{
  assert.throws(()=>nativeEvent({},'roll',{trait:'敏捷'}));
  assert.throws(()=>nativeEvent(snapshot,'roll',{trait:'敏捷',options:{reason:'a\n.st clr'}}));
  assert.throws(()=>nativeEvent(snapshot,'st',{field:'职业特性',value:2}));
});


test('universal native HTML contains no stored profile or optional embed handshake',()=>{
  const html=fs.readFileSync(new URL('../dist/daggerheart.html',import.meta.url),'utf8');
  assert.equal(html.includes('reference-profile'),false);assert.equal(html.includes('sealchat.embed.handshake'),false);
});

test('HTML builder preserves literal style/script text and escapes closing script tags',()=>{
  const markup=fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8');
  const source={markup,styles:'body:after{content:"$&"}',script:'window.example="</script> $&";'};
  const html=characterHtml(source);
  assert.equal(html.includes(source.styles),true);
  assert.equal(html.includes('window.example="<\\/script> $&"'),true);
  assert.equal(html.includes('/* STYLES */'),false);assert.equal(html.includes('/* SCRIPT */'),false);
  assert.throws(()=>characterHtml({markup:'',script:'x'}));
});
