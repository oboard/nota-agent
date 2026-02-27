"use client";

import { useState, useEffect } from "react";
import { getTodos, getRecentMemories } from "./actions";
import { TodoCard } from "@/components/todo-card";
import { AccordionTabs } from "@/components/accordion-tabs";
import { TodoData } from "@/lib/storage";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";

type Memory = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
};

export default function Home() {
  const [todos, setTodos] = useState<TodoData[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isMobileTodoExpanded, setIsMobileTodoExpanded] = useState(false);

  const refreshData = async () => {
    const [newTodos, newMemories] = await Promise.all([
      getTodos(),
      getRecentMemories(),
    ]);
    setTodos(newTodos);
    setMemories(newMemories);
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="flex flex-col lg:flex-row w-full h-full lg:h-[calc(100vh-4rem)] gap-0 lg:gap-4 md:p-4 bg-background overflow-hidden lg:overflow-visible">
      {/* Desktop layout */}
      <div className="hidden lg:flex w-full h-full gap-4">
        <div className="w-1/3 flex-shrink-0 flex flex-col overflow-visible">
          <TodoCard
            todos={todos}
            onRefresh={refreshData}
            onMobileExpandChange={setIsMobileTodoExpanded}
          />
        </div>
        <div className="w-2/3 flex-1 flex flex-col overflow-hidden h-full">
          {/* 主页简介内容 */}
          <Card className="w-full h-full">
            <CardHeader className="px-6 py-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">欢迎来到 Nota</h1>
                <p className="text-sm text-default-500 mt-1">您的智能个人助手</p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="p-6">
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-semibold mb-3">功能介绍</h2>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-lg bg-default-50 border border-default-200">
                      <h3 className="font-medium mb-2">💬 智能对话</h3>
                      <p className="text-sm text-default-600">
                        与 AI 助手进行自然语言对话，获取帮助、建议和解答。
                      </p>
                      <Link href="/chat" color="primary" className="text-sm mt-2 inline-block">
                        开始对话 →
                      </Link>
                    </div>
                    <div className="p-4 rounded-lg bg-default-50 border border-default-200">
                      <h3 className="font-medium mb-2">📝 任务管理</h3>
                      <p className="text-sm text-default-600">
                        创建和管理您的日常任务，设置优先级和提醒，提高工作效率。
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-default-50 border border-default-200">
                      <h3 className="font-medium mb-2">🧠 记忆系统</h3>
                      <p className="text-sm text-default-600">
                        保存重要信息和对话内容，随时回顾和参考之前的讨论。
                      </p>
                    </div>
                  </div>
                </div>

                <Divider />

                <div>
                  <h2 className="text-lg font-semibold mb-3">快速开始</h2>
                  <div className="flex flex-col gap-3">
                    <Button
                      as={Link}
                      href="/chat"
                      color="primary"
                      variant="solid"
                      className="w-full"
                    >
                      开始新的对话
                    </Button>
                    <Button
                      as={Link}
                      href="/docs"
                      color="default"
                      variant="bordered"
                      className="w-full"
                    >
                      查看使用文档
                    </Button>
                  </div>
                </div>

                <Divider />

                <div>
                  <h2 className="text-lg font-semibold mb-3">最近活动</h2>
                  <div className="text-sm text-default-600">
                    {memories.length > 0 ? (
                      <p>您有 {memories.length} 条最近的记忆记录</p>
                    ) : (
                      <p>暂无最近活动记录</p>
                    )}
                    {todos.filter(t => !t.completed).length > 0 && (
                      <p className="mt-1">待完成任务：{todos.filter(t => !t.completed).length} 项</p>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Mobile layout with Accordion Tabs */}
      <div className="lg:hidden w-full flex flex-col gap-2">
        <AccordionTabs
          items={[
            {
              key: "intro",
              title: "Nota 助手",
              subtitle: "您的智能个人助手",
              content: (
                <Card className="w-full">
                  <CardBody className="p-4">
                    <div className="flex flex-col gap-4">
                      <div>
                        <h2 className="text-lg font-semibold mb-2">功能介绍</h2>
                        <div className="flex flex-col gap-3">
                          <div className="p-3 rounded-lg bg-default-50 border border-default-200">
                            <h3 className="font-medium mb-1">💬 智能对话</h3>
                            <p className="text-sm text-default-600">
                              与 AI 助手进行自然语言对话
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-default-50 border border-default-200">
                            <h3 className="font-medium mb-1">📝 任务管理</h3>
                            <p className="text-sm text-default-600">
                              创建和管理日常任务
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-default-50 border border-default-200">
                            <h3 className="font-medium mb-1">🧠 记忆系统</h3>
                            <p className="text-sm text-default-600">
                              保存重要信息和对话内容
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          as={Link}
                          href="/chat"
                          color="primary"
                          variant="solid"
                          className="w-full"
                        >
                          开始对话
                        </Button>
                        <Button
                          as={Link}
                          href="/docs"
                          color="default"
                          variant="bordered"
                          className="w-full"
                        >
                          查看文档
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            },
            {
              key: "tasks",
              title: "Today's Tasks",
              subtitle: "Manage your daily goals",
              count: todos.filter((t) => !t.completed).length,
              content: (
                <TodoCard
                  todos={todos}
                  onRefresh={refreshData}
                  onMobileExpandChange={setIsMobileTodoExpanded}
                />
              )
            },
            {
              key: "context",
              title: "Recent Context",
              subtitle: "Memories for reference",
              content: (
                <Card className="w-full">
                  <CardBody className="p-4">
                    <div className="text-sm text-default-600">
                      {memories.length > 0 ? (
                        <div>
                          <p className="mb-2">您有 {memories.length} 条最近的记忆记录</p>
                          <div className="max-h-48 overflow-y-auto">
                            {memories.slice(0, 5).map((memory) => (
                              <div key={memory.id} className="p-2 mb-2 rounded-md bg-default-50 border border-default-100">
                                <div className="text-xs text-default-400 mb-1">
                                  {new Date(memory.createdAt).toLocaleString()}
                                </div>
                                <div className="text-sm line-clamp-2">
                                  {memory.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p>暂无最近活动记录</p>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )
            }
          ]}
          defaultExpandedKey="intro"
        />
      </div>
    </div >
  );
}