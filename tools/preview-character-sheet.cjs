const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const {fixture:hostHooks}=require('./sealchat-preview-hooks.cjs');
const routes = {
  '/': ['sealchat/character-sheet/preview/index.html','text/html'],
  '/fixture.mjs': ['sealchat/character-sheet/preview/fixture.mjs','text/javascript'],
  '/daggerheart.html': ['sealchat/character-sheet/dist/daggerheart.html','text/html'],
  '/daggerheart-embed.html': ['sealchat/character-sheet/dist/daggerheart-embed.html','text/html'],
  '/mock-sdk.js': ['sealchat/character-sheet/dist/mock-sdk.js','text/javascript'],
  '/host-hooks.json': [null,'application/json'],
  '/old-reference.html': ['archive/sealchat-character-sheet/git-snapshot/sealchat匕首之心人物卡模板_sealchat模板.html','text/html'],
};
const server = http.createServer((req,res) => {
  const route = routes[req.url?.split('?')[0]];
  if (req.method !== 'GET' || !route) { res.writeHead(404);res.end('Not found');return; }
  res.writeHead(200,{'Content-Type':route[1]+'; charset=utf-8','Cache-Control':'no-store'});
  res.end(route[0] ? fs.readFileSync(path.join(root,route[0])) : JSON.stringify(hostHooks));
});
server.listen(4178,'127.0.0.1',() => console.log('Local protocol preview: http://127.0.0.1:4178'));
