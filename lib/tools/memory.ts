import { tool } from "ai";
import { z } from "zod";
import { promises as fs } from "fs";
import * as path from "path";
import { addMemory, addLongTermMemory, getMemories, getLongTermMemories, getMemoryCategories, updateMemoryCategory, mergeMemoryCategory } from "@/app/actions";
import { storage } from "@/lib/storage";

/**
 * 清理记忆内容，移除HTML标签、XML参数等格式化标记
 */
export function cleanMemoryContent(content: string): string {
  if (!content) return '';

  // 移除HTML/XML标签
  let cleaned = content
    .replace(/<[^>]*>/g, '')                    // 移除HTML/XML标签
    .replace(/&[a-zA-Z]+;/g, '')                // 移除HTML实体
    .replace(/<\/?parameter[^>]*>/gi, '')      // 移除parameter标签
    .replace(/<\/?[^>]+>/g, '')                 // 移除任何其他标签
    .trim();

  // 移除特殊字符和格式化符号
  cleaned = cleaned
    .replace(/^[:：，。！？\s]+/, '')            // 移除开头的标点符号
    .replace(/[:：，。！？\s]+$/, '')            // 移除结尾的标点符号
    .replace(/\s+/g, ' ')                       // 规范化空格
    .trim();

  return cleaned;
}

/**
 * 验证内容是否有实质信息，避免保存空或无效内容
 */
export function isValidMemoryContent(content: string): boolean {
  if (!content || content.length < 3) return false;

  // 先清理内容
  const cleaned = cleanMemoryContent(content);

  // 去除空白字符和常见标点后再检查
  const pureText = cleaned
    .replace(/[：:，。！？\s]/g, '')
    .replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, '')
    .trim();

  // 检查是否为空、只有标点、或特定无效模式
  const invalidPatterns = [
    /^[:：，。！？\s]*$/,           // 只有标点符号
    /^\[链接\]$/,                   // 只有链接占位符
    /^用户说: \s*$/,               // 只有前缀没有内容
    /^用户说: \[链接\]$/,          // 只有前缀和链接占位符
    /^\d+$/,                        // 只有数字
    /^[a-zA-Z]+$/                   // 只有字母，没有实质内容
  ];

  return pureText.length >= 2 && !invalidPatterns.some(pattern => pattern.test(content));
}

/**
 * 判断内容是否应该作为长期记忆保存
 * 长期记忆的特征：用户偏好、长期计划、身份信息、"以后..."相关的表达
 */
export function isLongTermMemoryContent(content: string): boolean {
  const longTermIndicators = [
    /以后/g,           // "以后我想要..."
    /总是/g,           // "我总是..."
    /从来/g,           // "我从来不..."
    /喜欢/g,           // "我喜欢..."
    /讨厌/g,           // "我讨厌..."
    /习惯/g,           // "我的习惯是..."
    /偏好/g,           // "我的偏好是..."
    /目标/g,           // "我的目标是..."
    /计划/g,           // "我计划..."
    /希望/g,           // "我希望..."
    /梦想/g,           // "我的梦想是..."
    /原则/g,           // "我的原则是..."
    /重要/g,           // "对我来说重要的是..."
    /记住/g,           // "记住..."
    /别忘了/g,         // "别忘了..."
    /提醒我/g,         // "提醒我..."
    /永久/g,           // "永久保存..."
    /一直/g,           // "我一直..."
    /我的名字/g,       // 身份信息
    /我叫/g,           // 身份信息
    /生日/g,           // 重要日期
    /电话/g,           // 联系方式
    /邮箱/g,           // 联系方式
    /地址/g,           // 地址信息
  ];

  return longTermIndicators.some(pattern => pattern.test(content));
}

/**
 * 保存记忆工具
 * 用于保存值得长期记忆的信息（事实、偏好、想法、重要日期等）
 * 自动判断是短期记忆还是长期记忆
 */
export const saveMemoryTool = tool({
  description: "保存值得记忆的信息（事实、偏好、想法、重要日期等）。当用户分享重要信息、个人偏好或其他值得保存的内容时使用此工具。系统会自动判断是短期记忆还是长期记忆。",
  inputSchema: z.object({
    content: z.string().describe("提取出的核心记忆内容，简练陈述，不要包含HTML标签、XML参数或其他格式化标记"),
    category: z.string().optional().describe("记忆分类，例如 工作、生活"),
  }),
  execute: async ({ content, category }) => {
    // 清理记忆内容
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }

    // 判断是长期记忆还是短期记忆
    const isLongTerm = isLongTermMemoryContent(cleanedContent);

    if (isLongTerm) {
      await addLongTermMemory(cleanedContent, { category, categorySource: "agent" });
      return `已保存为长期记忆：${cleanedContent}`;
    } else {
      await addMemory(cleanedContent, { category, categorySource: "agent" });
      return `已保存记忆：${cleanedContent}`;
    }
  },
});

/**
 * 保存长期记忆工具
 * 明确保存为长期记忆
 */
