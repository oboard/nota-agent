"use server";

import { storage } from "@/lib/storage";
import { ChatStorage, ChatData } from "@/lib/chat-storage";
import { revalidatePath } from "next/cache";
import { readFile, readdir } from 'fs/promises';
import path from 'path';

// Todo Actions
export async function getTodos() {
  const todos = await storage.getTodos();
  return todos.sort((a, b) => {
    // 按完成状态、优先级、开始时间、创建时间排序
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.startDateTime && b.startDateTime) return a.startDateTime.getTime() - b.startDateTime.getTime();
    if (a.startDateTime && !b.startDateTime) return -1;
    if (!a.startDateTime && b.startDateTime) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function createTodo(data: {
  title: string;
  description?: string;
  startDateTime?: Date;
  endDateTime?: Date;
  priority?: number;
  cron?: string;
}) {
  const todo = await storage.saveTodo({
    title: data.title,
    description: data.description,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    priority: data.priority || 1,
    completed: false,
    cron: data.cron,
  });
  revalidatePath("/");
  return todo;
}

export async function toggleTodo(id: string, completed: boolean) {
  await storage.toggleTodo(id, completed);
  revalidatePath("/");
}

export async function updateTodo(id: string, data: {
  title?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  priority?: number;
  completed?: boolean;
}) {
  // 获取所有 todos
  const todos = await storage.getTodos();
  const todo = todos.find(t => t.id === id);

  if (todo) {
    // 更新提供的字段
    if (data.title !== undefined) todo.title = data.title;
    if (data.description !== undefined) todo.description = data.description;
    if (data.startDateTime !== undefined) todo.startDateTime = new Date(data.startDateTime);
    if (data.endDateTime !== undefined) todo.endDateTime = new Date(data.endDateTime);
    if (data.priority !== undefined) todo.priority = data.priority;
    if (data.completed !== undefined) todo.completed = data.completed;
    todo.updatedAt = new Date();

    // 保存回存储
    await storage.saveTodos(todos);
    revalidatePath("/");
  }
}

export async function deleteTodo(id: string) {
  await storage.deleteTodo(id);
  revalidatePath("/");
}

// Memory Actions
export async function addMemory(content: string) {
  await storage.addMemory(content);
  revalidatePath("/");
}

export async function getMemories() {
  return await storage.getMemories(50);
}

export async function getRecentMemories() {
  return await storage.getRecentMemories(20);
}

// Conversation Actions - 不再持久化，返回空数组
export async function saveConversation(
  message: string,
  response: string,
) {
  // 对话记录不再持久化，每次刷新页面都是空的
  revalidatePath("/");
}

export async function getConversations(cursor?: number, limit: number = 20) {
  // 返回空数组，因为对话记录不持久化
  return [];
}

// Chat Actions
export async function createChat(): Promise<string> {
  const chatStorage = new ChatStorage();
  const chatId = await chatStorage.createChat();
  revalidatePath("/");
  return chatId;
}

export async function loadChat(page: number = 1, pageSize: number = 20) {
  const chatStorage = new ChatStorage();
  return chatStorage.loadChat(page, pageSize);
}

export async function saveChat(messages: any[]) {
  const chatStorage = new ChatStorage();
  // 采用全局唯一会话存储，不再区分 chatId
  await chatStorage.saveChat('global', messages);
  revalidatePath("/");
}

export async function getRecentChats(limit: number = 5) {
  const chatStorage = new ChatStorage();
  const dataDir = 'data/chats';
  const files = await readdir(dataDir);
  const jsonFiles = files.filter(file => file.match(/^\d{4}-\d{2}-\d{2}\.json$/));
  const allChats: ChatData[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(dataDir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      const chats: ChatData[] = JSON.parse(content);
      allChats.push(...chats);
    } catch (error) {
      console.error(`Failed to read chat file ${file}:`, error);
    }
  }

  // 按更新时间排序并返回最近的聊天
  return allChats
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export async function loadMoreMessages(beforeMessageId?: string, limit: number = 20) {
  const chatStorage = new ChatStorage();
  // 加载所有消息并过滤
  const allMessages = await chatStorage.loadChat(1, 1000); // 获取足够多的消息

  if (beforeMessageId) {
    const beforeIndex = allMessages.findIndex(msg => msg.id === beforeMessageId);
    if (beforeIndex >= 0) {
      return allMessages.slice(0, beforeIndex).slice(-limit);
    }
  }

  return allMessages.slice(-limit);
}

export async function getAvailableDates() {
  const dataDir = 'data/chats';
  let files: string[] = [];
  try {
    files = await readdir(dataDir);
  } catch {
    files = [];
  }

  // 支持两种命名：YYYY-MM-DD.json 和 chat-YYYY-MM-DD.json
  const fileEntries = files.filter(file => file.match(/^(chat-)?\d{4}-\d{2}-\d{2}\.json$/));

  const items: { date: string; fileName: string; chatCount: number }[] = [];
  for (const file of fileEntries) {
    const match = file.match(/^(?:chat-)?(\d{4})-(\d{2})-(\d{2})\.json$/);
    if (match) {
      const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
      let chatCount = 0;
      try {
        const content = await readFile(path.join(dataDir, file), 'utf-8');
        const chats: ChatData[] = JSON.parse(content);
        chatCount = chats.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
      } catch {
        // 忽略读取失败，保留日期项
      }
      items.push({ date: dateStr, fileName: file, chatCount });
    }
  }

  // 确保今天在最上方，即使文件尚未生成
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!items.some(i => i.date === todayStr)) {
    items.unshift({ date: todayStr, fileName: `${todayStr}.json`, chatCount: 0 });
  }

  // 按日期降序（今天在上）
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return items;
}

export async function scrollToDate(targetDate: string) {
  const dataDir = 'data/chats';
  const fileName = `${targetDate}.json`;
  const filePath = path.join(dataDir, fileName);

  try {
    const content = await readFile(filePath, 'utf-8');
    const chats: ChatData[] = JSON.parse(content);
    const messages = chats.flatMap(c => c.messages || []);

    return {
      messages,
      hasMore: false
    };
  } catch (error) {
    console.error(`Failed to read chat file for date ${targetDate}:`, error);
  }

  return {
    messages: [],
    hasMore: false
  };
}

// Link Metadata Actions
export async function saveLinkMetadata(data: {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  favicon?: string;
  extractedAt: string;
}) {
  const metadata = await storage.saveLinkMetadata(data);
  revalidatePath("/");
  return metadata;
}

export async function getLinkMetadata() {
  return await storage.getLinkMetadata();
}

export async function getRecentLinkMetadata(limit: number = 20) {
  return await storage.getRecentLinkMetadata(limit);
}