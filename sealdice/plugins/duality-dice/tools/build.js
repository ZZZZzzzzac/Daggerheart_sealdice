const { buildSync } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dev = process.argv.includes('--dev');
try {
  const config = require('./build-config');
  const outfile = path.join(root, dev ? 'dev' : 'dist', config.filename);
  const result = buildSync({
    absWorkingDir: root, entryPoints: ['src/index.ts'], bundle: true,
    outfile, write: false, platform: 'neutral', format: 'iife',
    target: 'es2020', charset: 'utf8', minify: false,
    tsconfig: path.join(root, 'tsconfig.json'), sourcemap: dev ? 'inline' : false,
  });
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const header = fs.readFileSync(path.join(root, 'header.txt'), 'utf8');
  fs.writeFileSync(outfile, header + '\n' + result.outputFiles[0].text);
  console.log(outfile);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
