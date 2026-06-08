import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import type { ResumeDto } from "@/types/api"

type SaveSnapshot = { name: string; contentJson: string }

export function useAutosave(
  resumeId: string | undefined
): { status: "idle" | "saving" | "saved" | "error" } {
  const currentResume = useResumeStore((state) => state.currentResume)
  const setCurrentResume = useResumeStore((state) => state.setCurrentResume)
  const setLastSavedDocument = useResumeStore(
    (state) => state.setLastSavedDocument
  )
  const lastSavedDocument = useResumeStore((state) => state.lastSavedDocument)

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  )
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Save ref to avoid stale closures inside the debounce callback
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
        contentJson: JSON.stringify(lastSavedDocument),
      }
    }
  }, [lastSavedDocument, currentResume])

  // Main debounce effect
  useEffect(() => {
    if (!resumeId || !currentResume) return

    // Don't trigger on the initial load (when lastSavedDocument is null)
    if (saveRef.current.lastSavedDocument === null) return

    // Clear previous timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      const { currentResume: doc, lastSavedDocument: lastSaved } =
        saveRef.current
      if (!doc) return

      // Skip save if content hasn't changed since last save (catches spurious
      // identical PUTs when lastSavedDocument is set in the same render batch)
      if (lastSaved !== null && JSON.stringify(doc.content) === JSON.stringify(lastSaved)) return

      // Skip PUT when neither the name nor content has changed since the last save.
      // This prevents a spurious identical PUT on initial page load.
      const snapshot = lastSavedSnapshotRef.current
      if (
        snapshot !== null &&
        lastSaved !== null &&
        doc.name === snapshot.name &&
        JSON.stringify(doc.content) === snapshot.contentJson
      ) return

      setStatus("saving")

      apiClient
        .put<ResumeDto>(`/api/v1/resumes/${resumeId}`, {
          name: doc.name,
          content: doc.content,
          templateId: doc.templateId ?? null,
        })
        .then((updated) => {
          setLastSavedDocument(updated.content)
          lastSavedSnapshotRef.current = {
            name: doc.name,
            contentJson: JSON.stringify(updated.content),
          }
          setStatus("saved")
        })
        .catch(() => {
          // Revert to last successfully saved state
          if (lastSaved !== null) {
            setCurrentResume({ ...doc, content: lastSaved })
          }
          setStatus("error")
          toast.error("Save failed — changes reverted")
        })
    }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentResume, resumeId, setCurrentResume, setLastSavedDocument])

  // Cleanup on unmount — cancel any pending timer
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { status }
}
