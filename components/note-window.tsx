"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { deleteNote, getNote, updateNote } from "@/app/actions";
import { getAlwaysOnTop, isElectronRuntime, toggleAlwaysOnTop } from "@/lib/electron-window";
import type { NoteData } from "@/lib/storage";
import { announceNotesChanged, subscribeToNotesChanged } from "@/lib/note-window";
import { Pin, PinOff, Trash2 } from "lucide-react";

interface NoteWindowProps {
  initialNote: NoteData;
}

const dragRegionStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export function NoteWindow({ initialNote }: NoteWindowProps) {
  const [draftTitle, setDraftTitle] = useState(initialNote.title);
  const [draftContent, setDraftContent] = useState(initialNote.content);
  const [updatedAt, setUpdatedAt] = useState(initialNote.updatedAt);
  const [savedTitle, setSavedTitle] = useState(initialNote.title);
  const [savedContent, setSavedContent] = useState(initialNote.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSyncedAtRef = useRef(initialNote.updatedAt);

  useEffect(() => {
    const inElectron = isElectronRuntime();
    setIsElectron(inElectron);

    if (!inElectron) return;

    getAlwaysOnTop().then(setIsAlwaysOnTop).catch(() => setIsAlwaysOnTop(false));
  }, []);

  const isDirty = useMemo(
    () => draftTitle !== savedTitle || draftContent !== savedContent,
    [draftContent, draftTitle, savedContent, savedTitle]
  );

  const syncFromServer = async (force = false) => {
    const next = await getNote(initialNote.id);
    if (!next) return;

    const remoteChanged = next.updatedAt !== lastSyncedAtRef.current;
    if (!remoteChanged && !force) return;

    lastSyncedAtRef.current = next.updatedAt;
    setUpdatedAt(next.updatedAt);
    setSavedTitle(next.title);
    setSavedContent(next.content);

    if (!isDirty || force) {
      setDraftTitle(next.title);
      setDraftContent(next.content);
    }
  };

  const persistNote = async () => {
    setIsSaving(true);
    try {
      const next = await updateNote(initialNote.id, {
        title: draftTitle || "未命名便笺",
        content: draftContent,
      });
      lastSyncedAtRef.current = next.updatedAt;
      setSavedTitle(next.title);
      setSavedContent(next.content);
      setDraftTitle(next.title);
      setDraftContent(next.content);
      setUpdatedAt(next.updatedAt);
      announceNotesChanged("updated", initialNote.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (typeof window !== "undefined" && !window.confirm(`删除便笺《${savedTitle || draftTitle || "未命名便笺"}》？`)) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteNote(initialNote.id);
      announceNotesChanged("deleted", initialNote.id);
      if (typeof window !== "undefined") {
        window.close();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    const next = await toggleAlwaysOnTop();
    setIsAlwaysOnTop(next);
  };

  useEffect(() => {
    if (!isDirty) return;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      persistNote();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [draftContent, draftTitle, isDirty]);

  useEffect(() => {
    return subscribeToNotesChanged((payload) => {
      if (payload.noteId && payload.noteId !== initialNote.id) return;
      syncFromServer();
    });
  }, [initialNote.id, isDirty]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      syncFromServer();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [initialNote.id, isDirty]);

  return (
    <div className={`min-h-screen bg-[#f3e7bd] text-black/80 ${isElectron ? "p-0" : "p-3"}`}>
      <div className={`mx-auto flex min-h-0 flex-col overflow-hidden border border-[#d1b14d] bg-[linear-gradient(180deg,#fff9b7_0%,#fff39a_22%,#ffef82_100%)] shadow-[0_20px_45px_rgba(126,92,0,0.24)] ${isElectron ? "h-screen max-w-none rounded-none border-0" : "h-[calc(100vh-1.5rem)] max-w-[420px] rounded-[26px]"}`}>
        <div
          className={`relative flex items-center justify-between border-b border-[rgba(117,91,16,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))] py-2 ${isElectron ? "pl-20 pr-3 lg:pl-24 lg:pr-3" : "px-3"}`}
          style={isElectron ? dragRegionStyle : undefined}
        >
          <div className="absolute inset-x-0 top-0 h-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0))]" />
          <div className="relative flex items-center gap-2" style={isElectron ? noDragRegionStyle : undefined}>
            <div className="h-3 w-3 rounded-full border border-black/10 bg-white/35 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" />
            <div className="text-[11px] uppercase tracking-[0.16em] text-black/45">Stickies</div>
          </div>

          <div className="relative flex items-center gap-1.5" style={isElectron ? noDragRegionStyle : undefined}>
            {isElectron && (
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="h-7 min-h-7 w-7 min-w-7 border border-black/10 bg-white/30 text-black/65"
                onPress={handleToggleAlwaysOnTop}
                title={isAlwaysOnTop ? "取消置顶" : "置顶便笺"}
              >
                {isAlwaysOnTop ? <PinOff className="h-3.5 w-3.5 text-black/75" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="h-7 min-h-7 w-7 min-w-7 border border-black/10 bg-white/30 text-black/65"
              onPress={handleDelete}
              isDisabled={isSaving}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className={`relative flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 ${isElectron ? "max-w-none" : ""}`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_18%,rgba(175,134,26,0.03)_100%)]" />
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="便笺标题"
            className="relative z-10 w-full border-0 bg-transparent px-0 py-1 text-[22px] font-semibold tracking-tight text-black/80 outline-none placeholder:text-black/35"
          />

          <div className="relative z-10 mt-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-black/42">
            <span>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("zh-CN")}` : "New note"}</span>
            <span>{isSaving ? "Saving..." : isDirty ? "Typing..." : "Saved"}</span>
          </div>

          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            placeholder="直接写内容..."
            className="relative text-[14px] z-10 mt-4 min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[rgba(61,47,8,0.78)] outline-none placeholder:text-black/32"
          />
        </div>
      </div>
    </div>
  );
}
