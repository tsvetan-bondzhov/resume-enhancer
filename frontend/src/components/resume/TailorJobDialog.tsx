import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/useChatStore"

interface TailorJobDialogProps {
  readonly open: boolean
  readonly resumeId: string | undefined
  readonly onClose: () => void
  readonly startTailorStream: (resumeId: string, jobDescription: string) => () => void
}

export default function TailorJobDialog({
  open,
  resumeId,
  onClose,
  startTailorStream,
}: TailorJobDialogProps) {
  const isStreaming = useChatStore((state) => state.isStreaming)
  const [jobDescription, setJobDescription] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit() {
    if (!jobDescription.trim()) {
      setValidationError("Job description is required")
      return
    }
    setValidationError(null)
    onClose() // Close dialog immediately before stream starts (AC4)
    if (resumeId) {
      startTailorStream(resumeId, jobDescription)
    }
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      setJobDescription("")
      setValidationError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Tailor Resume to Job</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-2">
          <label htmlFor="job-description" className="text-sm font-medium">
            Job Description
          </label>
          <textarea
            id="job-description"
            autoFocus
            rows={8}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            placeholder="Paste the job description here…"
            value={jobDescription}
            onChange={(e) => {
              setJobDescription(e.target.value)
              if (validationError) setValidationError(null)
            }}
          />
          {validationError !== null && (
            <p role="alert" className="text-xs text-destructive">
              {validationError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isStreaming}
            onClick={handleSubmit}
          >
            Tailor Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
