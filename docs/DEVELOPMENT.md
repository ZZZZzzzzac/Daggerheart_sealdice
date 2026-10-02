# 当前开发方式

## 新匕首之心核心

开发入口 sealdice/packages/daggerheart：src/rules.mjs 是独立纯规则；src/state.mjs负责资源校验与纯结算；src/main.mjs 负责SealDice适配；info.toml负责包元信息与用户配置；templates/daggerheart.yaml为独立V2规则模板。规则参考正式版SRD2.0核心，扩展内容独立可选。

npm test 会先构建sealpack，再验证144种基础二元骰组合、难度边界、优劣势抵消、反应资源规则、参数限制、宿主模拟和ZIP文件清单。npm run build使用esbuild与fflate，运行时不依赖它们。构建显式检查所有输入来自新src，资源采用白名单，不自动打包旧文件和reference。

旧TS和standalone不迁移、不复用源码；旧类型声明也不引入新项目。保留build:legacy/test:legacy只供历史调查。

## 实际宿主验收与发布

本地测试不等于真实Goja/API或模板加载兼容。上线前用隔离1.6.1完成扩展包预览/安装/启用、脚本和模板重载、.set dh、.dd/.ddr、禁用/重新启用及卸载验收；停用旧同名指令。随后用户明确要求才上传指定包，不整包覆盖运行数据。

0.3.1按希望/压力字段存在与否独立结算；GM恐惧写入指定GM当前群绑定卡，只有GM身份按群保存在扩展。手动资源增减统一.st；公开.dh仅GM操作，recover为维护入口。

## SealChat

人物卡与频道工具分别按固定快照的doc/character-sheet-template-development.md、doc/channel-embed-api-developer-guide.md开发；两者不是相同协议。数据由Dice当前频道绑定卡统一保存；具体写回风险、反馈与验收要求见CHARACTER_STATE.md。无需为普通人物卡修改核心。

生产Chat在/chat/，Dice专用连接ws://127.0.0.1:3212/chat/ws/seal；生产配置仅在VPS仓库维护。测试不使用生产token、聊天数据库或真实群消息。

## 上游参考

reference默认只读，不构建、不安装依赖、不部署；npm run check-reference检查固定快照。包格式与宿主API以对应1.6.1源码核对，在线文档可能领先生产。需要改核心时另外建立development工作副本。

## 0.3.1验收与持久化边界

27项测试覆盖二元骰、独立字段、另一个GM用户卡、权限、去重、跨卡失败恢复和旧状态升级。运行python tools/native-smoke.py --binary <官方1.6.1绝对路径>，验收安装、缺失与零值、GM当前卡、手动修正、重载、等待保存周期后重启及卸载。测试helper仅存在唯一忽略runtime，通过真实newMessage/createTempCtx读取第二用户卡，不打包、不接IM或生产。随机骰使用有界循环。

属性约60秒周期保存；意图日志不是人物属性的跨库事务，也不锁住外部.st/character.set。恢复验证原玩家和GM的卡标识与字段前后值。不同群绑定同一GM卡会共享卡上恐惧。

发布目标sealpack-v0.3.1，包及SHA256SUMS与源码提交；不等于生产部署。Chat、PbDH导入、昵称标签及完整术语库待后续。旧0.2.x升级步骤见包README，不隐式迁移旧池，未完成旧写入须先在0.2.1恢复。
