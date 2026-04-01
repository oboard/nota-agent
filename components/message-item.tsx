"use client";

import { memo } from "react";
import { Chip } from "@heroui/chip";
import { Brain, Check, Cog, Wrench } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { cjk } from '@streamdown/cjk';
import { getToolName } from "ai";
import 'katex/dist/katex.min.css';

const plugins = { code, mermaid, math, cjk };

interface MessageItemProps {
  message: any;
  index: number;
  isStreaming?: boolean;
}

const MessageItem = memo(({ message: m, index, isStreaming = false }: MessageItemProps) => {
  // Timestamp separator
  if (m.type === 'timestamp') {
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

  return (
    <div
      data-message-id={m?.id || `message-${index}`}
      className={`animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ${isUser ? "flex justify-end" : "flex justify-start"}`}
    >
      <div className={`max-w-[92%] min-w-0 lg:max-w-[78%] xl:max-w-[760px]`}>
        <div
          className={`max-w-full overflow-hidden rounded-[14px] border px-2 py-1.5 text-[11px] leading-5 transition-colors lg:text-[12px] ${isUser
            ? "border-default-200/70 bg-content2/60 text-foreground"
            : "border-transparent bg-transparent px-0 py-0 text-foreground"
            }`}
        >
          {safeParts.map((part: any, partIndex: number) => {
            switch (part.type) {
              case 'text':
                return (
                  <div key={partIndex} className="min-w-0 overflow-hidden break-words">
                    <Streamdown
                      plugins={plugins}
                      isAnimating={isStreaming && m.role === 'assistant' && partIndex === m.parts.length - 1}
                      className={`sd-theme ${isUser ? "sd-theme--user prose-invert dark:prose-invert" : "sd-theme--assistant prose-neutral dark:prose-invert"} prose prose-sm max-w-none prose-p:my-0.5 prose-headings:my-1 prose-code:break-all`}
                    >
                      {part.text}
                    </Streamdown>
                  </div>
                );
              case 'reasoning':
                return (
                  <details
                    key={partIndex}
                    open={part.state === 'streaming'}
                    className="mt-1 rounded-lg border border-default-200/70 bg-content1/60 px-2 py-1.5 text-default-700 open:bg-content1 dark:text-default-300"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium leading-4 marker:content-none">
                      <span className="inline-flex items-center gap-1.5">
                        <Brain className="h-3 w-3" />
                        <span>{part.state === 'streaming' ? 'Thinking' : 'Thought process'}</span>
                      </span>
                      {part.state === 'streaming' && (
                        <span className="inline-flex items-center gap-1" aria-hidden="true">
                          <span className="h-1 w-1 rounded-full bg-primary/80 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1 w-1 rounded-full bg-primary/80 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1 w-1 rounded-full bg-primary/80 animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                    </summary>
                    <div className="mt-1.5 border-l-2 border-default-300/70 pl-2.5 text-default-600 dark:border-default-600/70 dark:text-default-400">
                      <Streamdown
                        plugins={plugins}
                        isAnimating={part.state === 'streaming'}
                        className="sd-theme sd-theme--muted sd-theme--assistant prose prose-xs max-w-none prose-p:my-0.5"
                      >
                        {part.text}
                      </Streamdown>
                    </div>
                  </details>
                );
              case 'tool-call':
              case 'tool-call-streaming': {
                const toolCallId = part.toolCallId;
                const toolName = getToolName(part);
                return (
                  <div key={toolCallId} className="mt-1 w-full rounded-lg border border-default-200/70 bg-content2/50 p-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {toolName === "createTodo" ? <Check className="w-3 h-3" /> : <Cog className="w-3 h-3" />}
                      <span className="font-medium opacity-80">{toolName}</span>
                      <Chip size="sm" variant="flat" color="primary" className="h-4 border-0 text-[9px]">Running</Chip>
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
                  <div key={part.toolCallId} className="mt-1 w-full rounded-lg border border-success/20 bg-success/10 p-1 text-[9px]">
                    <div className="flex items-center gap-1.5 text-success-600">
                      <Check className="w-3 h-3" />
                      <span>Completed: {part.toolName}</span>
                    </div>
                  </div>
                );
              case 'tool-error':
                return (
                  <div key={part.toolCallId} className="mt-1 w-full rounded-lg border border-danger/20 bg-danger/10 p-1 text-[9px] text-danger">
                    Error: {part.errorText}
                  </div>
                );
              default:
                // 兼容更多工具与步骤类型显示
                if (typeof part.type === 'string') {
                  if (part.type.startsWith('tool-')) {
                    const name = part.type.replace(/^tool-/, '');
                    return (
                      <div key={`tool-${name}-${partIndex}`} className="mt-1 w-full rounded-lg border border-default-200/70 bg-content2/50 p-1.5 text-[11px]">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="w-4 h-4" />
                          <span className="font-semibold opacity-80">{name}</span>
                          <Chip size="sm" variant="flat" color="primary" className="h-5 border-0 text-xs">Running</Chip>
                        </div>
                        {part.args && (
                          <pre className="overflow-auto rounded-xl bg-content1 p-2 text-xs">{JSON.stringify(part.args, null, 2)}</pre>
                        )}
                        {part.output && (
                          <pre className="mt-2 overflow-auto rounded-xl bg-content1 p-2 text-xs">{JSON.stringify(part.output, null, 2)}</pre>
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
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  return prevProps.message === nextProps.message;
});

MessageItem.displayName = 'MessageItem';

export { MessageItem };
