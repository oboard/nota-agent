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
   * 加载所有历史聊天消息
   */
  async loadChat(page: number = 1, pageSize: number = 20): Promise<UIMessage[]> {
    const chatFiles = await this.getAllChatFiles();
    const allMessages: UIMessage[] = [];

    for (const file of chatFiles) {
      const filePath = this.getFilePath(file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const chats: ChatData[] = JSON.parse(content);
        chats.forEach(chat => {
          allMessages.push(...this.normalizeMessages(chat.messages));
        });
      } catch (error) {
        console.error(`Failed to read chat file ${file}:`, error);
      }
    }

    // 按时间戳排序消息并分页
    const sortedDesc = allMessages.sort((a, b) => {
      const timeA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const timeB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return timeB - timeA; // 新的在前（今天优先）
    });

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // 取出该页后，再按时间正序展示，保证阅读顺序从早到晚
    const pageMessages = sortedDesc.slice(startIndex, endIndex).sort((a, b) => {
      const timeA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const timeB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return timeA - timeB;
    });

    return pageMessages;
  }

  /**
   * 获取所有聊天文件
   */
  private async getAllChatFiles(): Promise<string[]> {
    const chatDir = path.dirname(this.getFilePath(this.getTodayFileName()));
    let files: string[] = [];
    try {
      files = await readdir(chatDir);
    } catch {
      files = [];
    }
    // 支持两种命名：YYYY-MM-DD.json 和 chat-YYYY-MM-DD.json，并按日期降序（今天优先）
    const candidates = files.filter(file => file.match(/^(chat-)?\d{4}-\d{2}-\d{2}\.json$/));
    return candidates.sort((a, b) => {
      const ma = a.match(/^(?:chat-)?(\d{4})-(\d{2})-(\d{2})\.json$/);
      const mb = b.match(/^(?:chat-)?(\d{4})-(\d{2})-(\d{2})\.json$/);
      const ta = ma ? new Date(`${ma[1]}-${ma[2]}-${ma[3]}`).getTime() : 0;
      const tb = mb ? new Date(`${mb[1]}-${mb[2]}-${mb[3]}`).getTime() : 0;
      return tb - ta;
    });
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
}