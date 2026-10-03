# PbDH 外部 iForm 实验

独立路线：Seal 工作树 `codex/pbdh-iframe-sync`；PbDH 工作树 `codex/sealchat-iframe-sync`。两边从已提交版本开始，不包含主工作区未提交的原生人物卡/经历导出修改。本目录不依赖现有 `sealchat/character-sheet`，不修改 SealChat / SealDice 宿主或生产配置。

PbDH 实验前端通过宿主提供的 Channel Embed SDK 接入，四项控件显示 Dice 当前资源及上限；不把会话覆盖存进 PbDH 存档。操作发相对 `.st`，不调用 UPDATE_ATTRS、characterCard.updateAttrs 或 character.set，不上传图片、不用 Embed Storage、不接真实 AI。

## 配置现有 iForm

先构建并提供本实验 PbDH 前端。当前线上 PbDH 尚无此适配，不能把配置文件生成成功当成线上已可同步。

```powershell
npm run build:pbdh-embed -- https://your-pbdh.example/pbdh/player/daggerheart-core
npm run test:pbdh-embed
```

产物在 `dist/iframe.html` 与 `dist/bridge-policy.json`。在现有 SealChat 的频道 iForm 管理界面：

1. 将 `iframe.html` 的单个 `<iframe src>` 粘贴到嵌入代码。必须是直接外部 iframe；不要套进原生人物卡 HTML 或外层 srcdoc。
2. 启用 Embed API，允许 PbDH 所在 origin，授予 `context.read`、`characterCard.read`、`messages.send`。JSON 只是字段配置参考，不宣称宿主支持文件导入。
3. 固定版本对单个 iframe 嵌入代码追加 `hostOrigin` / `sdkUrl`。PbDH 校验两者一致并从该实例加载 SDK；`/chat/` 前缀由宿主处理。URL-only iForm 分支未核实参数注入，所以使用已核对的单 iframe 嵌入代码入口。
4. 在隔离账号/频道启用官方 BOT 人物卡 API、自有 sealpack，先用既有 `.st` 录入资源及上限，选择自己的活动人物卡。
5. PbDH 中选择对应人物，核对页面显示的 PbDH / Dice 名称，点击“确认关联当前人物卡”。四项余额来自 Dice；未录入字段显示未知且禁用，不填 0。

| PbDH Module | Dice 当前值 | Dice 上限 | 含义 |
| --- | --- | --- | --- |
| hp | 生命 | 生命上限 | 已标记生命 |
| stress | 压力 | 压力上限 | 已标记压力 |
| armor-slots | 护甲 | 护甲上限 | 已标记护甲槽；不是护甲值 |
| hope | 希望 | 希望上限 | 可用希望 |

## 本地双端预览

PbDH 工作树：`npm install`，按其 AGENTS.md 运行 `npm run verify`（包含 `apps/platform/dist` 构建）。此处无需启动 Backend 或重启其他路线的开发服务。

Seal 工作树：

```powershell
npm run preview:pbdh-embed -- "D:\path\to\PbDH\apps\platform\dist" "D:\path\to\readonly\reference\sealchat\api\embed\channel-embed-sdk.js"
```

默认父页端口18751，PbDH端口18752；可再传两个独立端口。只绑定回环，静态托管自己的构建和隔离协议 fixture。SDK 原字节从固定快照只读提供，不复制进发布物。预览按钮模拟外部检定、切卡、断线和会话失效，消息只存在内存，不发群聊、不连接真实宿主。测试用全新回环 origin 的存储，不复用生产 cookie/数据库。

浏览器工具不能操作跨域 iframe 时，可在两个端口后追加 `--same-origin`，只改变测试夹具的前端来源。默认跨域模式仍用于 SDK 握手/读卡/事件验收；同源模式用于按钮与界面验收，不改变正式 iForm 配置。

## 验收与能力边界

- 确认关联、打开和轮询不写 Dice；点击 `.st 希望-1` 等只写单字段；模拟外部结算可通过刷新和10秒轮询回读。
- PbDH普通模式资源仍按原有方式保存；实验模式关闭后回到本地存档值。静态编辑不受影响。PbDH `.pbcha` / 文本导出仍是本地值，跑团期间整卡导入可能覆盖 Dice，不能视为会话导出。
- 切换PbDH人物、SealChat频道/用户/身份、观察到Dice卡名/类型变化或断线会解除关联；恢复后需重新确认。正在发送的消息无法撤销。
- 宿主没有稳定Dice卡ID、原子expectedCardId、属性版本比较或通用属性推送；无法保证未观察到的A→B→A切卡、严格并发或跨设备去重。回读前的消息确认不等于Dice执行，超时不自动重发。
- 资源修改会留下普通聊天消息。最大值在实验模式只读，使用既有显式导入/命令配置。不新增宿主补丁来绕过限制。
- 协议fixture / 单元测试 / 静态构建通过只证明自有代码和固定 SDK 通信。上线前仍需未修改官方Chat/Dice的隔离真实联动，用户明确要求才发布或部署。

当前实验验证：PbDH `npm run verify` 通过（1406 项前端测试、178 项 Python 测试、边界/契约/类型检查和构建）；iForm 配置测试通过。浏览器验证实际 SDK 的跨域握手/读卡/上下文及断线事件，同源 fixture 验证四项按钮只发相对 `.st`、外部结算回读、切卡解除关联、断线禁用、会话失效重连，以及普通 PbDH 存档数值未被会话覆盖。未部署，未运行真实官方 Chat/Dice 联动。
