/**
 * 生成一个在 minNum 和 maxNum 之间的随机整数。
 * 如果只提供一个参数，则生成 1 到 minNum 之间的随机数。
 * @param minNum - 最小值或最大值（如果只提供一个参数）。
 * @param maxNum - 最大值。
 * @returns 返回生成的随机数。
 */
export function randomNum(minNum: number, maxNum?: number): number {
    if (maxNum === undefined) {
        maxNum = minNum;
        minNum = 1;
    }
    return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
}

// 定义优势/劣势的同义词列表
const advantageKeywords = ['adv', 'a', '优势', '优'];
const disadvantageKeywords = ['dis', 'd', '劣势', '劣'];

export interface DiceRollResult {
    hope: number;
    fear: number;
    value: number;
    adv_dis: number;
    modifier: number;
    diceResultStr: string;
    advDisResult: string;
    reply: string;
}

/**
 * 解析参数并计算骰子结果。
 * @param args - 从命令中解析的参数数组。
 * @returns 返回一个包含所有骰子结果的对象。
 */
export function parseArgsAndRoll(args: string[], userName: string): DiceRollResult {
    let hope = randomNum(12);
    let fear = randomNum(12);
    let adv_dis = 0;
    let modifier = 0;
    let diceResults: string[] = []; // 用于存储所有随机骰子的结果
    let advDisResult = ''; // 用于存储优劣势骰的结果
    let dc: number | null = null;

    const filteredArgs = args.filter(arg => {
        const dcMatch = arg.match(/^\[(\d+)\]$/);
        if (dcMatch) {
            dc = parseInt(dcMatch[1], 10);
            return false; // 从参数列表中移除DC
        }
        return true;
    });

    // 解析参数
    for (let arg of filteredArgs) {
        arg = arg.toLowerCase();
        // 检查是否是带数字的优势/劣势
        const advMatch = arg.match(/^(adv|a|优势|优)(\d+)$/);
        const disMatch = arg.match(/^(dis|d|劣势|劣)(\d+)$/);

        if (advMatch) {
            const numDice = parseInt(advMatch[2]);
            const rolls: number[] = [];
            for (let i = 0; i < numDice; i++) {
                rolls.push(randomNum(6));
            }
            adv_dis = Math.max(...rolls);
            advDisResult = `优势骰${numDice}个: [${rolls.join(', ')}] 取最高:${adv_dis}`;
        } else if (disMatch) {
            const numDice = parseInt(disMatch[2]);
            const rolls: number[] = [];
            for (let i = 0; i < numDice; i++) {
                rolls.push(randomNum(6));
            }
            adv_dis = -1 * Math.max(...rolls);
            advDisResult = `劣势骰${numDice}个: [${rolls.join(', ')}] 取最高:${-adv_dis}`;
        } else if (advantageKeywords.includes(arg)) {
            const roll = randomNum(6);
            adv_dis = roll;
            advDisResult = `优势骰: ${roll}`;
        } else if (disadvantageKeywords.includes(arg)) {
            const roll = randomNum(6);
            adv_dis = -1 * roll;
            advDisResult = `劣势骰: ${roll}`;
        } else {
            // 尝试解析为数字或随机值表达式
            let sign = 1;
            if (arg.startsWith('+')) {
                arg = arg.substring(1); // 移除加号
            } else if (arg.startsWith('-')) {
                sign = -1;
                arg = arg.substring(1); // 移除减号
            }
            // 检查是否是随机值表达式 (如 1d6)
            const diceMatch = arg.match(/^(\d+)d(\d+)$/);
            if (diceMatch) {
                const numDice = parseInt(diceMatch[1]);
                const diceSize = parseInt(diceMatch[2]);
                const rolls: number[] = [];
                let sum = 0;
                for (let i = 0; i < numDice; i++) {
                    const roll = randomNum(diceSize);
                    rolls.push(roll);
                    sum += roll;
                }
                modifier += sign * sum;
                diceResults.push(`${sign === 1 ? '+' : '-'}${numDice}d${diceSize}: [${rolls.join(', ')}]`);
            } else {
                // 如果不是随机值表达式，尝试解析为普通数字
                const num = parseInt(arg);
                if (!isNaN(num)) {
                    modifier += sign * num;
                }
            }
        }
    }

    const value = hope + fear + adv_dis + modifier;
    const diceResultStr = diceResults.length > 0 ? '\n 调整值结果: ' + diceResults.join(' ') : '';

    // 生成回复
    let reply = `Alea iacta est【${userName}】已掷下骰子...\n`;
    reply += `希望骰:${hope} 恐惧骰:${fear} ${advDisResult} 调整值:${modifier}${diceResultStr}\n`;
    
    if (dc !== null) {
        reply += `骰值总和:${value} / DC:${dc} `;
    } else {
        reply += `骰值总和:${value} `;
    }

    // 决定结果
    if (hope === fear) {
        reply += '关键成功，逆天改命!';
    } else if (dc !== null) {
        const success = value >= dc;
        if (hope > fear) {
            reply += success ? '希望成功' : '希望失败';
        } else { // hope < fear
            reply += success ? '恐惧成功' : '恐惧失败';
        }
    } else { // 无DC检定
        if (hope > fear) {
            reply += '希望尚存...';
        } else { // hope < fear
            reply += '直面恐惧...';
        }
    }

    return {
        hope,
        fear,
        value,
        adv_dis,
        modifier,
        diceResultStr,
        advDisResult,
        reply,
    };
}