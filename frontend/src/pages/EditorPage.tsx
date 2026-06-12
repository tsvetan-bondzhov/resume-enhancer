import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import SplitPaneLayout from "@/components/layout/SplitPaneLayout"
import SectionsPanel from "@/components/resume/SectionsPanel"
import ResumeCanvas from "@/components/resume/ResumeCanvas"
import EditorToolbar from "@/components/resume/EditorToolbar"
import SaveAsDialog from "@/components/resume/SaveAsDialog"
import TemplateGallery from "@/components/resume/TemplateGallery"
import ResumeSidebarItem from "@/components/resume/ResumeSidebarItem"
import { useAutosave } from "@/hooks/useAutosave"
import type { ResumeDto } from "@/types/api"

async function executeDeleteResume(
  resume: ResumeDto,
  pendingDeletes: Map<string, ReturnType<typeof setTimeout>>,
  setSidebarResumes: React.Dispatch<React.SetStateAction<ResumeDto[]>>
): Promise<void> {
  pendingDeletes.delete(resume.id)
  try {
    await apiClient.delete(`/api/v1/resumes/${resume.id}`)
  } catch {
    setSidebarResumes((prev) => {
      if (prev.find((r) => r.id === resume.id)) return prev
      return [...prev, resume]
    })
    toast.error("Delete failed — resume restored")
  }
}

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
  const setCurrentResumeTemplateId = useResumeStore(
    (state) => state.setCurrentResumeTemplateId
  )
  const addItem = useResumeStore((state) => state.addItem)
  const deleteItem = useResumeStore((state) => state.deleteItem)
  const reorderItems = useResumeStore((state) => state.reorderItems)
  const resumes = useResumeStore((state) => state.resumes)

  const [sidebarResumes, setSidebarResumes] = useState<ResumeDto[]>(() => resumes)
  const [duplicatingSidebarId, setDuplicatingSidebarId] = useState<string | null>(null)
  const pendingSidebarDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const currentTemplateId = useResumeStore((state) => state.currentResume?.templateId ?? null)

  const { status: autosaveStatus, isDirty, lastSavedAt, saveNow } = useAutosave(id)

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

    // Fire-and-forget: effect does not need the promise result; errors handled inside load()
    load()
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

  // Cleanup pending sidebar deletes on unmount
  useEffect(() => {
    const ref = pendingSidebarDeletes.current
    return () => { ref.forEach(clearTimeout) }
  }, [])

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

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      if (!id || !currentResume) return
      // Optimistic update — update store immediately so the gallery highlights correctly
      setCurrentResumeTemplateId(templateId)
      try {
        await apiClient.put<ResumeDto>(`/api/v1/resumes/${id}`, {
          name: currentResume.name,
          content: currentResume.content,
          templateId,
        })
        toast.success("Template applied")
      } catch {
        // Revert optimistic update on failure
        setCurrentResumeTemplateId(currentResume.templateId)
        toast.error("Failed to apply template — please try again")
      }
    },
    [id, currentResume, setCurrentResumeTemplateId]
  )

  const handleBack = useCallback(() => {
    navigate("/")
  }, [navigate])

  const handleDuplicateFromSidebar = useCallback(async (resume: ResumeDto) => {
    setDuplicatingSidebarId(resume.id)
    try {
      const newResume = await apiClient.post<ResumeDto>(
        `/api/v1/resumes/${resume.id}/clone`,
        { name: `${resume.name} (copy)` },
      )
      setSidebarResumes((prev) => [newResume, ...prev])
      toast.success("Resume duplicated")
    } catch {
      toast.error("Failed to duplicate resume")
    } finally {
      setDuplicatingSidebarId(null)
    }
  }, [])

  const handleDeleteFromSidebar = useCallback((resume: ResumeDto) => {
    // 1. Remove from sidebar list immediately (optimistic)
    setSidebarResumes((prev) => prev.filter((r) => r.id !== resume.id))

    // 2. Schedule actual API delete after 5s
    const timeoutId = setTimeout(async () => {
      await executeDeleteResume(resume, pendingSidebarDeletes.current, setSidebarResumes)
    }, 5000)

    pendingSidebarDeletes.current.set(resume.id, timeoutId)

    // 3. Show undo toast
    toast("Deleted. Undo?", {
      action: {
        label: "Undo",
        onClick: () => {
          const tid = pendingSidebarDeletes.current.get(resume.id)
          if (tid !== undefined) clearTimeout(tid)
          pendingSidebarDeletes.current.delete(resume.id)
          setSidebarResumes((prev) => {
            if (prev.find((r) => r.id === resume.id)) return prev
            return [...prev, resume]
          })
        },
      },
      duration: 5000,
    })
  }, [])

  return (
    <>
      <SplitPaneLayout
        leftSlot={
          <div className="overflow-y-auto h-full">
            {/* Resume list for quick navigation (UX-DR9) */}
            {sidebarResumes.length > 0 && (
              <div className="px-2 py-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 px-1">
                  Resumes
                </p>
                {sidebarResumes.map((r) => (
                  <ResumeSidebarItem
                    key={r.id}
                    resume={r}
                    isActive={r.id === id}
                    onOpen={() => navigate(`/resumes/${r.id}`)}
                    onDuplicate={() => handleDuplicateFromSidebar(r)}
                    onDelete={() => handleDeleteFromSidebar(r)}
                    isDuplicating={duplicatingSidebarId === r.id}
                  />
                ))}
              </div>
            )}
            <SectionsPanel sections={currentResume?.content.sections ?? []} />
            <div className="border-t border-border mt-2 pt-2">
              <TemplateGallery
                activeTemplateId={currentResume?.templateId ?? null}
                onApply={handleApplyTemplate}
              />
            </div>
          </div>
        }
        centerSlot={
          <div className="flex flex-col h-full overflow-hidden">
            <EditorToolbar
              resumeName={currentResume?.name ?? ""}
              autosaveStatus={autosaveStatus}
              isDirty={isDirty}
              lastSavedAt={lastSavedAt}
              isSavingAs={isSavingAs}
              onNameChange={handleNameChange}
              onSave={saveNow}
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
                <ResumeCanvas
                  document={currentResume?.content ?? null}
                  templateId={currentTemplateId}
                  isLoading={isLoading}
                  onTitleChange={handleTitleChange}
                  onFieldChange={handleFieldChange}
                  onAddItem={(sectionType, position) => addItem(sectionType, position)}
                  onDeleteItem={(sectionType, itemId) => deleteItem(sectionType, itemId)}
                  onReorderItems={(sectionType, newItems) => reorderItems(sectionType, newItems)}
                />
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
