import { tool } from "ai";
import { z } from "zod";
import { generateId } from "ai";
import { createTodo, updateTodo, toggleTodo, deleteTodo } from "@/app/actions";
import { TodoData } from "@/lib/storage";

/**
 * 创建待办事项工具
 */
export const createTodoTool = tool({
  description: "创建待办事项。当用户提到具体时间（小时、分钟、时间段）时，必须设置 startDateTime 和 endDateTime。",
  inputSchema: z.object({
    title: z.string().min(3, "任务标题至少需要3个字符").describe("任务标题，简短明确，不要包含时间信息，至少3个字符"),
    description: z.string().optional().describe("任务描述，可选"),
    startDateTime: z.string().optional().describe("开始时间（UTC格式，ISO字符串）。如：2026-02-11T11:57:00.000Z。注意：这是UTC时间，比北京时间慢8小时。当用户提到具体时间时必须设置"),
    endDateTime: z.string().optional().describe("结束时间（UTC格式，ISO字符串）。如：2026-02-11T14:57:00.000Z。注意：这是UTC时间，比北京时间慢8小时。当用户提到具体时间时必须设置"),
    priority: z.number().optional().describe("优先级：1最低，5最高，默认1"),
    links: z.record(z.string(), z.string()).optional().describe("相关链接，key为链接标题，value为URL"),
  }),
  execute: async (data) => {
    if (!data.title || data.title.length < 3) {
      return `错误：任务标题至少需要3个字符。请提供一个更详细的任务标题。`;
    }
    const todoData: TodoData = {
      id: generateId(),
      title: data.title,
      description: data.description,
      priority: data.priority || 1,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (data.startDateTime) {
      todoData.startDateTime = new Date(data.startDateTime);
    }
    if (data.endDateTime) {
      todoData.endDateTime = new Date(data.endDateTime);
    }
    if (data.links) {
      todoData.links = data.links;
    }
    await createTodo(todoData);
    if (data.startDateTime && data.endDateTime) {
      return `已创建任务：${data.title} (UTC时间：${new Date(data.startDateTime).toISOString()} - ${new Date(data.endDateTime).toISOString()})`;
    }
    return `已创建任务：${data.title}`;
  },
});

/**
 * 完成任务工具
 */
export const completeTodoTool = tool({
  description: "完成任务",
  inputSchema: z.object({
    id: z.string().describe("任务ID"),
    title: z.string().optional().describe("任务标题"),
  }),
  execute: async (data) => {
    await toggleTodo(data.id, true);
    return `任务已完成`;
  },
});

/**
 * 更新任务工具
 */
export const updateTodoTool = tool({
  description: "更新任务信息",
  inputSchema: z.object({
    id: z.string().describe("任务ID"),
    title: z.string().optional().describe("新标题"),
    description: z.string().optional().describe("新描述"),
    startDateTime: z.string().optional().describe("新开始时间（ISO格式）"),
    endDateTime: z.string().optional().describe("新结束时间（ISO格式）"),
    priority: z.number().optional().describe("新优先级（1-5）"),
    links: z.record(z.string(), z.string()).optional().describe("相关链接，key为链接标题，value为URL"),
  }),
  execute: async (data) => {
    await updateTodo(data.id, {
      title: data.title,
      description: data.description,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
      priority: data.priority,
      links: data.links,
    });
    return `已更新任务`;
  },
});

/**
 * 删除任务工具
 */
export const deleteTodoTool = tool({
  description: "删除任务",
  inputSchema: z.object({
    id: z.string().describe("任务ID"),
  }),
  execute: async (data) => {
    await deleteTodo(data.id);
    return `任务已删除`;
  },
});