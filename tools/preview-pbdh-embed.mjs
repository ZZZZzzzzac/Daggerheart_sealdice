import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 测试预览只读使用固定官方 SDK，不将 SDK 复制或打包进发布物。
const [buildPath, sdkPath, portArg = '18751', playerPortArg = '18752'] = process.argv.slice(2);
if (!buildPath || !sdkPath) throw Error('Usage: npm run preview:pbdh-embed -- <PbDH apps/platform/dist> <fixed official SDK path> [hostPort] [playerPort]');
const build = path.resolve(buildPath), sdk = path.resolve(sdkPath);
const port = Number(portArg), playerPort = Number(playerPortArg);
for (const value of [port, playerPort]) if (!Number.isInteger(value) || value < 1024 || value > 65535) throw Error('Invalid preview port');
if (port === playerPort) throw Error('Use different loopback ports to validate cross-origin embedding');
const shell = await readFile(path.join(build, 'index.html'));
const sdkBytes = await readFile(sdk);
if (!sdkBytes.toString().startsWith('/* SealChat Channel Embed SDK v1.')) throw Error('Expected fixed official Channel Embed SDK');
const fixture = (await readFile(new URL('../sealchat/pbdh-embed/preview.html', import.meta.url), 'utf8'))
  .replace('__PLAYER_URL__', `http://127.0.0.1:${process.argv.includes('--same-origin') ? port : playerPort}/player/daggerheart-core`);
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.pbres': 'application/zip' };
const host = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const isSDK = pathname === '/api/v1/channel-embed-sdk.js';
  if (!isSDK && pathname !== '/') { void servePlayer(req, res); return; }
  res.writeHead(200, { 'Content-Type': (isSDK ? 'application/javascript' : 'text/html') + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(isSDK ? sdkBytes : fixture);
});
async function servePlayer(req, res) {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(build, '.' + pathname);
    if (target !== build && !target.startsWith(build + path.sep)) { res.writeHead(403); res.end(); return; }
    let bytes, ext;
    try { if (!(await stat(target)).isFile()) throw Error(); bytes = await readFile(target); ext = path.extname(target); }
    catch { if (pathname.startsWith('/api/')) { res.writeHead(503); res.end('Preview has no backend'); return; } bytes = shell; ext = '.html'; }
    res.writeHead(200, { 'Content-Type': (mime[ext] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(bytes);
  } catch { res.writeHead(500); res.end('Preview read failed'); }
}
const player = http.createServer(servePlayer);
await Promise.all([new Promise(resolve => host.listen(port, '127.0.0.1', resolve)), new Promise(resolve => player.listen(playerPort, '127.0.0.1', resolve))]);
console.log(`Protocol preview: http://127.0.0.1:${port}`);
console.log(`Standalone Player: http://127.0.0.1:${playerPort}/player`);
console.log(`SDK read-only source: ${sdk}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { host.close(); player.close(); process.exit(0); });
