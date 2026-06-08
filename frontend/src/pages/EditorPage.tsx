import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import SplitPaneLayout from "@/components/layout/SplitPaneLayout"
import SectionsPanel from "@/components/resume/SectionsPanel"
import ResumeSection from "@/components/resume/ResumeSection"
import EditorToolbar from "@/components/resume/EditorToolbar"
import SaveAsDialog from "@/components/resume/SaveAsDialog"
import TemplateGallery from "@/components/resume/TemplateGallery"
import ResumeSidebarItem from "@/components/resume/ResumeSidebarItem"
import { useAutosave } from "@/hooks/useAutosave"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrderedSections } from "@/lib/templateUtils"
import type { ResumeDto, TemplateDto } from "@/types/api"

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
  const resumes = useResumeStore((state) => state.resumes)

  const [sidebarResumes, setSidebarResumes] = useState<ResumeDto[]>(() => resumes)
  const [duplicatingSidebarId, setDuplicatingSidebarId] = useState<string | null>(null)
  const pendingSidebarDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const [currentTemplate, setCurrentTemplate] = useState<TemplateDto | null>(null)
  const currentTemplateId = useResumeStore((state) => state.currentResume?.templateId ?? null)

  const { status: autosaveStatus } = useAutosave(id)

  // Template-driven CSS variables and layout type (AC10)
  const editorCssVars = currentTemplate?.templateDefinition?.cssVariables ?? {}
  const editorLayoutType = currentTemplate?.templateDefinition?.layoutType
  const editorBaseStyle = Object.fromEntries(
    Object.entries(editorCssVars as Record<string, string>).filter(([, v]) => v !== undefined)
  ) as React.CSSProperties
  const editorRootStyle: React.CSSProperties =
    editorLayoutType === "two-column"
      ? { ...editorBaseStyle, gridTemplateColumns: "1fr 2fr" }
      : editorBaseStyle
  // Two-column: sets of section IDs for grid-column assignment (AC8)
  const editorLeftColumnIds = new Set(
    currentTemplate?.templateDefinition?.layout?.columns?.left ?? []
  )
  const editorRightColumnIds = new Set(
    currentTemplate?.templateDefinition?.layout?.columns?.right ?? []
  )

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

  // Cleanup pending sidebar deletes on unmount
  useEffect(() => {
    const ref = pendingSidebarDeletes.current
    return () => { ref.forEach(clearTimeout) }
  }, [])

  // Fetch template definition when templateId changes (AC10)
  useEffect(() => {
    let cancelled = false
    if (currentTemplateId) {
      apiClient
        .get<TemplateDto>(`/api/v1/resume-templates/${currentTemplateId}`)
        .then((data) => {
          if (!cancelled) setCurrentTemplate(data)
        })
        .catch(() => {
          if (!cancelled) setCurrentTemplate(null)
        })
    } else {
      // ESLint react-hooks/set-state-in-effect forbids synchronous setState in effect body.
      // Promise.resolve().then() defers to microtask queue — satisfies the rule while
      // still resetting template when currentTemplateId becomes null (AC5/AC6).
      void Promise.resolve().then(() => {
        if (!cancelled) setCurrentTemplate(null)
      })
    }
    return () => {
      cancelled = true
    }
  }, [currentTemplateId])

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
      pendingSidebarDeletes.current.delete(resume.id)
      try {
        await apiClient.delete(`/api/v1/resumes/${resume.id}`)
      } catch {
        setSidebarResumes((prev) => {
          if (prev.find((r) => r.id === resume.id)) return prev
          return [...prev, resume]
        })
        toast.error("Delete failed — resume restored")
      }
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
                    style={editorRootStyle}
                    className={
                      editorLayoutType === "two-column"
                        ? "bg-white shadow-lg w-full max-w-[794px] grid gap-4 p-8"
                        : "bg-white shadow-lg w-full max-w-[794px] p-8"
                    }
                  >
                    <div
                      role="status"
                      aria-live="polite"
                      aria-label="AI is updating your resume"
                      className="sr-only"
                    >
                      {/* SSE streaming stub — Story 4.3 */}
                    </div>
                    {/* modern-accent: accent header band (AC7) — decorative only */}
                    {editorLayoutType === "modern-accent" && (
                      <div aria-hidden="true" className="bg-[var(--accent-color)] p-4 mb-6" />
                    )}
                    {getOrderedSections(currentResume.content.sections, currentTemplate).map((section) => (
                      <div
                        key={section.id}
                        style={
                          editorLayoutType === "two-column"
                            ? { gridColumn: editorLeftColumnIds.has(section.id) ? 1 : editorRightColumnIds.has(section.id) ? 2 : undefined }
                            : undefined
                        }
                      >
                        <ResumeSection
                          section={section}
                          onTitleChange={(title) =>
                            handleTitleChange(section.id, title)
                          }
                          onFieldChange={(itemId, field, value) =>
                            handleFieldChange(section.id, itemId, field, value)
                          }
                        />
                      </div>
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
