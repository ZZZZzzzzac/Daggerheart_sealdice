# 匕首之心sealpack

- 只使用官方插件/sealpack接口；禁止修改、补丁或重编译任何SealChat/Dice宿主副本。reference只读。
- info.toml为包ID/版本权威，独立YAML模板随包打包，不能在JS重复注册。新增资源列入构建白名单。
- rules/state是纯规则，main仅适配宿主，算式使用官方ctx.eval。Goja不假设Node/浏览器API存在。
- .dd/.ddr及原生.st独立可用，无.dh init门槛。费用hope或hopeN，0–5，先支付后结算。Dice经历协议、旧金币和pbdh=参数已移除；经历在iframe合成公式或手工转成修正。
- 资源写回校验当前人物卡，先保存意图，再写玩家希望/压力与指定GM当前群人物卡恐惧，稳定消息回执去重，失败用.dh recover。不得宣称跨库事务或外部.st并发原子性。
- GM me/set/clear保持权限边界，查询用昵称和恐惧。未设难度仅显示希望/恐惧结果，饱和收益提示溢出。
- .st show/list隐藏恐惧与内部标识，金币把/袋/箱聚合展示。iframe白名单金币边界9/9/1，资源上限0–60。
- .dh pbdh通过官方rawArgs接收完整中文JSON，兼容旧URI编码，先校验资源/UUID/姓名及可选徽标字段。确认标记只用DH来源/DH姓名，更新公开玩家昵称不访问卡管理器。初始化不走掷骰的完整恢复事务；不要把UUID放原生.st开头。
- npm test和npm run build；新版本须未修改官方1.6.1隔离验收和发布前持久化验收，不自动上传/重启生产、不接IM、不代发真实聊天。
