"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatInterface } from "@/components/chat-interface";
import { loadChat, createChat } from "@/app/actions";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";

export default function ChatPage() {
  const params = useParams();
  const chatIdFromUrl = params?.id as string;

  const [chatId, setChatId] = useState<string>("");
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initChat = async () => {
      try {
        let currentChatId = chatIdFromUrl;

        // 如果没有提供 chatId，创建新的聊天
        if (!currentChatId) {
          currentChatId = await createChat();
        }

        setChatId(currentChatId);

        // 检查是否有本地存储的完整消息列表
        const storedMessages = localStorage.getItem(`chat_${currentChatId}_messages`);
        let loadedMessages;

        if (storedMessages) {
          // 使用本地存储的完整消息列表
          loadedMessages = JSON.parse(storedMessages);
          localStorage.removeItem(`chat_${currentChatId}_messages`); // 清理临时存储
        } else {
          // 正常加载聊天消息
          loadedMessages = await loadChat();
        }

        // 转换消息格式
        const convertedMessages = loadedMessages.map((msg: any) => {
          if (msg.parts) {
            return msg;
          }
          return {
            ...msg,
            parts: [{
              type: 'text',
              text: msg.content || ''
            }]
          };
        });

        setInitialMessages(convertedMessages);

        // 加载记忆数据
        const { getRecentMemories } = await import("@/app/actions");
        const recentMemories = await getRecentMemories();
        setMemories(recentMemories);

      } catch (error) {
        console.error('初始化聊天失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
  }, [chatIdFromUrl]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg font-medium mb-2 text-foreground">正在加载聊天...</div>
          <div className="text-sm text-default-500">请稍候</div>
        </div>
      </div>
    );
  }

  if (!chatId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg font-medium mb-2 text-foreground">无法加载聊天</div>
          <div className="text-sm text-default-500 mb-4">聊天初始化失败</div>
          <Button as={Link} href="/" color="primary">
            返回主页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ChatInterface
      chatId={chatId}
      initialMessages={initialMessages}
      memories={memories}
    />
  );
}