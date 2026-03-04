"use client";

import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { toggleTodo, deleteTodo } from "@/app/actions";
import { TodoData } from "@/lib/storage";

interface TodoCardProps {
    todos: TodoData[];
    onRefresh: () => void;
    onMobileExpandChange?: (isExpanded: boolean) => void;
}

export function TodoCard({ todos, onRefresh, onMobileExpandChange }: TodoCardProps) {
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

    const TodoList = () => (
        <div className="flex flex-col gap-2">
            {todos.map((todo) => (
                <div
                    key={todo.id}
                    className={`group relative flex items-center gap-3 p-3 lg:p-4 rounded-xl border-2 transition-all duration-200 ${todo.completed
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
                                    {todo.endDateTime && (() => {
                                        const start = todo.startDateTime!;
                                        const end = todo.endDateTime;
                                        const isSameDay = start.toDateString() === end.toDateString();
                                        return <> - {isSameDay
                                            ? end.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })
                                            : end.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        }</>;
                                    })()}
                                </Chip>
                            ) : null}

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

                            {todo.links && Object.keys(todo.links).length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                    {Object.entries(todo.links).map(([title, url]) => (
                                        <Chip
                                            key={url}
                                            size="sm"
                                            variant="flat"
                                            color="primary"
                                            as="a"
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="cursor-pointer hover:bg-primary-100"
                                            startContent="🔗"
                                        >
                                            {title}
                                        </Chip>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                        onPress={() => handleDeleteTodo(todo.id)}
                    >
                        ✕
                    </Button>
                </div>
            ))}
            {todos.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 lg:h-48 text-default-400">
                    <div className="text-4xl lg:text-6xl mb-2 lg:mb-4">🎉</div>
                    <p className="text-base lg:text-lg font-medium">All clear!</p>
                    <p className="text-sm mt-2">No tasks for now. Ask me to create one!</p>
                </div>
            )}
        </div>
    );

    return (
        <ScrollShadow className="h-full p-3">
            <TodoList />
        </ScrollShadow>
    );
}