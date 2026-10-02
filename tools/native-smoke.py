"""Official SealDice 1.6.1 loopback-only smoke test; never opens IM accounts.

Usage: python tools/native-smoke.py --binary /path/to/official/sealdice-core.exe
Download the official v1.6.1 Windows amd64 release yourself; this script does not fetch code.
The unique runtime below the ignored package runtime directory is retained for diagnosis.
"""
from pathlib import Path
import argparse, subprocess, shutil, socket, time, json, urllib.request, urllib.parse, uuid

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--binary',required=True)
    parser.add_argument('--skip-restart',action='store_true',help='Skip previously verified persistence check for copy-only patches')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent.parent
    package_root=root/'sealdice/packages/daggerheart'
    version_line=next(line for line in (package_root/'info.toml').read_text(encoding='utf-8').splitlines() if line.startswith('version = '))
    package_version=version_line.split('\"')[1]
    package=package_root/'dist'/f'daggerheart-core-{package_version}.sealpack'
    runtime=package_root/'runtime'/('smoke-'+uuid.uuid4().hex)
    runtime.mkdir(parents=True)
    (runtime/'.owned-smoke-runtime').write_text('Isolated local validation only',encoding='utf-8')
    binary=Path(args.binary).resolve()
    exe=runtime/'sealdice-core.exe'
    shutil.copyfile(binary,exe)
    flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
    version=subprocess.run([str(exe),'--version'],cwd=runtime,capture_output=True,timeout=15,creationflags=flags)
    version_text=version.stdout.decode('utf-8',errors='replace')
    if version.returncode or '1.6.1' not in version_text: raise RuntimeError('Official 1.6.1 binary required')
    report={'version':version_text.strip(),'steps':[],'commands':[],'runtime':str(runtime)}
    # Only this isolated runtime contains the second-user inspection helper.
    scripts=runtime/'data/default/scripts'; scripts.mkdir(parents=True,exist_ok=True)
    (scripts/'native-smoke-helper.js').write_text("""// ==UserScript==
// @name native-smoke-helper
// @author local-test
// @version 1.0.0
// ==/UserScript==
const e=seal.ext.new('native-smoke-helper','local-test','1.0.0');
const c=seal.ext.newCmdItemInfo();c.name='smokegm';
c.solve=(ctx,msg,args)=>{
  const m=seal.newMessage();m.messageType='group';m.groupId=ctx.group.groupId;m.sender.userId='UI:1003';
  const g=seal.createTempCtx(ctx.endPoint,m);
  if(args.args[0]==='zero') seal.vars.intSet(g,'恐惧',0);
  const [value,exists]=seal.vars.intGet(g,'恐惧');
  seal.replyToSender(ctx,msg,'GM卡恐惧='+value+';存在='+exists);
  return seal.ext.newCmdExecuteResult(true);
};e.cmdMap['smokegm']=c;seal.ext.register(e);
""",encoding='utf-8')
    log=(runtime/'stdout.local.log').open('ab')
    process=None; token=''; url=''
    def call(path,data=None,raw=None,form=None):
        headers={'token':token}
        if raw is not None: body=raw; headers['Content-Type']='application/octet-stream'
        elif form is not None: body=urllib.parse.urlencode(form).encode(); headers['Content-Type']='application/x-www-form-urlencoded'
        elif data is not None: body=json.dumps(data).encode(); headers['Content-Type']='application/json'
        else: body=None
        with urllib.request.urlopen(urllib.request.Request(url+path,data=body,headers=headers),timeout=20) as res:
            raw_data=res.read(); result=json.loads(raw_data) if raw_data else None
        if isinstance(result,dict) and (result.get('result') is False or result.get('data',{}).get('success') is False):
            raise RuntimeError('Local API reported failure: '+path)
        return result
    def start():
        nonlocal process,token,url
        with socket.socket() as sock: sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        url=f'http://127.0.0.1:{port}/sd-api'
        process=subprocess.Popen([str(exe),'--hide-ui','--multi-instance','--container-mode','--address',f'127.0.0.1:{port}'],cwd=runtime,stdout=log,stderr=subprocess.STDOUT,creationflags=flags)
        token=''
        for _ in range(60):
            if process.poll() is not None: raise RuntimeError('Local process exited; see retained runtime log')
            try: token=call('/signin',data={'password':''})['token']; break
            except (OSError,KeyError): time.sleep(.5)
        else: raise RuntimeError('Local API startup timeout')
        print('Loopback-only official 1.6.1 ready; no IM accounts.',flush=True)
    def stop():
        if process and process.poll() is None: process.terminate(); process.wait(timeout=10)
    def step(path,**kwargs):
        call(path,**kwargs); report['steps'].append(path); print('PASS',path,flush=True)
    def command(text,expected=None):
        call('/dice/recentMessage')
        call('/dice/exec',form={'message':text,'messageType':'group','messageSplitLen':0})
        time.sleep(.7)
        replies=call('/dice/recentMessage')
        output='\n'.join(item.get('message','') for item in replies or [])
        report['commands'].append({'command':text,'reply':output})
        if expected and expected not in output: raise AssertionError(f'{text}: expected {expected!r}, got {output!r}')
        print('PASS',text,output[:220].replace('\n',' | '),flush=True)
        return output
    try:
        start()
        data=package.read_bytes()
        step('/package/preview-upload',raw=data); step('/package/install-upload',raw=data)
        step('/package/enable',data={'id':'daggerheart-local/core'}); step('/package/reload',data={'id':'daggerheart-local/core'})
        command('.set dh')
        command('.dd +2 dc15 -- 独立骰子','手动：')
        command('.st 希望0 压力2 敏捷3')
        for _ in range(100):
            result=command('.dd 敏捷 dc15','掷骰')
            if '关键成功' in result:
                assert '压力2→1' in result
                assert '希望' in result and '→' in result
                assert '手动：希望' not in result
                break
        else: raise AssertionError('No critical in 100 real rolls')
        command('.st show 压力','压力:1')
        command('.st del 压力')
        command('.st 希望2')
        reaction=command('.ddr 敏捷 dc15','掷骰')
        assert '压力' not in reaction and '→' not in reaction
        command('.st show 希望','希望:2')
        command('.dh gm set UI:1003','GM：UI:1003')
        command('.smokegm zero','GM卡恐惧=0;存在=true')
        for _ in range(40):
            result=command('.dd 敏捷','掷骰')
            if '恐惧0→1' in result: break
        else: raise AssertionError('No Fear in 40 real rolls')
        command('.smokegm','GM卡恐惧=1;存在=true')
        command('.st show 恐惧')
        command('.dh gm clear','GM已卸任')
        command('.dh fear +1','用法：')
        command('.dh 希望 -1','用法：')
        command('.st 希望2')
        command(".st DH经历='[{\"id\":\"e1\",\"name\":\"测试经历\",\"value\":2}]'")
        command('.ddr 敏捷 exp:e1 dc15','希望2→1')
        command('.st 希望0')
        command('.dd exp:e1','希望不足')
        command('.dd exp2','经历格式')
        command('.st 希望4 金币7')
        command('.dh gm set UI:1003','GM：UI:1003')
        for path in ['/package/disable','/package/reload','/package/enable','/package/reload']: step(path,data={'id':'daggerheart-local/core'})
        command('.st show 希望','希望:4')
        command('.smokegm','GM卡恐惧=1;存在=true')
        if not args.skip_restart:
            print('Waiting for the host 60s attribute persistence tick before restart.',flush=True)
            for _ in range(65): time.sleep(1)
            stop(); start()
            command('.st show 希望','希望:4')
            command('.st show 金币','金币:7')
            command('.dh gm','GM：UI:1003')
            command('.smokegm','GM卡恐惧=1;存在=true')
        step('/package/uninstall',data={'id':'daggerheart-local/core','mode':'full'})
        step('/js/reload',data={})
        assert '掷骰' not in command('.dd +2')
        report['passed']=True
        report['persistence_checked']=not args.skip_restart
        print('PASS native optional fields, real GM card, st, experiences, reload, restart and uninstall.',flush=True)
    finally:
        stop(); log.close()
        (runtime/'native-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Stopped only owned test PID; report:',runtime/'native-report.json',flush=True)
if __name__=='__main__': main()
