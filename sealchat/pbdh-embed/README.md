# PbDH 外部 iForm 实验

独立路线：Seal/sealpack 工作树 codex/pbdh-iframe-sync；PbDH 工作树 codex/sealchat-iframe-sync。本地实验 sealpack 为0.4.9；已发布0.4.7和 PbDH main 均不修改、不发布。SealChat/Dice 使用未修改的官方二进制，不补丁、不重新编译宿主。

## 数据职责

PbDH 当前 Character Save 保存属性、经历、武器、职业、闪避、阈值及资源。iframe 是完整 Platform Shell，登录、格式导入、本地存档和云端存档都复用正常流程。Dice 保留联动资源副本、DHPbDH来源 存档 UUID 和 DHPbDH姓名 昵称确认标记；基础属性、经历不再覆盖页面或写入 Dice。

明确点击“关联并使用 PbDH 资源”时，通过实验 .dh pbdh 接收 URI 编码的结构化数据，将当前存档的生命、压力、护甲槽、希望、金币以及资源上限初始化到 Dice，人物昵称采用 PbDH character-name 字段。空白姓名回退为未命名角色；姓名保留空格、连字符和引号。sealpack 先检查完整字段、UUID、姓名及资源范围，再使用官方插件变量和上下文字段写入，避免 .st 开头 UUID 被识别为人物名并拆成运算。昵称更新遵循官方玩家保存标记；不操作人物卡管理器或改写绑卡元数据。消息回执不代表执行；回读来源 UUID、姓名标记和相应资源字段确认后才进入已关联状态。按钮仍发相对 .st；PbDH 原生编辑或依赖计算引起的资源修改只发送变化字段，并保留同时到达的其他 Dice 资源变化。

Dice 结算或聊天资源命令的确认结果通过 Runtime.updateModuleValue 更新当前人物。沿用250ms自动本地保存及已关联云文档的 outbox，不另建“写回云端”按钮。护甲槽上限同时更新 PbDH 护甲值。重复回读不重复保存或反向发送，等待确认期间的较新本地编辑不被旧结果覆盖。非法、缺失或超出 PbDH 资源边界的数据停止关联，不污染人物存档。

六特质和主副武器保留独立 🎲 按钮；属性仍使用 PbDH 原生编辑，皮肤和布局保持现有系统包。检定助手读取当前 PbDH 属性和经历，修正直接加入数值表达式，例如 .dd 3+2 hope=1 -- 知识 · 世界旅行者。费用由 sealpack 在同一次操作中校验、扣除、结算奖励并沿用消息去重和恢复。桥接层发送时附加 pbdh=UUID，sealpack 在投骰前核对 DHPbDH来源。原生非 iframe 卡的 DH经历/exp 协议继续兼容。

武器助手仍只有熟练值、伤害骰大小、固定调整值三个输入框，扫描第一个 d/D 骰子条目，支持空格、多位数字和不同摘要格式。公式如 .r 3d6+3 改良巨杖；无法识别名字时回退主/副武器。DamageAdjustment 是显式因素接口，不自动解读特性自然语言。发送前核对武器与熟练值快照。

## 本地试用

官方 Chat 18760、官方 Dice 18761、实验 PbDH 18762。18762 的 Vite preview 使用 PBDH_API_PROXY_TARGET=https://daggerheart.cn，Supabase 认证及既有云存档、媒体继续通过正式 PbDH API；18763 合成验收后端保持停止。不得经18762创建或回收合成云文档。

1. 在现有 Chat 中重新加载 iframe，登录并选择想使用的 PbDH 存档。
2. 核对 PbDH/Dice 名称，点击“关联并使用 PbDH 资源”，这一步会将当前 PbDH 资源和人物昵称写入本地实验 Dice。
3. 通过 🎲 使用掷骰助手，或操作资源按钮；资源结果回读后自动保存，现有云文档自动同步。
4. 切换 PbDH 存档后重新关联，旧人物的资源结果不会写进新存档。

纯本地旧存档仍需沿用正常“同步到云”入口启用一次。云端已有不同修订时使用原有冲突处理；这不是多窗口实时共享编辑。账号单活动会话、离线 outbox 和格式导入边界都保持 PbDH 正常行为。

## iForm 配置与静态验收

npm run build:pbdh-embed -- https://your-pbdh.example/pbdh/player/daggerheart-core 生成 iframe.html、bridge-policy.json、presentation.json。宿主配置必须为直接外部 iframe，开启 Embed API 并授予 context.read、characterCard.read、messages.send；hostOrigin/sdkUrl 由宿主注入并校验同源。默认浮窗840×790，iframe随拖动缩放，沿用 PbDH 窄屏模式将桌面移到下方。

npm run preview:pbdh-embed -- <PbDH apps/platform/dist> <固定官方SDK路径> 提供隔离 SDK 协议夹具，--same-origin 仅供浏览器工具验收。夹具初始化与步进模拟资源保存，只记录投骰请求，不冒充真实掷骰或扣费，不接正式云端。

切换身份、频道、卡名/类型、存档或来源标识，以及断线，均停止关联。官方接口缺少稳定 Dice 卡 ID、原子 expectedCardId 和属性版本比较；初始化与 .st 调整没有严格外部并发保证，已经发送的消息不能撤销。读卡与约10秒轮询用于资源确认，超时/未知请求不自动重发。

测试与部署：专用初始化协议已补充零资源、完整姓名、非法字段拒绝与回读确认测试，并用未修改的官方1.6.1验证 .st show、数值公式、费用、来源和重载。本地实验需先安装0.4.9，再加载新版 PbDH iframe。正式云端仍沿用现有存档和认证流程，不创建或回收合成云文档；未部署或发布到生产。
