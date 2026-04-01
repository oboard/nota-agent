"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Drawer, DrawerContent } from "@heroui/drawer";
import { Spinner } from "@heroui/spinner";
import { addMemory, getTodos } from "@/app/actions";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, generateId } from "ai";
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import 'katex/dist/katex.min.css';
import { saveChat, loadMoreMessages, scrollToDate } from '@/app/actions';
import { addTimestampSeparators } from '@/lib/chat-utils';
import { DatePanel } from '@/components/date-panel';
import { TaskPanel } from "./task-panel";
import { MessageItem } from "./message-item";
import { ChevronLeft, ListTodo, ImageIcon, Save, ArrowUp, Sparkles, PanelLeft, PanelRight } from 'lucide-react';
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

export function ChatInterface({ chatId: _chatId, initialMessages = [], memories = [] }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const skipFirstScrollRef = useRef(true);
  const shouldAutoScrollRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const lastRenderedMessageRef = useRef<{ id?: string; count: number }>({ count: 0 });
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
  const messageCount = mergedMessages.length;
  const statusLabel = status === "streaming" ? "Thinking" : "Ready";
  const selectedDateLabel = useMemo(
    () => new Date(selectedDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }),
    [selectedDate]
  );
  const latestMessageId = mergedMessages[mergedMessages.length - 1]?.id;

  const isNearBottom = useCallback((element: HTMLDivElement) => {
    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    const element = scrollContainerRef.current;
    if (!element) return;
    if (!force && !shouldAutoScrollRef.current) return;

    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
      scrollFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    const lastMessage = mergedMessages[mergedMessages.length - 1];
    const prev = lastRenderedMessageRef.current;
    const messageId = lastMessage?.id;
    const messageCountChanged = prev.count !== mergedMessages.length;
    const activeMessageChanged = prev.id !== messageId;

    if ((messageCountChanged || activeMessageChanged || status === "streaming") && shouldAutoScrollRef.current) {
      scrollToBottom(messageCountChanged || activeMessageChanged);
    }

    lastRenderedMessageRef.current = {
      id: messageId,
      count: mergedMessages.length,
    };
  }, [mergedMessages, status, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);


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
    scrollContainerRef.current = element;
    const scrollTop = element.scrollTop;
    shouldAutoScrollRef.current = isNearBottom(element);

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
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'OCR 识别失败');
      }

      // 将识别的文字添加到输入框
      const recognizedText = result.text?.trim() || '';
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">

      <div className="relative z-20 flex items-center justify-between border-b border-default-200/60 bg-background/90 px-2.5 py-1.5 backdrop-blur-xl lg:px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold tracking-[0.14em] text-foreground uppercase">Nota Agent</span>
              <span className="rounded-full border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-success">
                {statusLabel}
              </span>
            </div>
            <div className="text-[11px] text-default-400">
              {selectedDateLabel} · {messageCount} messages
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={toggleDatePanel}
            className={`h-7 min-h-7 w-7 min-w-7 border border-default-200/70 transition-colors ${isDatePanelExpanded ? 'bg-default-100 text-foreground' : 'bg-transparent text-default-400 hover:bg-default-100'}`}
          >
            {isDatePanelExpanded ? <ChevronLeft className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={toggleTodoPanel}
            className={`h-7 min-h-7 w-7 min-w-7 border border-default-200/70 transition-colors ${isTodoPanelExpanded ? 'bg-default-100 text-foreground' : 'bg-transparent text-default-400 hover:bg-default-100'}`}
          >
            {isTodoPanelExpanded ? <PanelRight className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile DatePanel Drawer */}
      {isMobile && (
        <Drawer isOpen={isDatePanelExpanded} onClose={toggleDatePanel} placement="left">
          <DrawerContent className="[&>button]:hidden">
            <div className="h-full border-r border-default-200 bg-background">
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
          <DrawerContent className="[&>button]:hidden">
            <div className="h-full border-l border-default-200 bg-background">
              {/* 移动端复用 TaskPanel，并使用内部关闭按钮，避免和 Drawer 默认按钮重叠 */}
              <div className="h-full w-full [&>div]:w-full [&>div]:!w-full [&_button.absolute]:hidden">
                <TaskPanel todos={todos} onRefresh={refreshData} showCloseButton />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <div className="relative z-10 flex h-0 flex-1 flex-row">

        {/* 左侧日期选择面板 - 带有动画效果 */}
        <div className={`hidden lg:block flex-shrink-0 overflow-hidden border-r border-default-200/70 bg-content1/80 backdrop-blur-xl transition-all duration-300 ease-in-out ${isDatePanelExpanded ? 'w-[18.5rem] opacity-100' : 'w-0 opacity-0'}`}>
          <div className="h-full">
            <DatePanel
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate}
            />
          </div>
        </div>
        {/* 聊天区域 - 占满剩余空间 */}
        <div className="flex min-w-0 flex-1 flex-col h-full">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ScrollShadow
              ref={(node) => {
                scrollContainerRef.current = node as HTMLDivElement | null;
              }}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_18%)]"
            >
              {memories.length > 0 && (
                <div className="mx-auto mb-1 w-full max-w-4xl px-3 pt-1.5 lg:px-5">
                  <Accordion variant="splitted" className="px-0">
                    <AccordionItem
                      key="memories"
                      aria-label="Recent Memories"
                      classNames={{
                        base: "border border-default-200/60 bg-content1/50 shadow-none",
                        title: "text-[13px] font-medium text-default-400",
                        content: "pt-1",
                        trigger: "px-2.5 py-1.5",
                      }}
                      title={<span className="text-[13px] font-medium text-default-400">Recent Context ({memories.length})</span>}
                    >
                      <div className="flex flex-col gap-1.5 pb-1">
                        {memories.map((memory) => (
                          <div
                            key={memory.id}
                            className="flex gap-2 rounded-lg border border-default-200/50 bg-content2/30 px-2 py-1 text-[11px]"
                          >
                            <span className="mt-0.5 min-w-fit font-mono text-[11px] text-default-500">
                              {new Date(memory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex-1 min-w-0">
                              <Streamdown
                                plugins={plugins}
                                className="sd-theme sd-theme--muted prose prose-sm max-w-none text-default-400 [&>p]:my-0"
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

              <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-3 pb-3 pt-2.5 lg:px-5">
                {/* 加载更多指示器 */}
                {isLoadingMore && (
                  <div className="flex justify-center py-2">
                  <div className="rounded-full border border-default-200/60 bg-content1/50 px-3 py-1 text-[12px] text-default-500">加载历史消息中...</div>
                  </div>
                )}

                {!hasMoreMessages && messages.length > 0 && (
                  <div className="flex justify-center py-2">
                    <div className="rounded-full border border-default-200/60 bg-content1/50 px-3 py-1 text-[12px] text-default-500">没有更多消息了</div>
                  </div>
                )}

                {messagesWithTimestamps.map((item: any, index: number) => (
                  <MessageItem
                    key={item.type === 'timestamp' ? `timestamp-${item.timestamp}` : (item.id || `message-${index}`)}
                    message={item}
                    index={index}
                    isStreaming={status === "streaming" && item.type !== 'timestamp' && item.id === latestMessageId && item.role === 'assistant'}
                  />
                ))}

              </div>
              {status === "streaming" && (
                <div className="mx-auto flex w-full max-w-3xl justify-start px-3 pb-3 lg:px-5">
                  <div className="flex items-center rounded-lg border border-default-200/60 bg-content1/70 px-2 py-1">
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


          <div className="border-t border-default-200/60 bg-background/92 px-3 py-2.5 backdrop-blur-xl lg:px-5 lg:py-2.5">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-1 flex items-center justify-between gap-2 text-[9px] text-default-500">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-default-200/60 bg-content1/50 px-2 py-0.5">Enter to send</span>
                  <span className="rounded-full border border-default-200/60 bg-content1/50 px-2 py-0.5">Shift + Enter for newline</span>
                </div>
                <div>{input.trim().length} chars</div>
              </div>

              <div className="relative overflow-hidden rounded-[16px] border border-default-200/70 bg-content1/70 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-default-300 to-transparent" />
                <Textarea
                  value={input}
                  onValueChange={setInput}
                  placeholder="Message Nota..."
                  minRows={3}
                  maxRows={5}
                  classNames={{
                    base: "w-full",
                    input: "text-[12px] leading-5 text-foreground placeholder:text-default-500",
                    inputWrapper: "min-h-[76px] border-0 bg-transparent px-1 py-0.5 shadow-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent",
                    innerWrapper: "bg-transparent",
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
                <div className="mt-1 flex items-end justify-between gap-2 border-t border-default-200/60 px-0.5 pt-1.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={handleImageUpload}
                      className="h-6 min-h-6 border border-default-200/60 bg-content2/50 px-2 text-[10px] text-default-600 hover:bg-content2"
                      isDisabled={isOcrLoading || status === "streaming"}
                      startContent={isOcrLoading ? <Spinner size="sm" color="default" /> : <ImageIcon className="h-4 w-4" />}
                    >
                      OCR
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={handleRemember}
                      className="h-6 min-h-6 border border-default-200/60 bg-content2/50 px-2 text-[10px] text-default-600 hover:bg-content2"
                      isDisabled={!input.trim()}
                      startContent={<Save className="h-4 w-4" />}
                    >
                      Save to memory
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    radius="full"
                    color="primary"
                    variant={input.trim() ? "solid" : "flat"}
                    onPress={handleSend}
                    isLoading={status === "streaming"}
                    isDisabled={!input.trim()}
                    className={`h-7 min-h-7 min-w-[72px] px-2 text-[11px] ${input.trim() ? 'bg-primary text-primary-foreground' : 'border border-default-200/60 bg-content2/50 text-default-500'}`}
                    endContent={status !== "streaming" && <ArrowUp className="h-4 w-4" />}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {/* Mobile Todo panel removed, moved to drawer */}
          <div className="hidden lg:flex justify-center py-3">
            <span className="text-xs text-default-500">Nota can make mistakes. Check important info.</span>
          </div>
        </div>


        {/* 右侧工具面板 - 在移动端隐藏 */}
        <div className={`hidden lg:flex h-full overflow-hidden border-l border-default-200/70 bg-content1/80 backdrop-blur-xl transition-all duration-300 ease-in-out ${isTodoPanelExpanded ? 'w-[22rem] opacity-100' : 'w-0 opacity-0'}`}>
          <TaskPanel todos={todos} onRefresh={refreshData} />
        </div>
      </div>
    </div >
  );
}
