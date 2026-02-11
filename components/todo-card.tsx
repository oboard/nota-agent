"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { toggleTodo, deleteTodo } from "@/app/actions";
import { TodoData } from "@/lib/storage";

interface Todo {
    id: string;
    title: string;
    completed: boolean;
    startDateTime?: Date;
    endDateTime?: Date;
    priority: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
    cron?: string;
}

interface TodoCardProps {
    todos: TodoData[];
    onRefresh: () => void;
}

export function TodoCard({ todos, onRefresh }: TodoCardProps) {
    const handleToggleTodo = async (id: string, completed: boolean) => {
        // Optimistic update could be handled in parent or here if we manage local state
        // For now, we'll just call the action and refresh
        await toggleTodo(id, completed);
        onRefresh();
    };

    const handleDeleteTodo = async (id: string) => {
        await deleteTodo(id);
        onRefresh();
    };

    return (
        <Card className="w-full h-full">
            <CardHeader className="flex justify-between items-center px-6 py-4">
                <div>
                    <h2 className="text-2xl font-bold">
                        Today's Tasks
                    </h2>
                    <p className="text-sm text-default-500 mt-1">
                        Manage your daily goals
                    </p>
                </div>
                <Chip
                    size="lg"
                    variant="solid"
                    color="primary"
                    className="px-3 py-1"
                >
                    {todos.filter((t) => !t.completed).length} remaining
                </Chip>
            </CardHeader>
            <Divider />
            <CardBody className="p-0">
                <ScrollShadow className="h-full p-3">
                    <div className="flex flex-col gap-2">
                        {todos.map((todo) => (
                            <div
                                key={todo.id}
                                className={`group relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${todo.completed
                                    ? "bg-success-50 border-success-200 opacity-75"
                                    : "bg-content1 border-default-200 hover:border-primary-300 hover:shadow-sm"
                                    }`}
                            >
                                <Checkbox
                                    isSelected={todo.completed}
                                    onValueChange={(v) => handleToggleTodo(todo.id, v)}
                                    color="success"
                                    size="md"
                                    className="flex-shrink-0"
                                />

                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-medium ${todo.completed ? "line-through text-default-500" : "text-foreground"}`}>
                                        {todo.title}
                                    </h4>

                                    {todo.description && (
                                        <p className={`text-sm mt-1 ${todo.completed ? "line-through text-default-400" : "text-default-600"}`}>
                                            {todo.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {todo.startDateTime ? (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                className="bg-default-100 text-default-600"
                                                startContent="📅"
                                            >
                                                {todo.startDateTime.toLocaleString('zh-CN', {
                                                    timeZone: 'Asia/Shanghai',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </Chip>
                                        ) : (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                className="bg-default-50 text-default-400"
                                            >
                                                无时间限制
                                            </Chip>
                                        )}

                                        {todo.priority > 1 && (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={todo.priority >= 4 ? "danger" : "warning"}
                                                startContent="🔥"
                                            >
                                                P{todo.priority}
                                            </Chip>
                                        )}

                                        {todo.cron && (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color="secondary"
                                                startContent="🔄"
                                            >
                                                {todo.cron}
                                            </Chip>
                                        )}

                                        {todo.completed && (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color="success"
                                                startContent="✅"
                                            >
                                                已完成
                                            </Chip>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                                    onPress={() => handleDeleteTodo(todo.id)}
                                >
                                    ✕
                                </Button>
                            </div>
                        ))}
                        {todos.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-48 text-default-400">
                                <div className="text-6xl mb-4">🎉</div>
                                <p className="text-lg font-medium">All clear!</p>
                                <p className="text-sm mt-2">No tasks for now. Ask me to create one!</p>
                            </div>
                        )}
                    </div>
                </ScrollShadow>
            </CardBody>
        </Card>
    );
}