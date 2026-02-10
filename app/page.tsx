"use client";

import { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { getTodos, toggleTodo, deleteTodo, getRecentMemories } from "./actions";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
  dueDate: string | null;
  priority: number;
};

type Memory = {
  id: number;
  content: string;
  createdAt: Date;
};

export default function Home() {
  const [mode, setMode] = useState<"memory" | "question">("memory");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      body: { mode },
      onFinish: () => {
        refreshData();
      },
    });

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

  const handleToggleTodo = async (id: number, completed: boolean) => {
    // Optimistic update
    setTodos(
      todos.map((t) => (t.id === id ? { ...t, completed } : t))
    );
    await toggleTodo(id, completed);
    refreshData();
  };

  const handleDeleteTodo = async (id: number) => {
    // Optimistic update
    setTodos(todos.filter((t) => t.id !== id));
    await deleteTodo(id);
    refreshData();
  };

  return (
    <div className="flex h-screen w-full gap-4 p-4 bg-background">
      {/* Left Panel: Chat & Memories */}
      <div className="flex flex-col w-2/3 gap-4">
        <Card className="flex-1 h-3/5">
          <CardHeader className="flex justify-between items-center px-4 py-3">
            <h2 className="text-xl font-bold">Chat with Nota</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === "memory" ? "solid" : "bordered"}
                color="primary"
                onPress={() => setMode("memory")}
              >
                Memory Mode
              </Button>
              <Button
                size="sm"
                variant={mode === "question" ? "solid" : "bordered"}
                color="secondary"
                onPress={() => setMode("question")}
              >
                Question Mode
              </Button>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="overflow-hidden flex flex-col gap-4 p-0">
            <ScrollShadow className="flex-1 p-4 gap-4 flex flex-col">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-default-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.toolInvocations?.map((toolInvocation) => (
                      <div
                        key={toolInvocation.toolCallId}
                        className="mt-2 text-xs opacity-70 border-t border-white/20 pt-2"
                      >
                        {toolInvocation.toolName === "createTodo" && (
                          <span>✨ Created Todo: {toolInvocation.args.title}</span>
                        )}
                        {toolInvocation.toolName === "saveMemory" && (
                          <span>🧠 Saved Memory</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-default-100 rounded-lg p-3 animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </ScrollShadow>
            <div className="p-4 bg-content1 border-t border-divider">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder={
                    mode === "memory"
                      ? "Tell me something to remember or do..."
                      : "Ask me anything..."
                  }
                  className="flex-1"
                />
                <Button
                  type="submit"
                  color="primary"
                  isLoading={isLoading}
                >
                  Send
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>

        <Card className="h-2/5">
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
                      {new Date(memory.createdAt).toLocaleDateString()}
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

      {/* Right Panel: Todo List */}
      <Card className="w-1/3 h-full">
        <CardHeader className="flex justify-between items-center px-4 py-3">
          <h2 className="text-xl font-bold">Today's Tasks</h2>
          <Chip size="sm" variant="flat" color="primary">
            {todos.filter((t) => !t.completed).length} remaining
          </Chip>
        </CardHeader>
        <Divider />
        <CardBody className="p-0">
          <ScrollShadow className="h-full p-2">
            <div className="flex flex-col gap-1">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`group flex items-start gap-3 p-3 rounded-lg hover:bg-default-100 transition-colors ${
                    todo.completed ? "opacity-50" : ""
                  }`}
                >
                  <Checkbox
                    isSelected={todo.completed}
                    onValueChange={(v) => handleToggleTodo(todo.id, v)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        todo.completed ? "line-through text-default-400" : ""
                      }`}
                    >
                      {todo.title}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {todo.dueDate && (
                        <span className="text-xs text-default-400 bg-default-200 px-1.5 py-0.5 rounded">
                          📅 {todo.dueDate}
                        </span>
                      )}
                      {todo.priority > 1 && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            todo.priority >= 4
                              ? "bg-danger-100 text-danger-600"
                              : "bg-warning-100 text-warning-600"
                          }`}
                        >
                          🔥 P{todo.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onPress={() => handleDeleteTodo(todo.id)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {todos.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-default-400">
                  <p>All clear! 🎉</p>
                  <p className="text-xs">Ask me to create a task.</p>
                </div>
              )}
            </div>
          </ScrollShadow>
        </CardBody>
      </Card>
    </div>
  );
}