import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {injectHostHooks} = createRequire(import.meta.url)('../../../tools/sealchat-preview-hooks.cjs');

function scripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([,attrs]) => !/type="application\/json"/.test(attrs)).map(([, ,code]) => code);
}
function checkHost(html) {
  for (const fonts of [false, true]) {
    const document = injectHostHooks(html, fonts);
    const code = scripts(document);
    assert.equal(code.length, fonts ? 4 : 3, 'app and host scripts remain separate');
    for (const script of code) assert.doesNotThrow(() => new vm.Script(script));
    assert.equal((document.match(/<\/body>/gi) || []).length, 1, 'only the real body closing tag is visible to the host');
    assert.equal(injectHostHooks(document, fonts), document, 'host injection remains idempotent');
  }
}
for (const filename of ['daggerheart.html', 'daggerheart-embed.html']) {
  test(filename + ' survives the fixed Chat host injection with LF and CRLF', () => {
    const html = fs.readFileSync(new URL('../dist/' + filename, import.meta.url), 'utf8');
    checkHost(html.replace(/\r\n/g, '\n'));
    checkHost(html.replace(/\r?\n/g, '\r\n'));
  });
}
