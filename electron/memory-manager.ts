import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { generateEmbedding, ensurePreTodayVectorized, getCachedEmbeddingsForFile } from "./vectorizer.ts";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, ".env") });

const MEMORIES_DIR = path.join(__dirname, "../data/memories");
const LAST_RUN_FILE = path.join(__dirname, "../data/memories/.memory-consolidation-last-run");
const MEMORY_CLUSTERS_FILE = path.join(__dirname, "../data/memories/.memory-clusters.json");

// Initialize AI Model
// Using the same configuration as in app/api/chat/route.ts
const model = createOpenAICompatible({
    name: process.env.CHAT_MODEL_NAME || "",
    baseURL: process.env.MODEL_API_BASE || "https://api.openai.com/v1",
    apiKey: process.env.MODEL_API_KEY,
})(process.env.CHAT_MODEL_NAME || "");

interface MemoryEmbedding {
    content: string;
    timestamp: string;
    embedding: number[];
    type: string;
}

interface MemoryCluster {
    id: string;
    theme: string;
    summary: string;
    memories: MemoryEmbedding[];
    centroid: number[];
    lastUpdated: string;
}

/**
 * 生成文本嵌入向量（简化版本，使用关键词提取）
 */
/** generateEmbedding 已迁移至 vectorizer */

/**
 * 提取关键词用于相似度计算
 */
/** extractKeywords 已迁移至 vectorizer */

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 聚类相似的记忆
 * @param threshold 相似度阈值，默认0.7
 */
async function clusterMemories(memories: MemoryEmbedding[], threshold: number = 0.7): Promise<MemoryCluster[]> {
    const clusters: MemoryCluster[] = [];
    const processed = new Set<number>();

    // 使用分层聚类方法
    for (let i = 0; i < memories.length; i++) {
        if (processed.has(i)) continue;

        const cluster: MemoryCluster = {
            id: `cluster-${Date.now()}-${i}`,
            theme: '',
            summary: '',
            memories: [memories[i]],
            centroid: memories[i].embedding,
            lastUpdated: new Date().toISOString(),
        };

        processed.add(i);

        // 找到相似的记忆
        for (let j = i + 1; j < memories.length; j++) {
            if (processed.has(j)) continue;

            const similarity = cosineSimilarity(memories[i].embedding, memories[j].embedding);
            if (similarity > threshold) { // 使用传入的阈值
                cluster.memories.push(memories[j]);
                processed.add(j);

                // 更新聚类中心
                cluster.centroid = cluster.centroid.map((val, idx) =>
                    (val * (cluster.memories.length - 1) + memories[j].embedding[idx]) / cluster.memories.length
                );
            }
        }

        // 生成聚类摘要
        if (cluster.memories.length > 0) {
            await generateClusterSummary(cluster);
        }

        if (cluster.memories.length > 1) {
            clusters.push(cluster);
        }
    }

    return clusters;
}

/**
 * 生成聚类摘要
 */
async function generateClusterSummary(cluster: MemoryCluster): Promise<void> {
    const contents = cluster.memories.map(m => m.content).join('\n---\n');

    const prompt = `
请为以下记忆聚类生成一个简洁的主题和摘要：

<memories>
${contents}
</memories>

要求：
1. 主题(theme)：用2-4个中文关键词概括这个聚类的核心内容
2. 摘要(summary)：用1-2句话总结这些记忆的主要内容
3. 保持简洁，主题不超过15个字，摘要不超过50个字

只返回JSON格式：
{
  "theme": "关键词1 关键词2",
  "summary": "这些记忆主要关于..."
}
`;

    try {
        const { text } = await generateText({
            model,
            prompt,
            temperature: 0.3,
        });

        const result = JSON.parse(text.trim());
        cluster.theme = result.theme;
        cluster.summary = result.summary;
    } catch (error) {
        console.error("[Memory Manager] Error generating cluster summary:", error);
        cluster.theme = "未分类";
        cluster.summary = `${cluster.memories.length}条相关记忆`;
    }
}

