# 匕首之心人物卡与资源同步契约

2026-10-02 核对基线：SealDice 1.6.1 与 SealChat 20260921-7a7b5bb。Dice侧0.3.1已实现资源与结算；本文件中的Chat人物卡、PbDH导入和联动同步仍为后续方向，未修改生产。

## 数据由谁保存

**SealDice 当前频道绑定的人物卡属性是唯一权威状态。** `.st`、插件读写属性与 Chat 的 character.get/set 最终使用 Dice 的 AttrsManager；不是两套需要互相复制的资源数据库。Chat 人物卡是展示与操作入口，窗口缓存和浏览器存储不能成为生命、压力、护甲、希望的第二份权威状态。PbDH负责静态角色资料、属性、经历、装备及升级，通过版本化.pbcha导入；Dice保存跑团中的动态资源。重新导入静态变化不能覆盖现役生命、压力、护甲、希望、金币或GM恐惧。旧zzz车卡器不再作为集成目标。未接入Chat/PbDH前，用户直接用.dd与原生.st维护属性和资源；接入后卡片按钮操作同一份数据，不改变权威归属。

核对路径：reference/sealdice-core/dice/platform_adapter_sealchat_character.go 的 resolveSealChatCharacterTarget、handleCharacterGet、setSealChatCharacterAttrs；reference/sealchat/ui/src/stores/characterCard.ts 的 getActiveCard、updateCardStrict。

## 从恢复文件提取的功能

- 六特质点击检定，行动/反应模式，修正与优劣势选项。
- 生命、压力、护甲、希望的显示与增减；人物资料、头像、职业/种族/社群、经历、武器/护甲、金币、卡牌和笔记。
- 从车卡器导出 JSON 建卡，卡牌图片和资源徽章。
- 嵌入窗口使用 SEALCHAT_UPDATE 接收状态，SEALCHAT_EVENT 的 ROLL_DICE / UPDATE_ATTRS 发出操作。车卡器单独预览才使用 localStorage；不能据此断言旧在线卡把资源存在浏览器。

恢复文件在 archive/sealchat-character-sheet，保持原样。这里只提取需求，不复用实现；新模板不兼容旧字段作为隐式默认；旧zzz导出不列入集成计划。新导入仅面向PbDH的.pbcha及对应版本化Contract/System Package。

## 已定位的同步风险

1. 车卡器皮肤使用 AgilityTextbox / HpCurrent / StressCurrent 等字段；旧在线模板会转换为敏捷 / 生命 / 压力等中文字段并补写派生值。两个映射不能当作同一份当前模型。
2. 旧在线卡在 onUpdate 中合并缓存、补默认值并主动 updateAttrs；打开卡片也可能产生写操作。缺失上限常被补成6，护甲缺失值有时由上限代替，不能沿用这种资源含义。
3. 当前 Chat 的 CharacterSheetWindow 将局部 UPDATE_ATTRS 合入窗口 attrs，characterSheet.ts 的 scheduleAttrsSync 最终将完整 attrs 发给 character.set。Dice 接口支持逐键写入，但这一前端路径没有保持局部 patch。旧缓存可能覆盖刚刚投骰更新的希望或压力；这是源码推断的竞态风险，未复现为某一次历史故障。
4. chat.vue 的人物卡自动刷新识别 st/sc 等命令，当前列表不包含 dd/ddr。不能假定自定义骰子结算后卡片立即更新。
5. 旧模板将优劣势拼为 +/-1d6 数字修正；新插件有原生 adv/dis 语义，不能照搬旧字符串。修正统一发送普通数字，费用由玩家手动.st扣除。

## 新的读写流程

- 打开卡片只读最新绑定角色；不自动补字段或写回。未初始化数据明确提示，不猜测上限或余额。
- 六特质按钮发送特质名称，由 Dice 读取最新值；不能将旧缓存中的特质数字冒充最新角色值。
- 资源增减发送操作意图，Dice 按最新余额校验并结算；不由浏览器根据旧值计算绝对值后覆盖整张卡。
- 普通数字修正不触发费用扣除，玩家用.st手动管理希望；不实现经历ID、字段解析或自动扣费。
- 希望是可用点数；生命/压力/护甲是已标记槽，分别保存上限；GM 恐惧保存在当前频道指定GM的绑定人物卡，原生.st管理，GM身份按群保存。上限来源明确，不将生命一律默认6。
- 每次操作绑定频道、玩家与角色身份，返回确认结果和最新状态；切卡、重复提交、超时不得静默重放或扣另一张卡。
- 资源写入路径必须有受支持的刷新反馈。纯模板现有接口不足以承诺完整事务与确认机制：先在隔离环境验证自定义指令/回读；若需要修改 Chat，使用 development/sealchat 工作副本，reference 保持只读。不得靠发送假 .st 消息触发刷新。
- 人物资料、特质、经历、装备及升级在PbDH编辑；Chat只读使用，.pbcha重导入先预览静态差异并保护动态资源。上限下降等冲突须显式处理，不能静默截断。
- 金币也是动态资源，单位和换算按PbDH目标系统契约确定。玩家生命/压力/护甲/希望/金币显示在昵称label；GM显示当前绑定卡上的恐惧。优先复用现有徽章与倒计时能力，不新增GM资源工具窗或倒计时，也不实现援助确认流程。

## 下一阶段验收

在隔离 Chat + Dice 中检查：按钮与 .st 修改的是同一张绑定卡；两窗口并发增减；.dd 后希望/压力刷新；切卡期间操作；断线和重复点击；其他玩家不能被扣费。未通过这些检查前不称自动同步完成。

Dice侧0.3.1的写回采用可恢复意图日志，非跨库事务；核心属性有周期保存，外部.st/character.set并发不受插件锁保护。不能把Dice单独验收视作本文件的Chat并发验收。