export const saveLongTermMemoryTool = tool({
  description: "保存为长期记忆。当用户明确表示这是长期偏好、永久记住的信息，或使用'以后...'、'记住...'等表达时使用。",
  inputSchema: z.object({
    content: z.string().describe("提取出的核心长期记忆内容，简练陈述"),
    category: z.string().optional().describe("记忆分类，例如 工作、生活"),
  }),
  execute: async ({ content, category }) => {
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }
    await addLongTermMemory(cleanedContent, { category, categorySource: "agent" });
    return `已保存为长期记忆：${cleanedContent}`;
  },
});

/**
 * 检索相关记忆工具
 * 根据当前上下文检索最相关的记忆
 */
export const retrieveRelevantMemoriesTool = tool({
  description: "根据当前对话上下文检索最相关的记忆。当需要参考用户的历史信息、偏好或上下文时使用此工具。",
  inputSchema: z.object({
    context: z.string().describe("当前对话上下文或需要检索相关信息的主题"),
    limit: z.number().optional().describe("返回的记忆数量限制，默认5条").default(5),
    category: z.string().optional().describe("只检索指定分类"),
  }),
  execute: async ({ context, limit, category }) => {
    const relevantMemories = await storage.getRelevantMemories(context, limit, { category });

    if (relevantMemories.length === 0) {
      return "未找到相关记忆";
    }

    return `找到${relevantMemories.length}条相关记忆：\n` +
      relevantMemories.map((memory, index) =>
        `${index + 1}. ${memory.content} (${new Date(memory.createdAt).toLocaleDateString('zh-CN')})`
      ).join('\n');
  },
});

/**
 * 搜索记忆工具
 * 根据关键词搜索记忆内容，支持正则表达式
 */
export const memoryGrepTool = tool({
  description: "搜索记忆内容。当用户想要查找之前保存的特定记忆时使用此工具。支持关键词搜索和正则表达式。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词或正则表达式"),
    limit: z.number().optional().describe("返回结果数量限制，默认20条").default(20),
    category: z.string().optional().describe("只搜索指定分类"),
  }),
  execute: async ({ query, limit, category }) => {
    const results = await storage.searchMemories(query, limit, { category });

    if (results.length === 0) {
      return `未找到与"${query}"相关的记忆`;
    }

    return `找到${results.length}条相关记忆：\n` +
      results.map((memory, index) =>
        `${index + 1}. ${memory.content}\n   [${new Date(memory.createdAt).toLocaleDateString('zh-CN')} - ${memory.type}]`
      ).join('\n\n');
  },
});

export const listMemoryCategoriesTool = tool({
  description: "列出当前可用的记忆分类，便于查看有哪些分类可检索或管理。",
  inputSchema: z.object({}),
  execute: async () => {
    const categories = await getMemoryCategories();
    if (categories.length === 0) return "暂无记忆分类";
    return categories.map((category, index) => `${index + 1}. ${category.name}${category.disabled ? "（已停用）" : ""}`).join('\n');
  },
});

export const reclassifyMemoryTool = tool({
  description: "修改单条记忆的分类。",
  inputSchema: z.object({
    memoryId: z.string().describe("记忆 ID"),
    category: z.string().optional().describe("新分类，留空表示清空分类"),
  }),
  execute: async ({ memoryId, category }) => {
    const updated = await updateMemoryCategory(memoryId, category ?? null);
    return updated ? `已更新记忆分类：${memoryId}` : `未找到记忆：${memoryId}`;
  },
});

export const mergeMemoryCategoriesTool = tool({
  description: "将一个分类合并到另一个分类。",
  inputSchema: z.object({
    fromCategory: z.string().describe("来源分类"),
    toCategory: z.string().optional().describe("目标分类，留空表示清空来源分类"),
  }),
  execute: async ({ fromCategory, toCategory }) => {
    const updatedCount = await mergeMemoryCategory(fromCategory, toCategory ?? null);
    return `已处理 ${updatedCount} 个文件中的分类迁移`;
  },
});

/**
 * 压缩今天记忆文件的工具
 * 读取当天 memories/{today}.md，调用 LLM 语义去重后写回
 */
