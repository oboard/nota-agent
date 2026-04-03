"use client";

import { memo, type ReactNode } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ArrowUpRight,
  Brain,
  CalendarClock,
  Check,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Link2,
  ListTodo,
  Quote,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import { getToolName } from "ai";
import { buildInternalNoteUrl } from "@/lib/note-window";
import { isElectronRuntime, openNoteWindow } from "@/lib/electron-window";
import { useTodoPanelStore } from "@/lib/stores/todo-panel-store";

const plugins = { code, mermaid, math, cjk };

interface MessageItemProps {
  message: any;
  index: number;
  isStreaming?: boolean;
}

function getToolPayload(part: any) {
  return part?.input ?? part?.args ?? {};
}

function getResolvedToolName(part: any) {
  if (part?.toolName) return part.toolName;
  const sdkName = getToolName(part);
  if (sdkName) return sdkName;
  if (typeof part?.type === "string" && part.type.startsWith("tool-")) {
    return part.type.replace(/^tool-/, "");
  }
  return "";
}

function shortId(id?: string) {
  return id ? id.slice(0, 6) : "------";
}

function formatDateTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractText(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function openNote(noteId: string) {
  if (typeof window === "undefined") return;

  if (isElectronRuntime()) {
    void openNoteWindow(noteId);
    return;
  }

  window.open(buildInternalNoteUrl(`/notes/${noteId}`), "_blank", "popup=yes,width=420,height=520");
}

function parseNotePayload(part: any) {
  const payload = getToolPayload(part);
  const output = extractText(part.output);
  const noteLineMatch = output.match(/\[([^\]]+)\]\s*(.+)$/m);
  const readMatch = output.match(/标题：([^\n]+)\n更新时间：[^\n]+\n\n([\s\S]*)$/);
  const deleteMatch = output.match(/便笺\s+([^\s]+)/);

  return {
    id: payload?.id || noteLineMatch?.[1] || deleteMatch?.[1],
    title: payload?.title || noteLineMatch?.[2]?.trim() || readMatch?.[1]?.trim() || "未命名便笺",
    content: payload?.content || readMatch?.[2]?.trim() || "",
    rawOutput: output,
  };
}

function parseNotesList(output: string) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\d+\.\s+\[([^\]]+)\]\s+(.+?)(?:（更新于\s+(.+)）)?$/);
      if (!match) return null;
      return {
        id: match[1],
        title: match[2],
        updatedAt: match[3],
      };
    })
    .filter(Boolean) as Array<{ id: string; title: string; updatedAt?: string }>;
}

function isToolLike(part: any) {
  return (
    part?.type === "tool-call" ||
    part?.type === "tool-call-streaming" ||
    part?.type === "tool-result" ||
    part?.type === "tool-error" ||
    (typeof part?.type === "string" && part.type.startsWith("tool-"))
  );
}

function getCollapsedToolParts(parts: any[]) {
  const firstIndexById = new Map<string, number>();
  const latestById = new Map<string, any>();

  parts.forEach((part, index) => {
    if (!isToolLike(part)) return;
    const id = part.toolCallId || `tool-${index}`;
    if (!firstIndexById.has(id)) {
      firstIndexById.set(id, index);
    }
    latestById.set(id, part);
  });

  return { firstIndexById, latestById };
}

