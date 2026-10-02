# 旧开发环境审查（2026-10-02）

保留：src 下业务代码、三个独立 JS、原类型声明和研究脚本。源码未改业务逻辑，原文件移动后的内容保留；原模板说明与 memory-bank 放 archive。

修正：package.json 的模板名称/错误仓库链接、Node >=10 过时要求、README 的错误产物名与直接 node 运行宿主插件的建议；构建工具改为从脚本位置解析路径、按错误退出码失败、不递归清空输出目录，将 esbuild 更新到本次 npm 官方当前版，去掉未使用 cross-env/fs-extra/lodash 依赖；移除 TypeScript 的外部 Unity/Puerts 路径；npm 为唯一默认包管理器。

旧 ESLint 配置引用了未安装插件和过时 prettier 扩展，归档而不宣称 lint 可用。旧 memory-bank 只有部分 2025 年业务记录，其余空模板，不作为当前开发状态。原 pnpm-lock 与 dist 已归档，不作为当前发布入口；原 src/dice-logic.ts 仍保留原算法。

仍需后续验收：旧类型声明覆盖范围、三个 standalone 文件与当前源码的差异、现有 JS 在 SealDice 1.6.1 中实际加载与消息行为、是否需要改为 sealpack。现有旧 JS 同名/近似功能不能同时安装。本次不发布生产、不自动升级运行程序、不建立假完成的 SealChat 核心修改。
