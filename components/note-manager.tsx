"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Button } from "@heroui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { createNote, deleteNote, getNotes, updateNote } from "@/app/actions";
import type { NoteData } from "@/lib/storage";
import { buildInternalNoteUrl } from "@/lib/note-window";
import { NoteEditorPane } from "./note-editor-pane";
import { FilePlus2, StickyNote, X } from "lucide-react";

interface NoteManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  refreshToken?: number;
}

function openNoteWindow(noteId: string) {
  if (typeof window === "undefined") return;
  window.open(buildInternalNoteUrl(`/notes/${noteId}`), "_blank", "popup=yes,width=760,height=920");
}

export function NoteManager({ isOpen, onOpenChange, refreshToken = 0 }: NoteManagerProps) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedNote = useMemo(
    () => notes.find(note => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  const isDirty = useMemo(() => {
    if (!selectedNote) {
      return draftTitle.trim().length > 0 || draftContent.length > 0;
    }

    return draftTitle !== selectedNote.title || draftContent !== selectedNote.content;
  }, [draftContent, draftTitle, selectedNote]);

  const syncDraft = useCallback((note: NoteData | null) => {
    setDraftTitle(note?.title ?? "");
    setDraftContent(note?.content ?? "");
  }, []);

  const refreshNotes = useCallback(async (preferredId?: string | null) => {
    setIsLoading(true);
    try {
      const nextNotes = await getNotes();
      setNotes(nextNotes);

      const fallbackId = nextNotes[0]?.id ?? null;
      const nextSelectedId = preferredId && nextNotes.some(note => note.id === preferredId)
        ? preferredId
        : fallbackId;

      setSelectedNoteId(nextSelectedId);
      syncDraft(nextNotes.find(note => note.id === nextSelectedId) ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [syncDraft]);

  useEffect(() => {
    if (!isOpen) return;
    refreshNotes(selectedNoteId);
  }, [isOpen, refreshNotes, refreshToken]);

  const handleCreate = useCallback(async () => {
    setIsSaving(true);
    try {
      const note = await createNote({ title: "未命名便笺", content: "" });
      await refreshNotes(note.id);
    } finally {
      setIsSaving(false);
    }
  }, [refreshNotes]);

  const handleSave = useCallback(async () => {
    if (!selectedNoteId) {
      const note = await createNote({ title: draftTitle, content: draftContent });
      await refreshNotes(note.id);
      return;
    }

    setIsSaving(true);
    try {
      await updateNote(selectedNoteId, {
        title: draftTitle || "未命名便笺",
        content: draftContent,
      });
      await refreshNotes(selectedNoteId);
    } finally {
      setIsSaving(false);
    }
  }, [draftContent, draftTitle, refreshNotes, selectedNoteId]);

  const handleDelete = useCallback(async () => {
    if (!selectedNoteId) return;

    setIsSaving(true);
    try {
      await deleteNote(selectedNoteId);
      await refreshNotes(null);
    } finally {
      setIsSaving(false);
    }
  }, [refreshNotes, selectedNoteId]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      hideCloseButton
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        base: "border border-default-200/70 bg-background",
        wrapper: "items-start pt-10 sm:pt-14",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center justify-between gap-3 border-b border-default-200/70 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.12em] uppercase">
                  <StickyNote className="h-4 w-4 text-primary" />
                  便笺
                </div>
                <div className="mt-1 text-[11px] text-default-400">
                  AI 和你都可以直接增删改查，所有修改都会记进 memory。
                </div>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="h-7 min-h-7 w-7 min-w-7"
                onPress={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </ModalHeader>

            <ModalBody className="min-h-[70vh] px-0 py-0">
              <div className="flex h-[70vh] min-h-0 flex-col lg:flex-row">
                <div className="flex w-full shrink-0 flex-col border-b border-default-200/70 bg-content1/40 lg:w-[17rem] lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="text-[11px] font-medium text-default-500">
                      {notes.length} 个便笺
                    </div>
                    <Button
                      size="sm"
                      variant="flat"
                      className="h-7 min-h-7 border border-default-200/70 bg-content2/40 px-2 text-[11px]"
                      startContent={<FilePlus2 className="h-3.5 w-3.5" />}
                      onPress={handleCreate}
                      isLoading={isSaving && !selectedNoteId}
                    >
                      新建
                    </Button>
                  </div>

                  <ScrollShadow className="min-h-0 flex-1 px-2 pb-2">
                    <div className="space-y-1">
                      {notes.map(note => {
                        const active = note.id === selectedNoteId;
                        return (
                          <button
                            key={note.id}
                            type="button"
                            onClick={() => {
                              setSelectedNoteId(note.id);
                              syncDraft(note);
                            }}
                            className={`w-full rounded-xl border px-2.5 py-2 text-left transition-colors ${
                              active
                                ? "border-primary/30 bg-primary/10"
                                : "border-transparent bg-transparent hover:border-default-200/70 hover:bg-content2/40"
                            }`}
                          >
                            <div className="truncate text-[12px] font-medium text-foreground">
                              {note.title}
                            </div>
                            <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-default-500">
                              {note.content || "空白便笺"}
                            </div>
                            <div className="mt-1 text-[10px] text-default-400">
                              {new Date(note.updatedAt).toLocaleString("zh-CN")}
                            </div>
                          </button>
                        );
                      })}

                      {!isLoading && notes.length === 0 && (
                        <div className="rounded-xl border border-dashed border-default-200/70 px-3 py-6 text-center text-[11px] text-default-400">
                          还没有便笺，先新建一个。
                        </div>
                      )}
                    </div>
                  </ScrollShadow>
                </div>

                <div className="min-h-0 flex-1 p-3">
                  <NoteEditorPane
                    title={draftTitle}
                    content={draftContent}
                    updatedAt={selectedNote?.updatedAt}
                    isSaving={isSaving}
                    isDirty={isDirty}
                    onTitleChange={setDraftTitle}
                    onContentChange={setDraftContent}
                    onSave={handleSave}
                    onDelete={selectedNote ? handleDelete : undefined}
                    onOpenWindow={selectedNote ? () => openNoteWindow(selectedNote.id) : undefined}
                    emptyLabel="这里是纯文本便笺，不支持 markdown。"
                  />
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
