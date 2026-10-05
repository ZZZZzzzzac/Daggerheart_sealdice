# 开发与验收

## 当前入口

业务入口是sealdice/packages/daggerheart，info.toml为包ID/版本权威。main.mjs适配官方宿主，rules.mjs生成掷骰与结算文案，state.mjs负责范围/群状态，expression.mjs使用官方DiceScript，fields.mjs负责展示，pbdh.mjs负责关联白名单。Dice经历模块已删除。

SealChat使用sealchat/pbdh-embed官方Embed/iForm入口，人物卡代码在PbDH项目。旧HTML人物卡源码、测试和build/test/preview:sheet脚本已移除。不得修改reference或其他SealChat/Dice宿主副本，也不维护源码补丁或修改版宿主。

## 本地验证

    npm test
    npm run test:pbdh-embed
    npm run check-reference

npm test构建当前sealpack并测试规则、官方接口模拟、产物、费用、去重与恢复。模拟不替代真实Goja验收，测试数量以本次输出为准。PbDH修改完成后在其工作区运行npm run verify，包含完整前端/Python测试、类型检查与构建。

产物为sealdice/packages/daggerheart/dist/daggerheart-版本.sealpack，构建白名单只含本项目脚本、模板、README与许可/商店素材。不提交依赖、产物、凭据、数据库或聊天日志。

## 官方宿主隔离验收

使用未修改的官方Windows1.6.1二进制，唯一忽略runtime，不接IM：

    python tools/native-smoke.py --binary 官方二进制绝对路径 --restart-before-enable
    python tools/native-smoke.py --binary 官方二进制绝对路径 --zero-resources-only
    python tools/native-smoke.py --binary 官方二进制绝对路径 --summary-gold-only

完整验收覆盖安装/启用/.set dh、原生与h/l取高取低、数值/特质、hope与hopeN、旧协议拒绝、中文关联、金币箱范围、三行结果、GM昵称和恐惧、溢出、包重载、保存周期后重启与卸载。辅助检查只在自有隔离runtime注册，不进入交付包。仅停止脚本启动的进程，报告保留在runtime/native-report.json。

Windows禁用/重载后再启用可能受官方缓存目录句柄影响，--restart-before-enable在重新启用前重启隔离宿主。不改核心。发布前确认passed和persistence_checked为true；--skip-restart只适合已验证持久化且本次纯文案的修改。

## iframe与数据

PbDH当前存档是完整人物数据来源。首次关联通过.dh pbdh初始化资源、金币、闪避/阈值和姓名；重连核对DH来源/DH姓名，仅回读。经历在iframe选择，数值内联并传hope/hopeN，不导入Dice。.st show/list不展示恐惧，GM用.dh gm查看。

资源结果由官方SDK回读，再通过PbDH原Runtime更新、自动本地保存和云outbox，不创建另一个账号/存档库。SDK只有读卡到发送的非原子保护；.st与扩展storage没有跨库事务，详细恢复边界见CHARACTER_STATE.md。

## 正式发布

仅在用户明确要求后发布zac/daggerheart或操作生产，npm run publish:sealrepo会先运行本地测试，再使用忽略.env.local中的SEALREPO_TOKEN上传。不读取/打印完整生产配置，不在命令参数中放token，不盲目覆盖同版本。发布不等于生产安装，生产配置仍只由相邻VPS仓库维护。
