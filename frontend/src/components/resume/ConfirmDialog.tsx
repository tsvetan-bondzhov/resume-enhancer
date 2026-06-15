import { useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly isDestructive?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus Cancel button when dialog opens (UX-DR18: Cancel is default-focused)
  useEffect(() => {
    if (open) {
      // Use a microtask delay so the dialog has rendered before focusing
      const id = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [open])

  // UX-DR18: pressing Enter must NOT trigger the destructive action
  // Because Cancel is focused by default, Enter naturally triggers Cancel
  // (the button's default form submit behavior). No extra keydown handler needed.

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
