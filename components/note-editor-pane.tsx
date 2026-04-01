"use client";

import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { FileText, ExternalLink, Save, Trash2 } from "lucide-react";

interface NoteEditorPaneProps {
  title: string;
  content: string;
  updatedAt?: string;
  isSaving?: boolean;
  isDirty?: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onOpenWindow?: () => void;
  saveLabel?: string;
  emptyLabel?: string;
}

export function NoteEditorPane({
  title,
  content,
  updatedAt,
  isSaving = false,
  isDirty = false,
  onTitleChange,
  onContentChange,
  onSave,
  onDelete,
  onOpenWindow,
  saveLabel = "保存便笺",
  emptyLabel = "输入纯文本内容...",
}: NoteEditorPaneProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-default-200/70 bg-content1/80">
      <div className="flex items-center justify-between gap-3 border-b border-default-200/70 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-default-500">
            <FileText className="h-3.5 w-3.5" />
            Plain Text Note
          </div>
          <div className="mt-1 text-[10px] text-default-400">
            {updatedAt ? `最后修改于 ${new Date(updatedAt).toLocaleString("zh-CN")}` : "新建便笺"}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenWindow && (
            <Button
              size="sm"
              variant="flat"
              className="h-7 min-h-7 border border-default-200/70 bg-content2/40 px-2 text-[11px] text-default-600"
              startContent={<ExternalLink className="h-3.5 w-3.5" />}
              onPress={onOpenWindow}
            >
              新窗口
            </Button>
          )}
          {onDelete && (
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="h-7 min-h-7 w-7 min-w-7 border border-default-200/70 bg-content2/40 text-default-500"
              onPress={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            color="primary"
            variant={isDirty ? "solid" : "flat"}
            className="h-7 min-h-7 px-2 text-[11px]"
            startContent={<Save className="h-3.5 w-3.5" />}
            isLoading={isSaving}
            onPress={onSave}
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <Input
          value={title}
          onValueChange={onTitleChange}
          placeholder="便笺标题"
          classNames={{
            input: "text-[12px] font-medium",
            inputWrapper: "h-10 border border-default-200/70 bg-content2/40 shadow-none",
          }}
        />

        <Textarea
          value={content}
          onValueChange={onContentChange}
          placeholder={emptyLabel}
          minRows={16}
          classNames={{
            base: "flex-1",
            input: "text-[12px] leading-5 font-mono text-foreground",
            inputWrapper: "h-full min-h-[320px] items-start border border-default-200/70 bg-content2/30 px-2 py-2 shadow-none",
            innerWrapper: "h-full",
          }}
        />
      </div>
    </div>
  );
}
