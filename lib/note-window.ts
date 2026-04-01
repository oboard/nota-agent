export function buildInternalNoteUrl(pathname: string) {
  if (typeof window === "undefined") {
    return pathname;
  }

  return new URL(pathname, window.location.origin).toString();
}

const NOTE_SYNC_CHANNEL = "nota-note-sync";

type NoteSyncPayload = {
  noteId?: string;
  type: "created" | "updated" | "deleted" | "refresh";
  timestamp: number;
};

function dispatchNoteSync(payload: NoteSyncPayload) {
  if (typeof window === "undefined") return;

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(NOTE_SYNC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  }

  window.dispatchEvent(new CustomEvent(NOTE_SYNC_CHANNEL, { detail: payload }));
}

export function announceNotesChanged(type: NoteSyncPayload["type"], noteId?: string) {
  dispatchNoteSync({
    noteId,
    type,
    timestamp: Date.now(),
  });
}

export function subscribeToNotesChanged(listener: (payload: NoteSyncPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const customListener = (event: Event) => {
    const payload = (event as CustomEvent<NoteSyncPayload>).detail;
    listener(payload);
  };

  window.addEventListener(NOTE_SYNC_CHANNEL, customListener as EventListener);

  let channel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(NOTE_SYNC_CHANNEL);
    channel.onmessage = (event) => listener(event.data as NoteSyncPayload);
  }

  return () => {
    window.removeEventListener(NOTE_SYNC_CHANNEL, customListener as EventListener);
    channel?.close();
  };
}
