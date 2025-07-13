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

    const mathArgs: string[] = [];

    // 分离出优势/劣势参数
    const remainingArgs = filteredArgs.filter(arg => {
        arg = arg.toLowerCase();
        const advMatch = arg.match(/^(adv|优势|优)(\d*)$/);
        const disMatch = arg.match(/^(dis|劣势|劣)(\d*)$/);

        if (advMatch) {
            const numDiceStr = advMatch[2] || '1';
            const numDice = parseInt(numDiceStr);
            const rolls: number[] = [];
            for (let i = 0; i < numDice; i++) {
                rolls.push(randomNum(6));
            }
            adv_dis = Math.max(...rolls);
            advDisResult = `优势骰${numDice}个: [${rolls.join(', ')}] 取最高:${adv_dis}`;
            return false;
        } else if (disMatch) {
            const numDiceStr = disMatch[2] || '1';
            const numDice = parseInt(numDiceStr);
            const rolls: number[] = [];
            for (let i = 0; i < numDice; i++) {
                rolls.push(randomNum(6));
            }
            adv_dis = -1 * Math.max(...rolls);
            advDisResult = `劣势骰${numDice}个: [${rolls.join(', ')}] 取最高:${-adv_dis}`;
            return false;
        }
        mathArgs.push(arg);
        return true;
    });

    // 处理数学表达式
    const mathExpression = mathArgs.join('').toLowerCase();
    const regex = /([+-])?(\d*d\d+|\d+)/g;
    let match;

    while ((match = regex.exec(mathExpression)) !== null) {
        const sign = match[1] === '-' ? -1 : 1;
        let term = match[2];

        // 处理 dX 格式
        if (term.startsWith('d')) {
            term = '1' + term;
        }

        const diceMatch = term.match(/^(\d+)d(\d+)$/);
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
            diceResults.push(`${sign === 1 ? '+' : '-'}${term}: [${rolls.join(', ')}]`);
        } else {
            const num = parseInt(term);
            if (!isNaN(num)) {
                modifier += sign * num;
            }
        }
    }

    const value = hope + fear + adv_dis + modifier;
    const diceResultStr = diceResults.length > 0 ? '\n随机调整值结果: ' + diceResults.join(' ') : '';

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
export interface FeastRollResult {
    totalValue: number;
    bonusValue: number;
    reply: string;
}

export function calculateFeastRoll(args: string[], userName: string): FeastRollResult {
    // 1. Parse args into a dice pool (array of numbers)
    let dicePool: number[] = [];
    const diceStrings: string[] = []; // For the reply string

    const regex = /(\d*)d(\d+)/i;
    for (const arg of args) {
        const match = arg.match(regex);
        if (match) {
            const numDice = match[1] ? parseInt(match[1], 10) : 1;
            const diceSize = parseInt(match[2], 10);
            for (let i = 0; i < numDice; i++) {
                dicePool.push(diceSize);
            }
            diceStrings.push(arg);
        }
    }

    if (dicePool.length === 0) {
        return { totalValue: 0, bonusValue: 0, reply: "无效的骰池，请输入如 .dd feast 4d8 2d6" };
    }

    let totalValue = 0;
    let bonusValue = 0;
    const steps: string[] = [];

    let round = 1;
    while (dicePool.length >= 2) {
        // 2. Roll all dice
        const rollResults = dicePool.map(side => ({ side, value: randomNum(side) }));
        steps.push(`第 ${round} 轮, 骰池: [d${dicePool.join(', d')}]`);
        steps.push(`> 掷骰结果: [${rollResults.map(r => r.value).join(', ')}]`);

        // 3. Group results by value
        const valueGroups = new Map<number, { side: number, value: number }[]>();
        for (const roll of rollResults) {
            if (!valueGroups.has(roll.value)) {
                valueGroups.set(roll.value, []);
            }
            valueGroups.get(roll.value)!.push(roll);
        }

        // 4. Find matches
        const matchedDiceThisRound: { value: number, count: number }[] = [];
        const remainingRolls = [...rollResults];
        let matchFound = false;

        for (const [value, group] of valueGroups.entries()) {
            if (group.length > 1) {
                matchFound = true;
                totalValue += value;
                bonusValue += group.length - 2;
                matchedDiceThisRound.push({ value, count: group.length });

                // Remove matched dice from remainingRolls
                for (const matchedDie of group) {
                    const index = remainingRolls.findIndex(r => r === matchedDie);
                    if (index > -1) {
                        remainingRolls.splice(index, 1);
                    }
                }
            }
        }
        
        if (matchFound) {
            const totalValueGained = matchedDiceThisRound.map(m => m.value).reduce((a, b) => a + b, 0);
            const bonusValueGained = matchedDiceThisRound.map(m => m.count - 2).reduce((a, b) => a + b, 0);
            steps.push(`  -> 发现匹配: ${matchedDiceThisRound.map(m => `${m.count}个${m.value}`).join(', ')}`);
            steps.push(`     总值 +${totalValueGained}, 奖励值 +${bonusValueGained}`);
            dicePool = remainingRolls.map(r => r.side);
        } else {
            // 5. No matches, remove one die randomly
            const removedIndex = randomNum(remainingRolls.length) - 1;
            const removedDie = remainingRolls[removedIndex];
            steps.push(`  -> 未发现匹配, 随机移除一个 d${removedDie.side} (出目 ${removedDie.value})`);
            remainingRolls.splice(removedIndex, 1);
            dicePool = remainingRolls.map(r => r.side);
        }
        
        round++;
    }
    
    if (dicePool.length > 0) {
        steps.push(`结束, 剩余骰池: [d${dicePool.join(', d')}]`);
    } else {
        steps.push(`结束, 骰池已空`);
    }

    // 6. Format reply
    let reply = `【${userName}】的饕餮盛宴:\n`;
    reply += `初始骰池: ${diceStrings.join(' ')}\n`;
    reply += "========================\n";
    reply += steps.join('\n');
    reply += "\n========================";
    reply += `\n最终结果 -> 总值: ${totalValue}, 奖励值: ${bonusValue}`;

    return { totalValue, bonusValue, reply };
}
