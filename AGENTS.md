# Seal 二次开发工作目录

先读 README.md、docs/DEVELOPMENT.md 与目标项目说明。

- 本仓库维护用户自己的 SealDice 插件、SealChat 扩展/集成、研究代码和开发说明。生产配置仍在 ../Daggerheart_VPS/servers/bandwagon-192.243.116.94/，不要在两处维护相互冲突的生产配置。
- reference/sealchat、reference/sealdice-core、reference/sealdice-ui 是固定版本上游快照，**默认只读，不修改、不格式化、不安装依赖、不构建、不部署**。源码被 Git 忽略，清单 reference/manifest.json 可提交。用 npm run check-reference 验证；新版本另行核对和刷新清单，不跟随 master 自动更新。
- 用户要求改核心/前端时，在 development/sealchat 或 development/sealdice 建立可编辑工作副本并维护补丁/独立版本；不得直接把 reference 当开发副本。
- 当前业务入口是 sealdice/packages/daggerheart/，先读其 AGENTS.md 与 docs/DAGGERHEART_REWRITE.md；npm run build / test 只走新的 sealpack。旧 TS 和 standalone 原样保留作需求参考，不迁移、不导入、不复制旧实现；不可与新同名指令同时加载。
- archive 是历史说明/旧配置，不作为当前事实或发布入口。历史由 Git 保留，不追加流水账。
- 旧 types/seal.d.ts 只供历史调查，不引入新代码；新增 API 先核对固定核心源码。JS 环境为 SealDice Goja，不把 Node/浏览器 API 当成宿主必有能力。
- 开发先本地测试与构建，正式上传/重启需用户明确要求；默认不操作远端生产服务、不代发群聊、不调用真实付费 AI。
- 凭据、token、聊天日志、运行数据库、.env、参考仓库依赖与构建产物不入 Git。不读取或打印完整生产配置。
- 不新建 CLAUDE.md。npm 为唯一默认包管理入口；不要恢复旧 pnpm 锁作为现役。
