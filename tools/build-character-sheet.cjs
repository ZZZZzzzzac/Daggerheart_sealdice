const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..', 'sealchat/character-sheet');

async function main() {
  if(process.argv.length>2) throw Error("人物卡不接收存档；请使用 PbDH 的导出为海豹骰功能");
  const {characterHtml}=await import('../sealchat/character-sheet/src/native.mjs');
  const template=fs.readFileSync(path.join(root,'src/sheet.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'src/sheet.css'),'utf8');
  fs.mkdirSync(path.join(root,'dist'),{recursive:true});
  function build(embed, filename) {
    const result=esbuild.buildSync({entryPoints:[path.join(root,'src/sheet.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2020',write:false,define:{__SEALCHAT_EMBED_ENABLED__:String(embed)}});
    const html=characterHtml({markup:template,styles:css,script:result.outputFiles[0].text});
    fs.writeFileSync(path.join(root,'dist',filename),html);
  }
  build(false,'daggerheart.html');
  build(true,'daggerheart-embed.html');
  esbuild.buildSync({entryPoints:[path.join(root,'preview/mock-sdk.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2020',outfile:path.join(root,'dist/mock-sdk.js')});
  console.log('Built native daggerheart.html and optional daggerheart-embed.html');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
