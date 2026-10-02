# Daggerheart 二元骰插件

src/index.ts 注册 .dd，src/dice-logic.ts 是纯逻辑，header.txt 维护元信息。源码从旧项目原样迁入，types/seal.d.ts 为版本不详的旧声明。根目录 npm test / npm run build；产物 dist/daggerheart 二元骰插件.js。

当前测试覆盖基础关键成功/固定调整值、无效迷宫饭骰池及匹配奖励；宿主加载/真实消息需要另行验收。不要同时安装 standalone 中近似二元骰工作副本。
