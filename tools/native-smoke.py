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
    parser.add_argument('--zero-resources-only',action='store_true',help='Check native st storage, zero-value labels and resource persistence on a bound card')
    parser.add_argument('--summary-gold-only',action='store_true',help='Check st show whitelist and separate native gold quantities')
    parser.add_argument('--restart-before-enable',action='store_true',help='Verify re-enable after host restart when Windows retains cache-directory handles')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent.parent
    package_root=root/'sealdice/packages/daggerheart'
    version_line=next(line for line in (package_root/'info.toml').read_text(encoding='utf-8').splitlines() if line.startswith('version = '))
    package_version=version_line.split('\"')[1]
    package=package_root/'dist'/f'daggerheart-{package_version}.sealpack'
    package_id=next(line for line in (package_root/'info.toml').read_text(encoding='utf-8').splitlines() if line.startswith('id = ')).split(chr(34))[1]
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
  const m=seal.newMessage();m.messageType='group';m.groupId=ctx.group.groupId;m.sender.userId='UI:1003';m.sender.nickname='本地GM';
  const g=seal.createTempCtx(ctx.endPoint,m);
  if(args.args[0]==='zero') seal.vars.intSet(g,'恐惧',0);
  if(args.args[0]==='max') seal.vars.intSet(g,'恐惧',12);
  g.player.name='本地GM';
  const [value,exists]=seal.vars.intGet(g,'恐惧');
  seal.replyToSender(ctx,msg,'GM卡恐惧='+value+';存在='+exists);
  return seal.ext.newCmdExecuteResult(true);
};e.cmdMap['smokegm']=c;seal.ext.register(e);
const resources=seal.ext.newCmdItemInfo();resources.name='smokeresources';
resources.solve=(ctx,msg)=>{
  const fields=['敏捷','力量','灵巧','本能','风度','知识','生命','压力','护甲','希望','恐惧','金币把','金币袋','金币箱','生命上限','压力上限','护甲上限','希望上限','闪避','重伤阈值','严重阈值'];
  const values={};for(const field of fields) values[field]=seal.vars.intGet(ctx,field);
  seal.replyToSender(ctx,msg,'RESOURCES='+JSON.stringify(values)+';LABEL='+seal.format(ctx,'生命{生命}/{生命上限}|护甲{护甲}/{护甲上限}'));
  return seal.ext.newCmdExecuteResult(true);
};e.cmdMap['smokeresources']=resources;

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
            raise RuntimeError('Local API reported failure: '+path+'; '+json.dumps(result,ensure_ascii=False))
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
        step('/package/enable',data={'id':package_id}); step('/package/reload',data={'id':package_id})
        command('.set dh')
        if args.summary_gold_only:
            command('.pc new smoke-gold')
            command('.st 敏捷=0 生命=0 生命上限=5 护甲=0 护甲上限=4 希望=2 金币把=0 金币袋=9 金币箱=1 恐惧=7 DH角色标识="keep-recovery-role" 任意私密字段=99')
            output=command('.st show','金币：0 把 9 袋 1 箱')
            for text in ['敏捷:0','生命:0','护甲:0','金币：0 把 9 袋 1 箱']: assert text in output,output
            for text in ['DH角色标识','keep-recovery-role','任意私密字段','恐惧:7','99']: assert text not in output,output
            output=command('.st show DH角色标识')
            assert 'keep-recovery-role' not in output and 'DH角色标识' not in output,output
            command('.st show agi 把','敏捷:0')
            command('.st 把+1 袋+1 箱-1')
            command('.st list','金币：')
            command('.st show 金币把 金币箱','0 箱')
            command('.st export','keep-recovery-role')
            step('/package/reload',data={'id':package_id})
            command('.st show','金币：1 把')
            if not args.skip_restart:
                print('Waiting for native attribute persistence before restart.',flush=True)
                for _ in range(65): time.sleep(1)
                stop();start();command('.st show','金币：1 把')
            report['passed']=True;report['persistence_checked']=not args.skip_restart
            return
        if args.zero_resources_only:
            fields=['敏捷','力量','灵巧','本能','风度','知识','生命','压力','护甲','希望','恐惧','生命上限','压力上限','护甲上限','希望上限','闪避','重伤阈值','严重阈值']
            def inspect(values):
                output=command('.smokeresources')
                for field in fields:
                    expected=json.dumps(field,ensure_ascii=False)+':'+json.dumps([values.get(field,0),field in values],separators=(',',':'))
                    assert expected in output, f'Missing raw stored value: {expected}; output={output!r}'
                if '生命' in values and '护甲' in values:
                    label=f"LABEL=生命{values['生命']}/{values['生命上限']}|护甲{values['护甲']}/{values['护甲上限']}"
                    assert label in output, f'Zero value omitted from label: {output!r}'
            command('.pc new smoke-zero')
            inspect({})
            values={field:0 for field in fields}
            values.update({'生命上限':5,'压力上限':7,'护甲上限':4,'希望上限':6})
            command('.st '+' '.join(f'{field}{value}' for field,value in values.items()))
            inspect(values)
            command('.ddr 力量','[0]')
            command('.st format')
            inspect(values)
            command('.st hp+1 armor+1')
            values.update({'生命':1,'护甲':1}); inspect(values)
            command('.st hp-1 armor-1')
            values.update({'生命':0,'护甲':0}); inspect(values)
            command('.st del 生命'); command('.st del 护甲')
            del values['生命']; del values['护甲']; inspect(values)
            command('.st hp0 armor0')
            values.update({'生命':0,'护甲':0}); inspect(values)
            step('/package/reload',data={'id':package_id}); inspect(values)
            if not args.skip_restart:
                print('Waiting for the host 60s attribute persistence tick before restart.',flush=True)
                for _ in range(65): time.sleep(1)
                stop(); start(); inspect(values)
            report['passed']=True
            report['persistence_checked']=not args.skip_restart
            print('PASS bound-card zero resources, native labels, aliases, format, delete, reload and persistence.',flush=True)
            return
        command('.dd +2 dc15 -- 独立骰子','手动：')
        command('.st 敏捷3 力量1 自定义加值4')
        command('.dd 敏捷+2+1d6-4+2d6k1-3d12l1','掷骰')
        command('.r 敏捷+2+1d1-4+2d1k1-3d1kl1','=2')
        command('.ddr 敏捷+2+1d1-4+2d1k1-3d1l1','[2]')
        command('.ddr (敏捷+力量)*2','[8]')
        command('.ddr 自定义加值+1','[5]')
        command('.ddr agi+1','[4]')
        command('.st 敏捷5')
        command('.ddr 敏捷+1','[6]')
        command('.ddr 0.5','[0.5]')
        command('.ddr [1,2,3].kh(1)','[3]')
        command('.ddr [1,2,3].sum()','[6]')
        command('.ddr abs(-2)','[2]')
        command('.dd 1d6junk','算式无效')
        command('.dd 1/0','算式无效')
        command('.dd 敏捷=9','掷骰算式')
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
        command('.dh gm me','GM：')
        command('.dh gm set UI:1003','GM：')
        command('.smokegm zero','GM卡恐惧=0;存在=true')
        for _ in range(40):
            result=command('.dd 敏捷','掷骰')
            if '恐惧0→1' in result: break
        else: raise AssertionError('No Fear in 40 real rolls')
        command('.smokegm','GM卡恐惧=1;存在=true')
        command('.st show 恐惧','没有可显示')
        command('.dh gm clear','GM已卸任')
        command('.dh fear +1','用法：')
        command('.dh 希望 -1','用法：')
        command('.st 希望2')
        command('.ddr 敏捷 +2 dc15','掷骰')
        command('.st show 希望','希望:2')
        command('.dh exp','用法：')
        command('.dh init','用法：')
        command('.dh gm claim','用法：')
        command('.dd exp=1@12345678','掷骰算式')
        command('.dd pbdh=12345678-1234-1234-1234-123456789abc','掷骰算式')
        command('.dd hope=1','不使用等号')
        command('.st 希望-1')
        command('.st show 希望','希望:1')
        for suffix in ['k','q','kh','kl','h','l']:
            command('.ddr 3d1'+suffix+'1','[1]')
        command('.st 希望3')
        command('.ddr 3+2 hope2 -- 知识 · 两项经历','希望消耗2')
        command('.st show 希望','希望:1')
        command('.ddr 0 hope','希望消耗1')
        command('.st show 希望','希望:0')
        command('.ddr 0 hope2','希望不足：本次掷骰需要2点希望')
        command('.ddr 0 hope0','资源：无变化')
        payload={'source':'12345678-1234-1234-1234-123456789abc','name':'测试人物卡 - Hope "旅者"','values':{'生命':0,'生命上限':7,'压力':0,'压力上限':6,'护甲':0,'护甲上限':5,'希望':2,'希望上限':6,'金币把':1,'金币袋':0,'金币箱':1,'闪避':11,'重伤阈值':11,'严重阈值':22}}
        command('.dh pbdh '+json.dumps(payload,ensure_ascii=False,separators=(',',':')),'PbDH 已关联：测试人物卡')
        command('.st show','金币：1 把 0 袋 1 箱')
        bad={**payload,'values':{**payload['values'],'金币箱':2}}
        command('.dh pbdh '+json.dumps(bad,ensure_ascii=False,separators=(',',':')),'PbDH 金币数量越界')
        command('.st 希望6')
        for _ in range(40):
            result=command('.dd 0','掷骰')
            if '希望6/6（溢出1点）' in result: break
        else: raise AssertionError('No Hope overflow in 40 rolls')
        command('.smokegm max','GM卡恐惧=12;存在=true')
        command('.dh gm set UI:1003','GM：本地GM ｜ 恐惧12/12')
        for _ in range(40):
            result=command('.dd 0','掷骰')
            if '恐惧12/12（溢出1点）' in result: break
        else: raise AssertionError('No Fear overflow in 40 rolls')
        command('.smokegm zero','GM卡恐惧=0;存在=true')
        for _ in range(40):
            result=command('.dd 0','掷骰')
            if '恐惧0→1' in result: break
        else: raise AssertionError('No Fear gain in 40 rolls')
        command('.dh gm','GM：本地GM ｜ 恐惧1/12')
        command('.st 希望4 金币把7')
        command('.dh gm set UI:1003','GM：')
        for path in ['/package/disable','/package/reload','/package/enable','/package/reload']:
            if path == '/package/enable' and args.restart_before_enable:
                print('Restarting the isolated host before re-enable (Windows cache rename workaround).',flush=True)
                stop(); start()
                report['steps'].append('restart-before-enable')
            step(path,data={'id':package_id})
        command('.st show 希望','希望:4')
        command('.smokegm','GM卡恐惧=1;存在=true')
        if not args.skip_restart:
            print('Waiting for the host 60s attribute persistence tick before restart.',flush=True)
            for _ in range(65): time.sleep(1)
            stop(); start()
            command('.st show 希望','希望:4')
            command('.st show 金币把','金币：7 把')
            # This synthetic second user has no platform message history; restore its
            # nickname fixture only after checking the persisted GM/Fear state.
            persisted_gm=command('.dh gm','恐惧1/12')
            assert 'UI:1003' not in persisted_gm,persisted_gm
            command('.smokegm','GM卡恐惧=1;存在=true')
            command('.dh gm','GM：本地GM ｜ 恐惧1/12')
        step('/package/uninstall',data={'id':package_id,'mode':'full'})
        step('/js/reload',data={})
        assert '掷骰' not in command('.dd +2')
        report['passed']=True
        report['persistence_checked']=not args.skip_restart
        print('PASS native optional fields, real GM card, st, manual modifiers, reload, restart and uninstall.',flush=True)
    finally:
        stop(); log.close()
        (runtime/'native-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Stopped only owned test PID; report:',runtime/'native-report.json',flush=True)
if __name__=='__main__': main()
