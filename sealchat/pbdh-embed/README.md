# PbDH 外部 iForm 实验

独立路线：Seal 工作树 `codex/pbdh-iframe-sync`；PbDH 工作树 `codex/sealchat-iframe-sync`。目前已合并 Seal master `8d6526c`（sealpack 0.4.7）与 PbDH main `f6261fa`，不包含主工作区未提交内容。本目录不依赖现有 `sealchat/character-sheet`，不修改 SealChat / SealDice 宿主或生产配置。

PbDH 实验前端通过宿主提供的 Channel Embed SDK 接入，资源、金币、特质和防御控件显示 Dice 当前数值；不把会话覆盖存进 PbDH 存档。步进发相对 `.st`，显式数值编辑发单字段 `.st field=value`，不调用 UPDATE_ATTRS、characterCard.updateAttrs 或 character.set，不上传图片、不用 Embed Storage、不接真实 AI。

## 配置现有 iForm

先构建并提供本实验 PbDH 前端。当前线上 PbDH 尚无此适配，不能把配置文件生成成功当成线上已可同步。

```powershell
npm run build:pbdh-embed -- https://your-pbdh.example/pbdh/player/daggerheart-core
npm run test:pbdh-embed
```

产物在 `dist/iframe.html`、`dist/bridge-policy.json` 与 `dist/presentation.json`。在现有 SealChat 的频道 iForm 管理界面：

1. 将 `iframe.html` 的单个 `<iframe src>` 粘贴到嵌入代码。必须是直接外部 iframe；不要套进原生人物卡 HTML 或外层 srcdoc。
2. 启用 Embed API，允许 PbDH 所在 origin，授予 `context.read`、`characterCard.read`、`messages.send`。JSON 只是字段配置参考，不宣称宿主支持文件导入。
3. 窗口默认宽 840、高 790，iframe 填满官方相对定位容器；拖窗口边缘时内容跟随缩放。840px 宽可容纳约 794px 的 A4，触发 PbDH 原有 1080px 窄屏布局，卡牌桌面位于下方。已有浮窗可能保留旧尺寸，需拖动缩窄或关闭重开。固定版本对单个 iframe 嵌入代码追加 `hostOrigin` / `sdkUrl`；URL-only 分支没有这项注入。PbDH 校验两者一致并从该实例加载 SDK，`/chat/` 前缀由宿主处理。
4. 在隔离账号/频道启用官方 BOT 人物卡 API、自有 sealpack，先用既有 `.st` 录入资源及上限，选择自己的活动人物卡。
5. PbDH 中选择对应人物，核对页面显示的 PbDH / Dice 名称，点击“确认关联当前人物卡”。所接入数值来自 Dice；未录入字段显示未知且禁用，不填 0。
6. 点击六特质标题右侧的独立 🎲 按钮打开紧凑检定助手；属性格仍可编辑，失焦或回车只保存对应 Dice 字段。四项资源的 ± 支持右键/触摸长按改上限，拒绝上限低于当前值；不改 PbDH 皮肤、布局或独立模式。支持优劣势、反应、修正、难度、原因、经历勾选及手动 `.dd/.ddr` 公式。特质/经历读取 Dice；经历费用由 sealpack 0.4.7 校验并结算。升级不会自动补回旧版本已经丢失的零字段，需重新显式导入相应数值。

| PbDH Module | Dice 当前值 | Dice 上限 | 含义 |
| --- | --- | --- | --- |
| hp | 生命 | 生命上限 | 已标记生命 |
| stress | 压力 | 压力上限 | 已标记压力 |
| armor-slots | 护甲 | 护甲上限 | 已标记护甲槽 |
| hope | 希望 | 希望上限 | 可用希望 |
| handful-gold / bag-gold / chest-gold | 金币把 / 金币袋 / 金币箱 | 9 / 9 / 无上限 | 保持 PbDH 步进规则，不自动换算；外部较大值仍照实显示 |
| evasion | 闪避 | — | 可编辑单字段 |
| armor-value | 护甲上限 | — | 与护甲槽上限共用同一字段 |
| major-threshold / severe-threshold | 重伤阈值 / 严重阈值 | — | 可编辑单字段 |

主副武器标题旁的 🎲 按钮打开伤害助手，只有“熟练值、伤害骰大小、固定调整值”三个输入框。默认读取当前 PbDH 熟练值及武器伤害，扫描整段武器文字中第一个 `d/D` 骰子条目，不依赖分隔符，支持空格、多位骰面数和正负调整，例如 `D 12 + 15`、`d20+123` 或 `改良巨杖｜魔法/双手/极远｜知识: d6+3`；三个值都可手改，无法识别或空摘要也允许手填。预览与发送使用同一条完整官方指令，例如 `.r 3d6+3 改良巨杖`；可识别的单行武器名作为原因，识别失败回退到“主武器 / 副武器”。DamageAdjustment 保留为后续额外同类骰、固定修正与额外骰的能力注入接口，不增加弹窗输入、不自动识别特性文字。发送前检查源武器/熟练值是否变化。

## 账号、云存档与导入

