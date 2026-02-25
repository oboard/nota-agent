"use client";

import { useState, useEffect } from "react";
import { getTodos, getRecentMemories, loadChat, createChat } from "./actions";
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
  const [chatId, setChatId] = useState<string>('');
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(true);

  const refreshData = async () => {
    const [newTodos, newMemories] = await Promise.all([
      getTodos(),
      getRecentMemories(),
    ]);
    setTodos(newTodos);
    setMemories(newMemories);
  };

  // 初始化聊天 - 加载今天的会话数据
  useEffect(() => {
    const initChat = async () => {
      try {
        // 获取或创建今天的聊天
        const id = await createChat();
        setChatId(id);

        // 加载今天的聊天消息
        const loadedMessages = await loadChat(id);

        // 转换消息格式以适配新的 useChat API
        const convertedMessages = loadedMessages.map((msg: any) => {
          // 如果消息已经有 parts 结构，直接使用
          if (msg.parts) {
            return msg;
          }
          // 如果消息是旧格式（只有 role, content, 等），转换为 parts 格式
          return {
            ...msg,
            parts: [{
              type: 'text',
              text: msg.content || ''
            }]
          };
        });

        setInitialMessages(convertedMessages);

        console.log(`主页初始化聊天成功: ${id}, 消息数: ${loadedMessages.length}`);
        console.log('转换后的消息格式:', convertedMessages);
      } catch (error) {
        console.error('主页初始化聊天失败:', error);
      } finally {
        setIsChatLoading(false);
      }
    };

    initChat();
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
        <ChatCard
          memories={memories}
          onRefresh={refreshData}
          chatId={chatId}
          initialMessages={initialMessages}
          isLoading={isChatLoading}
        />
      </div>
    </div >
  );
}