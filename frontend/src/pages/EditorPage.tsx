import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import SplitPaneLayout from "@/components/layout/SplitPaneLayout"
import SectionsPanel from "@/components/resume/SectionsPanel"
import ResumeSection from "@/components/resume/ResumeSection"
import EditorToolbar from "@/components/resume/EditorToolbar"
import SaveAsDialog from "@/components/resume/SaveAsDialog"
import { useAutosave } from "@/hooks/useAutosave"
import { Skeleton } from "@/components/ui/skeleton"
import type { ResumeDto } from "@/types/api"

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false)
  const [isSavingAs, setIsSavingAs] = useState(false)

  const setCurrentResume = useResumeStore((state) => state.setCurrentResume)
  const currentResume = useResumeStore((state) => state.currentResume)
  const setLastSavedDocument = useResumeStore(
    (state) => state.setLastSavedDocument
  )
  const updateSectionTitle = useResumeStore((state) => state.updateSectionTitle)
  const updateItemField = useResumeStore((state) => state.updateItemField)
  const updateResumeName = useResumeStore((state) => state.updateResumeName)

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

  // Update browser tab title when resume name changes
  useEffect(() => {
    if (currentResume?.name) {
      document.title = `${currentResume.name} — Resume Enhancer`
    }
    return () => {
      document.title = "Resume Enhancer"
    }
  }, [currentResume?.name])

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

  const handleNameChange = useCallback(
    (name: string) => {
      updateResumeName(name)
      // useAutosave will pick up the currentResume change and debounce the PUT
    },
    [updateResumeName]
  )

  const handleSaveAs = useCallback(
    async (name: string) => {
      if (!id) return
      setIsSavingAs(true)
      try {
        const newResume = await apiClient.post<ResumeDto>(
          `/api/v1/resumes/${id}/clone`,
          { name }
        )
        setIsSaveAsOpen(false)
        toast.success(`Resume saved as '${name}'`)
        navigate(`/resumes/${newResume.id}`)
      } catch {
        toast.error("Failed to save as — please try again")
      } finally {
        setIsSavingAs(false)
      }
    },
    [id, navigate]
  )

  const handleBack = useCallback(() => {
    navigate("/")
  }, [navigate])

  return (
    <>
      <SplitPaneLayout
        leftSlot={
          <SectionsPanel sections={currentResume?.content.sections ?? []} />
        }
        centerSlot={
          <div className="flex flex-col h-full overflow-hidden">
            <EditorToolbar
              resumeName={currentResume?.name ?? ""}
              autosaveStatus={autosaveStatus}
              isSavingAs={isSavingAs}
              onNameChange={handleNameChange}
              onSaveAs={() => setIsSaveAsOpen(true)}
              onBack={handleBack}
            />
            {error !== null && !isLoading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-destructive">{error}</p>
              </div>
            ) : (
              <>
                {/* Autosave status for screen readers */}
                <div role="status" aria-live="polite" className="sr-only">
                  {autosaveStatus === "saving" && "Saving…"}
                  {autosaveStatus === "saved" && "Saved"}
                  {autosaveStatus === "error" && "Save failed"}
                </div>
                <div className="flex-1 overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">
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
          )}
          </div>
        }
        rightSlot={
          <div className="p-4 text-sm text-muted-foreground">
            Chat panel coming in Story 4.3
          </div>
        }
      />
      <SaveAsDialog
        open={isSaveAsOpen}
        defaultName={currentResume ? `${currentResume.name} (copy)` : ""}
        isSaving={isSavingAs}
        onConfirm={handleSaveAs}
        onClose={() => setIsSaveAsOpen(false)}
      />
    </>
  )
}
