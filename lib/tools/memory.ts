import { tool } from "ai";
import { z } from "zod";
import { addMemory, addLongTermMemory, getMemories, getLongTermMemories } from "@/app/actions";
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
  }),
  execute: async ({ content }) => {
    // 清理记忆内容
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }

    // 判断是长期记忆还是短期记忆
    const isLongTerm = isLongTermMemoryContent(cleanedContent);

    if (isLongTerm) {
      await addLongTermMemory(cleanedContent);
      return `已保存为长期记忆：${cleanedContent}`;
    } else {
      await addMemory(cleanedContent);
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
  }),
  execute: async ({ content }) => {
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }
    await addLongTermMemory(cleanedContent);
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
  }),
  execute: async ({ context, limit }) => {
    const relevantMemories = await storage.getRelevantMemories(context, limit);

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
 * 获取记忆洞察工具
 * 分析用户的记忆模式，提供洞察
 */
export const getMemoryInsightsTool = tool({
  description: "分析用户的记忆模式和偏好，提供洞察。当需要了解用户的长期行为模式或偏好时使用。",
  inputSchema: z.object({}),
  execute: async () => {
    const clusters = await storage.getMemoryClusters();
    const insights = await storage.getMemoryClusters();

    if (insights.length === 0) {
      return "暂无足够的记忆数据来生成洞察";
    }

    return "基于您的记忆分析：\n" + insights.map(insight => `• ${insight}`).join('\n');
  },
});

/**
 * 压缩记忆工具
 * 将旧记忆压缩成聚类，减少存储空间
 */
export const compressMemoriesTool = tool({
  description: "压缩30天前的记忆，将其聚类成主题摘要。当记忆过多或需要整理时使用。",
  inputSchema: z.object({}),
  execute: async () => {
    const clusters = await storage.compressMemories();

    if (clusters.length === 0) {
      return "没有需要压缩的记忆";
    }

    return `已压缩${clusters.length}个记忆主题：\n` +
      clusters.map(cluster =>
        `• ${cluster.theme}: ${cluster.memories.length}条记忆，摘要：${cluster.summary}`
      ).join('\n');
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