iframe 中使用完整 PbDH Platform Shell，账号、云存档和系统包声明的格式导入均复用原有入口。点击右上角“账号”登录；840px 下，“玩家存档 / 导入导出”位于右上角“主页面”菜单。切换或导入新人物后重新确认 Dice 关联。跑团数值覆盖仍不会写进本地/云存档。

本地前端必须连接 PbDH Backend，不能只启动静态预览。开发和预览可用环境变量 `PBDH_API_PROXY_TARGET` 指定 API 后端，未设置时仍为 `http://127.0.0.1:8001`。当前按用户要求，18762 前端使用 `PBDH_API_PROXY_TARGET=https://daggerheart.cn` 连接正常 PbDH API，代理改写 Host 并正常校验 HTTPS 证书。Supabase 负责认证，账号资料、原有云存档与托管图片来自正式 PbDH 后端；不会再读取 18763 的实验账号资料。仅修改本地预览连接，无需部署服务器、新账号或存档协议。原 18763 隔离后端只供合成数据验收，写入/回收脚本必须直接指向该端口，不得通过已接云端的 18762 执行。PbDH 单活动会话提示仍按原有流程处理。

## 本地双端预览

PbDH 工作树：`npm install`，按其 AGENTS.md 运行 `npm run verify`（包含 `apps/platform/dist` 构建）。以下协议夹具只做静态界面/SDK 验收，不提供 Backend；账号/云存档试用通过 18762 代理正常 PbDH API，不需重启其他路线的开发服务。

Seal 工作树：

```powershell
npm run preview:pbdh-embed -- "D:\path\to\PbDH\apps\platform\dist" "D:\path\to\readonly\reference\sealchat\api\embed\channel-embed-sdk.js"
```

默认父页端口18751，PbDH端口18752；可再传两个独立端口。只绑定回环，静态托管自己的构建和隔离协议 fixture。SDK 原字节从固定快照只读提供，不复制进发布物。预览按钮模拟外部检定、切卡、断线和会话失效，消息只存在内存，不发群聊、不连接真实宿主。测试用全新回环 origin 的存储，不复用生产 cookie/数据库。

浏览器工具不能操作跨域 iframe 时，可在两个端口后追加 `--same-origin`，只改变测试夹具的前端来源。默认跨域模式仍用于 SDK 握手/读卡/事件验收；同源模式用于按钮与界面验收，不改变正式 iForm 配置。

## 验收与能力边界

- 确认关联、打开和轮询不写 Dice；点击 `.st 希望-1` 等只写单字段；模拟外部结算可通过刷新和10秒轮询回读。
- PbDH普通模式资源仍按原有方式保存；实验模式关闭后回到本地存档值。其他静态编辑保持现有流程；已同步的数值编辑只保存 Dice，人物卡导出仍使用本地存档。PbDH `.pbcha` / 文本导出仍是本地值，跑团期间整卡导入可能覆盖 Dice，不能视为会话导出。
- 切换PbDH人物、SealChat频道/用户/身份、观察到Dice卡名/类型变化或断线会解除关联；恢复后需重新确认。正在发送的消息无法撤销。
- 宿主没有稳定Dice卡ID、原子expectedCardId、属性版本比较或通用属性推送；无法保证未观察到的A→B→A切卡、严格并发或跨设备去重。回读前的消息确认不等于Dice执行，超时不自动重发。
- 资源修改会留下普通聊天消息。最大值在实验模式只读，使用既有显式导入/命令配置。不新增宿主补丁来绕过限制。
- 协议fixture / 单元测试 / 静态构建通过只证明自有代码和固定 SDK 通信。上线前仍需未修改官方Chat/Dice的隔离真实联动，用户明确要求才发布或部署。

当前验收：PbDH `npm run verify` 通过（1435 项前端测试、178 项 Python 测试、边界/契约/类型检查和构建）；sealpack 41、原生卡 21、iForm 配置 2 项测试通过，固定参考清单一致。官方未修改 Chat 20260921 / Dice 1.6.1 本地实例已运行，`zac/daggerheart` 0.4.7 已启用；真实 iForm 读取活动卡，默认 840px，拖宽到 1040px 时 iframe 跟随，原有窄屏布局把桌面放到下方。同源 fixture 验证标题 🎲 位置、现有力量格点击、Dice 零特质显示、优势/反应/经历/DC/原因的单条 SDK 消息发送，以及格式化武器摘要默认值、三输入手改与完整 `.r` 指令一致；夹具只记录投骰请求，不冒充真实扣费结算。账号页面与正式云端连接已验收：显示正式账号资料，读取已有云人物存档及其七张卡牌图片；未做云文档写入或回收测试。合成数据创建/读取/更新/列表/回收仅在隔离后端验收。伤害助手页面已确认武器名预览。生产未部署；完整真实人物操作、经历费用和回复回读仍需本地试用验收。

助手交互只读核对了当前 [SealChat master 的 DiceRollPopover.vue](https://github.com/kagangtuya-star/sealchat/blob/7a7b5bb424ae08e4954a2078833b172dbac847b7/ui/src/views/chat/components/character-sheet/DiceRollPopover.vue)（核对时 master 即固定版本 7a7b5bb），以及本项目 master 的原生匕首之心卡。自有实现用 `.dd/.ddr adv/dis`，保留匕首之心经历协议；不复制或修改宿主组件。
