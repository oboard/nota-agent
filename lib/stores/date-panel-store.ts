import { create } from 'zustand'

interface DatePanelState {
  isDatePanelExpanded: boolean
  toggleDatePanel: () => void
  setExpanded: (expanded: boolean) => void
}

export const useDatePanelStore = create<DatePanelState>((set) => ({
  isDatePanelExpanded: true,
  toggleDatePanel: () => set((state) => ({ isDatePanelExpanded: !state.isDatePanelExpanded })),
  setExpanded: (expanded) => set({ isDatePanelExpanded: expanded }),
}))