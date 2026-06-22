import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/useChatStore"
import { useStreamingChat } from "@/hooks/useStreamingChat"
import TailorJobDialog from "@/components/resume/TailorJobDialog"

interface AIActionBarProps {
  readonly resumeId: string | undefined
}

export default function AIActionBar({ resumeId }: AIActionBarProps) {
  const isStreaming = useChatStore((state) => state.isStreaming)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTailorDialogOpen, setIsTailorDialogOpen] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const { startEnhanceStream, startTailorStream } = useStreamingChat({
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isStreaming || !resumeId}
        onClick={() => setIsTailorDialogOpen(true)}
        className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
      >
        ✦ Tailor to Job
      </Button>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
      <TailorJobDialog
        open={isTailorDialogOpen}
        resumeId={resumeId}
        onClose={() => setIsTailorDialogOpen(false)}
        startTailorStream={startTailorStream}
      />
    </div>
  )
}
