import { parseArgsAndRoll } from './dice-logic';

function main() {
  // 注册扩展
  let ext = seal.ext.find('daggerheart');
  if (!ext) {
    ext = seal.ext.new('daggerheart', 'Daggerheart', '1.0.0');
    seal.ext.register(ext);
  }

  const actionData: { [key: string]: { name: string, count: number } } = {};

  // 编写指令
  const cmdDaggerheart = seal.ext.newCmdItemInfo();
  cmdDaggerheart.name = 'dd'; // 指令名字
  cmdDaggerheart.help = 'Daggerheart二元骰专用模式\n' +
    '基础用法：.dd [adv/dis] [固定调整值:+/-N] [随机调整值:+/-XdY]\n' +
    '多个优/劣势骰取高：.dd adv2/dis2 (数字表示骰子数量)\n' +
    '优劣势可简写：优势:[adv/a/优势/优] 劣势:[dis/d/劣势/劣]\n' +
    '组合使用可以任意顺序：.dd 1d6 a3 +4\n' +
    'DC检定: .dd [DC]\n' +
    '.dd getAction //查询当前所有用户掷骰的次数\n' +
    '.dd clearAction //重置记录\n';

  cmdDaggerheart.solve = (ctx, msg, cmdArgs) => {
    const userId = ctx.player.userId;
    const userName = ctx.player.name;

    if (cmdArgs.args.length === 1) {
      const action = cmdArgs.args[0].toLowerCase();
      if (action === 'help') {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }

      if (action === 'getaction') {
        let reply = '当前掷骰次数记录:\n';
        if (Object.keys(actionData).length === 0) {
          reply += '暂无记录。';
        } else {
          for (const id in actionData) {
            reply += `${actionData[id].name}: ${actionData[id].count}次\n`;
          }
        }
        seal.replyToSender(ctx, msg, reply);
        return seal.ext.newCmdExecuteResult(true);
      }

      if (action === 'clearaction') {
        for (const key in actionData) {
          delete actionData[key];
        }
        seal.replyToSender(ctx, msg, '所有用户的掷骰次数记录已重置。');
        return seal.ext.newCmdExecuteResult(true);
      }
    }

    // 记录掷骰次数
    if (!actionData[userId]) {
      actionData[userId] = { name: userName, count: 0 };
    }
    actionData[userId].name = userName; // 每次都更新名字，防止用户改名
    actionData[userId].count++;

    const result = parseArgsAndRoll(cmdArgs.args, userName);
    seal.replyToSender(ctx, msg, result.reply);
    return seal.ext.newCmdExecuteResult(true);
  };

  // 注册命令
  ext.cmdMap['dd'] = cmdDaggerheart;
}

main();
