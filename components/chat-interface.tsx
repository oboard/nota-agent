"use client";

import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Drawer, DrawerContent } from "@heroui/drawer";
import { Spinner } from "@heroui/spinner";
import { addMemory, getTodos } from "@/app/actions";
import { DefaultChatTransport, getToolName, lastAssistantMessageIsCompleteWithToolCalls, generateId } from "ai";
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import 'katex/dist/katex.min.css';
import { saveChat, loadMoreMessages, scrollToDate } from '@/app/actions';
import { addTimestampSeparators } from '@/lib/chat-utils';
import { DatePanel } from '@/components/date-panel';
import { TodoCard } from "./todo-card";
import { DesktopTodoPanel } from "./desktop-todo-panel";
import { Calendar, ChevronLeft, ListTodo, ImageIcon } from 'lucide-react';
import { useDatePanelStore } from '@/lib/stores/date-panel-store';
import { useTodoPanelStore } from '@/lib/stores/todo-panel-store';

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

// 优化 Avatar 组件，避免不必要的重新渲染
const MemoizedAvatar = memo(({ role }: { role: string }) => (
  <Avatar
    src={role === "user" ? undefined : "https://i.pravatar.cc/150?u=nota"}
    name={role === "user" ? "User" : "Nota"}
    size="sm"
    className="flex-shrink-0 mt-1 w-8 h-8 lg:w-10 lg:h-10"
    showFallback
  />
));

MemoizedAvatar.displayName = 'MemoizedAvatar';

