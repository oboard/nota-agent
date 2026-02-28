import { create } from 'zustand'

interface TodoPanelState {
  isTodoPanelExpanded: boolean
  toggleTodoPanel: () => void
  setExpanded: (expanded: boolean) => void
}

export const useTodoPanelStore = create<TodoPanelState>((set) => ({
  isTodoPanelExpanded: true,
  toggleTodoPanel: () => set((state) => ({ isTodoPanelExpanded: !state.isTodoPanelExpanded })),
  setExpanded: (expanded) => set({ isTodoPanelExpanded: expanded }),
}))