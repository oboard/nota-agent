"use client";

import { memo } from "react";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Spinner } from "@heroui/spinner";
import { Brain, Check, Cog, Wrench } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import { getToolName } from "ai";
import 'katex/dist/katex.min.css';

const plugins = { code, mermaid, math, cjk };

// Memoized Avatar component
const MemoizedAvatar = memo(({ role }: { role: string }) => (
  <Avatar
    src={role === "user" ? undefined : "https://i.pravatar.cc/150?u=nota"}
    name={role === "user" ? "User" : "Nota"}
    size="sm"
    className="flex-shrink-0 mt-1 w-8 h-8 lg:w-10 lg:h-10"
    showFallback
  />
));
MemoizedAvatar.displayName = 'MemoizedAvatar';

interface MessageItemProps {
  message: any;
  status: string;
  index: number;
}

const MessageItem = memo(({ message: m, status, index }: MessageItemProps) => {
  // Timestamp separator
  if (m.type === 'timestamp') {
    return (
      <div className="flex justify-center py-2">
        <div className="bg-default-100 px-3 py-1 rounded-full text-xs text-default-500">
          {m.displayTime}
        </div>
      </div>
    );
  }

  const safeParts = Array.isArray(m?.parts) ? m.parts : [];

  return (
    <div
      data-message-id={m?.id || `message-${index}`}
      className={`flex gap-2 lg:gap-3 ${m?.role === "user" ? "flex-row-reverse" : "flex-row"}`}
    >
      <MemoizedAvatar role={m?.role} />
      <div className={`flex flex-col max-w-[85%] lg:max-w-[60%] xl:max-w-[500px] min-w-0 ${m?.role === "user" ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl space-y-1.5 px-3 py-1.5 lg:px-4 lg:py-2 text-sm lg:text-base max-w-full overflow-hidden ${m?.role === "user"
            ? "bg-default-200 text-foreground rounded-tr-none"
            : "bg-default-100 text-foreground rounded-tl-none shadow-sm"
            }`}
        >
          {safeParts.map((part: any, partIndex: number) => {
            switch (part.type) {
              case 'text':
                return (
                  <div key={partIndex} className="min-w-0 overflow-hidden break-words">
                    <Streamdown
                      plugins={plugins}
                      isAnimating={status === 'streaming' && m.role === 'assistant' && partIndex === m.parts.length - 1}
                      className={`${m.role === "user" ? "prose-invert" : "prose-neutral"} prose-pre:overflow-x-auto prose-code:break-all prose-p:my-1 prose-headings:my-2`}
                    >
                      {part.text}
                    </Streamdown>
                  </div>
                );
              case 'reasoning':
                return (
                  <Accordion
                    key={partIndex}
                    variant="bordered"
                    className="mt-1">
                    <AccordionItem
                      key={`reasoning-${partIndex}`}
                      aria-label="Reasoning"
                      title={
                        <div className="flex items-center gap-1.5 text-xs">
                          <Brain className="w-3 h-3" />
                          <span className="font-medium text-blue-600">
                            {part.state === 'streaming' ? '思考中...' : '思考过程'}
                          </span>
                          {part.state === 'streaming' && (
                            <div className="flex gap-0.5">
                              <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                        </div>
                      }
                    >
                      <div className="p-2 rounded bg-blue-50/50 border border-blue-100 text-xs w-full">
                        <div className="text-blue-700 opacity-90 italic">
                          <Streamdown
                            plugins={plugins}
                            isAnimating={part.state === 'streaming'}
                            className="prose-blue text-xs prose-p:my-0.5"
                          >
                            {part.text}
                          </Streamdown>
                        </div>
                      </div>
                    </AccordionItem>
                  </Accordion>
                );
              case 'tool-call':
              case 'tool-call-streaming': {
                const toolCallId = part.toolCallId;
                const toolName = getToolName(part);
                return (
                  <div key={toolCallId} className="mt-1 p-2 rounded bg-background/50 border border-default-200/50 text-xs w-full">
                    <div className="flex items-center gap-1.5">
                      {toolName === "createTodo" ? <Check className="w-3 h-3" /> : <Cog className="w-3 h-3" />}
                      <span className="font-medium opacity-80">{toolName}</span>
                      <Chip size="sm" variant="flat" color="primary" className="h-4 text-[10px]">Running</Chip>
                    </div>
                    {toolName === "createTodo" && part.output?.title && (
                      <div className="font-medium mt-0.5">{part.output.title}</div>
                    )}
                    {toolName === "saveMemory" && part.args?.content && (
                      <div className="italic opacity-80 mt-0.5">"{part.args.content}"</div>
                    )}
                  </div>
                );
              }
              case 'tool-result':
                return (
                  <div key={part.toolCallId} className="mt-1 p-1.5 rounded bg-success-50/50 border border-success-100 text-[10px] w-full">
                    <div className="flex items-center gap-1.5 text-success-600">
                      <Check className="w-3 h-3" />
                      <span>Completed: {part.toolName}</span>
                    </div>
                  </div>
                );
              case 'tool-error':
                return (
                  <div key={part.toolCallId} className="mt-1 p-1.5 rounded bg-danger-50/50 border border-danger-100 text-[10px] text-danger w-full">
                    Error: {part.errorText}
                  </div>
                );
              default:
                // 兼容更多工具与步骤类型显示
                if (typeof part.type === 'string') {
                  if (part.type.startsWith('tool-')) {
                    const name = part.type.replace(/^tool-/, '');
                    return (
                      <div key={`tool-${name}-${partIndex}`} className="mt-2 p-3 rounded-lg bg-background/50 border border-default-200/50 text-sm w-full">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="w-4 h-4" />
                          <span className="font-semibold opacity-80">{name}</span>
                          <Chip size="sm" variant="flat" color="primary" className="h-5 text-xs">Running</Chip>
                        </div>
                        {part.args && (
                          <pre className="text-xs bg-default-100 rounded-md p-2 overflow-auto">{JSON.stringify(part.args, null, 2)}</pre>
                        )}
                        {part.output && (
                          <pre className="text-xs bg-default-100 rounded-md p-2 overflow-auto mt-2">{JSON.stringify(part.output, null, 2)}</pre>
                        )}
                      </div>
                    );
                  }
                  if (part.type.startsWith('step-')) {
                    const step = part.type.replace(/^step-/, '');
                    return (<div key={`step-${step}-${partIndex}`}></div>);
                  }
                }
                console.warn('Unknown message part type:', part.type);
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  // Only re-render if:
  // 1. Message object identity changes (new content)
  // 2. Status changes AND it's the last message (currently streaming)
  // 3. Index changes (unlikely unless reordering)

  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.status !== nextProps.status) {
    // If status changed, we only care if this is potentially the active message
    // A simplified check: if it's an assistant message, it might be streaming.
    // Ideally, we should check if it's the *last* message.
    // However, the parent passes `status` which is global.
    // We can rely on `message` prop changes for content updates.
    // The `status` prop is used for `isAnimating`.

    // If the message is complete, status changes shouldn't matter unless it goes from streaming -> non-streaming
    // But since `isAnimating` depends on `status`, we must re-render if status changes 
    // AND this message is involved in animation (i.e. it's the assistant's last message).

    // Actually, `isAnimating` logic in render is: `status === 'streaming' && m.role === 'assistant' && index === m.parts.length - 1`
    // This logic is inside the component. So if `status` changes, we might need to update.

    // To be safe and still get performance benefits:
    // If the message is NOT the last one, status changes don't matter (usually).
    // But we don't know if it's the last one easily here without passing `isLast`.
    // Let's stick to default shallow comparison for now, but `message` prop changes are the main driver.
    // Since `useChat` updates the message object reference on every token,
    // this `memo` will still re-render the *active* message on every token, which is correct.
    // It will *prevent* re-rendering of *all previous* messages.
    return prevProps.message === nextProps.message;
  }

  return prevProps.message === nextProps.message;
});

MessageItem.displayName = 'MessageItem';

export { MessageItem, MemoizedAvatar };