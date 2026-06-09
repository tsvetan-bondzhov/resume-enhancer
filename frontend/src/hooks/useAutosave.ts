import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import type { ResumeDto } from "@/types/api"

type SaveSnapshot = { name: string; contentJson: string }

const stableStringify = (val: unknown): string =>
  JSON.stringify(val, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  )

export function useAutosave(resumeId: string | undefined): {
  status: "idle" | "saving" | "saved" | "error"
  isDirty: boolean
  lastSavedAt: Date | null
  saveNow: () => void
} {
  const currentResume = useResumeStore((state) => state.currentResume)
  const setCurrentResume = useResumeStore((state) => state.setCurrentResume)
  const setLastSavedDocument = useResumeStore(
    (state) => state.setLastSavedDocument
  )
  const lastSavedDocument = useResumeStore((state) => state.lastSavedDocument)

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [isDirty, setIsDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // true when the save was triggered by the user pressing Save (not the debounce)
  const isManualSaveRef = useRef(false)

  // Save ref to avoid stale closures inside callbacks
  const saveRef = useRef({ currentResume, lastSavedDocument })
  useEffect(() => {
    saveRef.current = { currentResume, lastSavedDocument }
  }, [currentResume, lastSavedDocument])

  // Tracks the last persisted (name + content) so we can skip identical PUTs.
  // Captured when lastSavedDocument first becomes non-null (initial page load),
  // then updated after every successful save.
  const lastSavedSnapshotRef = useRef<SaveSnapshot | null>(null)

  useEffect(() => {
    if (
      lastSavedDocument !== null &&
      currentResume !== null &&
      lastSavedSnapshotRef.current === null
    ) {
      lastSavedSnapshotRef.current = {
        name: currentResume.name,
        contentJson: stableStringify(lastSavedDocument),
      }
    }
  }, [lastSavedDocument, currentResume])

  // Shared save logic used by both the debounce timer and saveNow
  const executeSave = useCallback(
    (resumeIdArg: string) => {
      const { currentResume: doc, lastSavedDocument: lastSaved } = saveRef.current
      if (!doc) return

      // Skip PUT when neither the name nor content has changed since the last save.
      // NOTE: intentionally checks BOTH name and content — a name-only change must
      // not be skipped by a content-only comparison.
      const snapshot = lastSavedSnapshotRef.current
      if (
        snapshot !== null &&
        lastSaved !== null &&
        doc.name === snapshot.name &&
        stableStringify(doc.content) === snapshot.contentJson
      ) {
        setIsDirty(false)
        return
      }

      // Mark dirty immediately so the Save button becomes active
      setIsDirty(true)
      setStatus("saving")

      apiClient
        .put<ResumeDto>(`/api/v1/resumes/${resumeIdArg}`, {
          name: doc.name,
          content: doc.content,
          templateId: doc.templateId ?? null,
        })
        .then((updated) => {
          setLastSavedDocument(updated.content)
          lastSavedSnapshotRef.current = {
            name: doc.name,
            contentJson: stableStringify(updated.content),
          }
          setIsDirty(false)
          setLastSavedAt(new Date())
          setStatus("saved")

          const isManual = isManualSaveRef.current
          isManualSaveRef.current = false
          if (isManual) {
            toast.success("Document Saved")
          } else {
            toast("Document Autosaved")
          }
        })
        .catch(() => {
          // Revert to last successfully saved state
          const { lastSavedDocument: lastSaved } = saveRef.current
          if (lastSaved !== null) {
            setCurrentResume({ ...doc, content: lastSaved })
          }
          setStatus("error")
          toast.error("Save failed — changes reverted")
        })
    },
    [setCurrentResume, setLastSavedDocument]
  )

  // Main debounce effect — marks dirty and schedules save
  useEffect(() => {
    if (!resumeId || !currentResume) return

    // Don't trigger on the initial load (when lastSavedDocument is null)
    if (saveRef.current.lastSavedDocument === null) return

    // Clear previous timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      executeSave(resumeId)
    }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentResume, resumeId, executeSave])

  // Immediate save — cancels any pending debounce and saves right away
  const saveNow = useCallback(() => {
    if (!resumeId) return
    isManualSaveRef.current = true
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    executeSave(resumeId)
  }, [resumeId, executeSave])

  // Cleanup on unmount — cancel any pending timer
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { status, isDirty, lastSavedAt, saveNow }
}
