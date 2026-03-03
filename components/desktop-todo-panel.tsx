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
                <Chip size="sm" variant="shadow" color="primary">
                  {todos.filter((t) => !t.completed).length}
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="p-0 overflow-hidden bg-background/50">
              <ScrollShadow className="h-full p-2" hideScrollBar>
                <div className="flex flex-col gap-2 pb-20">
                  {todos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-default-400">
                      <div className="text-5xl mb-4 grayscale opacity-50">🎉</div>
                      <p className="text-lg font-medium text-default-600">全部完成！</p>
                      <p className="text-xs mt-1 text-default-400">暂无待办事项</p>
                    </div>
                  ) : (
                    <>
                      {/* 今日任务 (使用本地时区比较) */}
                      {(() => {
                        const today = new Date();
                        const todayDateStr = today.toLocaleDateString();
                        const todayTodos = todos.filter(todo => !todo.completed &&
                          todo.startDateTime && new Date(todo.startDateTime).toLocaleDateString() === todayDateStr
                        );

                        return todayTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                              今日任务
                            </h3>
                            <div className="space-y-1.5">
                              {todayTodos.map((todo) => (
                                <div
                                  key={todo.id}
                                  className="group relative p-2.5 rounded-lg border border-primary/30 bg-primary/5 transition-all duration-300 hover:shadow-md hover:border-primary/50"
                                >
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      isSelected={todo.completed}
                                      onValueChange={(v) => handleToggleTodo(todo.id, v)}
                                      color="success"
                                      size="sm"
                                      radius="full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <h4 className="font-medium text-xs leading-snug text-foreground">
                                          {todo.title}
                                        </h4>
                                        <span className="text-[10px] text-default-400 font-mono">
                                          #{todo.id.substring(0, 6)}
                                        </span>
                                      </div>
                                      {todo.description && (
                                        <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-600">
                                          {todo.description}
                                        </p>
                                      )}
                                      {(todo.priority > 1 || todo.startDateTime || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && (
                                            <Chip
                                              size="sm"
                                              variant="flat"
                                              color={todo.priority >= 4 ? "danger" : "warning"}
                                              className="h-4 text-[10px] px-1 min-w-0"
                                            >
                                              P{todo.priority}
                                            </Chip>
                                          )}
                                          {todo.startDateTime && (
                                            <Chip
                                              size="sm"
                                              variant="flat"
                                              color="primary"
                                              className="h-4 text-[10px] px-1 min-w-0"
                                            >
                                              {new Date(todo.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Chip>
                                          )}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5"
                                      onPress={() => handleDeleteTodo(todo.id)}
                                    >
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 无日期 */}
                      {(() => {
                        const noDateTodos = todos.filter(todo => !todo.completed && !todo.startDateTime);

                        return noDateTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-default-300"></span>
                              无日期
                            </h3>
                            <div className="space-y-1.5">
                              {noDateTodos.map((todo) => (
                                <div
                                  key={todo.id}
                                  className={`group relative p-2.5 rounded-lg border transition-all duration-200 hover:shadow-md ${"bg-content1 border-default-100 hover:border-default-300"
                                    }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      isSelected={todo.completed}
                                      onValueChange={(v) => handleToggleTodo(todo.id, v)}
                                      color="success"
                                      size="sm"
                                      radius="full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-xs leading-snug text-foreground">
                                        {todo.title}
                                      </h4>
                                      {todo.description && (
                                        <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-500">
                                          {todo.description}
                                        </p>
                                      )}
                                      {(todo.priority > 1 || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && (
                                            <Chip
                                              size="sm"
                                              variant="flat"
                                              color={todo.priority >= 4 ? "danger" : "warning"}
                                              className="h-4 text-[10px] px-1 min-w-0"
                                            >
                                              P{todo.priority}
                                            </Chip>
                                          )}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5"
                                      onPress={() => handleDeleteTodo(todo.id)}
                                    >
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 逾期未完成 (使用本地时区比较) */}
                      {(() => {
                        const today = new Date();
                        today.setHours(23, 59, 59, 999); // 设置为今天结束时间
                        const overdueTodos = todos.filter(todo => !todo.completed &&
                          todo.startDateTime && new Date(todo.startDateTime) < today
                        );

                        return overdueTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-danger-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>
                              逾期未完成
                            </h3>
                            <div className="space-y-1.5">
                              {overdueTodos.map((todo) => (
                                <div
                                  key={todo.id}
                                  className="group relative p-2.5 rounded-lg border border-danger/30 bg-danger/5 transition-all duration-300 hover:shadow-md hover:border-danger/50"
                                >
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      isSelected={todo.completed}
                                      onValueChange={(v) => handleToggleTodo(todo.id, v)}
                                      color="success"
                                      size="sm"
                                      radius="full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <h4 className="font-medium text-xs leading-snug text-foreground">
                                          {todo.title}
                                        </h4>
                                        <span className="text-[10px] text-default-400 font-mono">
                                          #{todo.id.substring(0, 6)}
                                        </span>
                                      </div>
                                      {todo.description && (
                                        <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-600">
                                          {todo.description}
                                        </p>
                                      )}
                                      {(todo.priority > 1 || todo.startDateTime || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && (
                                            <Chip
                                              size="sm"
                                              variant="flat"
                                              color={todo.priority >= 4 ? "danger" : "warning"}
                                              className="h-4 text-[10px] px-1 min-w-0"
                                            >
                                              P{todo.priority}
                                            </Chip>
                                          )}
                                          {todo.startDateTime && (
                                            <Chip
                                              size="sm"
                                              variant="flat"
                                              color="danger"
                                              className="h-4 text-[10px] px-1 min-w-0"
                                            >
                                              {new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </Chip>
                                          )}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5"
                                      onPress={() => handleDeleteTodo(todo.id)}
                                    >
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 本周 (今天之后的本周内) */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endOfWeek = new Date(today);
                        endOfWeek.setDate(today.getDate() + (7 - today.getDay()) % 7);
                        endOfWeek.setHours(23, 59, 59, 999);

                        const thisWeekTodos = todos.filter(todo => !todo.completed && todo.startDateTime && (() => {
                          const todoDate = new Date(todo.startDateTime);
                          todoDate.setHours(0, 0, 0, 0);
                          return todoDate > today && todoDate <= endOfWeek;
                        })());

                        return thisWeekTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                              本周
                            </h3>
                            <div className="space-y-1.5">
                              {thisWeekTodos.map((todo) => (
                                <div
                                  key={todo.id}
                                  className="group relative p-2.5 rounded-lg border border-primary/20 bg-primary/5 transition-all duration-200 hover:shadow-md"
                                >
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      isSelected={todo.completed}
                                      onValueChange={(v) => handleToggleTodo(todo.id, v)}
                                      color="success"
                                      size="sm"
                                      radius="full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-xs leading-snug text-foreground">
                                        {todo.title}
                                      </h4>
                                      {todo.description && (
                                        <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-500">
                                          {todo.description}
                                        </p>
                                      )}
                                      {(todo.priority > 1 || todo.startDateTime || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && (
                                            <Chip size="sm" variant="flat" color={todo.priority >= 4 ? "danger" : "warning"} className="h-4 text-[10px] px-1 min-w-0">P{todo.priority}</Chip>
                                          )}
                                          {todo.startDateTime && (
                                            <Chip size="sm" variant="flat" color="primary" className="h-4 text-[10px] px-1 min-w-0">
                                              {new Date(todo.startDateTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                            </Chip>
                                          )}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5" onPress={() => handleDeleteTodo(todo.id)}>
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 下周 */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const startOfNextWeek = new Date(today);
                        startOfNextWeek.setDate(today.getDate() + (7 - today.getDay()) % 7 + 1);
                        startOfNextWeek.setHours(0, 0, 0, 0);
                        const endOfNextWeek = new Date(startOfNextWeek);
                        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
                        endOfNextWeek.setHours(23, 59, 59, 999);

                        const nextWeekTodos = todos.filter(todo => !todo.completed && todo.startDateTime && (() => {
                          const todoDate = new Date(todo.startDateTime);
                          return todoDate >= startOfNextWeek && todoDate <= endOfNextWeek;
                        })());

                        return nextWeekTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                              下周
                            </h3>
                            <div className="space-y-1.5">
                              {nextWeekTodos.map((todo) => (
                                <div key={todo.id} className="group relative p-2.5 rounded-lg border border-secondary/20 bg-secondary/5 transition-all duration-200 hover:shadow-md">
                                  <div className="flex items-start gap-2">
                                    <Checkbox isSelected={todo.completed} onValueChange={(v) => handleToggleTodo(todo.id, v)} color="success" size="sm" radius="full" />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-xs leading-snug text-foreground">{todo.title}</h4>
                                      {todo.description && <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-500">{todo.description}</p>}
                                      {(todo.priority > 1 || todo.startDateTime || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && <Chip size="sm" variant="flat" color={todo.priority >= 4 ? "danger" : "warning"} className="h-4 text-[10px] px-1 min-w-0">P{todo.priority}</Chip>}
                                          {todo.startDateTime && <Chip size="sm" variant="flat" color="secondary" className="h-4 text-[10px] px-1 min-w-0">{new Date(todo.startDateTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</Chip>}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5" onPress={() => handleDeleteTodo(todo.id)}>
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 下个月 */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const startOfNextWeek = new Date(today);
                        startOfNextWeek.setDate(today.getDate() + (7 - today.getDay()) % 7 + 1);
                        startOfNextWeek.setHours(0, 0, 0, 0);
                        const endOfNextWeek = new Date(startOfNextWeek);
                        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
                        endOfNextWeek.setHours(23, 59, 59, 999);
                        const endOfNextMonth = new Date(today);
                        endOfNextMonth.setMonth(today.getMonth() + 1);
                        endOfNextMonth.setHours(23, 59, 59, 999);

                        const nextMonthTodos = todos.filter(todo => !todo.completed && todo.startDateTime && (() => {
                          const todoDate = new Date(todo.startDateTime);
                          return todoDate > endOfNextWeek && todoDate <= endOfNextMonth;
                        })());

                        return nextMonthTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-info"></span>
                              下个月
                            </h3>
                            <div className="space-y-1.5">
                              {nextMonthTodos.map((todo) => (
                                <div key={todo.id} className="group relative p-2.5 rounded-lg border border-info/20 bg-info/5 transition-all duration-200 hover:shadow-md">
                                  <div className="flex items-start gap-2">
                                    <Checkbox isSelected={todo.completed} onValueChange={(v) => handleToggleTodo(todo.id, v)} color="success" size="sm" radius="full" />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-xs leading-snug text-foreground">{todo.title}</h4>
                                      {todo.description && <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-500">{todo.description}</p>}
                                      {(todo.priority > 1 || todo.startDateTime || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && <Chip size="sm" variant="flat" color={todo.priority >= 4 ? "danger" : "warning"} className="h-4 text-[10px] px-1 min-w-0">P{todo.priority}</Chip>}
                                          {todo.startDateTime && <Chip size="sm" variant="flat" color="primary" className="h-4 text-[10px] px-1 min-w-0">{new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Chip>}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5" onPress={() => handleDeleteTodo(todo.id)}>
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 未来 */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endOfNextMonth = new Date(today);
                        endOfNextMonth.setMonth(today.getMonth() + 1);
                        endOfNextMonth.setHours(23, 59, 59, 999);

                        const futureTodos = todos.filter(todo => !todo.completed && todo.startDateTime && new Date(todo.startDateTime) > endOfNextMonth);

                        return futureTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-default-400"></span>
                              未来
                            </h3>
                            <div className="space-y-1.5">
                              {futureTodos.map((todo) => (
                                <div key={todo.id} className="group relative p-2.5 rounded-lg border border-default-200 bg-default-50 transition-all duration-200 hover:shadow-md">
                                  <div className="flex items-start gap-2">
                                    <Checkbox isSelected={todo.completed} onValueChange={(v) => handleToggleTodo(todo.id, v)} color="success" size="sm" radius="full" />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-xs leading-snug text-foreground">{todo.title}</h4>
                                      {todo.description && <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed text-default-500">{todo.description}</p>}
                                      {(todo.priority > 1 || todo.startDateTime || todo.links) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {todo.priority > 1 && <Chip size="sm" variant="flat" color={todo.priority >= 4 ? "danger" : "warning"} className="h-4 text-[10px] px-1 min-w-0">P{todo.priority}</Chip>}
                                          {todo.startDateTime && <Chip size="sm" variant="flat" className="h-4 text-[10px] px-1 bg-default-100 text-default-500 min-w-0">{new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Chip>}
                                          {todo.links && Object.entries(todo.links).map(([title, url]) => (
                                            <Chip
                                              key={url}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                              as="a"
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="h-4 text-[10px] px-1 min-w-0 cursor-pointer hover:bg-secondary-100"
                                            >
                                              🔗 {title}
                                            </Chip>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5" onPress={() => handleDeleteTodo(todo.id)}>
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 已完成 */}
                      {(() => {
                        const completedTodos = todos.filter(todo => todo.completed);

                        return completedTodos.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                              已完成
                            </h3>
                            <div className="space-y-1.5">
                              {completedTodos.map((todo) => (
                                <div
                                  key={todo.id}
                                  className="group relative p-2.5 rounded-lg border border-default-100 bg-default-50/50 opacity-60 hover:opacity-100 transition-all duration-200"
                                >
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      isSelected={true}
                                      onValueChange={(v) => handleToggleTodo(todo.id, v)}
                                      color="success"
                                      size="sm"
                                      radius="full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-xs leading-snug line-through text-default-400">
                                        {todo.title}
                                      </h4>
                                      {todo.description && (
                                        <p className="text-[10px] mt-1 line-clamp-2 leading-relaxed line-through text-default-300">
                                          {todo.description}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 h-5 w-5 min-w-5"
                                      onPress={() => handleDeleteTodo(todo.id)}
                                    >
                                      <span className="text-[10px]">✕</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </>
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