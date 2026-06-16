import { describe, it, expect, beforeEach } from "vitest"
import { useChatStore } from "./useChatStore"
import type { ChatMessage } from "@/types/api"

function buildMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-1",
    role: "user",
    content: "Hello",
    timestamp: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false })
  })

  it("addMessage appends a message to the messages array", () => {
    const msg = buildMessage({ role: "user", content: "Hello" })
    useChatStore.getState().addMessage(msg)
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0]).toEqual(msg)
  })

  it("addMessage appends multiple messages in order", () => {
    const msg1 = buildMessage({ role: "user", content: "First" })
    const msg2 = buildMessage({ role: "assistant", content: "Second" })
    useChatStore.getState().addMessage(msg1)
    useChatStore.getState().addMessage(msg2)
    const { messages } = useChatStore.getState()
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe("First")
    expect(messages[1].content).toBe("Second")
  })

  it("setStreaming sets isStreaming to true", () => {
    useChatStore.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(true)
  })

  it("setStreaming sets isStreaming to false", () => {
    useChatStore.setState({ isStreaming: true })
    useChatStore.getState().setStreaming(false)
    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  it("clearMessages empties the messages array", () => {
    useChatStore.setState({ messages: [buildMessage(), buildMessage()] })
    useChatStore.getState().clearMessages()
    expect(useChatStore.getState().messages).toHaveLength(0)
  })
})
