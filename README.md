# Daggerheart Seal 开发工作区

按用户要求从零重写匕首之心扩展：旧业务代码只用于提取功能与需求，不迁移、不作为新构建依赖。默认正式版核心，额外玩法独立可选。PbDH通过“导出为海豹骰”提供数值与经历，编辑和升级在PbDH完成；Dice/Chat维护跑团动态资源与昵称标签。生产配置仍在旁边的 Daggerheart_VPS 仓库。

| 目录 | 用途 |
| --- | --- |
| sealdice/packages/daggerheart/ | 原生sealpack，当前0.4.7支持经历持久化/自动扣希望，保留全部受支持数值的0 |
| sealchat/ | 原生人物卡HTML：数值、经历勾选、.st/.dd操作；嵌入窗可选，待完整真实联动验收 |
| reference/ | 对应服务器版本的只读源码与版本清单 |
| docs/DAGGERHEART_REWRITE.md | 功能提取、四个优先级、实现范围与剩余验收 |
| archive/sealchat-character-sheet/ | 旧人物卡与皮肤的只读参考，供布局对照，不作为构建或发布入口 |

Node.js 22或更新的受支持LTS，在根目录：

```powershell
npm ci
npm test
npm run test:sheet
npm run build
npm run check-reference
```

产物：[daggerheart-0.4.7.sealpack](sealdice/packages/daggerheart/dist/daggerheart-0.4.7.sealpack)。核心插件已完成隔离官方SealDice1.6.1验收，不自动上传生产。无需Chat即可用.dd和原生.st；玩家希望/压力存在时独立结算，指定GM时恐惧写入GM当前卡；资源增减统一.st。人物卡用同一原生HTML，PbDH“导出为海豹骰”的同一条.st包含数值和DH经历，持久化到Dice。掷骰窗勾选经历，每项自动扣1希望，余额不足不投骰；不整卡写回、不保存图片或其他资料。无需频道嵌入窗或宿主补丁，iForm仅可选。完整未修改Chat/Dice真实联动尚未验收，边界见[人物卡方案](docs/CHARACTER_STATE.md)。援助确认不在当前计划。

旧插件、类型声明和构建工具已移除；需要查阅旧实现时从 Git 历史恢复。新工作按[重写需求](docs/DAGGERHEART_REWRITE.md)、[开发指南](docs/DEVELOPMENT.md)和[只读参考约束](reference/AGENTS.md)推进。

计划已发布到[GitHub Issues](docs/GITHUB_ISSUES.md)，阻塞依赖以GitHub原生关系为准。

豹仓安装入口：[zac/daggerheart](https://repo.sealdice.com/packages?namespace=zac&package=daggerheart)。完成当前版本隔离宿主验收后，用npm run publish:sealrepo验证并上传；令牌保存在忽略的.env.local，配置与发布流程见[开发指南](docs/DEVELOPMENT.md)。
