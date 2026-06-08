import { useEffect, useRef, useState } from "react"
import { ChevronLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EditorToolbarProps {
  resumeName: string
  autosaveStatus: "idle" | "saving" | "saved" | "error"
  isSavingAs: boolean
  onNameChange: (name: string) => void
  onSaveAs: () => void
  onBack: () => void
}

export default function EditorToolbar({
  resumeName,
  autosaveStatus,
  isSavingAs,
  onNameChange,
  onSaveAs,
  onBack,
}: EditorToolbarProps) {
  const [localName, setLocalName] = useState(resumeName)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditingRef = useRef(false)

  // Keep local name in sync if parent changes it (e.g. after Save As navigation)
  // Only sync if not actively editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalName(resumeName)
    }
  }, [resumeName])

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

  const hasUnsavedChanges = autosaveStatus === "saving"

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

      {/* Save button with autosave dot indicator */}
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-1.5 relative"
        aria-label={hasUnsavedChanges ? "Unsaved changes — autosaving" : "Resume saved"}
        disabled
      >
        <Save className="size-4" />
        Save
        {hasUnsavedChanges && (
          <span
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-500"
            aria-hidden="true"
          />
        )}
      </Button>
    </div>
  )
}
