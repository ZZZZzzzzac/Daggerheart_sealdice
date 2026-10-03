// Synthetic public test data, never copied from a player's save.
export const fixture = {
  windowId: 'sheet-test', cardId: 'card-test', channelId: 'channel-test',
  name: '测试角色', canRoll: true, canOperate: true, stateVersion: 1, bindingGeneration: 1, readOnly: false,
  attrs: {
    DH经历: JSON.stringify({schemaVersion:1,experiences:[{name:'山野向导',modifier:2},{name:'守望者',modifier:2}]}),
    敏捷: 2, 力量: -1, 灵巧: 1, 本能: 0, 风度: 1, 知识: 0,
    生命: 1, 生命上限: 6, 压力: 2, 压力上限: 6,
    护甲: 0, 护甲上限: 3, 希望: 2, 希望上限: 6,
    金币把:0, 金币袋:9, 金币箱:1, 恐惧:7, DH角色标识:"hidden-test-role", 任意字段:"hidden-test-field",
    闪避: 12, 重伤阈值: 7, 严重阈值: 14,
  },
};
