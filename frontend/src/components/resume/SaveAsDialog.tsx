import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SaveAsDialogProps {
  open: boolean
  defaultName: string
  isSaving: boolean
  onConfirm: (name: string) => void
  onClose: () => void
}

interface SaveAsFormProps {
  defaultName: string
  isSaving: boolean
  onConfirm: (name: string) => void
  onClose: () => void
}

function SaveAsForm({ defaultName, isSaving, onConfirm, onClose }: SaveAsFormProps) {
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus and select all text when this form mounts (i.e., when dialog opens)
  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (name.trim() === "") {
      setError("Name is required")
      inputRef.current?.focus()
      return
    }
    setError(null)
    onConfirm(name.trim())
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="py-4 space-y-2">
        <Label htmlFor="save-as-name">Resume name</Label>
        <Input
          id="save-as-name"
          ref={inputRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          aria-describedby={error ? "save-as-error" : undefined}
          autoComplete="off"
        />
        {error && (
          <p id="save-as-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save As"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function SaveAsDialog({
  open,
  defaultName,
  isSaving,
  onConfirm,
  onClose,
}: SaveAsDialogProps) {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isSaving) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" aria-busy={isSaving}>
        <DialogHeader>
          <DialogTitle>Save As</DialogTitle>
        </DialogHeader>
        {/* key remounts SaveAsForm each time dialog opens, resetting name/error state */}
        {open && (
          <SaveAsForm
            key={defaultName}
            defaultName={defaultName}
            isSaving={isSaving}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
