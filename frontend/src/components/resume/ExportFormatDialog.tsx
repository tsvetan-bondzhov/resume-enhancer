import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type ExportMode = "visual" | "ats"

interface ExportFormatDialogProps {
  readonly open: boolean
  readonly resumeName: string
  readonly isExporting: boolean
  readonly onExport: (format: "pdf" | "docx", mode: ExportMode) => void
  readonly onClose: () => void
}

export default function ExportFormatDialog({
  open,
  resumeName,
  isExporting,
  onExport,
  onClose,
}: ExportFormatDialogProps) {
  const [mode, setMode] = useState<ExportMode>("visual")

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isExporting) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm" aria-busy={isExporting}>
        <DialogHeader>
          <DialogTitle>
            Export{resumeName ? ` "${resumeName}"` : ""}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Choose a style and format to download your resume.
        </p>

        {/* Mode selector — segmented control */}
        <div
          role="radiogroup"
          aria-label="Export style"
          className="flex gap-2 py-1"
        >
          <Button
            type="button"
            variant={mode === "visual" ? "default" : "outline"}
            className="flex-1"
            disabled={isExporting}
            role="radio"
            aria-checked={mode === "visual"}
            aria-label="Visual (matches preview)"
            onClick={() => setMode("visual")}
          >
            Visual (matches preview)
          </Button>
          <Button
            type="button"
            variant={mode === "ats" ? "default" : "outline"}
            className="flex-1"
            disabled={isExporting}
            role="radio"
            aria-checked={mode === "ats"}
            aria-label="ATS-friendly (plain)"
            onClick={() => setMode("ats")}
          >
            ATS-friendly (plain)
          </Button>
        </div>

        <div className="flex gap-3 py-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isExporting}
            autoFocus
            aria-label="Export as PDF"
            onClick={() => onExport("pdf", mode)}
          >
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isExporting}
            aria-label="Export as DOCX"
            onClick={() => onExport("docx", mode)}
          >
            Word (DOCX)
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
