# Seal 二次开发工作目录

先读 README.md、docs/DEVELOPMENT.md 与目标项目说明。

- 本仓库维护用户自己的 SealDice 插件、SealChat 扩展/集成、研究代码和开发说明。生产配置仍在 ../Daggerheart_VPS/servers/bandwagon-192.243.116.94/，不要在两处维护相互冲突的生产配置。
- reference/sealchat、reference/sealdice-core、reference/sealdice-ui 是固定版本上游快照，**默认只读，不修改、不格式化、不安装依赖、不构建、不部署**。源码被 Git 忽略，清单 reference/manifest.json 可提交。用 npm run check-reference 验证；新版本另行核对和刷新清单，不跟随 master 自动更新。
- **硬约束：只使用 SealChat / SealDice 已提供的二次开发接口开发本项目，包括官方 HTML 人物卡、Embed/API、插件与 sealpack 接口。禁止修改两者的宿主、核心或前端源码，禁止新增或应用源码补丁、维护修改版宿主，或通过重新编译宿主来实现本项目功能。此约束同样适用于 development、runtime 及其他工作副本，不得以 reference 之外可编辑为由绕过。**
- **接口能力不足时，必须明确说明限制并调整实现方案；不得虚构宿主 API，也不得自行转为源码补丁方案。“做人物卡”“后端你设计”“就这样做”等功能授权不构成修改宿主源码的授权。子目录说明、旧方案与脚本不得放宽这条约束。**
- 可以只读核对固定上游源码以验证接口，可以开发、测试和构建本项目自有 HTML、插件、sealpack 与接口集成；本地测试与构建要求不包含修改、重编译 SealChat / SealDice 宿主。
- 当前业务入口是 sealdice/packages/daggerheart/，先读其 AGENTS.md 与 docs/DAGGERHEART_REWRITE.md；npm run build / test 只走新的 sealpack。旧插件及其工具已移除，需求已提取到重写文档；旧源码从 Git 历史查阅，不恢复为当前开发入口。
- archive 是历史说明/旧配置，不作为当前事实或发布入口。历史由 Git 保留，不追加流水账。
- 新增 API 先核对固定核心源码，不使用旧类型声明。JS 环境为 SealDice Goja，不把 Node/浏览器 API 当成宿主必有能力。
- 开发先本地测试与构建，正式上传/重启需用户明确要求；默认不操作远端生产服务、不代发群聊、不调用真实付费 AI。
- 凭据、token、聊天日志、运行数据库、.env、参考仓库依赖与构建产物不入 Git。不读取或打印完整生产配置。
- 不新建 CLAUDE.md。npm 为唯一默认包管理入口；不要恢复旧 pnpm 锁作为现役。

- 豹仓发布入口npm run publish:sealrepo，仅发布zac/daggerheart。令牌位于忽略的.env.local（SEALREPO_TOKEN），不得输出、提交或嵌入脚本；.env.example只留空值。发布须完成当前版本本地测试与隔离宿主验收，同版本不得盲目覆盖，断线先核对工作区实际状态。
