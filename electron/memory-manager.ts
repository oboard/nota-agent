import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { BrowserWindow } from 'electron';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load environment variables from the project root first, with cwd as a fallback.
const envCandidates = [
    path.join(projectRoot, ".env"),
    path.join(process.cwd(), ".env"),
];

for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
    }
}

const MEMORIES_DIR = path.join(projectRoot, "data/memories");
const LAST_RUN_FILE = path.join(projectRoot, "data/memories/.memory-consolidation-last-run");

interface MemoryEntry {
    id: string;
    content: string;
    timestamp: string;
    type: string;
    category?: string | null;
    categorySource?: string | null;
    headerLine: string;
}

/**
 * 从 Markdown 内容中解析记忆条目（兼容带元数据的 header 格式）
 * 格式：## TYPE | id=xxx | category=xxx | source=xxx - ISO_TIMESTAMP
 */
function parseMemoriesFromContent(content: string, fileName: string): MemoryEntry[] {
    const memories: MemoryEntry[] = [];
    const entries = content.split('---');

    for (const entry of entries) {
        const trimmedEntry = entry.trim();
        if (!trimmedEntry) continue;

        const lines = trimmedEntry.split('\n');
        const headerLine = lines.find(line => line.startsWith('## '));
        if (!headerLine) continue;

        // 兼容两种格式：
        // ## TYPE - timestamp
        // ## TYPE | id=xxx | category=xxx - timestamp
        // 注意：id 本身含有 `-`，所以用 ISO 时间戳作为分割锚点
        const headerMatch = headerLine.match(/^##\s+(\w+)((?:\s+\|[^|]+)*)\s+-\s+(\d{4}-\d{2}-\d{2}T[\d:.Z]+)$/);
        if (!headerMatch) continue;

        const [, type, metaRaw = '', timestamp] = headerMatch;
        const metadata: Record<string, string> = {};
        // metaRaw 形如 " | id=xxx | category=yyy"，先整体按 | 切分
        for (const part of metaRaw.split('|')) {
            const kv = part.trim();
            if (!kv) continue;
            const eqIdx = kv.indexOf('=');
            if (eqIdx === -1) continue;
            metadata[kv.slice(0, eqIdx).trim()] = kv.slice(eqIdx + 1).trim();
        }

        const bodyLines = lines.slice(lines.indexOf(headerLine) + 1);
        const bodyContent = bodyLines.join('\n').trim();

        if (!bodyContent || bodyContent.length < 3) continue;

        memories.push({
            id: metadata['id'] || `${fileName}-${timestamp}`,
            content: bodyContent,
            timestamp,
            type: type.toLowerCase(),
            category: metadata['category'] || null,
            categorySource: metadata['source'] || null,
            headerLine,
        });
    }

    return memories;
}

/**
 * 将记忆条目序列化回 Markdown 格式（保留所有元数据）
 */
function serializeMemory(entry: MemoryEntry): string {
    const parts: string[] = [];
    if (entry.id) parts.push(`id=${entry.id}`);
    if (entry.category) parts.push(`category=${entry.category}`);
    if (entry.categorySource) parts.push(`source=${entry.categorySource}`);
    const meta = parts.length > 0 ? ` | ${parts.join(' | ')}` : '';
    const header = `## ${entry.type.toUpperCase()}${meta} - ${entry.timestamp}`;
    return `${header}\n\n${entry.content}`;
}

/**
 * 调用 LLM 对记忆列表做语义去重压缩，返回合并后的文本列表
 */
async function deduplicateWithLLM(memories: MemoryEntry[]): Promise<string[]> {
    const apiBase = process.env.MODEL_API_BASE || "https://api.openai.com/v1";
    const apiKey = process.env.MODEL_API_KEY;
    const modelName = process.env.CHAT_MODEL_NAME || "gpt-3.5-turbo";

    if (!apiKey) {
        console.warn("[Memory Manager] No API key found, skipping LLM deduplication.");
        return memories.map(m => m.content);
    }

    const numbered = memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n');

    const prompt = `下面是一批记忆条目，请对其进行语义去重和压缩：
- 将表达相同或高度相似意思的条目合并为一条，保留最完整的表述
- 保留所有独立、不重复的信息，不要遗漏
- 每条输出一行，不加序号，不加多余格式
- 只输出合并后的条目内容，每条占一行

记忆列表：
${numbered}`;

    try {
        const response = await fetch(`${apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            console.error(`[Memory Manager] LLM API error: ${response.status}`);
            return memories.map(m => m.content);
        }

        const data = await response.json() as any;
        const text: string = data.choices?.[0]?.message?.content || '';
        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        return lines.length > 0 ? lines : memories.map(m => m.content);
    } catch (err) {
        console.error("[Memory Manager] LLM deduplication failed:", err);
        return memories.map(m => m.content);
    }
}

/**
 * 压缩指定日期（默认今天）的记忆文件
 * 返回压缩前后的条目数量，若无需压缩返回 null
 */
export async function compressDailyMemories(dateStr?: string): Promise<{ before: number; after: number } | null> {
    const today = dateStr || new Date().toISOString().split("T")[0];
    const filePath = path.join(MEMORIES_DIR, `${today}.md`);

    if (!fs.existsSync(MEMORIES_DIR)) {
        fs.mkdirSync(MEMORIES_DIR, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
        console.log(`[Memory Manager] No memory file found for ${today}.`);
        return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) {
        console.log("[Memory Manager] Memory file is empty.");
        return null;
    }

    const memories = parseMemoriesFromContent(content, `${today}.md`);
    if (memories.length <= 1) {
        console.log(`[Memory Manager] Only ${memories.length} memory entry, no compression needed.`);
        return null;
    }

    console.log(`[Memory Manager] Compressing ${memories.length} memories for ${today}...`);

    // 按 type 分组，分别压缩
    const groups = new Map<string, MemoryEntry[]>();
    for (const m of memories) {
        const key = m.type;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m);
    }

    const outputParts: string[] = [];
    let totalAfter = 0;

    for (const [, groupMemories] of groups) {
        // 少于 2 条的 group 无需压缩，直接保留
        if (groupMemories.length < 2) {
            outputParts.push(serializeMemory(groupMemories[0]));
            totalAfter += 1;
            continue;
        }

        const mergedContents = await deduplicateWithLLM(groupMemories);
        totalAfter += mergedContents.length;

        // 用第一条记忆的元数据作为模板，为每条合并结果生成新条目
        const template = groupMemories[0];
        const now = new Date().toISOString();
        for (let i = 0; i < mergedContents.length; i++) {
            const newEntry: MemoryEntry = {
                id: `${today}.md-${now}-compressed-${i}`,
                content: mergedContents[i],
                timestamp: now,
                type: template.type,
                category: template.category,
                categorySource: template.categorySource,
                headerLine: '',
            };
            outputParts.push(serializeMemory(newEntry));
        }
    }

    const newFileContent = outputParts.join('\n\n---\n\n') + '\n\n---\n\n';
    fs.writeFileSync(filePath, newFileContent, 'utf-8');

    console.log(`[Memory Manager] Compression done: ${memories.length} → ${totalAfter} entries.`);
    return { before: memories.length, after: totalAfter };
}

/**
 * 检查并整合记忆（定时调用入口，1 小时冷却）
 */
export async function checkAndConsolidateMemories() {
    console.log("[Memory Manager] Checking consolidation status...");

    if (!fs.existsSync(MEMORIES_DIR)) {
        fs.mkdirSync(MEMORIES_DIR, { recursive: true });
    }

    const now = Date.now();
    let lastRun = 0;

    try {
        if (fs.existsSync(LAST_RUN_FILE)) {
            const data = fs.readFileSync(LAST_RUN_FILE, "utf-8");
            lastRun = parseInt(data, 10);
            if (isNaN(lastRun)) lastRun = 0;
        }
    } catch (error) {
        console.error("[Memory Manager] Error reading last run file:", error);
    }

    if (now - lastRun < 60 * 60 * 1000) {
        console.log(`[Memory Manager] Skipping: Last run was ${(now - lastRun) / 1000 / 60} minutes ago.`);
        return;
    }

    console.log("[Memory Manager] Starting consolidation...");
    try {
        const result = await compressDailyMemories();
        try {
            fs.writeFileSync(LAST_RUN_FILE, now.toString());
        } catch (error) {
            console.error(`[Memory Manager] Error writing last run file: ${error}`);
        }
        if (result) {
            notifyMemoryConsolidated();
        }
        console.log("[Memory Manager] Consolidation completed successfully.");
    } catch (error) {
        console.error("[Memory Manager] Consolidation failed:", error);
    }
}

function notifyMemoryConsolidated() {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send('memory:consolidated');
        }
    }
}