# 开发环境与历史材料边界（2026-10-02）

当前唯一 SealDice 开发入口为 sealdice/packages/daggerheart，使用原生 sealpack。根目录 npm run build / npm test 只构建和验证新包；构建依赖为 esbuild 与 fflate，Node.js 要求 >=22，npm 为默认包管理器。

旧 TypeScript 插件、三个独立 JS、旧类型声明、旧构建配置和旧测试已从工作目录移除，原实现可从 Git 历史恢复。已提取的功能需求见 DAGGERHEART_REWRITE.md，不再维护旧插件兼容性或将它们作为当前验收任务。

archive 中的旧 ESLint 配置、pnpm 锁、dist、模板说明及 memory-bank 仅为历史材料，不作为开发或发布入口。恢复的 SealChat 人物卡与车卡器皮肤用于提取需求，不沿用旧实现。

reference 中对应服务器版本的上游快照保持只读。新包当前功能、真实宿主验收和持久化边界见 DEVELOPMENT.md；SealChat 人物卡、PbDH 导入和昵称标签仍待实现。GitHub 发布不等于生产部署。
