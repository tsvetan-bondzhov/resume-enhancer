import { create } from "zustand"
import type { ChatMessage } from "@/types/api"

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  setStreaming: (isStreaming: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  addMessage: (message) =>
    set((state) => ({ ...state, messages: [...state.messages, message] })),
  updateMessage: (id, patch) =>
    set((state) => ({
      ...state,
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  setStreaming: (isStreaming) => set((state) => ({ ...state, isStreaming })),
  clearMessages: () => set((state) => ({ ...state, messages: [] })),
}))
