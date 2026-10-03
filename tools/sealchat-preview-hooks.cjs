// Test/preview only: read the fixed upstream injection code without building the host.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../reference/sealchat/ui/src/views/chat/components/character-sheet/IframeSandbox.vue'), 'utf8');
const names = ['MOBILE_PAN_STYLE_MARKER', 'MOBILE_PAN_STYLE', 'MOBILE_PAN_HOOK_MARKER', 'MOBILE_PAN_HOOK_SCRIPT', 'EDIT_HOOK_MARKER', 'EDIT_HOOK_SCRIPT', 'FONT_HOOK_MARKER', 'FONT_HOOK_SCRIPT'];
const declarations = names.map(name => {
  const match = source.match(new RegExp('const ' + name + ' = (?:\x27[^\x27]*\x27|`[\\s\\S]*?`);'));
  if (!match) throw Error('Fixed Chat hook changed: ' + name);
  return match[0];
}).join('\n');
const body = source.match(/const finalSrcDoc = computed\(\(\) => \{([\s\S]*?)\n\}\);/)?.[1];
if (!body) throw Error('Fixed Chat template injection changed');
const constants = vm.runInNewContext(declarations + '\n({' + names.join(',') + '})');
const fixture = {constants, body};
const inject = vm.compileFunction(body, ['props', 'hasTemplateFonts', ...names]);
function injectHostHooks(html, fonts = false) {
  return inject({html}, {value: fonts}, ...names.map(name => constants[name]));
}
module.exports = {fixture, injectHostHooks};