export function ChatInterface({ chatId, initialMessages = [], memories = [] }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipFirstScrollRef = useRef(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { isDatePanelExpanded, toggleDatePanel } = useDatePanelStore();
  const { isTodoPanelExpanded, toggleTodoPanel, setExpanded: setTodoPanelExpanded } = useTodoPanelStore();
  const [isMobile, setIsMobile] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const update = () => {
      setIsMobile(mq.matches);
      // 移动端默认收起，桌面端默认展开
      if (mq.matches) {
        setTodoPanelExpanded(false);
      } else {
        setTodoPanelExpanded(true);
      }
    }
    update();
    // 兼容较老的浏览器事件API
    if ((mq as any).addEventListener) {
      mq.addEventListener('change', update);
    } else {
      (mq as any).addListener(update);
    }
    return () => {
      if ((mq as any).removeEventListener) {
        mq.removeEventListener('change', update);
      } else {
        (mq as any).removeListener(update);
      }
    };
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    messages: initialMessages,
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

  // 合并历史+当前消息，并添加时间戳分隔符（避免闪烁）
  const mergedMessages = useMemo(() => {
    const ids = new Set<string>((historyMessages ?? []).map((m: any) => m?.id));
    const fresh = (messages ?? []).filter((m: any) => !ids.has(m?.id));
    return [...(historyMessages ?? []), ...fresh];
  }, [historyMessages, messages]);

  const messagesWithTimestamps = useMemo(
    () => addTimestampSeparators(mergedMessages ?? []),
    [mergedMessages]
  );


  const saveChatMessages = async () => {
    try {
      await saveChat(messages);
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
      const moreMessages = await loadMoreMessages(firstMessage.id, 20);

      if (moreMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // 直接在前端合并历史消息，无需整页刷新
        const merged = [...moreMessages, ...historyMessages, ...messages]
          .map(msg => ({
            ...msg,
            id: msg.id || generateId(),
            createdAt: (msg as any).createdAt || new Date().toISOString()
          }));

        // 去重并按时间排序（与后端规范一致）
        const deduped = new Map<string, any>();
        merged.forEach(m => {
          const key = m.id;
          if (!key) return;
          const existing = deduped.get(key);
          const existingTime = existing ? new Date(existing.createdAt).getTime() : -Infinity;
          const currentTime = new Date(m.createdAt).getTime();
          if (!existing || currentTime >= existingTime) {
            deduped.set(key, m);
          }
        });

        const ordered = Array.from(deduped.values()).sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // 更新历史消息，前置到 UI 里
        setHistoryMessages(ordered);
        setHasMoreMessages(moreMessages.length === 20);
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

    // 首次挂载时忽略初始滚动事件，避免触发重复加载/刷新
    if (skipFirstScrollRef.current) {
      skipFirstScrollRef.current = false;
      return;
    }

    // 当滚动到顶部时加载更多历史消息
    if (scrollTop < 50 && !isLoadingMore && hasMoreMessages && messages.length > 0) {
      loadMoreHistoryMessages();
    }
  };
  const [todos, setTodos] = useState<any[]>([]);

  const refreshData = async () => {
    setTodos(await getTodos(),);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // 使用 useCallback 优化事件处理函数
  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  }, [input, sendMessage]);

  const handleRemember = useCallback(async () => {
    if (!input.trim()) return;
    await addMemory(input);
    setInput('');
  }, [input]);

  // 处理图片上传和 OCR 识别
  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查是否是图片文件
    if (!file.type.startsWith('image/')) {
      console.error('请选择图片文件');
      return;
    }

    setIsOcrLoading(true);
    try {
      // 调用后端 OCR API（会自动下载所需语言包）
      const formData = new FormData();
      formData.append('image', file);
      formData.append('lang', 'chi_sim+eng');

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'OCR 识别失败');
      }

      // 将识别的文字添加到输入框
      const recognizedText = result.text.trim();
      if (recognizedText) {
        setInput((prev) => prev ? `${prev}\n${recognizedText}` : recognizedText);
      } else {
        console.log('未识别到文字');
      }
    } catch (error) {
      console.error('OCR 识别失败:', error);
      alert(error instanceof Error ? error.message : 'OCR 识别失败，请稍后重试');
    } finally {
      setIsOcrLoading(false);
      // 清空文件输入，允许重复选择同一文件
      e.target.value = '';
    }
  }, []);

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);

    try {
      const result = await scrollToDate(date);
      if (result.messages.length > 0) {
        // 日期选择只滚动到对应位置，不替换消息列表
        scrollToDateMessage(date, result.messages);
        console.log(`已跳转到 ${date} 的聊天记录`);
      } else {
        console.log(`${date} 没有找到聊天记录`);
      }
    } catch (error) {
      console.error('跳转到日期失败:', error);
    }
  };

  const scrollToDateMessage = async (_targetDate: string, targetMessages: any[]) => {
    console.log(`滚动到日期的消息（直接合并，无整页刷新）`);

    if (targetMessages.length === 0) return;

    // 合并目标消息 + 已有历史 + 当前消息
    const merged = [...targetMessages, ...historyMessages, ...messages]
      .map(msg => ({
        ...msg,
        id: msg.id || generateId(),
        createdAt: (msg as any).createdAt || new Date().toISOString()
      }));

    // 去重并按时间排序
    const deduped = new Map<string, any>();
    merged.forEach(m => {
      const key = m.id;
      if (!key) return;
      const existing = deduped.get(key);
      const existingTime = existing ? new Date(existing.createdAt).getTime() : -Infinity;
      const currentTime = new Date(m.createdAt).getTime();
      if (!existing || currentTime >= existingTime) {
        deduped.set(key, m);
      }
    });
    const ordered = Array.from(deduped.values()).sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    setHistoryMessages(ordered);

    // 渲染后尝试滚动到目标消息
    const firstTargetId = targetMessages[0]?.id;
    if (firstTargetId) {
      setTimeout(() => {
        const messageElements = Array.from(document.querySelectorAll('[data-message-id]'));
        const targetIdx = ordered.findIndex(m => m.id === firstTargetId);
        if (targetIdx >= 0 && messageElements[targetIdx]) {
          (messageElements[targetIdx] as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 0);
    }
  };

  // 清理旧的滚动标记（不再整页刷新）
  useEffect(() => {
    sessionStorage.removeItem(`scroll_target_global`);
  }, []);

  // 监听来自navbar的日期选择事件
  useEffect(() => {
    const handleDateSelected = (event: CustomEvent) => {
      const { date } = event.detail;
      handleDateSelect(date);
    };

    window.addEventListener('dateSelected', handleDateSelected as EventListener);
    return () => {
      window.removeEventListener('dateSelected', handleDateSelected as EventListener);
    };
  }, []);

  // 移动端切换日期面板
  const handleMobileTogglePanel = () => {
    toggleDatePanel();
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0">

      {/* 统一的悬浮按钮 - 类似 ChatGPT，始终在同一位置 */}
      {/* Mobile top header */}
      <div className="z-40 bg-background/80 border-b border-default-200 px-3 py-2 flex items-center justify-between">
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          color={isDatePanelExpanded ? "default" : "primary"}
          onPress={toggleDatePanel}
          className={`shadow-sm transition-all ${isDatePanelExpanded
            ? 'bg-background/80 hover:bg-default-100'
            : 'bg-primary/10 hover:bg-primary/20'
            }`}
        >
          {isDatePanelExpanded ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="flat"
          color={isTodoPanelExpanded ? "default" : "primary"}
          onPress={toggleTodoPanel}
          className={`shadow-sm transition-all ${isTodoPanelExpanded
            ? 'bg-background/80 hover:bg-default-100'
            : 'bg-primary/10 hover:bg-primary/20'
            }`}
        >
          <ListTodo className="w-4 h-4" />
        </Button>
      </div>

      {/* Mobile DatePanel Drawer */}
      {isMobile && (
        <Drawer isOpen={isDatePanelExpanded} onClose={toggleDatePanel} placement="left">
          <DrawerContent>
            <div className="h-full bg-default-50 border-r border-default-200">
              <DatePanel
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Mobile TodoPanel Drawer */}
      {isMobile && (
        <Drawer isOpen={isTodoPanelExpanded} onClose={toggleTodoPanel} placement="right" size="lg">
          <DrawerContent>
            <div className="h-full bg-default-50 border-l border-default-200">
              {/* 移动端直接复用 DesktopTodoPanel，但通过样式控制默认展开 */}
              <div className="h-full w-full [&>div]:w-full [&>div]:!w-full [&_button.absolute]:hidden">
                <DesktopTodoPanel todos={todos} onRefresh={refreshData} />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <div className="flex flex-1 flex-row h-0">

        {/* 左侧日期选择面板 - 带有动画效果 */}
        <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${isDatePanelExpanded ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
          <DatePanel
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
          />
        </div>
        {/* 聊天区域 - 占满剩余空间 */}
        <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 lg:border-l border-default-200">
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">

            <ScrollShadow onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden">
              {memories.length > 0 && (
                <div className="mb-6">
                  <Accordion variant="splitted" className="px-0">
                    <AccordionItem
                      key="memories"
                      aria-label="Recent Memories"
                      title={<span className="text-sm font-medium text-default-500">Recent Context ({memories.length})</span>}
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

              <div className="flex flex-col gap-6 pb-4 px-4">
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
                      <div key={`timestamp-${item.timestamp}-${index}`} className="flex justify-center py-2">
                        <div className="bg-default-100 px-3 py-1 rounded-full text-xs text-default-500">
                          {item.displayTime}
                        </div>
                      </div>
                    );
                  }

                  // 普通消息
                  const m = item as any;
                  const safeParts = Array.isArray(m?.parts) ? m.parts : [];
                  return (
                    <div
                      key={`${m?.id ?? 'message'}-${index}`}
                      data-message-id={m?.id || `message-${index}`}
                      className={`flex gap-2 lg:gap-3 ${m?.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <MemoizedAvatar role={m?.role} />
                      <div className={`flex flex-col max-w-[85%] lg:max-w-[60%] xl:max-w-[500px] min-w-0 ${m?.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-2xl space-y-4 px-3 py-2 lg:px-4 lg:py-3 text-sm lg:text-base max-w-full overflow-hidden ${m?.role === "user"
                            ? "bg-default-200 text-foreground rounded-tr-none"
                            : "bg-default-100 text-foreground rounded-tl-none shadow-sm"
                            }`}
                        >

                          {safeParts.map((part: any, index: number) => {
                            switch (part.type) {
                              case 'text':
                                return (
                                  <div key={index} className="min-w-0 overflow-hidden break-words">
                                    <Streamdown
                                      plugins={plugins}
                                      isAnimating={status === 'streaming' && m.role === 'assistant' && index === m.parts.length - 1}
                                      className={`${m.role === "user" ? "prose-invert" : "prose-neutral"} prose-pre:overflow-x-auto prose-code:break-all`}
                                    >
                                      {part.text}
                                    </Streamdown>
                                  </div>
                                );
                              case 'reasoning':
                                return (
                                  <Accordion
                                    key={index}
                                    variant="shadow" className="mt-2">
                                    <AccordionItem
                                      key={`reasoning-${index}`}
                                      aria-label="Reasoning"
                                      title={
                                        <div className="flex items-center gap-2">
                                          <span>🤔</span>
                                          <span className="font-semibold text-blue-700">
                                            {part.state === 'streaming' ? '思考中...' : '思考过程'}
                                          </span>
                                          {part.state === 'streaming' && (
                                            <div className="flex gap-1">
                                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                          )}
                                        </div>
                                      }
                                    >
                                      <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 text-sm w-full">
                                        <div className="text-blue-800 opacity-90 italic">
                                          <Streamdown
                                            plugins={plugins}
                                            isAnimating={part.state === 'streaming'}
                                            className="prose-blue text-sm"
                                          >
                                            {part.text}
                                          </Streamdown>
                                        </div>
                                      </div>
                                    </AccordionItem>
                                  </Accordion>
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
                              default:
                                // 兼容更多工具与步骤类型显示
                                if (typeof part.type === 'string') {
                                  if (part.type.startsWith('tool-')) {
                                    const name = part.type.replace(/^tool-/, '');
                                    return (
                                      <div key={`tool-${name}-${index}`} className="mt-2 p-3 rounded-lg bg-background/50 border border-default-200/50 text-sm w-full">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span>🛠️</span>
                                          <span className="font-semibold opacity-80">{name}</span>
                                          <Chip size="sm" variant="flat" color="primary" className="h-5 text-xs">Running</Chip>
                                        </div>
                                        {part.args && (
                                          <pre className="text-xs bg-default-100 rounded-md p-2 overflow-auto">{JSON.stringify(part.args, null, 2)}</pre>
                                        )}
                                        {part.output && (
                                          <pre className="text-xs bg-default-100 rounded-md p-2 overflow-auto mt-2">{JSON.stringify(part.output, null, 2)}</pre>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (part.type.startsWith('step-')) {
                                    const step = part.type.replace(/^step-/, '');
                                    return (<div key={`step-${step}-${index}`}></div>
                                      // <div key={`step-${step}-${index}`} className="mt-2 p-2 rounded-lg bg-default-50 border border-default-200 text-xs w-full">
                                      //   <div className="flex items-center gap-2">
                                      //     <span>🧩</span>
                                      //     <span>Step: {step}</span>
                                      //   </div>
                                      //   {part.text && <div className="mt-1 opacity-80">{part.text}</div>}
                                      // </div>
                                    );
                                  }
                                }
                                console.warn('Unknown message part type:', part.type);
                                return null;
                            }
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}

              </div>
              {status === "streaming" && (
                <div className="flex gap-3">
                  <MemoizedAvatar role="assistant" />
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

            </ScrollShadow>
          </div>


          <div className="p-4 border-t border-default-200 flex flex-col gap-3 relative flex-shrink-0 bg-background/80">
            <Textarea
              value={input}
              onValueChange={setInput}
              placeholder="Message Nota..."
              minRows={5}
              maxRows={5}
              classNames={{
                input: "text-base pr-10",
                inputWrapper: "pr-10 bg-default-100 hover:bg-default-200 focus-within:bg-default-100",
              }}
              onKeyDown={useCallback((e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }, [handleSend])}
            />
            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="absolute right-8 bottom-8 flex gap-1">
              {/* OCR 图片上传按钮 */}
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="default"
                onPress={handleImageUpload}
                className="text-default-500 hover:text-primary"
                isDisabled={isOcrLoading || status === "streaming"}
                title="上传图片进行 OCR 识别"
              >
                {isOcrLoading ? (
                  <Spinner size="sm" color="default" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="default"
                onPress={handleRemember}
                className="text-default-500 hover:text-primary"
                isDisabled={!input.trim()}
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
                isDisabled={!input.trim()}
              >
                {status !== "streaming" && <span className="text-lg">↑</span>}
              </Button>
            </div>
          </div>
          {/* Mobile Todo panel removed, moved to drawer */}
          <div className="hidden lg:flex justify-center py-2">
            <span className="text-xs text-default-400">Nota can make mistakes. Check important info.</span>
          </div>
        </div>


        {/* 右侧工具面板 - 在移动端隐藏 */}
        <div className="hidden lg:flex h-full">
          <DesktopTodoPanel todos={todos} onRefresh={refreshData} />
        </div>
      </div>
    </div >
  );
}