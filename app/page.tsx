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
  const [isMobileTodoExpanded, setIsMobileTodoExpanded] = useState(false);

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
    <div className="flex flex-col lg:flex-row w-full h-full lg:h-[calc(100vh-4rem)] gap-0 lg:gap-4 md:p-4 bg-background overflow-hidden lg:overflow-visible">
      {/* Todo List Panel: Mobile Top Accordion / Desktop Right Sidebar */}
      {/* 在移动端显示在顶部，在桌面端显示在右侧 (order-first lg:order-last) */}
      <div className={`w-full lg:w-1/3 flex-shrink-0 flex flex-col overflow-visible lg:order-last order-first z-20 ${isMobileTodoExpanded ? 'h-full' : 'h-auto'}`}>
        <TodoCard
          todos={todos}
          onRefresh={refreshData}
          onMobileExpandChange={setIsMobileTodoExpanded}
        />
      </div>

      {/* Chat & Memories Panel: Mobile Full Width / Desktop Left Main */}
      {/* 当移动端 Todo 展开时，隐藏聊天界面 */}
      <div className={`w-full lg:w-2/3 flex-1 lg:flex-shrink-0 flex flex-col overflow-hidden lg:overflow-visible h-full ${isMobileTodoExpanded ? 'hidden lg:flex' : 'flex'}`}>
        <ChatCard memories={memories} onRefresh={refreshData} />
      </div>
    </div>
  );
}