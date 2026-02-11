"use client";

import { useState, useEffect } from "react";
import { getTodos, getRecentMemories } from "./actions";
import { ChatCard } from "@/components/chat-card";
import { TodoCard } from "@/components/todo-card";
import { TodoData } from "@/lib/storage";


type Memory = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
};

export default function Home() {
  const [todos, setTodos] = useState<TodoData[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  const refreshData = async () => {
    const [newTodos, newMemories] = await Promise.all([
      getTodos(),
      getRecentMemories(),
    ]);
    setTodos(newTodos);
    setMemories(newMemories);
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="flex flex-col lg:flex-row w-full flex-1 min-h-0 gap-4 md:p-4 bg-background overflow-visible">
      {/* Left Panel: Chat & Memories - 移动端全宽，桌面端 2/3 */}
      <div className="w-full lg:w-2/3 flex-shrink-0 flex flex-col overflow-visible">
        <ChatCard memories={memories} onRefresh={refreshData} />
      </div>

      {/* Right Panel: Todo List - 移动端全宽，桌面端 1/3 */}
      <div className="w-full lg:w-1/3 flex-shrink-0 flex flex-col overflow-visible">
        <TodoCard todos={todos} onRefresh={refreshData} />
      </div>
    </div>
  );
}