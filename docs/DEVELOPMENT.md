# 当前开发方式

## 新匕首之心核心

开发入口 sealdice/packages/daggerheart：src/rules.mjs 是独立纯规则；src/state.mjs负责资源校验与纯结算；src/main.mjs 负责SealDice适配；info.toml负责包元信息与用户配置；templates/daggerheart.yaml为独立V2规则模板。规则参考正式版SRD2.0核心，扩展内容独立可选。

npm test 会先构建sealpack，再验证144种基础二元骰组合、难度边界、优劣势抵消、反应资源规则、参数限制、宿主模拟和ZIP文件清单。npm run build使用esbuild与fflate，运行时不依赖它们。构建显式检查所有输入来自新src，资源采用白名单，不自动打包旧文件和reference。

旧插件、类型声明及其构建和测试入口已移除。旧功能需求见DAGGERHEART_REWRITE.md，原实现从Git历史查阅；新sealpack不复用旧源码。

## 实际宿主验收与发布

本地测试不等于真实Goja/API或模板加载兼容。上线前用隔离1.6.1完成扩展包预览/安装/启用、脚本和模板重载、.set dh、.dd/.ddr、禁用/重新启用及卸载验收；停用旧同名指令。随后用户明确要求才上传指定包，不整包覆盖运行数据。

0.4.2按希望/压力字段存在与否独立结算；GM恐惧写入指定GM当前群绑定卡，只有GM身份按群保存在扩展。手动资源增减统一.st；公开.dh仅GM操作，recover为维护入口。

## SealChat

人物卡与频道工具分别按固定快照的doc/character-sheet-template-development.md、doc/channel-embed-api-developer-guide.md开发；两者不是相同协议。数据由Dice当前频道绑定卡统一保存；具体写回风险、反馈与验收要求见CHARACTER_STATE.md。无需为普通人物卡修改核心。

生产Chat在/chat/，Dice专用连接ws://127.0.0.1:3212/chat/ws/seal；生产配置仅在VPS仓库维护。测试不使用生产token、聊天数据库或真实群消息。

## 上游参考

reference默认只读，不构建、不安装依赖、不部署；npm run check-reference检查固定快照。包格式与宿主API以对应1.6.1源码核对，在线文档可能领先生产。需要改核心时另外建立development工作副本。

## 当前验收与持久化边界

30项测试覆盖二元骰、独立字段、另一个GM用户卡、权限、去重、跨卡失败恢复和旧状态升级。运行python tools/native-smoke.py --binary <官方1.6.1绝对路径>，验收安装、缺失与零值、GM当前卡、手动修正、重载、等待保存周期后重启及卸载。测试helper仅存在唯一忽略runtime，通过真实newMessage/createTempCtx读取第二用户卡，不打包、不接IM或生产。随机骰使用有界循环。

属性约60秒周期保存；意图日志不是人物属性的跨库事务，也不锁住外部.st/character.set。恢复验证原玩家和GM的卡标识与字段前后值。不同群绑定同一GM卡会共享卡上恐惧。

当前豹仓版本为zac/daggerheart@0.4.2，公开下载已核对SHA256，尚未标记verified；不等于生产部署。Chat、PbDH导入、昵称标签及完整术语库待后续。旧0.2.x升级步骤见包README，不隐式迁移旧池，未完成旧写入须先在0.2.1恢复。

## 原生表达式接口

expression.mjs仅适配ctx.eval与ctx.genDefaultRollVmConfig，复用人物属性加载钩子和原生DiceScript语法；rules只拆.dd选项，不实现算式语法。完整括号封装避免尾部被当原因；返回值toJSON区分错误t=0/v=null与数字0，避免readInt对错误对象造成Go panic。算式只执行一次，失败不投二元骰也不结算。数字小计含整数/浮点；l1仅对骰子词转换为kl1，不改属性或字符串。用户自定义属性、别名、模板默认值及缺失变量遵从原生.r。

真实宿主覆盖用户原式、确定性d1对照.r、括号、多属性、自定义字段、别名、修改.st后新值、浮点、数组取高、求和与abs函数、非法尾部及除零。

0.4.1仅调整掷骰显示：单组结果使用[N]，难度显示实际比较符号。用native-smoke.py --skip-restart复验；持久化重启沿用0.4.0验证，不宣称本次重新验收重启。

## 豹仓发布

包ID为zac/daggerheart，显示名为匕首之心；脚本与规则模板ID均为daggerheart，产物为dist/daggerheart-版本.sealpack。0.4.2仅统一包身份和文件名，掷骰规则不变。旧daggerheart-local/core先停用；包身份不同，GM指定和待恢复写入不能假定自动迁移，升级说明见包README。

本地CLI令牌放根目录.env.local的SEALREPO_TOKEN，已被Git忽略；.env.example仅含空字段。发布脚本也接受同名进程环境变量，不在命令参数中传令牌、不输出令牌、不将认证头转发到上传存储。

完成当前版本隔离宿主验收后，运行npm run publish:sealrepo：先构建并跑测试，再按info.toml申请上传、PUT包、提交版本；只操作zac/daggerheart。首次创建已选定的zac命名空间与daggerheart包。同版本存在时停止，上传或提交断线后先在豹仓查看真实状态，再重试，避免重复发布。powershell -NoProfile -NonInteractive -File tools/publish-sealrepo.ps1 -Check仅校验凭据及本地产物。

官方接口依据https://repo.sealdice.com/sealpack/页面的发布实现。豹仓发布、审核和公开可下载是不同状态；上传成功后核对状态并从公开下载校验SHA256。发布不代表生产服务器已安装。


0.4.2已完成30项测试及隔离官方1.6.1的安装、启用、掷骰、资源结算、保存周期后的重启和卸载验收。测试使用新的zac/daggerheart包ID，未连接生产或IM。
