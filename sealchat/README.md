# 匕首之心 SealChat 二次开发

P2从零实现PbDH角色的聊天人物卡，P3以昵称label展示玩家资源及GM恐惧。当前完成需求与接口调查，本目录尚无新实现。工作项见[GitHub Issues](../docs/GITHUB_ISSUES.md)。

- PbDH负责静态资料、特质、经历、装备与升级，通过.pbcha导入及更新；Chat只读展示和使用这些资料，不构建静态编辑器，不接旧zzz车卡器。
- Dice保存生命、压力、护甲、希望、金币等动态资源及共享GM恐惧，Chat负责操作、确认与刷新；重新导入保护跑团资源。
- 使用现有昵称label/徽章显示状态，不另建GM资源窗口或倒计时，不实现援助确认流程。
- 人物卡遵循固定版本HTML协议；现有写回与刷新限制见[同步契约](../docs/CHARACTER_STATE.md)。必要核心改动在development副本实现，reference只读。
