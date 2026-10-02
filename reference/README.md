# 对应生产版本的参考源码

2026-10-02 通过 SSH 核实搬瓦工 192.243.116.94。这里没有生产数据，只有公开源码。

| 快照 | 固定提交 / 依据 |
| :--- | :--- |
| sealchat | 7a7b5bb424ae08e4954a2078833b172dbac847b7，生产安装清单指向 20260921-7a7b5bb |
| sealdice-core | 755c106094a5931332945103c94071058e6e1286，官方 sealdice-build v1.6.1 的核心子模块 |
| sealdice-ui | 9c4ee578a32a0db938bf14e53a00735008582fac，同一正式版构建的 UI 子模块 |

服务器 Dice 自报 1.6.1+20260810，核心映射提交日期同为 2026-08-10；生产包来自官网。二进制经过压缩，未直接提取出 vcs.revision，因此对应关系依据官方正式版构建，不宣称独立重现了二进制字节。

manifest.json 记录来源、完整提交、归档 SHA256 和逐文件哈希。源码目录 Git 忽略且文件带只读属性；此属性是防误改，不是安全边界。npm run check-reference 检查原文件是否缺失/改变。副本下载后不包含 Git 历史；它们不是可直接编译的完整工作区，核心所需 builtins 子模块及预编译 UI 资源未随核心归档拉取；UI 源码单独放在 sealdice-ui。

SealChat go.mod 要求 Go 1.24.0，SealDice 核心 go.mod 要求 Go 1.25.0。这里默认不安装编译工具、不编译。需要核心修改时另建 development 下的工作副本，按对应构建仓库补齐依赖。

源码来源：[SealChat](https://github.com/kagangtuya-star/sealchat/tree/7a7b5bb424ae08e4954a2078833b172dbac847b7)、[SealDice 正式构建](https://github.com/sealdice/sealdice-build/tree/v1.6.1)、[核心](https://github.com/sealdice/sealdice-core/tree/755c106094a5931332945103c94071058e6e1286)、[UI](https://github.com/sealdice/sealdice-ui/tree/9c4ee578a32a0db938bf14e53a00735008582fac)。
