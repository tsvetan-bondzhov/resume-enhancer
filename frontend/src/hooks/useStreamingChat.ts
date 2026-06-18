import { createSseConnection } from "@/lib/sseClient"
import { useResumeStore } from "@/stores/useResumeStore"
import { useChatStore } from "@/stores/useChatStore"

export interface UseStreamingChatOptions {
  onDone?: (summary: string) => void
  onError?: (detail: string) => void
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const addMessage = useChatStore((state) => state.addMessage)
  const setStreaming = useChatStore((state) => state.setStreaming)
  const applyPatch = useResumeStore((state) => state.applyPatch)

  function startStream(url: string): () => void {
    setStreaming(true)

    // Start with an empty assistant message that tokens will be appended to
    const assistantMsgId = crypto.randomUUID()
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    })

    const closeConnection = createSseConnection(url, {
      onToken: ({ token }) => {
        // Append token to the assistant message content in useChatStore
        useChatStore.setState((state) => ({
          ...state,
          messages: state.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m
          ),
        }))
      },
      onPatch: (patch) => {
        // Dispatch patch to useResumeStore — AC5
        applyPatch(patch)
      },
      onDone: ({ summary }) => {
        setStreaming(false)
        options.onDone?.(summary)
      },
      onError: ({ detail }) => {
        setStreaming(false)
        options.onError?.(detail)
      },
    })

    // F5: ensure isStreaming is cleared on early cleanup (e.g. component unmount before done/error fires)
    function cleanup() {
      closeConnection()
      setStreaming(false)
    }

    return cleanup
  }

  return { startStream }
}
