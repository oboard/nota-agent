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

interface Memory {
    id: string;
    content: string;
    type: string;
    createdAt: string;
}

interface ChatCardProps {
    memories: Memory[];
    onRefresh: () => void;
}

const plugins = { code, mermaid, math, cjk };

export function ChatCard({ memories, onRefresh }: ChatCardProps) {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
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
        }
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, status]);

    const handleSend = () => {
        if (!input.trim()) return;
        sendMessage({ text: input });
        setInput('');
    };

    const handleRemember = async () => {
        if (!input.trim()) return;
        await addMemory(input);
        setInput('');
        onRefresh();
    };

    return (
        <Card className="w-full h-full shadow-lg flex flex-col">
            <CardHeader className="flex justify-between items-center px-4 py-3 border-b border-divider">
                <div className="flex items-center gap-2">
                    <Avatar src="https://i.pravatar.cc/150?u=nota" size="sm" isBordered />
                    <div>
                        <h2 className="text-lg font-bold">Nota Agent</h2>
                        <p className="text-xs text-default-400">AI Assistant</p>
                    </div>
                </div>
            </CardHeader>
            <CardBody className="flex-1 overflow-hidden p-0 relative">
                <ScrollShadow className="h-full p-4">
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
                                                <span className="text-default-700">{memory.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}

                    <div className="flex flex-col gap-6">
                        {messages.map((m: any) => (
                            <div
                                key={m.id}
                                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                <Avatar
                                    src={m.role === "user" ? undefined : "https://i.pravatar.cc/150?u=nota"}
                                    name={m.role === "user" ? "User" : "Nota"}
                                    size="sm"
                                    className="flex-shrink-0 mt-1"
                                    showFallback
                                />
                                <div className={`flex flex-col max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                                    <div
                                        className={`rounded-2xl px-4 py-3 ${m.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-content2 text-foreground rounded-tl-none"
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
                                                            className={m.role === "user" ? "prose-invert" : ""}
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
            <div className="p-4 border-t border-divider bg-background">
                <div className="flex flex-col gap-2">
                    <Textarea
                        value={input}
                        onValueChange={setInput}
                        placeholder="Type a message..."
                        minRows={5}
                        maxRows={5}
                        radius="lg"
                        classNames={{
                            input: "text-base",
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-default-400">Enter to send, Shift+Enter for new line</span>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="light"
                                color="default"
                                onPress={handleRemember}
                                startContent={<span className="text-lg">💾</span>}
                            >
                                Remember
                            </Button>
                            <Button
                                size="sm"
                                color="primary"
                                onPress={handleSend}
                                isLoading={status === "streaming"}
                                startContent={status !== "streaming" && <span className="text-lg">➤</span>}
                            >
                                Send
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}