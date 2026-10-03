# 匕首之心生态 GitHub Issues

边界：旧代码仅提取需求，从零实现；默认正式版核心。PbDH负责角色编辑及升级，通过“导出为海豹骰”的同一条.st提供数值、三种金币和最多5项经历；SealDice保存跑团数据，SealChat负责操作与展示。不导入.pbcha，不实现援助确认或另建倒计时。参考快照保持只读，生产部署另需用户明确要求。

下列11张票已发布。2026-10-03此前通过gh回读：#1、#5已关闭，#7按当时要求取消关闭，其余8张仍打开；本次没有重新查询或修改远端issue。后续用户重新要求经历选择和自动扣希望，现已实现并通过插件/人物卡测试及隔离官方Dice重启验收。#5旧共享池由GM绑定卡字段替代；#2/#3/#4只使用通用原生HTML与现有接口，无宿主补丁或角色专属模板，Embed为可选。人物卡基础已获用户认可，完整Chat/Dice真实联动、昵称徽章与术语库仍待验收。#4严格外部并发与#6即时推送超出现有接口，不能按早期正文宣称完成。标题与正文保留早期记录，执行以最新用户要求和CHARACTER_STATE.md为准。

- [#1 P1：让原生 sealpack 的安装与核心掷骰验收可重复执行](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/1) — 阻塞：无
- [#2 P2：导入 PbDH .pbcha 并刷新角色静态资料](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/2) — 阻塞：#1
- [#3 P2：在 Chat 查看 PbDH 角色并点击六特质掷骰](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/3) — 阻塞：#2
- [#4 P2：在 Chat 增减动态资源并与 Dice/.st 同步](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/4) — 阻塞：#3
- [#5 P1：维护有权限边界的共享 GM 恐惧池](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/5) — 阻塞：#1
- [#6 P1：让 .dd 自动结算资源并刷新 Chat](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/6) — 阻塞：#4, #5
- [#7 P2：选择 PbDH 经历并付费用于掷骰](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/7) — 原票曾取消关闭；现已按后续要求实现勾选经历和每项1希望费用，待真实Chat联动验收
- [#8 P3：在昵称 label 显示玩家资源和 GM 恐惧点](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/8) — 阻塞：#4, #5
- [#9 P4：通过骰子命令查询匕首之心术语和核心速查](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/9) — 阻塞：#1
- [#10 P4：在 Chat 人物卡中查看统一术语与速查](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/10) — 阻塞：#3, #9
- [#11 P2：验收 PbDH 导入到 Seal 跑团的完整发布候选](https://github.com/ZZZZzzzzac/Daggerheart_sealdice/issues/11) — 阻塞：#1, #6, #7, #8
