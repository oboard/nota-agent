import { tool } from "ai";
import { z } from "zod";
import { addMemory } from "@/app/actions";

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
 * 保存记忆工具
 * 用于保存值得长期记忆的信息（事实、偏好、想法、重要日期等）
 */
export const saveMemoryTool = tool({
  description: "保存值得长期记忆的信息（事实、偏好、想法、重要日期等）。当用户分享重要信息、个人偏好或其他值得长期保存的内容时使用此工具。",
  inputSchema: z.object({
    content: z.string().describe("提取出的核心记忆内容，简练陈述，不要包含HTML标签、XML参数或其他格式化标记"),
  }),
  execute: async ({ content }) => {
    // 清理记忆内容
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }
    await addMemory(cleanedContent);
    return `已保存记忆：${cleanedContent}`;
  },
});

/**
 * 自动记忆提取工具（用于 onFinish 回调中）
 * 功能与 saveMemoryTool 相同，但描述更简洁
 */
export const autoSaveMemoryTool = tool({
  description: "保存值得长期记忆的信息（事实、偏好、想法等）",
  inputSchema: z.object({
    content: z.string().describe("提取出的核心记忆内容，简练陈述"),
  }),
  execute: async ({ content }) => {
    const cleanedContent = cleanMemoryContent(content);
    if (!isValidMemoryContent(cleanedContent)) {
      return "记忆内容无效或过短，未保存";
    }
    await addMemory(cleanedContent);
    return "记忆已保存";
  },
});