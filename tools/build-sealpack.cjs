const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { zipSync, strToU8 } = require('fflate');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const pkg = path.join(root, 'sealdice/packages/daggerheart');
async function main() {
  const manifest = fs.readFileSync(path.join(pkg, 'info.toml'), 'utf8');
  const version = /^version = "([0-9]+\.[0-9]+\.[0-9]+)"$/m.exec(manifest)?.[1];
  if (!version) throw new Error('Missing package version');
  const compiled = await build({ absWorkingDir: root, entryPoints: [path.join(pkg, 'src/main.mjs')], bundle: true,
    write: false, format: 'iife', platform: 'neutral', target: 'es2020',
    metafile: true, banner: { js: `// ==UserScript==\n// @name 匕首之心\n// @author Daggerheart workspace\n// @version ${version}\n// @sealVersion 1.6.1\n// @license Apache-2.0\n// ==/UserScript==` } });
  for (const input of Object.keys(compiled.metafile.inputs)) {
    const absolute = path.resolve(root, input);
    if (!absolute.startsWith(path.join(pkg, 'src') + path.sep)) throw new Error(`Unexpected source dependency: ${input}`);
  }
  const js = compiled.outputFiles[0].text;
  new vm.Script(js, { filename: 'daggerheart.js' });
  const date = new Date('2026-01-01T00:00:00Z');
  const files = {
    'info.toml': [strToU8(manifest), { mtime: date }],
    'README.md': [fs.readFileSync(path.join(pkg, 'README.md')), { mtime: date }],
    'templates/daggerheart.yaml': [fs.readFileSync(path.join(pkg, 'templates/daggerheart.yaml')), { mtime: date }],
    'scripts/daggerheart.js': [strToU8(js), { mtime: date }],
  };
  const dist = path.join(pkg, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const output = path.join(dist, `daggerheart-${version}.sealpack`);
  fs.writeFileSync(output, zipSync(files, { level: 6 }));
  fs.writeFileSync(path.join(dist, 'daggerheart.js'), js);
  console.log(`Built ${output} (${fs.statSync(output).size} bytes)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
