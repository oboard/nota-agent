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

  private getToolPartName(part: any): string {
    if (typeof part?.toolName === 'string' && part.toolName) return part.toolName;
    if (typeof part?.type === 'string' && part.type.startsWith('tool-')) {
      return part.type.replace(/^tool-/, '');
    }
    return '';
  }

  private buildPartFingerprint(part: any): string {
    const partType = typeof part?.type === 'string' ? part.type : '';

    if (partType === 'step-start') {
      return 'step-start';
    }

    if (partType.startsWith('tool-') || partType === 'tool-call' || partType === 'tool-result' || partType === 'tool-error') {
      const toolName = this.getToolPartName(part);
      const input = JSON.stringify(part?.input ?? part?.args ?? {});
      const output = typeof part?.output === 'string' ? part.output.trim() : JSON.stringify(part?.output ?? '');

      // saveMemory 本身已经会自动升级为长期记忆，这里按“记忆内容”去重，避免同条消息里重复持久化
      if (toolName === 'saveMemory' || toolName === 'saveLongTermMemory' || toolName === 'autoSaveMemory') {
        const memoryContent =
          typeof part?.input?.content === 'string'
            ? part.input.content.trim()
            : typeof part?.args?.content === 'string'
              ? part.args.content.trim()
              : output;
        return `memory-save:${memoryContent}`;
      }

      return `tool:${toolName}:${input}:${output}`;
    }

    if (partType === 'text') {
      return `text:${typeof part?.text === 'string' ? part.text : ''}`;
    }

    return JSON.stringify(part);
  }

  private sanitizeParts(parts: any[] = []): any[] {
    const seen = new Set<string>();
    const sanitized: any[] = [];

    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;

      // step-start 仅用于过程展示，持久化时没有必要反复保留
      if (part.type === 'step-start') {
        continue;
      }

      const fingerprint = this.buildPartFingerprint(part);
      if (seen.has(fingerprint)) {
        continue;
      }

      seen.add(fingerprint);
      sanitized.push(part);
    }

    return sanitized;
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
      parts: this.sanitizeParts(parts),
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
   * 保存聊天消息 - 只保存今天创建的消息到今天的文件
   */
  async saveChat(messages: UIMessage[]): Promise<void> {
    const todayFile = this.getTodayFileName();
    const filePath = this.getFilePath(todayFile);

    // 确保目录存在
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // 获取今天的日期字符串用于比较
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 过滤出今天的消息
    const todayMessages = (messages || []).filter((msg: any) => {
      const createdAt = msg.createdAt;
      if (!createdAt) return true; // 没有时间戳的消息默认保存到今天
      const msgDate = new Date(createdAt);
      const msgStr = `${msgDate.getFullYear()}-${String(msgDate.getMonth() + 1).padStart(2, '0')}-${String(msgDate.getDate()).padStart(2, '0')}`;
      return msgStr === todayStr;
    });

    const existingMessages = await this.readMessagesFromFile(filePath);
    const merged = this.normalizeMessages([...existingMessages, ...todayMessages]);

    await writeFile(filePath, JSON.stringify(merged, null, 2));
  }
}
