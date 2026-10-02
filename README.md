# Daggerheart Seal 开发工作区

按用户要求从零重写匕首之心扩展：旧业务代码只用于提取功能与需求，不迁移、不作为新构建依赖。默认正式版核心，额外玩法独立可选。PbDH通过.pbcha提供角色静态资料，静态编辑和升级在PbDH完成；Dice/Chat维护跑团动态资源与昵称标签。生产配置仍在旁边的 Daggerheart_VPS 仓库。

| 目录 | 用途 |
| --- | --- |
| sealdice/packages/daggerheart/ | 全新的原生 sealpack，当前0.4.1支持.dd/.ddr、.st资源及GM人物卡恐惧 |
| sealchat/ | 人物卡与互动工具开发入口，尚未重写 |
| reference/ | 对应服务器版本的只读源码与版本清单 |
| docs/DAGGERHEART_REWRITE.md | 功能提取、四个优先级、实现范围与剩余验收 |
| archive/ | 旧开发环境文档和产物，不作为开发入口 |

Node.js 22或更新的受支持LTS，在根目录：

```powershell
npm ci
npm test
npm run build
npm run check-reference
```

产物：[daggerheart-core-0.4.1.sealpack](sealdice/packages/daggerheart/dist/daggerheart-core-0.4.1.sealpack)。测试涵盖规则、宿主模拟与ZIP结构，已完成隔离官方SealDice1.6.1加载验收，SealChat联动尚未实现；不自动上传生产。无需Chat即可用.dd和原生.st；玩家希望/压力存在时独立结算，指定GM时恐惧写入GM当前卡；资源增减统一.st。Chat人物卡尚未接入；援助确认不在当前计划。

旧插件、类型声明和构建工具已移除；需要查阅旧实现时从 Git 历史恢复。新工作按[重写需求](docs/DAGGERHEART_REWRITE.md)、[开发指南](docs/DEVELOPMENT.md)和[只读参考约束](reference/AGENTS.md)推进。

计划已发布到[GitHub Issues](docs/GITHUB_ISSUES.md)，阻塞依赖以GitHub原生关系为准。
