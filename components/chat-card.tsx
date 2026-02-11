"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
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
                    // 当创建、完成、更新或删除 todo 时，触发刷新以更新 todo 列表
                    onRefresh();
                    break;
            }
        }
    });

    return (
        <div className="flex flex-col w-full h-full gap-4">
            <Card className="flex-1 min-h-[50vh] lg:min-h-0">
                <CardHeader className="flex justify-between items-center px-4 py-3">
                    <h2 className="text-xl font-bold">Chat with Nota</h2>
                </CardHeader>
                <Divider />
                <CardBody className="overflow-hidden flex flex-col gap-4 p-0">
                    <ScrollShadow className="flex-1 p-4 gap-4 flex flex-col">
                        {messages.map((m: any) => (
                            <div
                                key={m.id}
                                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${m.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-default-100"
                                        }`}
                                >
                                    {m.parts.map((part: any, index: number) => {
                                        switch (part.type) {
                                            // render text parts as simple text:
                                            case 'text':
                                                return (
                                                    <Streamdown
                                                        key={index}
                                                        plugins={plugins}
                                                        isAnimating={status === 'streaming' && m.role === 'assistant' && index === m.parts.length - 1}
                                                    >
                                                        {part.text}
                                                    </Streamdown>
                                                );

                                            case 'tool-call':
                                            case 'tool-call-streaming': {
                                                const toolCallId = part.toolCallId;
                                                const toolName = getToolName(part);

                                                return (
                                                    <div key={toolCallId} className="mt-3 p-3 rounded-lg bg-default-50 border border-default-200">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-lg">
                                                                {toolName === "createTodo" ? "✅" :
                                                                    toolName === "completeTodo" ? "✅" :
                                                                        toolName === "updateTodo" ? "📝" :
                                                                            toolName === "deleteTodo" ? "🗑️" : "🧠"}
                                                            </span>
                                                            <span className="text-sm font-medium text-default-600">
                                                                {toolName === "createTodo" ? "创建待办事项" :
                                                                    toolName === "completeTodo" ? "完成任务" :
                                                                        toolName === "updateTodo" ? "更新任务" :
                                                                            toolName === "deleteTodo" ? "删除任务" : "保存记忆"}
                                                            </span>
                                                            <Chip size="sm" variant="flat" color="primary">
                                                                执行中
                                                            </Chip>
                                                        </div>
                                                        {toolName === "createTodo" && (
                                                            <div className="space-y-1 text-sm">
                                                                <div>
                                                                    <span className="text-default-500">标题：</span>
                                                                    <span className="font-medium">{part.output?.title}</span>
                                                                </div>
                                                                {part.output?.description && (
                                                                    <div>
                                                                        <span className="text-default-500">描述：</span>
                                                                        <span>{part.output?.description}</span>
                                                                    </div>
                                                                )}
                                                                {part.output?.startDateTime && (
                                                                    <div>
                                                                        <span className="text-default-500">时间：</span>
                                                                        <span>{new Date(part.output.startDateTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
                                                                    </div>
                                                                )}
                                                                {part.output?.priority && part.output?.priority > 1 && (
                                                                    <div>
                                                                        <span className="text-default-500">优先级：</span>
                                                                        <Chip size="sm" variant="flat" color="warning">
                                                                            P{part.output?.priority}
                                                                        </Chip>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {toolName === "saveMemory" && (
                                                            <div className="text-sm">
                                                                <div>
                                                                    <span className="text-default-500">内容：</span>
                                                                    <span>{part.args.content}</span>
                                                                </div>
                                                                {part.args.type && part.args.type !== "memory" && (
                                                                    <div>
                                                                        <span className="text-default-500">类型：</span>
                                                                        <Chip size="sm" variant="flat">{part.args.type}</Chip>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );

                                            }
                                            case 'tool-result':
                                                return (
                                                    <div key={part.toolCallId} className="mt-3 p-3 rounded-lg bg-default-50 border border-default-200">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-lg">
                                                                {part.toolName === "createTodo" ? "✅" :
                                                                    part.toolName === "completeTodo" ? "✅" :
                                                                        part.toolName === "updateTodo" ? "📝" :
                                                                            part.toolName === "deleteTodo" ? "🗑️" : "🧠"}
                                                            </span>
                                                            <span className="text-sm font-medium text-default-600">
                                                                {part.toolName === "createTodo" ? "创建待办事项" :
                                                                    part.toolName === "completeTodo" ? "完成任务" :
                                                                        part.toolName === "updateTodo" ? "更新任务" :
                                                                            part.toolName === "deleteTodo" ? "删除任务" : "保存记忆"}
                                                            </span>
                                                            <Chip size="sm" variant="flat" color="success">
                                                                已完成
                                                            </Chip>
                                                        </div>
                                                        <div className="text-sm text-default-500">
                                                            {typeof part.result === 'string' ? part.result : JSON.stringify(part.result)}
                                                        </div>
                                                    </div>
                                                );
                                            case 'tool-error':
                                                return (
                                                    <div key={part.toolCallId} className="mt-3 p-3 rounded-lg bg-danger-50 border border-danger-200">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-lg">❌</span>
                                                            <span className="text-sm font-medium text-danger-600">
                                                                工具执行失败
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-danger-600">
                                                            {part.errorText}
                                                        </div>
                                                    </div>
                                                );
                                        }
                                    })}

                                </div>
                            </div>
                        ))}
                        {status === "streaming" && (
                            <div className="flex justify-start">
                                <div className="bg-default-100 rounded-lg p-3 animate-pulse">
                                    Thinking...
                                </div>
                            </div>
                        )}
                    </ScrollShadow>
                    <div className="p-4 bg-content1 border-t border-divider">
                        <form className="flex gap-2">
                            <Input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Type your message here..."
                                className="flex-1"
                            />
                            <Button
                                color="primary"
                                variant="flat"
                                onPress={async () => {
                                    if (!input.trim()) return;
                                    // 记忆模式下直接保存到今天的文件
                                    await addMemory(input, "memory");
                                    setInput('');
                                    onRefresh(); // 刷新记忆列表
                                }}
                                className="px-3 sm:px-4"
                                startContent="💾"
                            >
                                Remember
                            </Button>
                            <Button
                                color="secondary"
                                variant="flat"
                                onPress={async () => {
                                    if (!input.trim()) return;
                                    // 正常发送消息
                                    sendMessage({ text: input });
                                    setInput('');
                                }}
                                isLoading={status == "streaming"}
                                className="px-3 sm:px-4"
                                startContent="💬"
                            >
                                Send
                            </Button>
                        </form>
                    </div>
                </CardBody>
            </Card>

            <Card className="h-48 lg:h-2/5">
                <CardHeader className="px-4 py-3">
                    <h2 className="text-lg font-bold">Recent Memories</h2>
                </CardHeader>
                <Divider />
                <CardBody>
                    <ScrollShadow className="h-full">
                        <div className="flex flex-col gap-2">
                            {memories.map((memory) => (
                                <div
                                    key={memory.id}
                                    className="p-2 rounded-md bg-default-50 text-sm flex gap-2"
                                >
                                    <span className="text-default-400 text-xs min-w-fit mt-0.5">
                                        {new Date(memory.createdAt).toLocaleString()}
                                    </span>
                                    <span>{memory.content}</span>
                                </div>
                            ))}
                            {memories.length === 0 && (
                                <div className="text-center text-default-400 py-4">
                                    No memories yet. Tell me something!
                                </div>
                            )}
                        </div>
                    </ScrollShadow>
                </CardBody>
            </Card>
        </div>
    );
}