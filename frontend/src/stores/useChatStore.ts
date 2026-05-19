import { create } from "zustand"
import type { ChatMessage } from "@/types/api"

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  addMessage: (message: ChatMessage) => void
  setStreaming: (isStreaming: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  addMessage: (message) =>
    set((state) => ({ ...state, messages: [...state.messages, message] })),
  setStreaming: (isStreaming) => set((state) => ({ ...state, isStreaming })),
  clearMessages: () => set((state) => ({ ...state, messages: [] })),
}))