function Surface({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return <div className={`overflow-hidden ${className}`}>{children}</div>;
}

function MemoryCard({ part }: { part: any }) {
  const payload = getToolPayload(part);
  const content = payload?.content || extractText(part.output);
  const isLongTerm = getResolvedToolName(part) === "saveLongTermMemory" || extractText(part.output).includes("长期记忆");

  return (
    <Surface className="rounded-[20px] border border-sky-200/70 bg-sky-50/95">
      <div className="relative px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200/70 bg-white/65">
            <Brain className="h-4 w-4 text-sky-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-semibold text-sky-950/85">
                {isLongTerm ? "长期记住了这件事" : "这段内容已经被记住"}
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-sky-500/70" />
            </div>
            <div className="mt-1.5 rounded-xl border border-white/70 bg-white/55 px-2 py-1.5 text-[11px] leading-5 text-sky-950/80">
              <div className="mb-1 flex items-center gap-1.5 text-sky-500/70">
                <Quote className="h-3.5 w-3.5" />
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="max-h-[5.5rem] overflow-hidden break-words">
                {content || "已整理到记忆层。"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function NoteCard({ part }: { part: any }) {
  const toolName = getResolvedToolName(part);
  const { id, title, content, rawOutput } = parseNotePayload(part);
  const canOpen = Boolean(id && toolName !== "deleteNote" && part.type !== "tool-error");
  const noteList = toolName === "listNotes" ? parseNotesList(rawOutput) : [];

  if (toolName === "listNotes") {
    return (
      <Surface className="rounded-[20px] border border-amber-200/80 bg-amber-50/95">
        <div className="relative px-3 py-2.5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800/70">
            <StickyNote className="h-4 w-4" />
            Notes
          </div>
          <div className="space-y-2">
            {noteList.length > 0 ? noteList.slice(0, 4).map((note) => (
              <button
                key={note.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-amber-200/80 bg-white/80 px-2.5 py-1.5 text-left transition-colors hover:bg-white"
                onClick={() => openNote(note.id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-amber-950/85">{note.title}</div>
                  <div className="mt-0.5 text-[10px] text-amber-800/60">{note.updatedAt || `#${shortId(note.id)}`}</div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-800/70" />
              </button>
            )) : (
              <div className="rounded-xl border border-amber-200/80 bg-white/80 px-2.5 py-3 text-[11px] text-amber-950/70">
                暂时还没有便笺。
              </div>
            )}
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="rounded-[20px] border border-amber-200/80 bg-amber-50/95">
      <div className="relative px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-amber-800/75">
              <StickyNote className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-[0.18em]">
                {toolName === "deleteNote" ? "Note Removed" : "Sticky Note"}
              </span>
            </div>
            <div className="mt-1.5 break-words text-[14px] font-semibold tracking-tight text-amber-950/85">
              {title}
            </div>
            {content ? (
              <div className="mt-1.5 max-h-[6rem] overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-5 text-amber-950/72">
                {content}
              </div>
            ) : (
              <div className="mt-1.5 text-[11px] text-amber-800/60">
                {toolName === "deleteNote" ? "这张便签已经被清走了。" : "便笺已放进你的便签堆。"}
              </div>
            )}
          </div>
          {canOpen ? (
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="h-7 w-7 min-w-7 shrink-0 border border-amber-200/80 bg-white/80 text-amber-900/75"
              onPress={() => openNote(id)}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}

function TodoCard({
  part,
  onOpenPanel,
}: {
  part: any;
  onOpenPanel: () => void;
}) {
  const payload = getToolPayload(part);
  const toolName = getResolvedToolName(part);
  const title = payload?.title || (payload?.id ? `任务 #${shortId(payload.id)}` : "任务");
  const description = payload?.description;
  const start = formatDateTime(payload?.startDateTime);
  const end = formatDateTime(payload?.endDateTime);
  const phases = Array.isArray(payload?.phases) ? payload.phases : [];
  const links = payload?.links ? Object.entries(payload.links) : [];
  const priority = typeof payload?.priority === "number" ? payload.priority : null;
  const isCompleted = toolName === "completeTodo";

  return (
    <Surface className="rounded-[20px] border border-emerald-200/70 bg-emerald-50/95">
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${isCompleted ? "border-emerald-300 bg-emerald-500 text-white" : "border-emerald-200 bg-white/70 text-emerald-600"}`}>
              {isCompleted ? <Check className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`break-words text-[15px] font-semibold ${isCompleted ? "text-emerald-900/65 line-through" : "text-emerald-950/85"}`}>
                  {title}
                </div>
                {priority ? (
                  <Chip size="sm" variant="flat" color={priority >= 4 ? "danger" : "warning"} className="h-5 border-0 text-[10px]">
                    P{priority}
                  </Chip>
                ) : null}
              </div>
              {description ? (
                <div className="mt-1 break-words text-[11px] leading-5 text-emerald-950/72">
                  {description}
                </div>
              ) : null}
              {(start || end) ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white/55 px-2.5 py-1 text-[10px] text-emerald-900/70">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span>{start || "待定"}{end ? ` - ${end}` : ""}</span>
                </div>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="flat"
            className="h-8 min-h-8 shrink-0 border border-emerald-200/80 bg-white/60 px-2 text-[10px] text-emerald-800"
            endContent={<ArrowUpRight className="h-3.5 w-3.5" />}
            onPress={onOpenPanel}
          >
            查看
          </Button>
        </div>

        {phases.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-emerald-200/80 bg-white/45 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-emerald-900/55">
              <Clock3 className="h-3.5 w-3.5" />
              Timeline
            </div>
            <div className="space-y-2">
              {phases.map((phase: any, index: number) => (
                <div key={phase.id || `${phase.title}-${index}`} className="flex items-start gap-2">
                  <div className="mt-1">
                    {phase.completed ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-emerald-500/70" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-emerald-950/80">{phase.title}</div>
                    {(phase.startDateTime || phase.endDateTime) ? (
                      <div className="mt-0.5 text-[10px] text-emerald-900/58">
                        {formatDateTime(phase.startDateTime) || "待定"}{phase.endDateTime ? ` - ${formatDateTime(phase.endDateTime)}` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {links.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map(([label, href]) => (
              <a
                key={String(href)}
                href={String(href)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white/55 px-2.5 py-1 text-[10px] text-emerald-900/75 transition-transform hover:-translate-y-0.5"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>{String(label)}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

function GenericCard({ part }: { part: any }) {
  const toolName = getResolvedToolName(part) || "tool";
  const content = extractText(part.output || getToolPayload(part));

  return (
    <Surface className="rounded-[18px] border border-default-200/80 bg-content1/80">
      <div className="px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2 text-default-500">
          <FileText className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-[0.16em]">{toolName}</span>
        </div>
        <div className="whitespace-pre-wrap break-words text-[11px] leading-5 text-default-700">{content}</div>
      </div>
    </Surface>
  );
}

function ErrorCard({ part }: { part: any }) {
  return (
    <Surface className="rounded-[18px] border border-danger/25 bg-danger-50/80">
      <div className="px-3 py-2.5">
        <div className="text-[12px] font-medium text-danger-700">这次动作没有成功完成</div>
        <div className="mt-1 break-words text-[11px] leading-5 text-danger-700/80">{part.errorText}</div>
      </div>
    </Surface>
  );
}

function renderToolWidget(part: any, onOpenTodoPanel: () => void) {
  if (part.type === "tool-error") {
    return <ErrorCard part={part} />;
  }

  const toolName = getResolvedToolName(part);

  if (toolName.toLowerCase().includes("note")) {
    return <NoteCard part={part} />;
  }

  if (toolName.toLowerCase().includes("memory")) {
    return <MemoryCard part={part} />;
  }

  if (toolName.toLowerCase().includes("todo")) {
    return <TodoCard part={part} onOpenPanel={onOpenTodoPanel} />;
  }

  return <GenericCard part={part} />;
}

const MessageItem = memo(({ message: m, index, isStreaming = false }: MessageItemProps) => {
  const { setExpanded: setTodoPanelExpanded } = useTodoPanelStore();

  if (m.type === "timestamp") {
    return (
      <div className="flex justify-center py-2">
        <div className="rounded-full border border-default-200/70 bg-content1/70 px-2.5 py-0.5 text-[10px] text-default-500 backdrop-blur-sm">
          {m.displayTime}
        </div>
      </div>
    );
  }

  const safeParts = Array.isArray(m?.parts) ? m.parts : [];
  const isUser = m?.role === "user";
  const { firstIndexById, latestById } = getCollapsedToolParts(safeParts);

  const handleOpenTodoPanel = () => {
    setTodoPanelExpanded(true);
  };

  return (
    <div
      data-message-id={m?.id || `message-${index}`}
      className={`animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ${isUser ? "flex justify-end" : "flex justify-start"}`}
    >
      <div className="max-w-[92%] min-w-0 lg:max-w-[78%] xl:max-w-[760px]">
        <div
          className={`max-w-full overflow-hidden rounded-[14px] border px-2 py-1.5 text-[11px] leading-5 transition-colors lg:text-[12px] ${isUser
            ? "border-default-200/70 bg-content2/60 text-foreground"
            : "border-transparent bg-transparent px-0 py-0 text-foreground"
            }`}
        >
          <div className="flex flex-col gap-2.5">
            {safeParts.map((part: any, partIndex: number) => {
              if (isToolLike(part)) {
                const id = part.toolCallId || `tool-${partIndex}`;
                if (firstIndexById.get(id) !== partIndex) {
                  return null;
                }
                const finalPart = latestById.get(id) || part;
                return <div key={id}>{renderToolWidget(finalPart, handleOpenTodoPanel)}</div>;
              }

              switch (part.type) {
                case "text":
                  return (
                    <div key={partIndex} className="min-w-0 overflow-hidden break-words">
                      <Streamdown
                        plugins={plugins}
                        isAnimating={isStreaming && m.role === "assistant" && partIndex === m.parts.length - 1}
                        className={`sd-theme ${isUser ? "sd-theme--user prose-invert dark:prose-invert" : "sd-theme--assistant prose-neutral dark:prose-invert"} prose prose-sm max-w-none prose-p:my-0.5 prose-headings:my-1 prose-code:break-all`}
                      >
                        {part.text}
                      </Streamdown>
                    </div>
                  );
                case "reasoning":
                  return (
                    <details
                      key={partIndex}
                      open={part.state === "streaming"}
                      className="mt-1 rounded-lg border border-default-200/70 bg-content1/60 px-2 py-1.5 text-default-700 open:bg-content1 dark:text-default-300"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium leading-4 marker:content-none">
                        <span className="inline-flex items-center gap-1.5">
                          <Brain className="h-3 w-3" />
                          <span>{part.state === "streaming" ? "Thinking" : "Thought process"}</span>
                        </span>
                      </summary>
                      <div className="mt-1.5 border-l-2 border-default-300/70 pl-2.5 text-default-600 dark:border-default-600/70 dark:text-default-400">
                        <Streamdown
                          plugins={plugins}
                          isAnimating={part.state === "streaming"}
                          className="sd-theme sd-theme--muted sd-theme--assistant prose prose-xs max-w-none prose-p:my-0.5"
                        >
                          {part.text}
                        </Streamdown>
                      </div>
                    </details>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  return prevProps.message === nextProps.message;
});

MessageItem.displayName = "MessageItem";

export { MessageItem };
