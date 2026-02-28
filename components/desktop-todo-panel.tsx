"use client";

import { TodoData } from "@/lib/storage";
import { Button } from "@heroui/button";
import { useTodoPanelStore } from "@/lib/stores/todo-panel-store";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Checkbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { toggleTodo, deleteTodo } from "@/app/actions";

interface DesktopTodoPanelProps {
  todos: TodoData[];
  onRefresh: () => void;
}

export function DesktopTodoPanel({ todos, onRefresh }: DesktopTodoPanelProps) {
  const { isTodoPanelExpanded, toggleTodoPanel } = useTodoPanelStore();

  const handleToggleTodo = async (id: string, completed: boolean) => {
    await toggleTodo(id, completed);
    onRefresh();
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
    onRefresh();
  };

  return (
    <div
      className={`relative flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out h-full ${!isTodoPanelExpanded ? "w-0" : "w-80 xl:w-96"}`}
    >
      <div className="absolute -left-3 top-6 z-100">
        <Button
          isIconOnly
          size="sm"
          variant="faded"
          radius="full"
          className="shadow-sm w-8 h-8 min-w-6 bg-background border-default-200 hover:scale-110 transition-transform"
          onPress={toggleTodoPanel}
        >
          <span className="text-default-500 text-xs">{isTodoPanelExpanded ? "▶" : "◀"}</span>
        </Button>
      </div>

      <Card className="h-full w-full overflow-hidden border-none shadow-sm">
        {!isTodoPanelExpanded ? (
          <div className="h-full flex flex-col items-center py-4 bg-default-50">
            <div className="writing-vertical-rl text-default-500 font-bold tracking-widest uppercase transform rotate-180 py-8 select-none">
              My Tasks
            </div>
            <div className="mt-2 flex flex-col gap-3 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <div className="w-1.5 h-1.5 rounded-full bg-default-400" />
              <div className="w-1.5 h-1.5 rounded-full bg-default-400" />
            </div>
          </div>
        ) : (
          <>
            <CardHeader className="px-5 py-4 border-b border-default-100 flex justify-between items-center bg-default-50/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-default-800">待办事项</span>
                <Chip size="sm" variant="shadow" color="primary" className="h-5 min-w-5 px-0">
                  {todos.filter((t) => !t.completed).length}
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="p-0 overflow-hidden bg-background/50">
              <ScrollShadow className="h-full p-3" hideScrollBar>
                <div className="flex flex-col gap-2.5 pb-20">
                  {todos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-default-400">
                      <div className="text-5xl mb-4 grayscale opacity-50">🎉</div>
                      <p className="text-lg font-medium text-default-600">全部完成！</p>
                      <p className="text-xs mt-1 text-default-400">暂无待办事项</p>
                    </div>
                  ) : (
                    todos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`group relative p-3.5 rounded-xl border transition-all duration-200 hover:shadow-md ${todo.completed
                          ? "bg-default-50/50 border-transparent opacity-60 hover:opacity-100"
                          : "bg-content1 border-default-100 hover:border-primary-200/50"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            isSelected={todo.completed}
                            onValueChange={(v) => handleToggleTodo(todo.id, v)}
                            color="success"
                            size="md"
                            radius="full"
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0 pt-0.5">
                            <h4
                              className={`font-medium text-sm leading-snug ${todo.completed
                                ? "line-through text-default-400"
                                : "text-default-900"
                                }`}
                            >
                              {todo.title}
                            </h4>
                            {todo.description && (
                              <p
                                className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${todo.completed
                                  ? "text-default-300"
                                  : "text-default-500"
                                  }`}
                              >
                                {todo.description}
                              </p>
                            )}
                            {(todo.priority > 1 || todo.startDateTime) && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {todo.priority > 1 && (
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={
                                      todo.priority >= 4 ? "danger" : "warning"
                                    }
                                    className="h-5 text-[10px] px-1.5 min-w-0"
                                  >
                                    P{todo.priority}
                                  </Chip>
                                )}
                                {todo.startDateTime && (
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    className="h-5 text-[10px] px-1.5 bg-default-100 text-default-500 min-w-0"
                                  >
                                    {new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </Chip>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2 text-default-300 hover:text-danger hover:bg-danger-50"
                            onPress={() => handleDeleteTodo(todo.id)}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollShadow>
            </CardBody>
          </>
        )}
      </Card>
    </div>
  );
}