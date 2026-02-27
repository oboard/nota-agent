import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, tool, generateObject, convertToModelMessages, generateText, type UIMessage } from "ai";
import { z } from "zod";
import { createTodo, updateTodo, toggleTodo, deleteTodo, addMemory, getRecentMemories, getTodos, saveConversation, saveLinkMetadata, saveChat } from "@/app/actions";
import { urlMetadataExtractor } from "@/lib/url-metadata";
import { skillsManager } from "@/lib/skills-manager";

export const maxDuration = 30;

/**
 * 清理记忆内容，移除HTML标签、XML参数等格式化标记
 */
function cleanMemoryContent(content: string): string {
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
function isValidMemoryContent(content: string): boolean {
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

export async function POST(req: Request) {
  const chatId = req.headers.get('X-Chat-ID');
  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelName = process.env.AI_MODEL_NAME || "gpt-3.5-turbo";

  const model = createOpenAICompatible({
    name: modelName,
    baseURL: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
  })(modelName)

  // 获取上下文信息和技能
  const [recentMemories, currentTodos, availableSkills] = await Promise.all([
    getRecentMemories(),
    getTodos(),
    skillsManager.discoverSkills(),
  ]);

  const skillsPrompt = skillsManager.buildSkillsPrompt(availableSkills);

  const systemPrompt = `你是一个智能助手 NotaAgent。
  你的核心目标是帮助用户整理任务和回答问题。
  
  当前已有记忆：
  ${recentMemories.map(m => `- [${m.createdAt}] ${m.content}`).join("\n")}
  
  当前待办事项：
  ${currentTodos}
  
  ${skillsPrompt}
  
  你的职责：
  1. 回答用户的问题或与用户对话。
  2. 智能管理待办事项：
      - 如果用户提到具体时间（几点、小时、分钟、时间段），使用 createTodo 工具，必须设置 startDateTime 和 endDateTime
      - 如果用户只说要做的事情但没有具体时间，使用 createSimpleTodo 工具
      - 如果用户表示完成了某个任务，使用 completeTodo 工具直接标记为完成
      - 如果用户说要删除某个任务，使用 deleteTodo 工具删除
      - 如果用户要修改任务信息，使用 updateTodo 工具更新
  3. 始终保持友善、简洁。
  4. 今天的日期是：${new Date().toLocaleDateString()}。
  5. 当前UTC时间是：${new Date().toISOString()}（注意：这是UTC时间，比北京时间慢8小时）。
  
  重要规则：
  - 当用户说"我完成了"、"做好了"等表达时，智能识别他们指的是哪个任务，并直接使用 completeTodo 工具标记为完成
  - 不要询问用户任务ID，根据当前任务列表智能匹配最相关的任务
  - 工具选择：有时间要求用 createTodo，无时间要求用 createSimpleTodo
  - 提取记忆时，请确保提取的内容是简洁、有意义的文本，不要包含HTML标签、XML参数或其他格式化标记
  `;

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    tools: {
      createTodo: tool({
        description: "创建待办事项。当用户提到具体时间（小时、分钟、时间段）时，必须设置 startDateTime 和 endDateTime。",
        inputSchema: z.object({
          title: z.string().describe("任务标题，简短明确，不要包含时间信息"),
          description: z.string().optional().describe("任务描述，可选"),
          startDateTime: z.string().describe("开始时间（UTC格式，ISO字符串）。如：2026-02-11T11:57:00.000Z。注意：这是UTC时间，比北京时间慢8小时。当用户提到具体时间时必须设置"),
          endDateTime: z.string().describe("结束时间（UTC格式，ISO字符串）。如：2026-02-11T14:57:00.000Z。注意：这是UTC时间，比北京时间慢8小时。当用户提到具体时间时必须设置"),
          priority: z.number().optional().describe("优先级：1最低，5最高，默认1"),
        }),
        execute: async (data) => {
          const todoData = {
            title: data.title,
            description: data.description,
            startDateTime: new Date(data.startDateTime),
            endDateTime: new Date(data.endDateTime),
            priority: data.priority || 1,
          };
          await createTodo(todoData);
          return `已创建任务：${data.title} (UTC时间：${new Date(data.startDateTime).toISOString()} - ${new Date(data.endDateTime).toISOString()})`;
        },
      }),
      createSimpleTodo: tool({
        description: "创建简单待办事项（无时间要求）",
        inputSchema: z.object({
          title: z.string().describe("任务标题"),
          description: z.string().optional().describe("任务描述"),
          priority: z.number().optional().describe("优先级：1最低，5最高，默认1"),
        }),
        execute: async (data) => {
          await createTodo({
            title: data.title,
            description: data.description,
            priority: data.priority || 1,
          });
          return `已创建任务：${data.title}`;
        },
      }),
      completeTodo: tool({
        description: "完成任务",
        inputSchema: z.object({
          id: z.string().describe("任务ID"),
          title: z.string().optional().describe("任务标题"),
        }),
        execute: async (data) => {
          await toggleTodo(data.id, true);
          return `任务已完成`;
        },
      }),
      updateTodo: tool({
        description: "更新任务信息",
        inputSchema: z.object({
          id: z.string().describe("任务ID"),
          title: z.string().optional().describe("新标题"),
          description: z.string().optional().describe("新描述"),
          startDateTime: z.string().optional().describe("新开始时间（ISO格式）"),
          endDateTime: z.string().optional().describe("新结束时间（ISO格式）"),
          priority: z.number().optional().describe("新优先级（1-5）"),
        }),
        execute: async (data) => {
          await updateTodo(data.id, {
            title: data.title,
            description: data.description,
            startDateTime: data.startDateTime,
            endDateTime: data.endDateTime,
            priority: data.priority,
          });
          return `已更新任务`;
        },
      }),
      deleteTodo: tool({
        description: "删除任务",
        inputSchema: z.object({
          id: z.string().describe("任务ID"),
        }),
        execute: async (data) => {
          await deleteTodo(data.id);
          return `任务已删除`;
        },
      }),
      loadSkill: tool({
        description: "加载指定技能以获取专业指令",
        inputSchema: z.object({
          name: z.string().describe("要加载的技能名称"),
        }),
        execute: async ({ name }) => {
          const skill = await skillsManager.loadSkill(name);
          if (!skill) {
            return { error: `技能 '${name}' 未找到` };
          }

          return {
            skillDirectory: skill.metadata.path,
            content: skill.content,
            metadata: skill.metadata,
          };
        },
      }),
    },
    onFinish: async ({ text }) => {
      // 保存对话记录

      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage.role !== 'user') return;

      // Extract text from parts
      const userContent = lastUserMessage.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');

      // 保存到数据库
      await saveConversation(userContent, text);

      // 提取并保存URL元数据
      try {
        const urlMetadataList = await urlMetadataExtractor.extractAndFetchMetadata(userContent);
        if (urlMetadataList.length > 0) {
          // 保存所有提取到的链接元数据
          await Promise.all(
            urlMetadataList.map(metadata =>
              saveLinkMetadata({
                url: metadata.url,
                title: metadata.title,
                description: metadata.description,
                image: metadata.image,
                siteName: metadata.siteName,
                type: metadata.type,
                favicon: metadata.favicon,
                extractedAt: metadata.extractedAt,
              })
            )
          );
          console.log(`已保存 ${urlMetadataList.length} 个链接的元数据`);
        }
      } catch (error) {
        console.error("Failed to extract URL metadata:", error);
      }

      // 提取记忆
      try {
        const memoryResult = await generateText({
          model,
          tools: {
            saveMemory: tool({
              description: "保存值得长期记忆的信息（事实、偏好、想法等）",
              inputSchema: z.object({
                content: z.string().describe("提取出的核心记忆内容，简练陈述"),
              }),
              execute: async (args) => {
                await addMemory(args.content);
                return "记忆已保存";
              }
            }),
          },
          prompt: `分析用户的最新输入和你的回复，判断是否包含值得长期记忆的关键信息（如事实、用户偏好、重要日期、想法等）。
            
            用户输入: ${userContent}
            你的回复: ${text}
            
            如果包含有用信息，请调用 saveMemory 工具保存。
            如果是简单的问候、询问 factual 问题（如"天气如何"）或单纯的任务指令（如"创建一个任务"），则不要保存。
            
            重要：提取的记忆内容必须是简洁、有意义的文本，不能包含：
            - HTML标签
            - XML标签或参数
            - 格式化标记如 <parameter>、> 等
            - 代码块或特殊符号
            请确保提取的内容是纯文本，易于人类阅读。
            `,
        });

        // 如果没有保存任何记忆，则直接将用户输入保存为记忆
        if (!memoryResult.toolCalls || memoryResult.toolCalls.length === 0) {
          // 简化用户输入作为记忆，去除URL链接和多余空格
          const simplifiedContent = userContent
            .replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, '[链接]')
            .trim();

          // 使用更全面的内容验证，先清理再验证
          const cleanedContent = cleanMemoryContent(simplifiedContent);
          const memoryText = `用户说: ${cleanedContent}`;
          if (isValidMemoryContent(memoryText)) {
            await addMemory(memoryText);
            console.log("没有提取到记忆，已保存用户原话作为记忆");
          } else {
            console.log("用户输入内容过短或无实质内容，跳过记忆保存");
          }
        }
      } catch (error) {
        console.error("Failed to extract memory:", error);
        // 如果记忆提取失败，也尝试保存用户输入
        try {
          const simplifiedContent = userContent
            .replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, '[链接]')
            .trim();

          // 使用更全面的内容验证，先清理再验证
          const cleanedContent = cleanMemoryContent(simplifiedContent);
          const memoryText = `用户说: ${cleanedContent}`;
          if (isValidMemoryContent(memoryText)) {
            await addMemory(memoryText);
            console.log("记忆提取失败，已保存用户原话作为记忆");
          } else {
            console.log("用户输入内容过短或无实质内容，跳过记忆保存");
          }
        } catch (backupError) {
          console.error("Backup memory save also failed:", backupError);
        }
      }

      // 保存聊天消息（如果提供了chatId）
      if (chatId) {
        try {
          // 消息已经通过 ChatStorage 的 normalizeMessages 方法处理，不需要额外处理时间戳
          await saveChat(chatId, messages);
          console.log(`聊天消息已保存到聊天 ${chatId}`);
        } catch (error) {
          console.error("Failed to save chat messages:", error);
        }
      }

    }
  });

  return result.toUIMessageStreamResponse();
}