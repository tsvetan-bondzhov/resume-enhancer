import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import SplitPaneLayout from "@/components/layout/SplitPaneLayout"
import SectionsPanel from "@/components/resume/SectionsPanel"
import ResumeSection from "@/components/resume/ResumeSection"
import { useAutosave } from "@/hooks/useAutosave"
import { Skeleton } from "@/components/ui/skeleton"
import type { ResumeDto } from "@/types/api"

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setCurrentResume = useResumeStore((state) => state.setCurrentResume)
  const currentResume = useResumeStore((state) => state.currentResume)
  const setLastSavedDocument = useResumeStore(
    (state) => state.setLastSavedDocument
  )
  const updateSectionTitle = useResumeStore((state) => state.updateSectionTitle)
  const updateItemField = useResumeStore((state) => state.updateItemField)

  const { status: autosaveStatus } = useAutosave(id)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const data = await apiClient.get<ResumeDto>(`/api/v1/resumes/${id}`)
        setCurrentResume(data)
        setLastSavedDocument(data.content)
      } catch {
        setError("Failed to load resume")
        toast.error("Failed to load resume")
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [id, setCurrentResume, setLastSavedDocument])

  // Cleanup: clear current resume from store on unmount
  useEffect(() => {
    return () => {
      setCurrentResume(null)
    }
  }, [setCurrentResume])

  const handleTitleChange = useCallback(
    (sectionId: string, title: string) => {
      updateSectionTitle(sectionId, title)
    },
    [updateSectionTitle]
  )

  const handleFieldChange = useCallback(
    (sectionId: string, itemId: string, field: string, value: string) => {
      updateItemField(sectionId, itemId, field, value)
    },
    [updateItemField]
  )

  return (
    <SplitPaneLayout
      leftSlot={
        <SectionsPanel sections={currentResume?.content.sections ?? []} />
      }
      centerSlot={
        error !== null && !isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <>
            <div
              role="status"
              aria-live="polite"
              className="text-xs text-muted-foreground text-right px-4 py-1 h-6"
            >
              {autosaveStatus === "saving" && "Saving…"}
              {autosaveStatus === "saved" && "Saved"}
              {autosaveStatus === "error" && (
                <span className="text-destructive">Save failed</span>
              )}
            </div>
            <div className="h-full overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">
              {isLoading ? (
                <div
                  id="resume-canvas"
                  aria-label="Resume preview loading"
                  className="bg-white shadow-lg w-full max-w-[794px] p-8 space-y-6"
                >
                  <Skeleton className="h-6 w-48" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                  <div className="space-y-2 pt-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="space-y-2 pt-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                </div>
              ) : currentResume === null ? (
                <article
                  id="resume-canvas"
                  aria-label="Resume preview"
                  className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]"
                />
              ) : (
                <article
                  id="resume-canvas"
                  aria-label="Resume preview"
                  className="bg-white shadow-lg w-full max-w-[794px] p-8"
                >
                  <div
                    role="status"
                    aria-live="polite"
                    aria-label="AI is updating your resume"
                    className="sr-only"
                  >
                    {/* SSE streaming stub — Story 4.3 */}
                  </div>
                  {currentResume.content.sections
                    .filter((s) => s.visible)
                    .map((section) => (
                      <ResumeSection
                        key={section.id}
                        section={section}
                        onTitleChange={(title) =>
                          handleTitleChange(section.id, title)
                        }
                        onFieldChange={(itemId, field, value) =>
                          handleFieldChange(section.id, itemId, field, value)
                        }
                      />
                    ))}
                </article>
              )}
            </div>
          </>
        )
      }
      rightSlot={
        <div className="p-4 text-sm text-muted-foreground">
          Chat panel coming in Story 4.3
        </div>
      }
    />
  )
}