export const compressMemoriesTool = tool({
  description: "压缩今天的记忆文件，将重复或高度相似的记忆条目通过 LLM 语义去重合并，减少冗余。当你发现记忆里有很多重复内容时主动调用。",
  inputSchema: z.object({
    date: z.string().optional().describe("要压缩的日期，格式 YYYY-MM-DD，留空表示今天"),
  }),
  execute: async ({ date }) => {
    const today = date || new Date().toISOString().split("T")[0];
    const memoriesDir = path.join(process.cwd(), "data/memories");
    const filePath = path.join(memoriesDir, `${today}.md`);

    // 读取文件
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (err: any) {
      if (err.code === "ENOENT") return `${today} 没有找到记忆文件`;
      throw err;
    }

    if (!content.trim()) return "记忆文件为空，无需压缩";

    // 解析所有条目（复用与 memory-manager 相同的逻辑）
    interface MemEntry { id: string; content: string; timestamp: string; type: string; category?: string | null; categorySource?: string | null; }
    const fileName = `${today}.md`;
    const entries: MemEntry[] = [];
    for (const entry of content.split("---")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const lines = trimmed.split("\n");
      const headerLine = lines.find(l => l.startsWith("## "));
      if (!headerLine) continue;
      const m = headerLine.match(/^##\s+(\w+)((?:\s+\|[^|]+)*)\s+-\s+(\d{4}-\d{2}-\d{2}T[\d:.Z]+)$/);
      if (!m) continue;
      const [, type, metaRaw = "", timestamp] = m;
      const meta: Record<string, string> = {};
      for (const part of metaRaw.split("|")) {
        const kv = part.trim();
        if (!kv) continue;
        const eq = kv.indexOf("=");
        if (eq === -1) continue;
        meta[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
      }
      const body = lines.slice(lines.indexOf(headerLine) + 1).join("\n").trim();
      if (!body || body.length < 3) continue;
      entries.push({ id: meta["id"] || `${fileName}-${timestamp}`, content: body, timestamp, type: type.toLowerCase(), category: meta["category"] || null, categorySource: meta["source"] || null });
    }

    if (entries.length <= 1) return `只有 ${entries.length} 条记忆，无需压缩`;

    const before = entries.length;

    // 按 type 分组，各组调用 LLM 去重
    const groups = new Map<string, MemEntry[]>();
    for (const e of entries) {
      if (!groups.has(e.type)) groups.set(e.type, []);
      groups.get(e.type)!.push(e);
    }

    const apiBase = process.env.MODEL_API_BASE || "https://api.openai.com/v1";
    const apiKey = process.env.MODEL_API_KEY;
    const modelName = process.env.CHAT_MODEL_NAME || "gpt-3.5-turbo";

    const outputParts: string[] = [];
    let totalAfter = 0;

    for (const [, group] of groups) {
      if (group.length < 2) {
        const e = group[0];
        const parts: string[] = [];
        if (e.id) parts.push(`id=${e.id}`);
        if (e.category) parts.push(`category=${e.category}`);
        if (e.categorySource) parts.push(`source=${e.categorySource}`);
        const meta = parts.length > 0 ? ` | ${parts.join(" | ")}` : "";
        outputParts.push(`## ${e.type.toUpperCase()}${meta} - ${e.timestamp}\n\n${e.content}`);
        totalAfter += 1;
        continue;
      }

      let mergedContents: string[] = group.map(e => e.content);
      if (apiKey) {
        const numbered = group.map((e, i) => `${i + 1}. ${e.content}`).join("\n");
        const prompt = `下面是一批记忆条目，请对其进行语义去重和压缩：\n- 将表达相同或高度相似意思的条目合并为一条，保留最完整的表述\n- 保留所有独立、不重复的信息，不要遗漏\n- 每条输出一行，不加序号，不加多余格式\n- 只输出合并后的条目内容，每条占一行\n\n记忆列表：\n${numbered}`;
        try {
          const resp = await fetch(`${apiBase}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({ model: modelName, messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
          });
          if (resp.ok) {
            const data = await resp.json() as any;
            const text: string = data.choices?.[0]?.message?.content || "";
            const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            if (lines.length > 0) mergedContents = lines;
          }
        } catch { /* 降级：保留原内容 */ }
      }

      const template = group[0];
      const now = new Date().toISOString();
      for (let i = 0; i < mergedContents.length; i++) {
        const parts: string[] = [];
        const newId = `${today}.md-${now}-compressed-${i}`;
        parts.push(`id=${newId}`);
        if (template.category) parts.push(`category=${template.category}`);
        if (template.categorySource) parts.push(`source=${template.categorySource}`);
        const meta = ` | ${parts.join(" | ")}`;
        outputParts.push(`## ${template.type.toUpperCase()}${meta} - ${now}\n\n${mergedContents[i]}`);
      }
      totalAfter += mergedContents.length;
    }

    const newContent = outputParts.join("\n\n---\n\n") + "\n\n---\n\n";
    await fs.writeFile(filePath, newContent, "utf-8");

    return `压缩完成：${before} 条 → ${totalAfter} 条（${today}）`;
  },
});

/**
 * 自动记忆提取工具（用于 onFinish 回调中）
 * 功能与 saveMemoryTool 相同，但描述更简洁
 */
export const autoSaveMemoryTool = tool({
  description: "保存值得长期记忆的信息（事实、偏好、想法等）。自动判断是短期还是长期记忆，并触发智能聚类。",
  inputSchema: z.object({
    content: z.string().describe("提取出的核心记忆内容，简练陈述"),
  }),
  execute: async ({ content }) => {
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }

    const isLongTerm = isLongTermMemoryContent(cleanedContent);

    if (isLongTerm) {
      await addLongTermMemory(cleanedContent);
      return "已保存为长期记忆，将触发智能聚类";
    } else {
      await addMemory(cleanedContent);
      return "记忆已保存，将触发智能处理";
    }
  },
});
