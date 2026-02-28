import { ChatInterface } from "@/components/chat-interface";
import { ChatStorage } from "@/lib/chat-storage";
import { getRecentMemories } from "@/app/actions";

export default async function ChatPage() {
  const chatStorage = new ChatStorage();

  // chatId 仅作为前端 key 标识
  const chatId = await chatStorage.createChat();

  // 加载初始消息并确保 parts 存在
  const loadedMessages = await chatStorage.loadChat();
  const initialMessages = loadedMessages.map((msg: any) => {
    if (msg.parts) return msg;
    return {
      ...msg,
      parts: [
        {
          type: "text",
          text: msg.content || msg.text || "",
        },
      ],
    };
  });

  const memories = await getRecentMemories();

  return (
    <div className="h-full w-full bg-background">
      <ChatInterface
        chatId={chatId}
        initialMessages={initialMessages}
        memories={memories}
      />
    </div>
  );
}