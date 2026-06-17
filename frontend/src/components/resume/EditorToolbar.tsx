import { useEffect, useRef, useState } from "react"
import { ChevronLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EditorToolbarProps {
  readonly resumeName: string
  readonly autosaveStatus: "idle" | "saving" | "saved" | "error"
  readonly isDirty: boolean
  readonly lastSavedAt: Date | null
  readonly isSavingAs: boolean
  readonly onNameChange: (name: string) => void
  readonly onSave: () => void
  readonly onSaveAs: () => void
  readonly onBack: () => void
}

function formatSavedAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  return `${mins} min ago`
}

export default function EditorToolbar({
  resumeName,
  autosaveStatus,
  isDirty,
  lastSavedAt,
  isSavingAs,
  onNameChange,
  onSave,
  onSaveAs,
  onBack,
}: EditorToolbarProps) {
  const [localName, setLocalName] = useState(resumeName)
  const [nameError, setNameError] = useState<string | null>(null)
  const [savedAgoText, setSavedAgoText] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditingRef = useRef(false)

  // Keep local name in sync if parent changes it (e.g. after Save As navigation)
  // Only sync if not actively editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalName(resumeName)
    }
  }, [resumeName])

  // Update the "saved X min ago" text whenever lastSavedAt changes, then refresh every 30s
  useEffect(() => {
    if (!lastSavedAt) return
    const update = () => setSavedAgoText(formatSavedAgo(lastSavedAt))
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  const handleNameFocus = () => {
    isEditingRef.current = true
  }

  const handleNameBlur = () => {
    isEditingRef.current = false
    if (localName.trim() === "") {
      setNameError("Name is required")
      nameInputRef.current?.focus()
      return
    }
    setNameError(null)
    if (localName !== resumeName) {
      onNameChange(localName)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      nameInputRef.current?.blur()
    }
  }

  const savedLabel = lastSavedAt ? `Saved ${savedAgoText}` : "Saved"
  const saveButtonLabel = isDirty ? "Save" : savedLabel

  return (
    <div className="h-12 border-b border-border bg-card flex items-center gap-2 px-4 shrink-0">
      {/* Back navigation */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="gap-1 text-muted-foreground"
        aria-label="Back to resumes"
      >
        <ChevronLeft className="size-4" />
        Resumes
      </Button>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Inline name editor */}
        <input
          ref={nameInputRef}
          type="text"
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            if (nameError) setNameError(null)
          }}
          onFocus={handleNameFocus}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          placeholder="Resume name"
          aria-label="Resume name"
          aria-describedby={nameError ? "name-error" : undefined}
          className="text-sm font-medium bg-transparent border-0 outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded px-1 w-full min-w-0 truncate"
        />
        {nameError && (
          <p id="name-error" role="alert" className="text-xs text-destructive px-1">
            {nameError}
          </p>
        )}
      </div>

      {/* Save As button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSaveAs}
        disabled={isSavingAs}
        aria-label="Save as new resume"
      >
        {isSavingAs ? "Saving…" : "Save As"}
      </Button>

      {/* Save button — disabled while autosaving */}
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-1.5 relative whitespace-nowrap"
        aria-label={isDirty ? "Save unsaved changes" : saveButtonLabel}
        onClick={onSave}
        disabled={autosaveStatus === "saving"}
      >
        <Save className="size-4 shrink-0" />
        {saveButtonLabel}
        {isDirty && (
          <span
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-500"
            aria-hidden="true"
          />
        )}
      </Button>
    </div>
  )
}
