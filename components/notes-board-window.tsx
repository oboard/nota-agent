"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { createNote, getNotes } from "@/app/actions";
import { isElectronRuntime, openNoteWindow as openElectronNoteWindow } from "@/lib/electron-window";
import type { NoteData } from "@/lib/storage";
import { announceNotesChanged, buildInternalNoteUrl, subscribeToNotesChanged } from "@/lib/note-window";
import { FilePlus2, RefreshCw, StickyNote } from "lucide-react";

interface NotesBoardWindowProps {
  initialNotes: NoteData[];
}

const dragRegionStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

function openNoteWindow(noteId: string) {
  if (typeof window === "undefined") return;
  if (isElectronRuntime()) {
    openElectronNoteWindow(noteId);
    return;
  }
  window.open(buildInternalNoteUrl(`/notes/${noteId}`), "_blank", "popup=yes,width=420,height=520");
}

export function NotesBoardWindow({ initialNotes }: NotesBoardWindowProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(isElectronRuntime());
  }, []);

  const refreshNotes = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setNotes(await getNotes());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      refreshNotes();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshNotes]);

  useEffect(() => {
    return subscribeToNotesChanged(() => {
      refreshNotes();
    });
  }, [refreshNotes]);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const note = await createNote({ title: "新便笺", content: "" });
      announceNotesChanged("created", note.id);
      await refreshNotes();
      openNoteWindow(note.id);
    } finally {
      setIsCreating(false);
    }
  }, [refreshNotes]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#fff6bf_0%,#f6ecd0_30%,#efe6d3_100%)] text-foreground">
      <div
        className={`flex items-center justify-between border-b border-black/10 bg-white/30 py-2 backdrop-blur-md ${isElectron ? "pl-20 pr-3 lg:pl-24 lg:pr-4" : "px-4"}`}
        style={isElectron ? dragRegionStyle : undefined}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-black/65">
            <StickyNote className="h-4 w-4" />
            Notes
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            便笺集合窗口。点任意便笺会打开独立小便签。
          </div>
        </div>

        <div className="flex items-center gap-2" style={isElectron ? noDragRegionStyle : undefined}>
          <Button
            size="sm"
            variant="flat"
            className="h-8 min-h-8 border border-black/10 bg-white/50 px-2 text-[11px] text-black/70"
            startContent={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />}
            onPress={refreshNotes}
            isLoading={isRefreshing}
          >
            刷新
          </Button>
          <Button
            size="sm"
            className="h-8 min-h-8 bg-[#f2c84b] px-3 text-[11px] font-medium text-black shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
            startContent={<FilePlus2 className="h-3.5 w-3.5" />}
            onPress={handleCreate}
            isLoading={isCreating}
          >
            新建便笺
          </Button>
        </div>
      </div>

      <ScrollShadow className="min-h-0 flex-1 px-4 py-4">
        {notes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-[24px] border border-black/10 bg-white/35 px-8 py-10 text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm">
              <div className="text-[14px] font-medium text-black/70">还没有便笺</div>
              <div className="mt-2 text-[11px] text-black/50">先建一张黄色小便签吧。</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {notes.map((note, index) => (
              <button
                key={note.id}
                type="button"
                onClick={() => openNoteWindow(note.id)}
                className="group relative min-h-[220px] overflow-hidden rounded-[20px] border border-[#d3b348] bg-[linear-gradient(180deg,#fff7a8_0%,#fff18a_100%)] p-4 text-left shadow-[0_14px_32px_rgba(126,92,0,0.18)] transition-transform hover:-translate-y-0.5"
                style={{
                  transform: `rotate(${index % 3 === 0 ? "-1.2deg" : index % 3 === 1 ? "0.8deg" : "-0.3deg"})`,
                }}
              >
                <div className="absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0))]" />
                <div className="absolute right-3 top-3 h-3 w-3 rounded-full border border-black/10 bg-white/35 shadow-[0_2px_6px_rgba(0,0,0,0.08)]" />

                <div className="relative flex h-full flex-col">
                  <div className="pr-6 text-[16px] font-semibold leading-5 text-black/75">
                    {note.title}
                  </div>
                  <div className="mt-3 line-clamp-[9] whitespace-pre-wrap break-words text-[13px] leading-5 text-black/68">
                    {note.content || "空白便笺"}
                  </div>
                  <div className="mt-auto pt-4 text-[10px] uppercase tracking-[0.16em] text-black/45">
                    {new Date(note.updatedAt).toLocaleString("zh-CN")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollShadow>
    </div>
  );
}
