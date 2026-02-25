import { chatStorage } from './lib/chat-storage';

async function testChatSave() {
  console.log('测试聊天保存功能...');

  try {
    // 创建新聊天
    const chatId = await chatStorage.createChat();
    console.log(`创建聊天: ${chatId}`);

    // 模拟消息数据
    const testMessages = [
      {
        id: 'msg1',
        role: 'user',
        content: '哈哈，好事多蘑More！这款我刚喝完～茶颜的抹茶系列真的挺耐喝的，你平常喜欢喝哪个甜度呀？',
        createdAt: new Date().toISOString()
      },
      {
        id: 'msg2',
        role: 'assistant',
        content: '巴西豆做冰咖确实够味！450ml标准浓缩的话，咖啡因含量应该刚好提神但不会过劲。是工作间隙来一杯还是刚吃完饭解腻呀？😄',
        createdAt: new Date().toISOString()
      },
      {
        id: 'msg3',
        role: 'user',
        content: '喝了 450ml标准浓缩标准冰巴西豆',
        createdAt: new Date().toISOString()
      },
      {
        id: 'msg4',
        role: 'assistant',
        content: '巴西豆做冰咖确实够味！450ml标准浓缩的话，咖啡因含量应该刚好提神但不会过劲。是工作间隙来一杯还是刚吃完饭解腻呀？😄',
        createdAt: new Date().toISOString()
      },
      {
        id: 'msg5',
        role: 'user',
        content: '是的，工作喝这个精神百倍了',
        createdAt: new Date().toISOString()
      },
      {
        id: 'msg6',
        role: 'assistant',
        content: '哈哈，巴西豆果然是你的续命神器！☕️ 精神满满继续干活，有需要喊我～',
        createdAt: new Date().toISOString()
      }
    ];

    // 保存消息
    await chatStorage.saveChat(chatId, testMessages);
    console.log('消息保存成功');

    // 验证保存结果
    const loadedMessages = await chatStorage.loadChat(chatId);
    console.log(`加载消息数量: ${loadedMessages.length}`);
    console.log('第一条消息:', loadedMessages[0]?.content);
    console.log('最后一条消息:', loadedMessages[loadedMessages.length - 1]?.content);

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testChatSave().catch(console.error);