# 开发与发布

## 工作入口

- SealDice：`sealdice/packages/daggerheart/`，`info.toml` 为版本和包身份权威，包 ID 为 `zac/daggerheart`。`rules.mjs` 负责纯规则，`state.mjs` 负责纯结算，`expression.mjs` 复用原生 DiceScript，`main.mjs` 适配宿主；`experiences.mjs` 和 `fields.mjs` 分别维护经历格式、展示字段及金币单位。
- SealChat：`sealchat/character-sheet/`，自有通用 HTML 使用原生人物卡协议；频道 Embed 是可选入口。数据和接口边界见 [CHARACTER_STATE.md](CHARACTER_STATE.md)。
- `reference/` 是固定版本只读快照，只核对接口，不安装依赖、构建或部署。禁止修改、打补丁或重编译宿主；旧 `development/` 补丁方案已经清理。
- `archive/sealchat-character-sheet/` 仅保留旧人物卡和皮肤的只读对照。旧插件、旧开发环境和临时产物已清理，历史从 Git 查阅。
- 生产配置仅在旁边的 VPS 仓库维护。本地验收不读取生产 token、数据库或配置，不连接 IM 或真实付费 AI。

Node.js 22 或更新的受支持 LTS，npm 是唯一默认包管理器：

```powershell
npm ci
npm test
npm run test:sheet
npm run check-reference
```

`npm test` 构建并运行 41 项插件测试；`test:sheet` 构建并验证模型、协议、刷新队列和固定 Chat 的 HTML 注入。构建白名单只包含本项目源码、模板、README 与明确声明的许可/商店素材，不打包参考源码、凭据、测试替身或运行数据。

`npm run build` 生成 `sealdice/packages/daggerheart/dist/daggerheart-版本.sealpack`。`npm run build:sheet` 生成通用 `daggerheart.html` 与可选 `daggerheart-embed.html`，不接收存档或生成角色专属 HTML。构建产物、依赖和本地运行目录均忽略，不提交 Git。

## 人物卡与 PbDH

PbDH 的“导出为海豹骰”复制同一条 `.st`，包含数值、金币把/袋/箱及最多 5 项经历名称/整数修正。经历以小型版本化 JSON 字符串保存到 Dice 绑定卡的 `DH经历`，空列表清除旧经历；不导入图片、职业、装备或其他参考资料。

HTML 接收 `SEALCHAT_UPDATE`，用 `ROLL_DICE/template` 发送 `.st/.dd/.ddr`，不用整卡 `UPDATE_ATTRS`、`characterCard.updateAttrs`、`character.set` 或本地/共享 Storage。资源操作使用相对 `.st`，约 10 秒回读；明确的 0 保留，未录入字段显示未知。

勾选经历时每项自动扣 1 希望，插件从当前卡计算修正和费用；余额不足、经历版本变化或算式错误在投骰前拒绝。费用先支付，再结算收益；恢复沿用角色标识、字段前后值与稳定 rawId 去重。原生 `.st` 与插件写入没有跨库事务或严格外部并发保证，属性约 60 秒落盘。

`npm run preview:sheet` 开启仅本机的协议预览，使用合成数据，只记录命令。旧版 UI 对照来自 archive；固定 Chat 的真实 IframeSandbox 注入代码只读提取用于测试，不进入交付 HTML。3D 注解输出实际骰面，固定 Chat 只有整次统一皮肤，不能逐骰区分希望/恐惧颜色。

## 隔离官方宿主验收

使用未修改的官方 SealDice 1.6.1 二进制，在唯一的忽略 runtime 中验收，不接 IM：

```powershell
python tools/native-smoke.py --binary <官方1.6.1绝对路径> --restart-before-enable
python tools/native-smoke.py --binary <官方1.6.1绝对路径> --experiences-only
python tools/native-smoke.py --binary <官方1.6.1绝对路径> --summary-gold-only
```

完整验收覆盖安装、启用、`.set dh`、零值/缺失字段、原生算式、玩家资源与 GM 当前群绑定卡恐惧、重载、保存周期后的重启和卸载。经历验收覆盖 Unicode/引号、多项/零修正费用、失效选择及错误不扣费；`--st-export-fixture` 可传入实际 PbDH 格式器生成的合成命令/经历 JSON。展示/金币验收覆盖白名单、别名、原生命令回退和三个单位持久化。

Windows 禁用重载后重新启用可能遇到官方宿主缓存目录重命名 `Access is denied`；`--restart-before-enable` 在重新启用前重启隔离宿主，不修改核心。每次只停止自有进程；报告写到该 runtime 的 `native-report.json`，发布前确认 `passed` 与 `persistence_checked` 为 true。

测试不会代替完整未修改 Chat/Dice 的真实联动验收。仍须核对模板保存/绑定、数据下发、当前聊天身份路由、扣费回复与轮询；完整昵称徽章和术语库也未完成。详见 [重写范围](DAGGERHEART_REWRITE.md)。

## 豹仓发布

发布仅操作 `zac/daggerheart`，正式上传需用户明确要求；不意味着生产服务器已安装。令牌放忽略的根目录 `.env.local`（`SEALREPO_TOKEN`）或同名进程环境变量；`.env.example` 只留空字段。不得打印令牌、将其放命令参数、提交 Git 或转发到预签名上传存储。

完成当前版本本地测试与隔离宿主验收后：

```powershell
npm run publish:sealrepo
```

入口先构建/测试，再申请上传、PUT 本地包并提交版本。只校验凭据和本地产物可运行 `powershell -NoProfile -NonInteractive -File tools/publish-sealrepo.ps1 -Check`。同版本存在时停止；断线或提交后校验失败时，先核对豹仓实际状态和包摘要，不盲目覆盖或重发。

提交成功后查询公开版本、下载并比较 SHA256。上传成功、审核标记 verified、公开可下载和生产部署是不同状态，分别据实报告。包升级和恢复步骤见包 README。
