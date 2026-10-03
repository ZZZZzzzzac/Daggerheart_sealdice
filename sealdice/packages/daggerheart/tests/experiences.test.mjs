import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeExperiences, readExperiences, experienceRevision, experienceImportCommand, experienceToken, parseExperienceToken, selectedExperiences} from '../src/experiences.mjs';
import {parseRequest} from '../src/rules.mjs';
test('bounded experience text round trips quotes, HTML, Unicode, zero and negative modifiers',()=>{
  const items=[{name:'引号 "甲" 与 O\'Brien </body> 🐈',modifier:0},{name:'负值',modifier:-1}];
  assert.deepEqual(readExperiences(encodeExperiences(items)),items);
  assert.deepEqual(readExperiences(decodeURIComponent(experienceImportCommand(items).split(' ').at(-1))),items);
  assert.ok(experienceImportCommand(items).length<4096);
  assert.notEqual(experienceRevision([{name:'🐈',modifier:2}]),experienceRevision([{name:'🐉',modifier:2}]));
});
test('invalid or oversized imports and duplicate/invalid selections are rejected',()=>{
  for(const items of [[{name:'bad\n.st 希望6',modifier:2}],[{name:'x'.repeat(61),modifier:2}],[{name:'x',modifier:'2 adv'}],[{name:'x',modifier:21}],Array.from({length:6},()=>({name:'x',modifier:2}))]) assert.throws(()=>encodeExperiences(items));
  for(const raw of ['{}','x'.repeat(4097),{},1]) assert.throws(()=>readExperiences(raw));
  for(const token of ['exp=1,1@12345678','exp=0@12345678','exp=6@12345678','exp=1@bad']) assert.throws(()=>parseExperienceToken(token));
});
test('experience flags stay outside native arithmetic and reasons, and stale values are refused',()=>{
  const items=[{name:'向导',modifier:2}];const token=experienceToken([1],experienceRevision(items));
  const parsed=parseRequest(['敏捷','+2','adv',token,'dc15','--','exp=原因']);
  assert.equal(parsed.expression,'敏捷 +2');assert.equal(parsed.reason,'exp=原因');assert.equal(parsed.advantages,1);assert.deepEqual(selectedExperiences(encodeExperiences(items),parsed.experiences),items);
  assert.throws(()=>selectedExperiences(encodeExperiences([{name:'向导',modifier:3}]),parsed.experiences),/已变化/);
  assert.throws(()=>parseRequest([token,token]),/一次/);
});
