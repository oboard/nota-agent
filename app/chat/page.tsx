import { redirect } from 'next/navigation';
import { getOrCreateDefaultChat } from '@/lib/chat-storage';

export default async function ChatPage() {
  // 获取或创建默认聊天（优先复用同一天的已有会话）
  const chatId = await getOrCreateDefaultChat();
  redirect(`/chat/${chatId}`); // 重定向到具体聊天页面
}