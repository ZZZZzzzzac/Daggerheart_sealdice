# Daggerheart Seal 开发工作区

当前采用PbDH iframe作为SealChat人物卡。属性、经历、装备与完整存档由PbDH保存；Dice保存跑团资源副本和徽标字段，执行通用.dd/.ddr。旧HTML人物卡、Dice经历协议与构建入口已移除，历史从Git查阅。正式入口是Seal master与PbDH main；部署配置只在Daggerheart_VPS维护。

| 目录 | 用途 |
| --- | --- |
| sealdice/packages/daggerheart/ | zac/daggerheart 0.5.0规则包 |
| sealchat/pbdh-embed/ | 官方Embed/iForm配置、预览及接入说明 |
| reference/ | 固定版本只读上游接口核对 |
| docs/ | 开发、数据职责和功能文案审阅说明 |
| archive/ | 历史只读参考，不作为当前发布入口 |

Node.js22或更新的受支持LTS，使用npm：

    npm ci
    npm test
    npm run test:pbdh-embed
    npm run check-reference

不修改、打补丁或重新编译SealChat/Dice宿主。开发说明见docs/DEVELOPMENT.md，当前功能见sealdice/packages/daggerheart/README.md，文案清单见docs/SEALPACK_REVIEW.md，数据方案见docs/CHARACTER_STATE.md。

其他平台仍可手输.dd/.ddr与.st；经历手动转成修正并写hope/hopeN。PbDH“导出海豹骰”只导出数字快照，不导出经历。无需.dh init。

生产配置只在相邻Daggerheart_VPS仓库维护；不自动上传/重启生产。豹仓发布入口npm run publish:sealrepo，仅zac/daggerheart，凭据不入Git且不输出，同版本不得盲目覆盖。

iframe部署和频道安装步骤见[PbDH iframe接入](sealchat/pbdh-embed/README.md)。它随PbDH前端发布，无须单独托管另一张HTML人物卡。
