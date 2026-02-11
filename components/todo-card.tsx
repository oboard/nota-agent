"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Accordion, AccordionItem } from "@heroui/accordion";
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
        <>
            {/* Desktop View */}
            <Card className="hidden lg:flex w-full h-full">
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
                        <TodoList />
                    </ScrollShadow>
                </CardBody>
            </Card>

            {/* Mobile View */}
            <div className="lg:hidden w-full transition-all duration-300">
                <Accordion
                    variant="splitted"
                    className="px-0"
                    onSelectionChange={(keys) => {
                        const isExpanded = Array.from(keys).includes("todos");
                        onMobileExpandChange?.(isExpanded);
                    }}
                >
                    <AccordionItem
                        key="todos"
                        aria-label="Tasks"
                        title={
                            <div className="flex justify-between items-center w-full pr-2">
                                <span className="font-semibold">My Tasks</span>
                                <Chip size="sm" variant="solid" color="primary">
                                    {todos.filter((t) => !t.completed).length}
                                </Chip>
                            </div>
                        }
                        classNames={{
                            content: "h-[calc(100vh-140px)] overflow-y-auto"
                        }}
                    >
                        <div className="pb-20">
                            <TodoList />
                        </div>
                    </AccordionItem>
                </Accordion>
            </div>
        </>
    );
}