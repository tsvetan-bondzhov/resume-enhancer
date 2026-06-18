import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/useChatStore"
import { useStreamingChat } from "@/hooks/useStreamingChat"

interface AIActionBarProps {
  readonly resumeId: string | undefined
}

export default function AIActionBar({ resumeId }: AIActionBarProps) {
  const isStreaming = useChatStore((state) => state.isStreaming)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const { startEnhanceStream } = useStreamingChat({
    onDone: () => {
      setErrorMessage(null)
    },
    onError: (detail) => {
      setErrorMessage(detail)
    },
  })

  function handleEnhance() {
    if (!resumeId || isStreaming) return
    setErrorMessage(null)
    const cleanup = startEnhanceStream(resumeId)
    cleanupRef.current = cleanup
  }

  useEffect(() => () => {
    cleanupRef.current?.()
  }, [])

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-card shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isStreaming || !resumeId}
        onClick={handleEnhance}
        className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
      >
        ✦ Enhance
        {isStreaming && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 motion-safe:animate-pulse ml-1"
            aria-hidden="true"
          />
        )}
      </Button>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
