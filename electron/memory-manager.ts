import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';

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
    content: string;
    timestamp: string;
    type: string;
}

/**
 * 检查并整合记忆（简化版本，移除聚类和向量化）
 */
export async function checkAndConsolidateMemories() {
    console.log("[Memory Manager] Checking consolidation status...");

    // Ensure memories directory exists
    if (!fs.existsSync(MEMORIES_DIR)) {
        console.log(`[Memory Manager] Creating memories directory: ${MEMORIES_DIR}`);
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

    // Check if 1 hour (3600000 ms) has passed
    if (now - lastRun < 60 * 60 * 1000) {
        console.log(`[Memory Manager] Skipping: Last run was ${(now - lastRun) / 1000 / 60} minutes ago.`);
        return;
    }

    console.log("[Memory Manager] Starting consolidation...");
    try {
        await consolidateMemories();
        // Update last run time
        try {
            fs.writeFileSync(LAST_RUN_FILE, now.toString());
        } catch (error) {
            console.error(`[Memory Manager] Error writing last run file: ${error}`);
            // Continue execution even if we can't write the last run file
        }
        console.log("[Memory Manager] Consolidation completed successfully.");
    } catch (error) {
        console.error("[Memory Manager] Consolidation failed:", error);
    }
}

/**
 * 从记忆内容中解析记忆条目
 */
function parseMemoriesFromContent(content: string): MemoryEntry[] {
    const memories: MemoryEntry[] = [];
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

                if (content && content.length > 10 && !/^\s*$/.test(content)) {
                    memories.push({
                        content,
                        timestamp,
                        type: type.toLowerCase(),
                    });
                }
            }
        }
    }

    return memories;
}

/**
 * 整合今天的记忆（基于时间分组）
 */
async function consolidateMemories() {
    const today = new Date().toISOString().split("T")[0];
    const filePath = path.join(MEMORIES_DIR, `${today}.md`);

    // 检查目录是否存在
    if (!fs.existsSync(MEMORIES_DIR)) {
        console.log(`[Memory Manager] Memories directory does not exist: ${MEMORIES_DIR}`);
        return;
    }

    if (!fs.existsSync(filePath)) {
        console.log(`[Memory Manager] No memory file found for today (${today}).`);
        return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) {
        console.log("[Memory Manager] Memory file is empty.");
        return;
    }

    // 解析记忆条目
    const memories = parseMemoriesFromContent(content);

    if (memories.length === 0) {
        console.log("[Memory Manager] No valid memories to consolidate.");
        return;
    }

    // 按类型分组记忆
    const typeGroups: { [key: string]: MemoryEntry[] } = {};
    for (const memory of memories) {
        if (!typeGroups[memory.type]) {
            typeGroups[memory.type] = [];
        }
        typeGroups[memory.type].push(memory);
    }

    // 生成整合内容
    let consolidatedContent = '';

    // 按类型处理记忆
    for (const [type, typeMemories] of Object.entries(typeGroups)) {
        // 按时间排序
        const sortedMemories = typeMemories.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // 合并同类型的记忆
        const mergedContent = sortedMemories.map(m => m.content).join('\n\n');
        
        // 使用最早的时间戳
        const earliestTimestamp = sortedMemories[0].timestamp;

        consolidatedContent += `## ${type.toUpperCase()} - ${earliestTimestamp}\n\n${mergedContent}\n\n---\n\n`;
    }

    if (consolidatedContent.trim()) {
        // Overwrite with consolidated content
        fs.writeFileSync(filePath, consolidatedContent.trim());
        console.log(`[Memory Manager] Consolidated ${memories.length} memories into ${Object.keys(typeGroups).length} type groups.`);
    }
}