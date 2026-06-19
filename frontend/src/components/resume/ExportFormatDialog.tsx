import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ExportFormatDialogProps {
  readonly open: boolean
  readonly resumeName: string
  readonly isExporting: boolean
  readonly onExport: (format: "pdf" | "docx") => void
  readonly onClose: () => void
}

export default function ExportFormatDialog({
  open,
  resumeName,
  isExporting,
  onExport,
  onClose,
}: ExportFormatDialogProps) {
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
          Choose a format to download your resume.
        </p>

        <div className="flex gap-3 py-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isExporting}
            autoFocus
            aria-label="Export as PDF"
            onClick={() => onExport("pdf")}
          >
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isExporting}
            aria-label="Export as DOCX"
            onClick={() => onExport("docx")}
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
