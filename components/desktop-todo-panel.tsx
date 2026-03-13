"use client";

import type { ReactNode } from "react";
import { TodoData, TaskPhase } from "@/lib/storage";
import { Button } from "@heroui/button";
import { useTodoPanelStore } from "@/lib/stores/todo-panel-store";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Checkbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { toggleTodo, deleteTodo, updateTodo, toggleSuspended } from "@/app/actions";
import { ChevronLeft, ChevronRight, Link as LinkIcon, X, PartyPopper, CalendarClock, CheckCircle2, Circle, Pause, Play } from "lucide-react";

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

  const handleToggleSuspended = async (id: string, suspended: boolean) => {
    await toggleSuspended(id, suspended);
    onRefresh();
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
    onRefresh();
  };

  const handleTogglePhase = async (todoId: string, phases: TaskPhase[], phaseId: string, completed: boolean) => {
    const newPhases = phases.map(p => p.id === phaseId ? { ...p, completed } : p);
    // Check if all phases are completed, maybe auto-complete the todo?
    // For now, just update the phase.
    await updateTodo(todoId, { phases: newPhases });
    onRefresh();
  }

  // 复用组件：阶段时间线
  const PhaseTimeline = ({ todo }: { todo: TodoData }) => {
    if (!todo.phases || todo.phases.length === 0) return null;

    const now = new Date();

    const isPhaseActive = (phase: TaskPhase) => {
      if (phase.completed) return false;
      if (phase.startDateTime && phase.endDateTime) {
        const start = new Date(phase.startDateTime);
        const end = new Date(phase.endDateTime);
        return now >= start && now <= end;
      }
      const index = todo.phases!.findIndex(p => p.id === phase.id);
      if (index === 0) return true;
      return todo.phases![index - 1].completed;
    };

    return (
      <div className="mt-4 px-1 relative">
        <div className="space-y-3">
          {todo.phases.map((phase, index) => {
            const isCompleted = phase.completed;
            const isActive = isPhaseActive(phase);

            return (
              <div
                key={phase.id}
                className={`group/phase relative flex gap-3 items-center`}
              >
                {/* 状态点 - 使用 Checkbox 或自定义指示器 */}
                <div className="relative z-10 flex-shrink-0">
                  <Checkbox
                    isSelected={isCompleted}
                    color={isActive ? "primary" : "success"}
                    radius="full"
                    onValueChange={(v) => handleTogglePhase(todo.id, todo.phases!, phase.id, v)}
                    classNames={{
                      wrapper: `group-hover:scale-110 transition-transform ${isActive ? "ring-2 ring-primary-100 dark:ring-primary-900/30 ring-offset-2 ring-offset-background" : ""}`,
                      icon: isCompleted ? "text-white" : "",
                    }}
                  />
                </div>

                {/* 内容卡片 - 使用 Card */}
                <Card
                  shadow="sm"
                  className={`flex-1 min-w-0 transition-all duration-300 border-1
                    ${isCompleted
                      ? "bg-default-50/50 border-default-100 opacity-60 hover:opacity-100"
                      : isActive
                        ? "bg-content1 border-primary-200 dark:border-primary-800 shadow-md shadow-primary/5"
                        : "bg-content1 border-default-100 hover:border-default-200"
                    }
                  `}
                  isPressable
                  onPress={() => handleTogglePhase(todo.id, todo.phases!, phase.id, !isCompleted)}
                >
                  <CardBody className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[14px] font-medium transition-colors ${isCompleted ? "text-default-500 line-through" :
                        isActive ? "text-primary-600 dark:text-primary-400 font-semibold" : "text-foreground"
                        }`}>
                        {phase.title}
                      </span>
                      {isActive && !isCompleted && (
                        <Chip size="sm" color="primary" variant="flat" className="h-5 px-2 text-[10px] font-bold">
                          进行中
                        </Chip>
                      )}
                    </div>

                    {(phase.startDateTime || phase.endDateTime) && (
                      <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] font-medium ${isActive ? "text-primary-500/80" : "text-default-400"
                        }`}>
                        <CalendarClock className="w-3.5 h-3.5 opacity-70" />
                        <span>
                          {phase.startDateTime && new Date(phase.startDateTime).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          {phase.startDateTime && phase.endDateTime && " - "}
                          {phase.endDateTime && new Date(phase.endDateTime).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 复用组件：单个待办行
  const TodoItemRow = ({
    todo,
    itemClassName,
    getDateChip,
  }: {
    todo: TodoData;
    itemClassName: string;
    getDateChip?: (todo: TodoData) => ReactNode;
  }) => (
    <div
      key={todo.id}
      className={itemClassName}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          isSelected={todo.completed}
          onValueChange={(v) => handleToggleTodo(todo.id, v)}
          color="success"
          size="sm"
          radius="full"
          isDisabled={todo.suspended}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className={`font-medium text-xs leading-snug ${todo.completed ? "line-through text-default-400" : todo.suspended ? "text-default-400 italic" : "text-foreground"}`}>
              {todo.title}
            </h4>
            {todo.suspended && (
              <Chip
                size="sm"
                variant="flat"
                color="default"
                className="h-4 text-[10px] px-1 min-w-0 bg-default-200/50 animate-[pulse_2s_ease-in-out_infinite]"
              >
                已挂起
              </Chip>
            )}
            <span className="text-[10px] text-default-400 font-mono">
              #{todo.id.substring(0, 6)}
            </span>
          </div>
          {todo.description && (
            <p className={`text-[10px] mt-1 leading-relaxed ${todo.completed ? "line-through text-default-300" : todo.suspended ? "text-default-300" : "text-default-600"}`}>
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
              {getDateChip && getDateChip(todo)}
              {todo.links &&
                Object.entries(todo.links).map(([title, url]) => (
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
                    <div className="flex items-center gap-1">
                      {<LinkIcon className="w-3 h-3" />} {title}
                    </div>
                  </Chip>
                ))}
            </div>
          )}
          {todo.phases && todo.phases.length > 0 && (
            <PhaseTimeline todo={todo} />
          )}
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="opacity-0 group-hover:opacity-100 transition-all duration-300 -mr-1 -mt-1 text-default-300 hover:text-default-500 hover:bg-default-100 hover:scale-110 active:scale-95 h-5 w-5 min-w-5"
          onPress={() => handleToggleSuspended(todo.id, !todo.suspended)}
          title={todo.suspended ? "恢复任务" : "挂起任务"}
        >
          <span className={todo.suspended ? "animate-[spin_0.5s_ease-out]" : ""}>
            {todo.suspended ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </span>
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="opacity-0 group-hover:opacity-100 transition-all duration-300 -mr-1 -mt-1 text-default-300 hover:text-danger hover:bg-danger-50 hover:scale-110 active:scale-95 h-5 w-5 min-w-5"
          onPress={() => handleDeleteTodo(todo.id)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div >
  );

  // 复用组件：区块渲染
  const SectionBlock = ({
    title,
    indicatorClassName,
    todos,
    itemClassName,
    getDateChip,
  }: {
    title: string;
    indicatorClassName: string;
    todos: TodoData[];
    itemClassName: string;
    getDateChip?: (todo: TodoData) => ReactNode;
  }) => {
    if (!todos || todos.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-default-500 px-2 flex items-center gap-1.5">
          <span className={indicatorClassName}></span>
          {title}
        </h3>
        <div className="space-y-1.5">
          {todos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              itemClassName={itemClassName}
              getDateChip={getDateChip}
            />
          ))}
        </div>
      </div>
    );
  };

  // 日期Chip渲染：今日任务（时间范围）
  const renderTodayChip = (todo: TodoData) => {
    if (!todo.startDateTime) return null;
    const start = new Date(todo.startDateTime);
    const end = todo.endDateTime ? new Date(todo.endDateTime) : start;
    const isSameDay = start.toDateString() === end.toDateString();
    return (
      <Chip
        size="sm"
        variant="flat"
        color="primary"
        className="h-4 text-[10px] px-1 min-w-0"
      >
        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {" "}
        -{" "}
        {isSameDay
          ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : end.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
      </Chip>
    );
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
          {isTodoPanelExpanded ? (
            <ChevronRight className="w-4 h-4 text-default-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-default-500" />
          )}
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
                  {todos.filter((t) => !t.completed && !t.suspended).length}
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="p-0 overflow-hidden bg-background/50">
              <ScrollShadow className="h-full p-2" hideScrollBar>
                <div className="flex flex-col gap-2 pb-20">
                  {todos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-default-400">
                      <div className="text-5xl mb-4 grayscale opacity-50">{<PartyPopper className="w-12 h-12" />}</div>
                      <p className="text-lg font-medium text-default-600">全部完成！</p>
                      <p className="text-xs mt-1 text-default-400">暂无待办事项</p>
                    </div>
                  ) : (
                    <>
                      {/* 今日任务 (开始时间或结束时间在今天，或时间范围跨越今天) */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const todayEnd = new Date(today);
                        todayEnd.setHours(23, 59, 59, 999);

                        const todayTodos = todos.filter((todo) => {
                          if (todo.completed) return false;
                          if (todo.suspended) return false;
                          if (!todo.startDateTime) return false;

                          const startTime = new Date(todo.startDateTime);
                          const endTime = todo.endDateTime
                            ? new Date(todo.endDateTime)
                            : startTime;

                          return (
                            (startTime >= today && startTime <= todayEnd) ||
                            (endTime >= today && endTime <= todayEnd) ||
                            (startTime < today && endTime > todayEnd)
                          );
                        });

                        return (
                          <SectionBlock
                            title="今日任务"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                            todos={todayTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-primary/30 bg-primary/5 transition-all duration-300 hover:shadow-md hover:border-primary/50 hover:scale-[1.02] active:scale-[0.98]"
                            getDateChip={renderTodayChip}
                          />
                        );
                      })()}

                      {/* 无日期 */}
                      {(() => {
                        const noDateTodos = todos.filter(
                          (todo) => !todo.completed && !todo.suspended && !todo.startDateTime
                        );

                        return (
                          <SectionBlock
                            title="无日期"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-default-300"
                            todos={noDateTodos}
                            itemClassName={`group relative p-2.5 rounded-lg border transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${"bg-content1 border-default-100 hover:border-default-300"}`}
                          />
                        );
                      })()}

                      {/* 逾期未完成 (结束时间早于现在) */}
                      {(() => {
                        const now = new Date();
                        const overdueTodos = todos.filter(todo => {
                          if (todo.completed) return false;
                          if (todo.suspended) return false;
                          // 使用结束时间判断逾期，如果没有结束时间则使用开始时间
                          const endTime = todo.endDateTime ? new Date(todo.endDateTime) : (todo.startDateTime ? new Date(todo.startDateTime) : null);
                          return endTime && endTime < now;
                        });

                        return overdueTodos.length > 0 && (
                          <SectionBlock
                            title="逾期未完成"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"
                            todos={overdueTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-danger/30 bg-danger/5 transition-all duration-300 hover:shadow-md hover:border-danger/50 hover:scale-[1.02] active:scale-[0.98]"
                            getDateChip={(todo) => (
                              todo.startDateTime ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="danger"
                                  className="h-4 text-[10px] px-1 min-w-0"
                                >
                                  {new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  {todo.endDateTime && <> - {new Date(todo.endDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                                </Chip>
                              ) : null
                            )}
                          />
                        );
                      })()}

                      {/* 本周 (今天之后的本周内) */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endOfWeek = new Date(today);
                        endOfWeek.setDate(today.getDate() + (7 - today.getDay()) % 7);
                        endOfWeek.setHours(23, 59, 59, 999);

                        const thisWeekTodos = todos.filter(todo => !todo.completed && !todo.suspended && todo.startDateTime && (() => {
                          const todoDate = new Date(todo.startDateTime);
                          todoDate.setHours(0, 0, 0, 0);
                          return todoDate > today && todoDate <= endOfWeek;
                        })());

                        return thisWeekTodos.length > 0 && (
                          <SectionBlock
                            title="本周"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-primary"
                            todos={thisWeekTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-primary/20 bg-primary/5 transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                            getDateChip={(todo) => (
                              todo.startDateTime ? (
                                <Chip size="sm" variant="flat" color="primary" className="h-4 text-[10px] px-1 min-w-0">
                                  {new Date(todo.startDateTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                  {todo.endDateTime && <> - {new Date(todo.endDateTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</>}
                                </Chip>
                              ) : null
                            )}
                          />
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

                        const nextWeekTodos = todos.filter(todo => !todo.completed && !todo.suspended && todo.startDateTime && (() => {
                          const todoDate = new Date(todo.startDateTime);
                          return todoDate >= startOfNextWeek && todoDate <= endOfNextWeek;
                        })());

                        return nextWeekTodos.length > 0 && (
                          <SectionBlock
                            title="下周"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-secondary"
                            todos={nextWeekTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-secondary/20 bg-secondary/5 transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                            getDateChip={(todo) => (
                              todo.startDateTime ? (
                                <Chip size="sm" variant="flat" color="secondary" className="h-4 text-[10px] px-1 min-w-0">
                                  {new Date(todo.startDateTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                  {todo.endDateTime && <> - {new Date(todo.endDateTime).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</>}
                                </Chip>
                              ) : null
                            )}
                          />
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

                        const nextMonthTodos = todos.filter(todo => !todo.completed && !todo.suspended && todo.startDateTime && (() => {
                          const todoDate = new Date(todo.startDateTime);
                          return todoDate > endOfNextWeek && todoDate <= endOfNextMonth;
                        })());

                        return nextMonthTodos.length > 0 && (
                          <SectionBlock
                            title="下个月"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-info"
                            todos={nextMonthTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-info/20 bg-info/5 transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                            getDateChip={(todo) => (
                              todo.startDateTime ? (
                                <Chip size="sm" variant="flat" color="primary" className="h-4 text-[10px] px-1 min-w-0">
                                  {new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  {todo.endDateTime && <> - {new Date(todo.endDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                                </Chip>
                              ) : null
                            )}
                          />
                        );
                      })()}

                      {/* 未来 */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endOfNextMonth = new Date(today);
                        endOfNextMonth.setMonth(today.getMonth() + 1);
                        endOfNextMonth.setHours(23, 59, 59, 999);

                        const futureTodos = todos.filter(todo => !todo.completed && !todo.suspended && todo.startDateTime && new Date(todo.startDateTime) > endOfNextMonth);

                        return futureTodos.length > 0 && (
                          <SectionBlock
                            title="未来"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-default-400"
                            todos={futureTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-default-200 bg-default-50 transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                            getDateChip={(todo) => (
                              todo.startDateTime ? (
                                <Chip size="sm" variant="flat" className="h-4 text-[10px] px-1 bg-default-100 text-default-500 min-w-0">
                                  {new Date(todo.startDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  {todo.endDateTime && <> - {new Date(todo.endDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                                </Chip>
                              ) : null
                            )}
                          />
                        );
                      })()}

                      {/* 已挂起 */}
                      {(() => {
                        const suspendedTodos = todos.filter(todo => todo.suspended);

                        return suspendedTodos.length > 0 && (
                          <SectionBlock
                            title="已挂起"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-default-400 animate-[pulse_3s_ease-in-out_infinite]"
                            todos={suspendedTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-default-200 bg-default-100/50 opacity-70 hover:opacity-100 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                          />
                        );
                      })()}

                      {/* 已完成 */}
                      {(() => {
                        const completedTodos = todos.filter(todo => todo.completed);

                        return completedTodos.length > 0 && (
                          <SectionBlock
                            title="已完成"
                            indicatorClassName="w-1.5 h-1.5 rounded-full bg-success"
                            todos={completedTodos}
                            itemClassName="group relative p-2.5 rounded-lg border border-default-100 bg-default-50/50 opacity-60 hover:opacity-100 transition-all duration-200"
                          />
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