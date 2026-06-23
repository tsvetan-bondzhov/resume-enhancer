import { create } from "zustand"

export interface DiffEntry {
  id: string
  sectionId: string
  itemIndex: number
  field: string
  newValue: string
  previousValue: string
  kind: "addition" | "rewrite" | "deletion"
  state: "visible" | "hidden"
}

interface DiffState {
  diffs: DiffEntry[]
  addDiff: (entry: DiffEntry) => void
  acceptDiff: (id: string) => void
  rejectDiff: (id: string) => void
  clearAll: () => void
}

export const useDiffStore = create<DiffState>((set) => ({
  diffs: [],
  addDiff: (entry) =>
    set((state) => ({ ...state, diffs: [...state.diffs, entry] })),
  acceptDiff: (id) =>
    set((state) => ({
      ...state,
      diffs: state.diffs.map((d) =>
        d.id === id ? { ...d, state: "hidden" } : d
      ),
    })),
  rejectDiff: (id) =>
    set((state) => ({
      ...state,
      diffs: state.diffs.map((d) =>
        d.id === id ? { ...d, state: "hidden" } : d
      ),
    })),
  clearAll: () => set((state) => ({ ...state, diffs: [] })),
}))
