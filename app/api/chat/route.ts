import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, tool, generateObject } from "ai";
import { z } from "zod";
import { createTodo, addMemory, getRecentMemories, getTodos } from "@/app/actions";

export const maxDuration = 30;



export async function POST(req: Request) {
  const { messages, mode = "memory" } = await req.json();

  const model = createOpenAICompatible({
    name: "Kimi-K2.5",
    baseURL: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
  })("Kimi-K2.5")

  // 获取上下文信息
  const [recentMemories, currentTodos] = await Promise.all([
    getRecentMemories(),
    getTodos(),
  ]);

  const systemPrompt = `你是一个智能助手 NotaAgent。
你的核心目标是帮助用户整理任务和回答问题。

当前已有记忆：
${recentMemories.map(m => `- [${m.createdAt.toISOString()}] ${m.content}`).join("\n")}

当前待办事项：
${currentTodos.map(t => `- [${t.completed ? "x" : " "}] ${t.title} (Priority: ${t.priority})`).join("\n")}

你的职责：
1. 回答用户的问题或与用户对话。
2. 如果用户提到需要做的事情，使用 createTodo 工具创建待办事项。
3. 始终保持友善、简洁。
4. 今天的日期是：${new Date().toLocaleDateString()}。

当前模式：${mode}
在"memory"模式下，用户主要在进行记录，你可以简短确认。
在"question"模式下，你需要详细回答用户的问题。
`;

  const result = streamText({
    model,
    messages,
    system: systemPrompt,
    tools: {
      createTodo: tool({
        description: "创建一个新的待办事项",
        inputSchema: z.object({
          title: z.string().describe("待办事项的标题"),
          description: z.string().optional().describe("待办事项的详细描述"),
          dueDate: z.string().optional().describe("截止日期 (YYYY-MM-DD)"),
          priority: z.number().optional().describe("优先级 (1-5, 5最高)"),
        }),
        execute: async (data, options) => {
          await createTodo(data);
          return `已创建待办事项: ${data.title}`;
        },
      }),
    },
    onFinish: async ({ text }) => {
      // 异步提取记忆，不阻塞响应
      try {
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage.role !== 'user') return;

        const memoryExtraction = await generateObject({
          model,
          schema: z.object({
            hasUsefulInformation: z.boolean().describe("是否包含值得长期记忆的信息（事实、偏好、想法等），任务指令除外"),
            memoryContent: z.string().optional().describe("提取出的核心记忆内容，简练陈述"),
          }),
          prompt: `分析用户的最新输入和你的回复，提取值得记忆的关键信息。
          
          用户输入: ${lastUserMessage.content}
          你的回复: ${text}
          
          只提取事实、用户偏好、重要日期、想法等长期有用的信息。
          如果是简单的问候、询问 factual 问题（如"天气如何"）或单纯的任务指令（如"创建一个任务"），则不要提取。
          `,
        });

        if (memoryExtraction.object.hasUsefulInformation && memoryExtraction.object.memoryContent) {
          console.log("Saving memory:", memoryExtraction.object.memoryContent);
          await addMemory(memoryExtraction.object.memoryContent);
        }
      } catch (error) {
        console.error("Failed to extract memory:", error);
      }
    },
  });

  return result.toTextStreamResponse();
}