export async function checkAndConsolidateMemories() {
    await ensurePreTodayVectorized();
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
        await compressOldMemories();
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
 * 压缩30天前的记忆到聚类 - 温和压缩长期记忆
 */
async function compressOldMemories() {
    console.log("[Memory Manager] Starting memory compression...");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let allMemories: MemoryEmbedding[] = [];

    // 检查目录是否存在
    if (!fs.existsSync(MEMORIES_DIR)) {
        console.log(`[Memory Manager] Memories directory does not exist: ${MEMORIES_DIR}`);
        return;
    }

    // 读取所有记忆文件（先确保今天之前的文件已向量化缓存）
    await ensurePreTodayVectorized();
    const files = fs.readdirSync(MEMORIES_DIR);
    const mdFiles = files.filter(file => file.endsWith('.md') && !file.startsWith('.'));

    for (const file of mdFiles) {
        const filePath = path.join(MEMORIES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const memories = parseMemoriesFromContent(content, file);
        const cached = getCachedEmbeddingsForFile(file) || [];

        // 只保留30天前的记忆，并从缓存中读取向量（缺失则稍后补算）
        const oldMemories = memories
            .filter(m => new Date(m.timestamp) < thirtyDaysAgo)
            .map(m => {
                const match = cached.find(ci => ci.timestamp === m.timestamp && ci.type === m.type);
                return {
                    ...m,
                    embedding: match ? match.embedding : []
                };
            });

        allMemories.push(...oldMemories);
    }

    if (allMemories.length === 0) {
        console.log("[Memory Manager] No memories older than 30 days to compress.");
        return;
    }

    // 处理长期记忆文件 - 温和压缩
    const longTermFilePath = path.join(MEMORIES_DIR, 'long-term.md');
    if (fs.existsSync(longTermFilePath)) {
        console.log("[Memory Manager] Processing long-term memories...");
        const longTermContent = fs.readFileSync(longTermFilePath, 'utf-8');
        const longTermMemories = parseMemoriesFromContent(longTermContent, 'long-term.md');

        // 长期记忆使用更宽松的标准（90天而不是30天）
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const oldLongTermMemories = longTermMemories.filter(m => new Date(m.timestamp) < ninetyDaysAgo);

        if (oldLongTermMemories.length > 0) {
            console.log(`[Memory Manager] Found ${oldLongTermMemories.length} old long-term memories.`);

            // 为长期记忆生成嵌入（优先使用缓存，缺失则补算）
            const cachedLong = getCachedEmbeddingsForFile('long-term.md') || [];
            const longTermWithEmbeddings = await Promise.all(
                oldLongTermMemories.map(async (memory) => {
                    const match = cachedLong.find(ci => ci.timestamp === memory.timestamp && ci.type === memory.type);
                    if (match && match.embedding && match.embedding.length > 0) {
                        return { ...memory, embedding: match.embedding };
                    }
                    return { ...memory, embedding: await generateEmbedding(memory.content) };
                })
            );

            // 对长期记忆使用更宽松的聚类阈值（0.6而不是0.7）
            const longTermClusters = await clusterMemories(longTermWithEmbeddings, 0.6);

            if (longTermClusters.length > 0) {
                console.log(`[Memory Manager] Created ${longTermClusters.length} long-term memory clusters.`);
                allMemories.push(...longTermWithEmbeddings);
            }
        }
    }

    console.log(`[Memory Manager] Found ${allMemories.length} memories to compress.`);

    // 为所有记忆补齐嵌入（已缓存的直接使用）
    console.log("[Memory Manager] Preparing embeddings with cache...");
    const memoriesWithEmbeddings = await Promise.all(
        allMemories.map(async (memory) => {
            if (memory.embedding && memory.embedding.length > 0) return memory;
            return {
                ...memory,
                embedding: await generateEmbedding(memory.content)
            };
        })
    );

    // 分别处理常规记忆和长期记忆的聚类
    const regularMemories = memoriesWithEmbeddings.filter(m => m.type !== 'long_term');
    const longTermMemories = memoriesWithEmbeddings.filter(m => m.type === 'long_term');

    let allClusters: MemoryCluster[] = [];

    // 聚类常规记忆（使用标准阈值0.7）
    if (regularMemories.length > 0) {
        console.log("[Memory Manager] Clustering regular memories...");
        const regularClusters = await clusterMemories(regularMemories, 0.7);
        allClusters.push(...regularClusters);
    }

    // 聚类长期记忆（使用更宽松阈值0.6）
    if (longTermMemories.length > 0) {
        console.log("[Memory Manager] Clustering long-term memories with gentle threshold...");
        const longTermClusters = await clusterMemories(longTermMemories, 0.6);
        allClusters.push(...longTermClusters);
    }

    // 保存聚类结果
    if (allClusters.length > 0) {
        try {
            fs.writeFileSync(MEMORY_CLUSTERS_FILE, JSON.stringify(allClusters, null, 2));
            console.log(`[Memory Manager] Created ${allClusters.length} total memory clusters.`);
        } catch (error) {
            console.error(`[Memory Manager] Error writing clusters file: ${error}`);
        }

        // 输出聚类摘要，区分长期记忆
        allClusters.forEach((cluster, index) => {
            const isLongTerm = cluster.memories.some(m => m.type === 'long_term');
            const memoryType = isLongTerm ? 'long-term' : 'regular';
            console.log(`[Memory Manager] Cluster ${index + 1} (${memoryType}): ${cluster.theme} (${cluster.memories.length} memories)`);
            console.log(`[Memory Manager] Summary: ${cluster.summary}`);
        });
    }
}

/**
 * 从记忆内容中解析记忆条目
 */
function parseMemoriesFromContent(content: string, fileName: string): MemoryEmbedding[] {
    const memories: MemoryEmbedding[] = [];
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
                        embedding: [], // Will be generated later
                        type: type.toLowerCase(),
                    });
                }
            }
        }
    }

    return memories;
}

