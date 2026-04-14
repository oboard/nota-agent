import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { CronExpressionParser } from 'cron-parser';

export interface MemoryData {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    embedding?: number[];
    summary?: string;
}

export interface TaskPhase {
    id: string;
    title: string;
    startDateTime?: Date;
    endDateTime?: Date;
    completed: boolean;
}

export interface TodoData {
    id: string;
    title: string;
    description?: string;
    startDateTime?: Date;
    endDateTime?: Date;
    priority: number;
    completed: boolean;
    suspended?: boolean; // 挂起状态
    createdAt: Date;
    updatedAt: Date;
    cron?: string;
    lastGenerated?: string;
    links?: Record<string, string>; // title: url
    phases?: TaskPhase[];
}

export interface LinkMetadata {
    id: string;
    url: string;
    title: string;
    description?: string;
    image?: string;
    siteName?: string;
    type?: string;
    favicon?: string;
    extractedAt: string;
    createdAt: Date;
}

export interface NoteData {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    fileName: string;
}

export class FileStorage {
    private dataDir: string;

    constructor(dataDir: string = 'data/memories') {
        this.dataDir = dataDir;
    }

    private getDateFileName(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.md`;
    }

    private getTodayFileName(): string {
        return this.getDateFileName(new Date());
    }

    private getYesterdayFileName(): string {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.getDateFileName(yesterday);
    }

    private getFilePath(fileName: string): string {
        // 将数据目录与传入的文件名拼接成完整路径并返回
        return path.join(this.dataDir, fileName);
    }

    private async ensureDir(dirPath: string = this.dataDir): Promise<void> {
        await fs.mkdir(dirPath, { recursive: true });
    }

    private getNotesDir(): string {
        return path.join(this.dataDir, 'notes');
    }

    private getNoteFilePath(id: string): string {
        return path.join(this.getNotesDir(), `${id}.txt`);
    }

    private normalizeNoteText(title?: string, content?: string): string {
        const safeTitle = (title || '').replace(/\r/g, '').trim() || '未命名便笺';
        const safeContent = (content || '').replace(/\r/g, '');
        return `${safeTitle}\n\n${safeContent}`.trimEnd();
    }

    private parseNoteFile(id: string, fileName: string, raw: string, createdAt: string, updatedAt: string): NoteData {
        const normalized = raw.replace(/\r/g, '');
        const [rawTitle = '', ...rest] = normalized.split('\n');
        const title = rawTitle.trim() || '未命名便笺';
        const content = rest.join('\n').replace(/^\n+/, '');

        return {
            id,
            title,
            content,
            createdAt,
            updatedAt,
            fileName,
        };
    }

    async addMemory(content: string, type: string = "memory"): Promise<void> {
        await this.ensureDir();
        const fileName = this.getTodayFileName();
        const filePath = this.getFilePath(fileName);

        const timestamp = new Date().toISOString();
        const entry = `## ${type.toUpperCase()} - ${timestamp}\n\n${content}\n\n---\n\n`;

        try {
            await fs.appendFile(filePath, entry);
        } catch (error) {
            console.error('Error adding memory:', error);
            throw error;
        }

        // The electron memory manager will handle intelligent processing
    }

    async addLongTermMemory(content: string): Promise<void> {
        await this.ensureDir();
        const fileName = 'long-term.md';
        const filePath = this.getFilePath(fileName);

        const timestamp = new Date().toISOString();
        const entry = `## LONG_TERM - ${timestamp}\n\n${content}\n\n---\n\n`;

        try {
            await fs.appendFile(filePath, entry);
        } catch (error) {
            console.error('Error adding long-term memory:', error);
            throw error;
        }

        // The electron memory manager will handle intelligent processing
    }

