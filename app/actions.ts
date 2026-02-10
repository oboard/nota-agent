"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Todo Actions
export async function getTodos() {
  const todos = await prisma.todo.findMany({
    orderBy: [
      { completed: "asc" },
      { priority: "desc" },
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
  });
  return todos;
}

export async function createTodo(data: {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: number;
}) {
  const todo = await prisma.todo.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      priority: data.priority || 1,
    },
  });
  revalidatePath("/");
  return todo;
}

export async function toggleTodo(id: number, completed: boolean) {
  await prisma.todo.update({
    where: { id },
    data: { completed },
  });
  revalidatePath("/");
}

export async function deleteTodo(id: number) {
  await prisma.todo.delete({
    where: { id },
  });
  revalidatePath("/");
}

// Memory Actions
export async function addMemory(content: string, type: string = "memory") {
  await prisma.memory.create({
    data: {
      content,
      type,
    },
  });
  revalidatePath("/");
}

export async function getMemories() {
  return await prisma.memory.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getRecentMemories() {
  return await prisma.memory.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}