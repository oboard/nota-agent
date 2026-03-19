import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages, generateText, type UIMessage } from "ai";
import { addMemory, getRecentMemories, getLongTermMemories, getTodos, saveConversation, saveLinkMetadata, saveChat } from "@/app/actions";
import { urlMetadataExtractor } from "@/lib/url-metadata";
import { skillsManager } from "@/lib/skills-manager";
import {
  createTodoTool,
  completeTodoTool,
  updateTodoTool,
  deleteTodoTool,
  saveMemoryTool,
  saveLongTermMemoryTool,
  autoSaveMemoryTool,
  cleanMemoryContent,
  isValidMemoryContent,
  loadSkillTool,
} from "@/lib/tools";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelName = process.env.CHAT_MODEL_NAME || "gpt-3.5-turbo";
  const model = createOpenAICompatible({
    name: modelName,
    baseURL: process.env.MODEL_API_BASE || "https://api.openai.com/v1",
    apiKey: process.env.MODEL_API_KEY,
  })(modelName)

  // 获取上下文信息和技能
  const [recentMemories, longTermMemories, currentTodos, availableSkills] = await Promise.all([
    getRecentMemories(),
    getLongTermMemories(),
    getTodos(),
    skillsManager.discoverSkills(),
  ]);

  const skillsPrompt = skillsManager.buildSkillsPrompt(availableSkills);

  // 格式化记忆显示
  const longTermMemoriesText = longTermMemories.length > 0
    ? longTermMemories.map(m => `- ${m.content}`).join("\n")
    : "（暂无长期记忆）";

  const recentMemoriesText = recentMemories.length > 0
    ? recentMemories.map(m => `- [${m.createdAt}] ${m.content}`).join("\n")
    : "（暂无近期记忆）";

  const systemPrompt = `你是一个智能助手 NotaAgent。
  你的核心目标是帮助用户整理任务和回答问题。
  
  ## 长期记忆（用户偏好、重要信息、永久记住的内容）：
  ${longTermMemoriesText}
  
  ## 近期记忆（最近的对话关键信息）：
  ${recentMemoriesText}
  
  ## 当前待办事项（ID: 标题）：
  ${currentTodos.map(t => `- ${t.id}: ${t.title}`).join("\n")}
  
  ${skillsPrompt}
  
  你的职责：
  1. 回答用户的问题或与用户对话。
  2. 智能管理待办事项：
      - 首先检查当前待办事项列表，判断用户请求是创建新任务还是更新现有任务
      - 如果用户提到具体时间（几点、小时、分钟、时间段），使用 createTodo 工具，必须设置 startDateTime 和 endDateTime
      - 如果用户只说要做的事情但没有具体时间，使用 createTodo 工具（不设置时间参数）
      - 如果用户表示完成了某个任务，使用 completeTodo 工具直接标记为完成
      - 如果用户说要删除某个任务，使用 deleteTodo 工具删除
      - 如果用户想要修改现有任务（更改标题、描述、时间或优先级），必须使用 updateTodo 工具并通过ID指定任务，不允许通过标题匹配
      - 始终在待办事项列表中向用户显示ID和标题，方便用户引用
      - 如果用户要修改任务信息，使用 updateTodo 工具更新
      - 创建任务时，如果用户提供了相关链接（如文档链接、参考链接等），使用 links 参数保存，key 为链接标题，value 为 URL
  3. 始终保持友善、简洁。
  4. 今天的日期是：${new Date().toLocaleDateString()}。
  5. 当前UTC时间是：${new Date().toISOString()}（注意：这是UTC时间，比北京时间慢8小时）。
  
  重要规则：
  - 当用户说"我完成了"、"做好了"等表达时，智能识别他们指的是哪个任务，并直接使用 completeTodo 工具标记为完成
  - 不要询问用户任务ID，根据当前任务列表智能匹配最相关的任务
  - 任务标题至少需要3个字符，如果用户提供的标题太短，请要求用户提供更详细的描述
  - 提取记忆时，请确保提取的内容是简洁、有意义的文本，不要包含HTML标签、XML参数或其他格式化标记
  - 当用户说"以后..."、"记住..."、"我喜欢..."、"我讨厌..."等表达长期偏好或永久记住的内容时，使用 saveLongTermMemory 工具保存为长期记忆
  `;

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    tools: {
      createTodo: createTodoTool,
      completeTodo: completeTodoTool,
      updateTodo: updateTodoTool,
      deleteTodo: deleteTodoTool,
      loadSkill: loadSkillTool,
      saveMemory: saveMemoryTool,
      saveLongTermMemory: saveLongTermMemoryTool,
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
            saveMemory: autoSaveMemoryTool,
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

      // 保存聊天消息（全局唯一会话）
      try {
        await saveChat(messages);
        console.log(`聊天消息已保存`);
      } catch (error) {
        console.error("Failed to save chat messages:", error);
      }

    },
    onError: (error) => {
      console.error("Error in stream:", JSON.stringify(error, null, 2));
    }
  });

  return result.toUIMessageStreamResponse();
}