    async getLongTermMemories(limit: number = 50): Promise<MemoryData[]> {
        // 直接从文件读取长期记忆
        const fileName = 'long-term.md';
        const filePath = this.getFilePath(fileName);
        const memories: MemoryData[] = [];

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsedMemories = this.parseMemoriesFromMarkdown(content, fileName);
            memories.push(...parsedMemories);
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                console.error(`Error reading long-term memory file:`, err);
            }
        }

        // 按时间戳排序，最新的在前面
        return memories
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    }

    async getMemories(limit: number = 50): Promise<MemoryData[]> {
        // 直接从文件读取记忆
        const memories: MemoryData[] = [];

        try {
            const files = await fs.readdir(this.dataDir);
            const mdFiles = files.filter(file => file.endsWith('.md')).sort().reverse();

            // 优先加载今天的和昨天的文件
            const todayFile = this.getTodayFileName();
            const yesterdayFile = this.getYesterdayFileName();

            const prioritizedFiles = [
                todayFile,
                yesterdayFile,
                ...mdFiles.filter(file => file !== todayFile && file !== yesterdayFile)
            ].filter(file => mdFiles.includes(file));

            for (const file of prioritizedFiles) {
                if (memories.length >= limit) break;

                const filePath = this.getFilePath(file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const parsedMemories = this.parseMemoriesFromMarkdown(content, file);
                    memories.push(...parsedMemories);
                } catch (error) {
                    console.error(`Error reading file ${file}:`, error);
                }
            }
        } catch (error) {
            console.error('Error getting memories:', error);
        }

        // 按时间戳排序，最新的在前面
        return memories
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    }

    async getRecentMemories(limit: number = 20): Promise<MemoryData[]> {
        return this.getMemories(limit);
    }

    /**
     * Get relevant memories for current context using semantic search
     */
    async getRelevantMemories(context: string, limit: number = 10): Promise<MemoryData[]> {
        // Simple keyword-based relevance for now
        // In production, this would use embeddings from the electron memory manager
        const allMemories = await this.getMemories(100); // Get more memories for filtering
        const contextWords = context.toLowerCase().split(/\s+/);

        const scoredMemories = allMemories.map(memory => {
            const memoryWords = memory.content.toLowerCase().split(/\s+/);
            let score = 0;

            contextWords.forEach(word => {
                if (memoryWords.some(mw => mw.includes(word) || word.includes(mw))) {
                    score += 1;
                }
            });

            // Boost recent memories
            const daysSinceCreated = (Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 1 - daysSinceCreated / 30);

            return { memory, score: score + recencyBoost };
        });

        return scoredMemories
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => item.memory);
    }

    /**
     * 搜索记忆 - 基于关键词搜索记忆内容
     */
    async searchMemories(query: string, limit: number = 20): Promise<MemoryData[]> {
        const allMemories = await this.getMemories(100);
        const queryLower = query.toLowerCase();

        // 支持正则表达式搜索
        let regex: RegExp | null = null;
        try {
            regex = new RegExp(query, 'i');
        } catch {
            // 如果不是有效的正则，使用普通文本搜索
        }

        const matchedMemories = allMemories.filter(memory => {
            if (regex) {
                return regex.test(memory.content);
            }
            // 简单的关键词包含搜索
            const contentLower = memory.content.toLowerCase();
            // 支持多个关键词（用空格分隔）
            const keywords = queryLower.split(/\s+/).filter(k => k.length > 0);
            return keywords.every(keyword => contentLower.includes(keyword));
        });

        // 按时间排序，最新的在前面
        return matchedMemories
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    }

    private parseMemoriesFromMarkdown(content: string, fileName: string): MemoryData[] {
        const memories: MemoryData[] = [];
        const entries = content.split('---');

        for (const entry of entries) {
            const trimmedEntry = entry.trim();
            if (!trimmedEntry) continue;

            const lines = trimmedEntry.split('\n');
            const headerLine = lines.find(line => line.startsWith('## '));

            if (headerLine) {
                const headerMatch = headerLine.match(/^##\s+(\w+)\s+-\s+(.+)$/);
                if (headerMatch) {
                    const [, type, timestamp] = headerMatch;
                    const content = lines.slice(lines.indexOf(headerLine) + 1).join('\n').trim();

                    memories.push({
                        id: `${fileName}-${timestamp}`,
                        content,
                        type: type.toLowerCase(),
                        createdAt: timestamp,
                    });
                }
            }
        }

        return memories;
    }

    async saveTodo(todo: Omit<TodoData, 'id' | 'createdAt' | 'updatedAt'>): Promise<TodoData> {
        const todos = await this.getTodos();
        const newTodo: TodoData = {
            ...todo,
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        todos.push(newTodo);
        await this.saveTodos(todos);

        return newTodo;
    }

    async getTodos(): Promise<TodoData[]> {
        try {
            const filePath = path.join(this.dataDir, 'todos.json');
            let content = '';
            try {
                content = await fs.readFile(filePath, 'utf-8');
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return [];
                }
                throw err;
            }

            let todos: TodoData[] = JSON.parse(content);

            // 将 ISO 字符串转换回 Date 对象
            todos = todos.map(todo => {
                const parsedPhases = todo.phases?.map(phase => ({
                    ...phase,
                    startDateTime: phase.startDateTime ? new Date(phase.startDateTime) : undefined,
                    endDateTime: phase.endDateTime ? new Date(phase.endDateTime) : undefined,
                }));

                // 如果有 phases，自动计算主任务的日期范围
                let calculatedStart = todo.startDateTime ? new Date(todo.startDateTime) : undefined;
                let calculatedEnd = todo.endDateTime ? new Date(todo.endDateTime) : undefined;

                if (parsedPhases && parsedPhases.length > 0) {
                    const phaseStarts = parsedPhases.filter(p => p.startDateTime).map(p => p.startDateTime!) as Date[];
                    const phaseEnds = parsedPhases.filter(p => p.endDateTime).map(p => p.endDateTime!) as Date[];

                    if (phaseStarts.length > 0) {
                        const earliestStart = new Date(Math.min(...phaseStarts.map(d => d.getTime())));
                        if (!calculatedStart || earliestStart < calculatedStart) {
                            calculatedStart = earliestStart;
                        }
                    }

                    if (phaseEnds.length > 0) {
                        const latestEnd = new Date(Math.max(...phaseEnds.map(d => d.getTime())));
                        if (!calculatedEnd || latestEnd > calculatedEnd) {
                            calculatedEnd = latestEnd;
                        }
                    }
                }

                return {
                    ...todo,
                    startDateTime: calculatedStart,
                    endDateTime: calculatedEnd,
                    phases: parsedPhases,
                };
            });

            // Check for cron tasks and generate new instances if needed
            let hasChanges = false;
            const now = new Date();
            const newTodos: TodoData[] = [];

            for (const todo of todos) {
                // If it's a cron template (has cron string and not completed)
                // Assuming cron templates are kept to generate new tasks
                if (todo.cron) {
                    try {
                        const interval = CronExpressionParser.parse(todo.cron, {
                            currentDate: todo.lastGenerated ? new Date(todo.lastGenerated) : new Date(todo.createdAt)
                        });

                        // Check if we need to generate tasks up to now
                        // Prevent infinite loop if multiple intervals passed, maybe limit to 1 or a few?
                        // For simplicity, let's just check the next occurrence

                        let next = interval.next();
                        let nextDate = next.toDate();

                        // If next occurrence is in the past (before or equal to now), generate task
                        if (nextDate <= now) {
                            // Generate new task
                            const newInstance: TodoData = {
                                ...todo,
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                createdAt: nextDate,
                                updatedAt: nextDate,
                                cron: undefined, // Instance doesn't have cron
                                lastGenerated: undefined,
                                completed: false
                            };
                            newTodos.push(newInstance);

                            // Update template
                            todo.lastGenerated = nextDate.toISOString();
                            // If it was meant to catch up multiple, we might need a loop,
                            // but let's just do one at a time per request to be safe or just update lastGenerated to now if we only want one.
                            // But cron usually implies "every X", so if we missed 3, we might want 3 tasks.
                            // Let's stick to generating one if due, and updating lastGenerated.
                            // Next time getTodos is called, it might generate another if still due.
                            hasChanges = true;
                        }
                    } catch (err) {
                        console.error(`Error parsing cron for todo ${todo.id}:`, err);
                    }
                }
            }

            if (hasChanges) {
                todos = [...todos, ...newTodos];
                await this.saveTodos(todos);
            }

            return todos;
        } catch (error) {
            console.error('Error reading todos:', error);
            return [];
        }
    }

    async toggleTodo(id: string, completed: boolean): Promise<void> {
        const todos = await this.getTodos();
        const todo = todos.find(t => t.id === id);

        if (todo) {
            todo.completed = completed;
            todo.updatedAt = new Date();
            await this.saveTodos(todos);
        }
    }

    async toggleSuspended(id: string, suspended: boolean): Promise<void> {
        const todos = await this.getTodos();
        const todo = todos.find(t => t.id === id);

        if (todo) {
            todo.suspended = suspended;
            todo.updatedAt = new Date();
            await this.saveTodos(todos);
        }
    }

    async deleteTodo(id: string): Promise<void> {
        const todos = await this.getTodos();
        const filteredTodos = todos.filter(t => t.id !== id);
        await this.saveTodos(filteredTodos);
    }

    async saveTodos(todos: TodoData[]): Promise<void> {
        const filePath = path.join(this.dataDir, 'todos.json');
        await this.ensureDir();
        // 将 Date 对象转换为 ISO 字符串以便 JSON 序列化
        await fs.writeFile(filePath, JSON.stringify(todos, null, 2));
    }

    async getNotes(): Promise<NoteData[]> {
        const notesDir = this.getNotesDir();
        await this.ensureDir(notesDir);

        try {
            const files = await fs.readdir(notesDir);
            const noteFiles = files.filter(file => file.endsWith('.txt'));

            const notes = await Promise.all(
                noteFiles.map(async (fileName) => {
                    const id = fileName.replace(/\.txt$/, '');
                    const filePath = path.join(notesDir, fileName);
                    const [raw, stat] = await Promise.all([
                        fs.readFile(filePath, 'utf-8'),
                        fs.stat(filePath),
                    ]);

                    return this.parseNoteFile(
                        id,
                        fileName,
                        raw,
                        stat.birthtime.toISOString(),
                        stat.mtime.toISOString(),
                    );
                })
            );

            return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        } catch (error) {
            console.error('Error reading notes:', error);
            return [];
        }
    }

    async getNote(id: string): Promise<NoteData | null> {
        const filePath = this.getNoteFilePath(id);

        try {
            const [raw, stat] = await Promise.all([
                fs.readFile(filePath, 'utf-8'),
                fs.stat(filePath),
            ]);

            return this.parseNoteFile(
                id,
                `${id}.txt`,
                raw,
                stat.birthtime.toISOString(),
                stat.mtime.toISOString(),
            );
        } catch (error: any) {
            if (error?.code !== 'ENOENT') {
                console.error(`Error reading note ${id}:`, error);
            }
            return null;
        }
    }

    async createNote(data?: { title?: string; content?: string }): Promise<NoteData> {
        const noteId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const filePath = this.getNoteFilePath(noteId);
        await this.ensureDir(this.getNotesDir());

        const noteText = this.normalizeNoteText(data?.title, data?.content);
        await fs.writeFile(filePath, noteText, 'utf-8');

        const note = await this.getNote(noteId);
        if (!note) {
            throw new Error('Failed to create note');
        }

        return note;
    }

    async updateNote(id: string, data: { title?: string; content?: string }): Promise<NoteData | null> {
        const existing = await this.getNote(id);
        if (!existing) {
            return null;
        }

        const filePath = this.getNoteFilePath(id);
        const noteText = this.normalizeNoteText(
            data.title ?? existing.title,
            data.content ?? existing.content,
        );

        await fs.writeFile(filePath, noteText, 'utf-8');
        return this.getNote(id);
    }

    async deleteNote(id: string): Promise<boolean> {
        const filePath = this.getNoteFilePath(id);
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error: any) {
            if (error?.code !== 'ENOENT') {
                console.error(`Error deleting note ${id}:`, error);
            }
            return false;
        }
    }

    async saveLinkMetadata(metadata: Omit<LinkMetadata, 'id' | 'createdAt'>): Promise<LinkMetadata> {
        const links = await this.getLinkMetadata();
        const newLink: LinkMetadata = {
            ...metadata,
            id: Date.now().toString(),
            createdAt: new Date(),
        };

        links.push(newLink);
        await this.saveLinkMetadataList(links);

        return newLink;
    }

    async getLinkMetadata(): Promise<LinkMetadata[]> {
        try {
            const filePath = path.join(this.dataDir, 'links.json');
            let content = '';
            try {
                content = await fs.readFile(filePath, 'utf-8');
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return [];
                }
                throw err;
            }

            let links: LinkMetadata[] = [];
            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    links = parsed;
                } else {
                    console.error('Invalid link metadata format: Expected array');
                    return [];
                }
            } catch (error) {
                console.error('Error parsing link metadata:', error);
                // 尝试修复常见的 JSON 格式问题
                try {
                    // 移除末尾可能的逗号
                    const fixedContent = content.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
                    const parsed = JSON.parse(fixedContent);
                    links = Array.isArray(parsed) ? parsed : [];
                    console.log('Successfully fixed malformed JSON');
                } catch (fixError) {
                    console.error('Failed to fix malformed JSON:', fixError);
                    return [];
                }
            }

            // 将 ISO 字符串转换回 Date 对象
            links = links.map(link => ({
                ...link,
                createdAt: new Date(link.createdAt),
            }));

            return links;
        } catch (error) {
            console.error('Error reading link metadata:', error);
            return [];
        }
    }

    async saveLinkMetadataList(links: LinkMetadata[]): Promise<void> {
        const filePath = path.join(this.dataDir, 'links.json');
        await this.ensureDir();
        // 将 Date 对象转换为 ISO 字符串以便 JSON 序列化
        await fs.writeFile(filePath, JSON.stringify(links, null, 2));
    }

    async getRecentLinkMetadata(limit: number = 20): Promise<LinkMetadata[]> {
        const links = await this.getLinkMetadata();
        return links
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
}

export const storage = new FileStorage();
