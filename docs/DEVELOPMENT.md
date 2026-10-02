# 当前开发方式

## 新匕首之心核心

开发入口 sealdice/packages/daggerheart：src/rules.mjs 是独立纯规则；src/state.mjs负责资源校验与纯结算；src/main.mjs 负责SealDice适配；info.toml负责包元信息与用户配置；templates/daggerheart.yaml为独立V2规则模板。规则参考正式版SRD2.0核心，扩展内容独立可选。

npm test 会先构建sealpack，再验证144种基础二元骰组合、难度边界、优劣势抵消、反应资源规则、参数限制、宿主模拟和ZIP文件清单。npm run build使用esbuild与fflate，运行时不依赖它们。构建显式检查所有输入来自新src，资源采用白名单，不自动打包旧文件和reference。

旧TS和standalone不迁移、不复用源码；旧类型声明也不引入新项目。保留build:legacy/test:legacy只供历史调查。

## 实际宿主验收与发布

本地测试不等于真实Goja/API或模板加载兼容。上线前用隔离1.6.1完成扩展包预览/安装/启用、脚本和模板重载、.set dh、.dd/.ddr、禁用/重新启用及卸载验收；停用旧同名指令。随后用户明确要求才上传指定包，不整包覆盖运行数据。

0.2.0新增Dice侧动态资源、GM恐惧池及可恢复结算；无需.dh init，原生.st与.dd直接可用。资源/静态上限不足或无GM时保持正常投骰，提示手动结算。角色数据与.st共用，不因未来Chat接入另建资源数据库。具体剩余需求见DAGGERHEART_REWRITE.md。不得把尚未实现的P2/P3/P4描述为完成。

## SealChat

人物卡与频道工具分别按固定快照的doc/character-sheet-template-development.md、doc/channel-embed-api-developer-guide.md开发；两者不是相同协议。数据由Dice当前频道绑定卡统一保存；具体写回风险、反馈与验收要求见CHARACTER_STATE.md。无需为普通人物卡修改核心。

生产Chat在/chat/，Dice专用连接ws://127.0.0.1:3212/chat/ws/seal；生产配置仅在VPS仓库维护。测试不使用生产token、聊天数据库或真实群消息。

## 上游参考

reference默认只读，不构建、不安装依赖、不部署；npm run check-reference检查固定快照。包格式与宿主API以对应1.6.1源码核对，在线文档可能领先生产。需要改核心时另外建立development工作副本。

## 0.2.0验收入口与持久化边界

npm test有23项行为测试，包含两套144种二元骰组合的规则和结算检查、权限、余额、重复消息、失败注入和恢复冲突。使用官方Windows amd64 1.6.1二进制执行 `python tools/native-smoke.py --binary <绝对路径>`，runtime为包内唯一忽略目录，绑定随机127.0.0.1端口，不配置IM账号；报告与日志留在该目录，不发布。

验收覆盖真实安装/启用、.set dh、独立.dd、原生.st默认值省略兼容、资源与GM池、经历字段读取/费用不足、重载、等待宿主属性保存周期后的重启和卸载。适配器无rawId时不能保证重复消息去重；属性约60秒周期落盘，突然杀进程可丢失未保存数据。扩展意图日志与属性不构成跨库事务；.st/character.set的外部并发仍需后续同步设计。

发布目标为GitHub Release tag `sealpack-v0.2.0`，产物包含.sealpack、SHA256SUMS.txt与完整源代码提交。GitHub发布不等于服务器部署，也不等于上架官方扩展商店；Chat人物卡、昵称标签、.pbcha导入和完整术语库继续保留未完成Issue。
