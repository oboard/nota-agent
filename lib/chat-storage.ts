import { generateId } from 'ai';
import { UIMessage } from 'ai';
import { existsSync, mkdirSync } from 'fs';
import { writeFile, readFile, readdir } from 'fs/promises';
import path from 'path';

export interface ChatData {
  id: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
}

export class ChatStorage {
  private dataDir: string;

  constructor(dataDir: string = 'data/chats') {
    this.dataDir = dataDir;
  }

  private getDateFileName(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`;
  }

  private getTodayFileName(): string {
    return this.getDateFileName(new Date());
  }

  private getFilePath(fileName: string): string {
    return path.join(this.dataDir, fileName);
  }

  /**
   * 将任意消息标准化为 UIMessage 结构
   */
  private normalizeMessage(message: any): UIMessage {
    const createdAt = message.createdAt ?? new Date().toISOString();
    const id = message.id ?? generateId();
    const parts =
      message.parts ??
      (message.content
        ? [{ type: 'text', text: message.content }]
        : message.text
          ? [{ type: 'text', text: message.text }]
          : []);

    return {
      ...message,
      id,
      createdAt,
      parts,
    };
  }

  /**
   * 批量标准化消息
   */
  private normalizeMessages(messages: any[] = []): UIMessage[] {
    return messages.map((msg) => this.normalizeMessage(msg));
  }

  /**
   * 创建新的聊天 - 优先复用同一天的活跃聊天
   */
  async createChat(): Promise<string> {
    const todayFile = this.getTodayFileName();
    const filePath = this.getFilePath(todayFile);

    // 确保目录存在
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // 读取现有的聊天数据
    let existingChats: ChatData[] = [];
    try {
      const content = await readFile(filePath, 'utf-8');
      existingChats = JSON.parse(content);
    } catch (error) {
      // 文件不存在或解析失败，创建新的空数组
    }

    // 检查今天是否已有活跃的聊天（有消息的聊天）
    const activeChats = existingChats.filter(
      (chat) => chat.messages && chat.messages.length > 0,
    );

    if (activeChats.length > 0) {
      // 按更新时间排序，获取最新的活跃聊天
      const latestActiveChat = activeChats.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];

      console.log(`复用今天已有的活跃聊天: ${latestActiveChat.id}`);
      return latestActiveChat.id;
    }

    // 如果没有活跃聊天，检查是否有空聊天（无消息的聊天）
    const emptyChats = existingChats.filter(
      (chat) => !chat.messages || chat.messages.length === 0,
    );

    if (emptyChats.length > 0) {
      // 复用最新的空聊天，并更新其时间戳
      const latestEmptyChat = emptyChats.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

      const now = new Date().toISOString();
      latestEmptyChat.updatedAt = now;
      latestEmptyChat.createdAt = now; // 也更新创建时间，让它成为"新"的聊天

      // 保存更新
      await writeFile(filePath, JSON.stringify(existingChats, null, 2));

      console.log(`复用今天已有的空聊天: ${latestEmptyChat.id}`);
      return latestEmptyChat.id;
    }

    // 如果没有可用的聊天，创建新的
    const id = generateId();
    const now = new Date().toISOString();
    const newChat: ChatData = {
      id,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    existingChats.push(newChat);
    await writeFile(filePath, JSON.stringify(existingChats, null, 2));

    console.log(`创建新的聊天: ${id}`);
    return id;
  }

  /**
   * 加载聊天
   */
  async loadChat(chatId: string): Promise<UIMessage[]> {
    const todayFile = this.getTodayFileName();
    const todayFilePath = this.getFilePath(todayFile);

    try {
      // 首先尝试从今天的文件加载
      const content = await readFile(todayFilePath, 'utf-8');
      const chats: ChatData[] = JSON.parse(content);
      const chat = chats.find((c) => c.id === chatId);

      if (chat) {
        return this.normalizeMessages(chat.messages);
      }
    } catch (error) {
      // 今天的文件不存在或解析失败
    }

    // 如果今天文件中没有找到，尝试从历史文件中查找
    try {
      const files = await readdir(this.dataDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json')).sort().reverse();

      for (const file of jsonFiles) {
        if (file === todayFile) continue; // 跳过今天文件，已经处理过了

        try {
          const filePath = this.getFilePath(file);
          const content = await readFile(filePath, 'utf-8');
          const chats: ChatData[] = JSON.parse(content);
          const chat = chats.find((c) => c.id === chatId);

          if (chat) {
            return this.normalizeMessages(chat.messages);
          }
        } catch (error) {
          // 文件读取或解析失败，继续下一个文件
          continue;
        }
      }
    } catch (error) {
      console.error('Error searching for chat in history files:', error);
    }

    // 如果都没找到，返回空数组
    return [];
  }

  /**
   * 保存聊天消息 - 始终保存到今天的文件
   */
  async saveChat(chatId: string, messages: UIMessage[]): Promise<void> {
    const todayFile = this.getTodayFileName();
    const filePath = this.getFilePath(todayFile);

    // 确保目录存在
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    const normalizedMessages = this.normalizeMessages(messages);

    // 读取今天的聊天数据
    let todayChats: ChatData[] = [];
    try {
      const content = await readFile(filePath, 'utf-8');
      todayChats = JSON.parse(content);
    } catch (error) {
      // 文件不存在或解析失败，创建新的空数组
    }

    // 查找聊天是否已存在于今天文件中
    const chatIndex = todayChats.findIndex((c) => c.id === chatId);
    const now = new Date().toISOString();

    if (chatIndex >= 0) {
      // 更新今天文件中的聊天
      todayChats[chatIndex] = {
        ...todayChats[chatIndex],
        messages: normalizedMessages,
        updatedAt: now,
      };
    } else {
      // 查找聊天是否存在于历史文件中
      let foundInHistory = false;

      try {
        const files = await readdir(this.dataDir);
        const jsonFiles = files
          .filter((file) => file.endsWith('.json') && file !== todayFile)
          .sort()
          .reverse();

        for (const file of jsonFiles) {
          try {
            const filePath = this.getFilePath(file);
            const content = await readFile(filePath, 'utf-8');
            const chats: ChatData[] = JSON.parse(content);
            const chat = chats.find((c) => c.id === chatId);

            if (chat) {
              // 找到历史聊天，复制到今天文件并更新
              todayChats.push({
                ...chat,
                messages: normalizedMessages,
                updatedAt: now,
              });
              foundInHistory = true;
              break;
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        console.error('Error searching for chat in history files:', error);
      }

      // 如果在历史文件中也找不到，创建新的聊天
      if (!foundInHistory) {
        todayChats.push({
          id: chatId,
          messages: normalizedMessages,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 保存回今天的文件
    await writeFile(filePath, JSON.stringify(todayChats, null, 2));
  }

  /**
   * 追加消息到聊天
   */
  async appendMessage(chatId: string, message: UIMessage): Promise<void> {
    const messages = await this.loadChat(chatId);
    messages.push(this.normalizeMessage(message));
    await this.saveChat(chatId, messages);
  }

  /**
   * 获取今天的所有聊天
   */
  async getTodayChats(): Promise<ChatData[]> {
    const todayFile = this.getTodayFileName();
    const filePath = this.getFilePath(todayFile);

    try {
      const content = await readFile(filePath, 'utf-8');
      const chats: ChatData[] = JSON.parse(content);
      return chats.map((chat) => ({
        ...chat,
        messages: this.normalizeMessages(chat.messages),
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * 获取可用的日期列表
   */
  async getAvailableDates(): Promise<{ date: string; fileName: string; chatCount: number }[]> {
    try {
      const files = await readdir(this.dataDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json')).sort().reverse();

      const dates = await Promise.all(
        jsonFiles.map(async (fileName) => {
          try {
            const filePath = this.getFilePath(fileName);
            const content = await readFile(filePath, 'utf-8');
            const chats: ChatData[] = JSON.parse(content);

            // 从文件名提取日期 (YYYY-MM-DD.json)
            const date = fileName.replace('.json', '');

            return {
              date,
              fileName,
              chatCount: chats.length,
            };
          } catch (error) {
            console.error(`Error reading date file ${fileName}:`, error);
            return null;
          }
        }),
      );

      return dates.filter((date) => date !== null);
    } catch (error) {
      console.error('Error getting available dates:', error);
      return [];
    }
  }

  /**
   * 滚动到指定日期的消息
   */
  async scrollToDate(chatId: string, targetDate: string): Promise<{ messages: UIMessage[]; foundDate: boolean }> {
    const filePath = this.getFilePath(`${targetDate}.json`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const chats: ChatData[] = JSON.parse(content);
      const chat = chats.find((c) => c.id === chatId);

      if (chat) {
        return {
          messages: this.normalizeMessages(chat.messages),
          foundDate: true,
        };
      }
    } catch (error) {
      console.error(`Error scrolling to date ${targetDate}:`, error);
    }

    return {
      messages: [],
      foundDate: false,
    };
  }

  /**
   * 加载更多历史消息（无限滚动）
   */
  async loadMoreMessages(chatId: string, beforeMessageId?: string, limit: number = 20): Promise<UIMessage[]> {
    const files = await readdir(this.dataDir);
    const jsonFiles = files.filter((file) => file.endsWith('.json')).sort().reverse();

    let allMessages: UIMessage[] = [];
    let foundTargetFile = false;

    for (const file of jsonFiles) {
      try {
        const filePath = this.getFilePath(file);
        const content = await readFile(filePath, 'utf-8');
        const chats: ChatData[] = JSON.parse(content);
        const chat = chats.find((c) => c.id === chatId);

        if (chat) {
          const normalizedChatMessages = this.normalizeMessages(chat.messages);

          if (beforeMessageId) {
            // 找到指定的消息ID，只返回该消息之前的内容
            const messageIndex = normalizedChatMessages.findIndex((m) => m.id === beforeMessageId);
            if (messageIndex > 0) {
              const messagesBefore = normalizedChatMessages.slice(
                Math.max(0, messageIndex - limit),
                messageIndex,
              );
              allMessages = [...messagesBefore, ...allMessages];
            }
          } else if (!foundTargetFile) {
            // 如果没有指定消息ID，从找到的第一个文件开始加载
            allMessages = [...normalizedChatMessages, ...allMessages];
            foundTargetFile = true;
          } else {
            // 继续加载更早的消息
            allMessages = [...normalizedChatMessages, ...allMessages];
          }

          if (allMessages.length >= limit) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
        continue;
      }
    }

    return allMessages.slice(0, limit);
  }

  /**
   * 获取或创建默认聊天（确保始终有可用的聊天）
   */
  async getOrCreateDefaultChat(): Promise<string> {
    const todayChats = await this.getTodayChats();

    if (todayChats.length > 0) {
      // 按更新时间排序，获取最新的聊天
      const latestChat = todayChats.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
      return latestChat.id;
    }

    // 如果没有今天的聊天，创建一个新的
    return await this.createChat();
  }

  /**
   * 获取最近的聊天记录（用于恢复会话）
   */
  async getRecentChats(limit: number = 5): Promise<ChatData[]> {
    const todayFile = this.getTodayFileName();
    const todayFilePath = this.getFilePath(todayFile);

    try {
      // 首先获取今天的聊天
      const todayContent = await readFile(todayFilePath, 'utf-8');
      const todayChats: ChatData[] = JSON.parse(todayContent);

      // 按更新时间排序，最新的在前面
      const sortedChats = todayChats
        .map((chat) => ({
          ...chat,
          messages: this.normalizeMessages(chat.messages),
        }))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);

      return sortedChats;
    } catch (error) {
      return [];
    }
  }
}

export const chatStorage = new ChatStorage();