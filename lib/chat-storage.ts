import { generateId } from 'ai';
import { UIMessage } from 'ai';
import { existsSync, mkdirSync } from 'fs';
import { writeFile, readFile, readdir } from 'fs/promises';
import path from 'path';

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
   * 批量标准化消息，并对相同 id 保留 createdAt 最新的版本，最终按时间排序
   */
  private normalizeMessages(messages: any[] = []): UIMessage[] {
    const normalized = messages.map((msg) => this.normalizeMessage(msg));
    const deduped = new Map<string, UIMessage>();

    for (const msg of normalized) {
      const key = msg.id;
      if (!key) continue;

      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, msg);
        continue;
      }

      const existingTime = new Date((existing as any).createdAt ?? 0).getTime();
      const currentTime = new Date((msg as any).createdAt ?? 0).getTime();

      if (currentTime >= existingTime) {
        deduped.set(key, msg);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => {
      const timeA = new Date((a as any).createdAt ?? 0).getTime();
      const timeB = new Date((b as any).createdAt ?? 0).getTime();
      return timeA - timeB;
    });
  }

  /**
   * 解析文件内容，兼容旧格式（ChatData 数组）与新格式（消息数组）
   * migrated=true 表示读到旧格式并需要回写为新格式
   */
  private readMessagesFromContent(content: string): { messages: UIMessage[]; migrated: boolean } {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // 旧格式：[{ id, messages, createdAt, updatedAt }]
        if (parsed.length > 0 && typeof parsed[0] === 'object' && (parsed[0] as any)?.messages) {
          const msgs = (parsed as any[]).flatMap((c) => Array.isArray((c as any).messages) ? (c as any).messages : []);
          return { messages: this.normalizeMessages(msgs), migrated: true };
        }
        // 新格式：消息数组
        return { messages: this.normalizeMessages(parsed as any[]), migrated: false };
      }
    } catch (error) {
      // ignore parse errors
    }
    return { messages: [], migrated: false };
  }

  private async readMessagesFromFile(filePath: string): Promise<UIMessage[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const { messages, migrated } = this.readMessagesFromContent(content);
      if (migrated) {
        await writeFile(filePath, JSON.stringify(messages, null, 2));
      }
      return messages;
    } catch {
      return [];
    }
  }

  /**
   * 创建聊天：不再写入文件，仅确保目录存在并返回固定 chatId（用于前端 key）
   */
  async createChat(): Promise<string> {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    return 'global';
  }

  /**
   * 加载所有历史聊天消息（按时间分页，跨文件聚合）
   */
  async loadChat(page: number = 1, pageSize: number = 20): Promise<UIMessage[]> {
    const chatFiles = await this.getAllChatFiles();
    const allMessages: UIMessage[] = [];

    for (const file of chatFiles) {
      const filePath = this.getFilePath(file);
      const msgs = await this.readMessagesFromFile(filePath);
      allMessages.push(...msgs);
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
   * 保存聊天消息 - 每日文件仅存消息数组（兼容旧文件合并后写回新格式）
   */
  async saveChat(messages: UIMessage[]): Promise<void> {
    const todayFile = this.getTodayFileName();
    const filePath = this.getFilePath(todayFile);

    // 确保目录存在
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    const existingMessages = await this.readMessagesFromFile(filePath);
    const merged = this.normalizeMessages([...existingMessages, ...(messages || [])]);

    await writeFile(filePath, JSON.stringify(merged, null, 2));
  }
}