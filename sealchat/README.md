# 匕首之心 SealChat 二次开发

默认使用 character-sheet 中的原生人物卡 HTML，保留此前 UI，已有 ROLL_DICE 模板模式发送 .dd/.ddr/.st。无需频道嵌入窗、宿主源码补丁或重编译，不走整卡 UPDATE_ATTRS。

Dice保存已有数值及小型经历列表。PbDH“导出为海豹骰”的同一条.st包含数值及最多5项经历名称/修正，写入Dice当前绑定卡。掷骰窗可勾选经历，每项自动消耗1希望，希望不足时不投骰。所有角色使用同一HTML，无需生成角色专属模板。其他PbDH资料不导入、不展示；图片不嵌入，头像使用Chat现有功能。

频道嵌入窗版是可选入口，原生安装见 character-sheet/README.md；数据与真实限制见 ../docs/CHARACTER_STATE.md。未部署生产，未完成未修改Chat/Dice真实联动验收。
