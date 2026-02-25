import { notFound } from 'next/navigation';
import { loadChat, getRecentMemories } from '@/app/actions';
import { ChatInterface } from '@/components/chat-interface';

interface ChatPageProps {
  params: {
    id: string;
  };
}

export default async function ChatDetailPage({ params }: ChatPageProps) {
  const { id } = params;

  // 加载聊天消息和记忆
  const [messages, memories] = await Promise.all([
    loadChat(id),
    getRecentMemories(),
  ]);

  // 不再返回404，即使是空聊天也正常显示
  // 这样可以确保用户总是看到聊天界面，即使是新创建的空聊天

  return (
    <div className="flex flex-col lg:flex-row w-full h-full lg:h-[calc(100vh-4rem)] gap-0 lg:gap-4 md:p-4 bg-background overflow-hidden lg:overflow-visible">
      <ChatInterface
        chatId={id}
        initialMessages={messages}
        memories={memories}
      />
    </div>
  );
}