/**
 * 整合今天的记忆（基于语义相似性）
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

    // First, parse memories and generate embeddings for intelligent consolidation
    const memories = parseMemoriesFromContent(content, `${today}.md`);

    if (memories.length === 0) {
        console.log("[Memory Manager] No valid memories to consolidate.");
        return;
    }

    // Generate embeddings for intelligent grouping
    console.log("[Memory Manager] Generating embeddings for consolidation...");
    const memoriesWithEmbeddings = await Promise.all(
        memories.map(async (memory) => ({
            ...memory,
            embedding: await generateEmbedding(memory.content)
        }))
    );

    // Group similar memories together
    const groups: MemoryEmbedding[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < memoriesWithEmbeddings.length; i++) {
        if (processed.has(i)) continue;

        const group: MemoryEmbedding[] = [memoriesWithEmbeddings[i]];
        processed.add(i);

        // Find similar memories
        for (let j = i + 1; j < memoriesWithEmbeddings.length; j++) {
            if (processed.has(j)) continue;

            const similarity = cosineSimilarity(
                memoriesWithEmbeddings[i].embedding,
                memoriesWithEmbeddings[j].embedding
            );

            if (similarity > 0.8) { // High similarity threshold for consolidation
                group.push(memoriesWithEmbeddings[j]);
                processed.add(j);
            }
        }

        if (group.length > 1) {
            groups.push(group);
        }
    }

    // Generate consolidated content
    let consolidatedContent = '';

    // Process single memories (not in groups)
    for (let i = 0; i < memoriesWithEmbeddings.length; i++) {
        if (!processed.has(i)) {
            consolidatedContent += `## ${memoriesWithEmbeddings[i].type.toUpperCase()} - ${memoriesWithEmbeddings[i].timestamp}\n\n${memoriesWithEmbeddings[i].content}\n\n---\n\n`;
        }
    }

    // Process groups of similar memories
    for (const group of groups) {
        if (group.length <= 1) continue;

        // Use the earliest timestamp in the group
        const earliestTimestamp = group.reduce((earliest, current) =>
            current.timestamp < earliest.timestamp ? current : earliest
        ).timestamp;

        // Generate consolidated content for the group
        const groupContent = await generateConsolidatedGroupContent(group);

        consolidatedContent += `## ${group[0].type.toUpperCase()} - ${earliestTimestamp}\n\n${groupContent}\n\n---\n\n`;
    }

    if (consolidatedContent.trim()) {
        // Overwrite with consolidated content
        fs.writeFileSync(filePath, consolidatedContent.trim());
        console.log(`[Memory Manager] Consolidated ${memories.length} memories into ${groups.length + (memories.length - processed.size)} entries.`);
    }
}

/**
 * 为相似记忆组生成整合内容
 */
async function generateConsolidatedGroupContent(group: MemoryEmbedding[]): Promise<string> {
    const contents = group.map(m => m.content).join('\n---\n');

    const prompt = `
请将以下相似的记忆条目整合成一个简洁的条目，保留重要信息，去除冗余：

<memories>
${contents}
</memories>

要求：
1. 合并重复的信息
2. 保留所有重要细节
3. 使用简洁清晰的语言
4. 保持原意不变

只返回整合后的内容，不要添加任何解释或格式标记。
`;

    try {
        const { text } = await generateText({
            model,
            prompt,
            temperature: 0.3,
        });

        return text.trim();
    } catch (error) {
        console.error("[Memory Manager] Error generating consolidated content:", error);
        // Fallback: just join the contents
        return contents;
    }
}