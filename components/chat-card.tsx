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
import { addMemory, loadChat, createChat } from "@/app/actions";
import { DefaultChatTransport, getToolName, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import 'katex/dist/katex.min.css';

interface Memory {
    id: string;
    content: string;
    type: string;
    createdAt: string;
}

interface ChatCardProps {
    memories: Memory[];
    onRefresh: () => void;
    chatId?: string;
    initialMessages?: any[];
    isLoading?: boolean;
}

const plugins = { code, mermaid, math, cjk };

export function ChatCard({ memories, onRefresh, chatId, initialMessages = [], isLoading }: ChatCardProps) {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // 添加定时刷新机制
    useEffect(() => {
        const interval = setInterval(() => {
            onRefresh();
        }, 5000); // 每5秒刷新一次

        return () => clearInterval(interval);
    }, [onRefresh]);

    // 始终调用 useChat，但在条件不满足时传入空配置
    const { messages: chatMessages, sendMessage, status } = useChat({
        id: chatId || 'temp', // 使用临时ID避免空值
        messages: initialMessages, // 只在准备好时使用消息
        transport: new DefaultChatTransport({
            api: '/api/chat',
            headers: {
                'X-Chat-ID': chatId || ''
            }
        }),
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
                    onRefresh();
                    break;
            }
        },
        onFinish: async () => {
            // 当对话完成时刷新数据，确保Recent Context及时更新
            setTimeout(() => {
                onRefresh();
            }, 500); // 延迟500ms确保数据已保存
        }
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, status]);

    const handleSend = () => {
        if (!input.trim() || !chatId) return;

        sendMessage({ text: input });
        setInput('');
        // 发送消息后立刷新数据，确保URL链接和记忆及时显示
        setTimeout(() => {
            onRefresh();
        }, 1000); // 延迟1秒确保后端处理完成
    };

    const handleRemember = async () => {
        if (!input.trim()) return;
        await addMemory(input);
        setInput('');
        // 立即刷新数据，确保记忆及时显示
        setTimeout(() => {
            onRefresh();
        }, 300); // 延迟300ms确保数据已保存
    };

    // 显示加载状态
    if (isLoading) {
        return (
            <Card className="w-full h-full flex flex-col shadow-none border-none lg:border-default-200">
                <CardBody className="flex-1 overflow-hidden p-0 relative bg-background">
                    <div className="h-full flex items-center justify-center">
                        <div className="text-default-500">正在加载今天的会话...</div>
                    </div>
                </CardBody>
            </Card>
        );
    }

    return (
        <Card className="w-full h-full flex flex-col shadow-none border-none lg:border-default-200">
            <CardBody className="flex-1 overflow-hidden p-0 relative bg-background">
                <ScrollShadow className="h-full p-2 lg:p-4">
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
                        {chatMessages.map((m: any) => (
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

                                        {m.parts?.map((part: any, index: number) => {
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
                                                // ... keep tool rendering logic ...
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
                                                            {/* Simplified Tool Output */}
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
                                        {/* 如果没有 parts，显示旧格式的内容 */}
                                        {!m.parts && m.content && (
                                            <Streamdown
                                                plugins={plugins}
                                                className={m.role === "user" ? "prose-invert" : "prose-neutral"}
                                            >
                                                {m.content}
                                            </Streamdown>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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
    );
}