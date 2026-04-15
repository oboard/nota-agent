"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { getRecentMemories } from "@/app/actions";
import { isElectronRuntime, subscribeMemoryConsolidated } from "@/lib/electron-window";

export interface MemoryItem {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  category?: string | null;
}

interface MemoryState {
  memories: MemoryItem[];
  isLoading: boolean;
  hasHydrated: boolean;
  setMemories: (memories: MemoryItem[]) => void;
  refreshMemories: () => Promise<void>;
  hydrateMemories: (memories: MemoryItem[]) => void;
}

const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  isLoading: false,
  hasHydrated: false,
  setMemories: (memories) => set({ memories }),
  hydrateMemories: (memories) => {
    const current = get();
    if (current.hasHydrated && current.memories.length > 0) return;
    set({ memories, hasHydrated: true });
  },
  refreshMemories: async () => {
    set({ isLoading: true });
    try {
      const memories = await getRecentMemories();
      set({ memories, hasHydrated: true });
    } finally {
      set({ isLoading: false });
    }
  },
}));

let memoryConsolidationUnsubscribe: null | (() => void) = null;

export function useMemories(initialMemories?: MemoryItem[]) {
  const memories = useMemoryStore((state) => state.memories);
  const isLoading = useMemoryStore((state) => state.isLoading);
  const hydrateMemories = useMemoryStore((state) => state.hydrateMemories);
  const refreshMemories = useMemoryStore((state) => state.refreshMemories);

  useEffect(() => {
    if (initialMemories && initialMemories.length > 0) {
      hydrateMemories(initialMemories);
      return;
    }

    if (memories.length === 0) {
      refreshMemories().catch(console.error);
    }
  }, [hydrateMemories, initialMemories, memories.length, refreshMemories]);

  useEffect(() => {
    if (!isElectronRuntime()) return;
    if (memoryConsolidationUnsubscribe) return memoryConsolidationUnsubscribe;

    memoryConsolidationUnsubscribe = subscribeMemoryConsolidated(() => {
      refreshMemories().catch(console.error);
    });

    return () => {
      memoryConsolidationUnsubscribe?.();
      memoryConsolidationUnsubscribe = null;
    };
  }, [refreshMemories]);

  return {
    memories,
    isLoading,
    refreshMemories,
    setMemories: useMemoryStore.getState().setMemories,
  };
}
