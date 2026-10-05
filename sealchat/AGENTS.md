# 匕首之心iframe接入

- 当前人物卡采用PbDH iframe，旧自有HTML人物卡和相关构建/测试已删除；历史由Git保留，不恢复为开发入口。
- 只用官方Embed/iForm配置、Channel Embed SDK和sealpack，不修改宿主、不打补丁、不重新编译；reference固定只读。
- PbDH保存完整人物数据，Dice保存资源副本与徽标。经历内联到数值公式，费用hope/hopeN；Dice不维护经历协议。
- 接入使用context.read、characters.read、characterCard.read、messages.send，不调用整卡updateAttrs或内部API，不读取token。
- .dh pbdh初始化DH来源/DH姓名、资源与徽标；重连仅回读。发送前核对当前存档/身份，不能宣称原子绑定、严格外部并发安全或即时推送。
- 使用现有PbDH皮肤和布局，登录/导入/本地保存/云同步沿用原流程；不另建资料库或写云端按钮。
- 本地预览与测试只用合成资料，不经正式云端创建测试文档；生产部署必须用户明确要求。
