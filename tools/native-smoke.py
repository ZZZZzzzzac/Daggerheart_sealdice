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
    args=parser.parse_args()
    root=Path(__file__).resolve().parent.parent
    package_root=root/'sealdice/packages/daggerheart'
    package=package_root/'dist/daggerheart-core-0.2.0.sealpack'
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
        command('.dd +2 dc15 -- 独立骰子','未自动修改资源')
        command('.st 敏捷3 生命上限6 压力上限6 护甲上限2 生命0 压力2 护甲0 希望2 金币0')
        command('.dh status','可用希望 2/6')
        command('.dd 敏捷 dc15','尚未指定GM')
        command('.dh gm claim','GM已设为')
        command('.dh fear =3','3/12')
        command('.dd 敏捷 dc15','已结算')
        command('.ddr 敏捷 dc15','已结算')
        command('.dh 希望 =2','希望')
        command('.dh 金币 +5','金币计数 5')
        command('.dh fear =12','12/12')
        command('.dh fear +1','必须是0–12')
        command(".st DH经历='[{\"id\":\"e1\",\"name\":\"测试经历\",\"value\":2}]'")
        command('.dh experience','测试经历')
        command('.ddr 敏捷 exp:e1 dc15','测试经历=+2')
        command('.dh status','可用希望 1/6')
        command('.dh 希望 =0')
        command('.dd exp:e1','希望不足')
        command('.dd exp2','不接受自报')
        command('.dh 希望 =4')
        command('.dh 金币 =7')
        command('.dd junk','无法识别')
        for path in ['/package/disable','/package/reload','/package/enable','/package/reload']: step(path,data={'id':'daggerheart-local/core'})
        command('.dh status','可用希望 4/6')
        print('Waiting for the host 60s attribute persistence tick before restart.',flush=True)
        for _ in range(65): time.sleep(1)
        stop(); start()
        command('.dh status','可用希望 4/6')
        command('.dh status','金币计数 7')
        command('.dh fear','12/12')
        command('.dh experience','测试经历')
        step('/package/uninstall',data={'id':'daggerheart-local/core','mode':'full'})
        step('/js/reload',data={})
        assert '已结算' not in command('.dd +2')
        report['passed']=True
        print('PASS native install, st, resources, GM, experience, reload, persistence and uninstall.',flush=True)
    finally:
        stop(); log.close()
        (runtime/'native-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Stopped only owned test PID; report:',runtime/'native-report.json',flush=True)
if __name__=='__main__': main()
