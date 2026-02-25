"use server";

import { storage } from "@/lib/storage";
import { chatStorage } from "@/lib/chat-storage";
import { revalidatePath } from "next/cache";

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
  const chatId = await chatStorage.createChat();
  revalidatePath("/");
  return chatId;
}

export async function loadChat(chatId: string) {
  const messages = await chatStorage.loadChat(chatId);
  return messages;
}

export async function saveChat(chatId: string, messages: any[]) {
  await chatStorage.saveChat(chatId, messages);
  revalidatePath("/");
}

export async function getRecentChats(limit: number = 5) {
  const chats = await chatStorage.getRecentChats(limit);
  return chats;
}

export async function loadMoreMessages(chatId: string, beforeMessageId?: string, limit: number = 20) {
  const messages = await chatStorage.loadMoreMessages(chatId, beforeMessageId, limit);
  return messages;
}

export async function getAvailableDates() {
  const dates = await chatStorage.getAvailableDates();
  return dates;
}

export async function scrollToDate(chatId: string, targetDate: string) {
  const result = await chatStorage.scrollToDate(chatId, targetDate);
  return result;
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