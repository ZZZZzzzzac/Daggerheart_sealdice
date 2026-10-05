# PbDH iframe接入

正式功能：Seal master、PbDH main，sealpack0.5.0。采用官方未修改Chat/Dice，通过Channel Embed SDK接入。旧HTML人物卡与Dice经历协议已删除；规则YAML继续用于.set dh、属性别名及.st。

## 数据与保存

PbDH当前Character Save保存属性、经历、武器、职业、资源与闪避/阈值。iframe是完整Platform Shell，账号、各种格式导入、本地/云端存档与市场沿用普通网页流程。Dice保存资源副本、徽标及DH来源/DH姓名确认标记，其他基础数据不写Dice。

首次明确点击“关联”通过.dh pbdh中文JSON初始化四项资源/上限、金币把/袋/箱、闪避、重伤阈值、严重阈值和当前玩家昵称。JSON仅转义<、>、&以免被聊天解释，官方rawArgs保留姓名空格/引号/百分号/--。先完整校验再写，回读来源/姓名/所有字段确认后关联；消息回执不是执行成功。

资源按变化字段.st同步，按钮用相对增减；徽标字段单向以PbDH为准。Dice确认结果通过Runtime.updateModuleValue更新，再沿用250ms本地保存与现有云outbox，等待期间较新的本地修改保留，不另设写云端按钮。金币边界9把/9袋/1箱，不自动换算；零与未知分开处理。

关闭重开或断线后用“重连”，核对DH来源/DH姓名及权限，只读取Dice当前资源，不发.dh pbdh。标记不匹配不自动初始化。旧DHPbDH标记升级后需关联一次；改存档也须重新关联。iframe先等账号恢复再恢复所选人物缓存。

## 掷骰

六特质和主副武器用独立🎲按钮，原属性点击继续编辑，保留系统包皮肤/布局。经历留在PbDH，助手生成数值公式，例如.dd 3+2 hope -- 知识 · 世界旅行者；hope/hope1花费1，hope2花费2，0–5。费用与资源收益由sealpack一次结算，复用去重与.dh recover。

不发送pbdh=或exp=。桥接发送前通过官方SDK读卡核对DH来源，但读卡到发送不是原子操作。海豹骰导出仅数字快照；其他平台经历手动转成修正与hope费用。

武器助手保留熟练值、伤害骰大小、固定调整值三输入，从d/D开始扫描伤害条目，不依赖分隔符；公式如.r 3d6+3 改良巨杖。名字识别失败回退主/副武器，DamageAdjustment接口保留，不自然语言推断特性。发送前核对武器/熟练值快照。

## 本地与上线

本地官方Chat18760、Dice18761、PbDH18762。PbDH代理指向正式账号API，使用真实Supabase；不得经此端口创建合成云资料。隔离SDK预览另用合成数据，仅记录命令。

同源Market/Player导航保留sealchat、hostOrigin、sdkUrl，不传给外站，不沿用旧交接查询。“与海豹聊天连接”在玩家功能菜单最末，恢复工具条并尝试重连，不初始化。

官方Embed需context.read、characters.read、characterCard.read、messages.send，URL为PbDH/player并带sealchat=1、hostOrigin及同源官方sdkUrl。使用直接iframe和840×790默认窗口，约A4宽触发窄屏，手动宽度由外层宿主窗口控制。

部署需升级同一个sealpack、部署PbDH前端并配置正确allowedOrigins/SDK权限，停用旧HTML显示配置，保留Dice规则模板。不需要新增账号或数据库schema。正式域名响应头、登录、云存档及跨页面连接还须上线验收。

未关联时页面仍按PbDH普通方式保存。纯本地人物沿用原“同步到云”入口启用一次，云修订冲突用原解决界面。关闭iframe停止10秒资源回读；跨平台/账号的人物卡不自动共享资源。完整去重/恢复边界见../../docs/CHARACTER_STATE.md。

## 正式部署与频道安装

1. Dice安装/更新豹仓zac/daggerheart 0.5.0，启用扩展。频道连接Dice Bot并选择匕首之心规则（.set dh）。
2. 部署包含此接入的PbDH前端。本站由PbDH GitHub Release构建并部署到https://daggerheart.cn/pbdh/；不需要新数据库、独立后端或Chat/Dice二进制。
3. 在SealChat频道新建嵌入窗/iForm，粘贴下面的HTML。使用能启用Embed API的频道嵌入窗；旧HTML人物卡模板停用。
4. 开启Embed API，allowedOrigins填写https://daggerheart.cn，授予context.read、characters.read、characterCard.read、messages.send。设置默认宽840、高790、浮动窗口。宿主自动追加hostOrigin及包含/chat前缀的sdkUrl，不手工固定到某个聊天实例。
5. 玩家打开嵌入窗，登录自己的PbDH账号，选择人物存档，点击关联；之后关闭重开可重连。每个玩家仍读取和操作自己的Dice活动人物卡。

```html
<iframe src="https://daggerheart.cn/pbdh/player/daggerheart-core?sealchat=1" title="PbDH 匕首之心人物卡" width="840" height="760" sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups" referrerpolicy="no-referrer" style="position:absolute;inset:0;display:block;width:100%;height:100%;border:0"></iframe>
```

正式发布文件已随源码提交到GitHub，可直接下载[iframe.html](dist/iframe.html)、[bridge-policy.json](dist/bridge-policy.json)和[presentation.json](dist/presentation.json)。iframe.html粘贴到频道嵌入窗；两个JSON用于对照Embed API权限和默认窗口设置，无须上传到服务器。

从项目根目录运行npm run build:pbdh-embed可重新生成这三个文件。修改生成器后应重新构建并一起提交默认正式域名的产物。其他PbDH站点可把Player URL作为参数传入构建命令，并使用对应origin；自定义域名的输出不要覆盖已提交的正式版本。

本站的Chat位于/chat/，官方SDK为/chat/api/v1/channel-embed-sdk.js。与PbDH同源，当前Nginx路由即可提供iframe及SDK，无须新增反代或放宽跨站策略。其他站点部署需检查frame-ancestors/X-Frame-Options与HTTPS；只允许实际使用的工具origin。

用户应尽量从与平时PbDH相同的域名打开iframe，便于沿用浏览器本地存档和账号会话。daggerheart.cn与pbdh.top虽然服务器相同，浏览器本地存储仍不同；云存档通过原账号同步。
