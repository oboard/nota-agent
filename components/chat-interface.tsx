"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Avatar } from "@heroui/avatar";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { addMemory } from "@/app/actions";
import { DefaultChatTransport, getToolName, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import 'katex/dist/katex.min.css';
import { saveChat, loadMoreMessages, scrollToDate } from '@/app/actions';
import { addTimestampSeparators, shouldShowTimestamp, formatChatTime } from '@/lib/chat-utils';
import { DatePanel } from '@/components/date-panel';

interface Memory {
  id: string;
  content: string;
  type: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  chatId: string;
  initialMessages: any[];
  memories: Memory[];
}

const plugins = { code, mermaid, math, cjk };

export function ChatInterface({ chatId, initialMessages, memories }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isDatePanelCollapsed, setIsDatePanelCollapsed] = useState(false);
  const [chatInfo, setChatInfo] = useState<string>(''); // 显示聊天信息

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: {
        'X-Chat-ID': chatId
      }
    }),
    initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async (data) => {
      console.log(data.toolCall)
      switch (data.toolCall.toolName) {
        case 'createTodo':
        case 'createSimpleTodo':
        case 'completeTodo':
        case 'updateTodo':
        case 'deleteTodo':
        case 'saveMemory':
          // 当创建、完成、更新或删除 todo 时，触发刷新以更新 todo 列表
          refreshData();
          break;
      }
    },
    onFinish: async () => {
      // 当对话完成时保存聊天消息到今天的文件
      await saveChatMessages();
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  // 为消息添加时间戳分隔符
  const messagesWithTimestamps = addTimestampSeparators(messages);

  // 显示聊天信息
  useEffect(() => {
    if (chatId && initialMessages.length > 0) {
      setChatInfo(`当前会话: ${chatId} (${initialMessages.length} 条消息)`);
    } else if (chatId) {
      setChatInfo(`当前会话: ${chatId} (新会话)`);
    }
  }, [chatId, initialMessages]);

  const saveChatMessages = async () => {
    try {
      await saveChat(chatId, messages);
      console.log('聊天消息已保存');
    } catch (error) {
      console.error('保存聊天消息失败:', error);
    }
  };

  const loadMoreHistoryMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      // 获取最早的消息ID
      const firstMessage = messages[0];
      const moreMessages = await loadMoreMessages(chatId, firstMessage.id, 20);

      if (moreMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // 将历史消息添加到当前消息列表前面
        const updatedMessages = [...moreMessages, ...messages];
        // 这里需要更新useChat的消息状态，但useChat不提供直接修改方法
        // 所以我们需要在保存时处理，或者在组件初始化时处理
        console.log(`加载了 ${moreMessages.length} 条历史消息`);
      }
    } catch (error) {
      console.error('加载历史消息失败:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;

    // 当滚动到顶部时加载更多历史消息
    if (scrollTop < 50 && !isLoadingMore && hasMoreMessages && messages.length > 0) {
      loadMoreHistoryMessages();
    }
  };

  const refreshData = async () => {
    // 刷新相关数据
    console.log('刷新数据...');
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleRemember = async () => {
    if (!input.trim()) return;
    await addMemory(input);
    setInput('');
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);

    try {
      const result = await scrollToDate(chatId, date);
      if (result.foundDate && result.messages.length > 0) {
        // 滚动到对应日期的消息
        scrollToMessages(result.messages);
        console.log(`已跳转到 ${date} 的聊天记录`);
      } else {
        console.log(`${date} 没有找到聊天记录`);
      }
    } catch (error) {
      console.error('跳转到日期失败:', error);
    }
  };

  const scrollToMessages = (targetMessages: any[]) => {
    // 这里可以实现滚动到指定消息的逻辑
    // 由于useChat的限制，我们可以通过重新加载来实现
    console.log('滚动到消息:', targetMessages.length, '条');

    // 临时方案：显示提示信息
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full gap-0 lg:gap-4">
      {/* 左侧日期选择面板 - ChatGPT风格 */}
      <DatePanel
        chatId={chatId}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />

      {/* 聊天区域 - 占满剩余空间 */}
      <div className="flex-1 flex flex-col h-full">
        <Card className="w-full h-full flex flex-col shadow-none border-none lg:border-default-200">
          <CardBody className="flex-1 overflow-hidden p-0 relative bg-background">
            <ScrollShadow className="h-full p-2 lg:p-4" onScroll={handleScroll}>
              {chatInfo && (
                <div className="mb-4 p-2 bg-default-100 rounded-lg text-xs text-default-600">
                  {chatInfo}
                </div>
              )}
              {memories.length > 0 && (
                <div className="mb-6">
                  <Accordion variant="splitted" className="px-0">
                    <AccordionItem
                      key="memories"
                      aria-label="Recent Memories"
                      title={<span className="text-sm font-medium text-default-500">Recent Context ({memories.length})</span>}
                      className="group-[.is-splitted]:px-3 group-[.is-splitted]:bg-default-50 group-[.is-splitted]:shadow-none"
                    >
                      <div className="flex flex-col gap-2 pb-2">
                        {memories.map((memory) => (
                          <div
                            key={memory.id}
                            className="p-2 rounded-md bg-background text-sm flex gap-2 border border-default-100"
                          >
                            <span className="text-default-400 text-xs min-w-fit mt-0.5 font-mono">
                              {new Date(memory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex-1 min-w-0">
                              <Streamdown
                                plugins={plugins}
                                className="prose-neutral text-default-700 [&>p]:my-0"
                              >
                                {memory.content}
                              </Streamdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              <div className="flex flex-col gap-6 pb-4">
                {/* 加载更多指示器 */}
                {isLoadingMore && (
                  <div className="flex justify-center py-4">
                    <div className="text-sm text-default-500">加载历史消息中...</div>
                  </div>
                )}

                {!hasMoreMessages && messages.length > 0 && (
                  <div className="flex justify-center py-4">
                    <div className="text-sm text-default-400">没有更多消息了</div>
                  </div>
                )}

                {messagesWithTimestamps.map((item: any, index: number) => {
                  // 时间戳分隔符
                  if (item.type === 'timestamp') {
                    return (
                      <div key={`timestamp-${index}`} className="flex justify-center py-2">
                        <div className="bg-default-100 px-3 py-1 rounded-full text-xs text-default-500">
                          {item.displayTime}
                        </div>
                      </div>
                    );
                  }

                  // 普通消息
                  const m = item as any;
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2 lg:gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar
                        src={m.role === "user" ? undefined : "https://i.pravatar.cc/150?u=nota"}
                        name={m.role === "user" ? "User" : "Nota"}
                        size="sm"
                        className="flex-shrink-0 mt-1 w-8 h-8 lg:w-10 lg:h-10"
                        showFallback
                      />
                      <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 lg:px-4 lg:py-3 text-sm lg:text-base ${m.role === "user"
                            ? "bg-default-200 text-foreground rounded-tr-none"
                            : "bg-default-100 text-foreground rounded-tl-none shadow-sm"
                            }`}
                        >

                          {m.parts.map((part: any, index: number) => {
                            switch (part.type) {
                              case 'text':
                                return (
                                  <Streamdown
                                    key={index}
                                    plugins={plugins}
                                    isAnimating={status === 'streaming' && m.role === 'assistant' && index === m.parts.length - 1}
                                    className={m.role === "user" ? "prose-invert" : "prose-neutral"}
                                  >
                                    {part.text}
                                  </Streamdown>
                                );
                              case 'tool-call':
                              case 'tool-call-streaming': {
                                const toolCallId = part.toolCallId;
                                const toolName = getToolName(part);
                                return (
                                  <div key={toolCallId} className="mt-2 p-3 rounded-lg bg-background/50 border border-default-200/50 text-sm w-full">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span>{toolName === "createTodo" ? "✅" : "⚙️"}</span>
                                      <span className="font-semibold opacity-80">{toolName}</span>
                                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-xs">Running</Chip>
                                    </div>
                                    {toolName === "createTodo" && part.output?.title && (
                                      <div className="font-medium">{part.output.title}</div>
                                    )}
                                    {toolName === "saveMemory" && part.args?.content && (
                                      <div className="italic opacity-80">"{part.args.content}"</div>
                                    )}
                                  </div>
                                );
                              }
                              case 'tool-result':
                                return (
                                  <div key={part.toolCallId} className="mt-2 p-2 rounded-lg bg-success-50/50 border border-success-100 text-xs w-full">
                                    <div className="flex items-center gap-2 text-success-600">
                                      <span>✓</span>
                                      <span>Completed: {part.toolName}</span>
                                    </div>
                                  </div>
                                );
                              case 'tool-error':
                                return (
                                  <div key={part.toolCallId} className="mt-2 p-2 rounded-lg bg-danger-50/50 border border-danger-100 text-xs text-danger w-full">
                                    Error: {part.errorText}
                                  </div>
                                );
                            }
                          })}
                        </div>
                      </div>
                    </div>
                  )
                }
                </div>
              {status === "streaming" && (
                <div className="flex gap-3">
                  <Avatar src="https://i.pravatar.cc/150?u=nota" size="sm" className="mt-1" />
                  <div className="bg-content2 rounded-2xl rounded-tl-none px-4 py-3 flex items-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-default-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-default-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-default-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollShadow>
        </CardBody>
        <div className="p-3 lg:p-4 border-t border-divider bg-background sticky bottom-0">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Textarea
                value={input}
                onValueChange={setInput}
                placeholder="Message Nota..."
                minRows={5}
                maxRows={5}
                radius="lg"
                classNames={{
                  input: "text-base pr-10",
                  inputWrapper: "pr-10 bg-default-100 hover:bg-default-200 focus-within:bg-default-100",
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="default"
                  onPress={handleRemember}
                  className="text-default-500 hover:text-primary"
                >
                  <span className="text-lg">💾</span>
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  color={input.trim() ? "primary" : "default"}
                  variant={input.trim() ? "solid" : "flat"}
                  onPress={handleSend}
                  isLoading={status === "streaming"}
                  isDisabled={!input.trim() && status !== "streaming"}
                >
                  {status !== "streaming" && <span className="text-lg">↑</span>}
                </Button>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <span className="text-[10px] text-default-400">Nota can make mistakes. Check important info.</span>
            </div>
          </div>
        </div>
      </Card>
    </div>

      {/* 右侧工具面板 - 可以折叠或隐藏 */ }
  <div className="w-80 flex-shrink-0 flex flex-col overflow-visible">
    <div className="bg-default-50 rounded-lg border border-default-200 p-4 h-full">
      <h3 className="text-lg font-semibold mb-4">工具面板</h3>
      <p className="text-default-500 text-sm">这里可以放置各种工具和快捷功能</p>
    </div>
  </div>
    </div >
  );
}