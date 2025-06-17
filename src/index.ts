import { parseArgsAndRoll } from './dice-logic';

function main() {
  // 注册扩展
  let ext = seal.ext.find('daggerheart');
  if (!ext) {
    ext = seal.ext.new('daggerheart', 'Daggerheart', '1.0.0');
    seal.ext.register(ext);
  }

  // 编写指令
  const cmdDaggerheart = seal.ext.newCmdItemInfo();
  cmdDaggerheart.name = 'dd'; // 指令名字
  cmdDaggerheart.help = 'Daggerheart二元骰专用模式\n' +
    '基础用法：.dd [adv/dis] [固定调整值:+/-N] [随机调整值:+/-XdY]\n' +
    '多个优/劣势骰取高：.dd adv2/dis2 (数字表示骰子数量)\n' +
    '优劣势可简写：优势:[adv/a/优势/优] 劣势:[dis/d/劣势/劣]\n' +
    '组合使用可以任意顺序：.dd 1d6 a3 +4\n';

  cmdDaggerheart.solve = (ctx, msg, cmdArgs) => {
    if (cmdArgs.args.length === 1 && cmdArgs.args[0].toLowerCase() === 'help') {
      const ret = seal.ext.newCmdExecuteResult(true);
      ret.showHelp = true;
      return ret;
    }

    const result = parseArgsAndRoll(cmdArgs.args);
    const { hope, fear, value, modifier, diceResultStr, advDisResult } = result;
    const ctxname = ctx.player.name;

    let reply = `Alea iacta est【${ctxname}】已掷下骰子...\n`;
    reply += `希望骰:${hope} 恐惧骰:${fear} ${advDisResult} 调整值:${modifier}${diceResultStr}\n`;
    reply += `骰值总和:${value} `;

    if (hope > fear) {
      reply += '希望尚存...';
    } else if (hope < fear) {
      reply += '直面恐惧...';
    } else {
      reply += '关键成功，逆天改命!';
    }

    seal.replyToSender(ctx, msg, reply);
    return seal.ext.newCmdExecuteResult(true);
  };

  // 注册命令
  ext.cmdMap['dd'] = cmdDaggerheart;
}

main();
