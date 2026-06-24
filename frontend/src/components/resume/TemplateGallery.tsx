import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TemplateDto } from "@/types/api"

interface TemplateGalleryProps {
  readonly activeTemplateId: string | null
  readonly onApply: (templateId: string) => void
}

function TemplateThumbnail({ template }: { readonly template: TemplateDto }) {
  const layoutType = template.templateDefinition?.layoutType
  const accentColor = template.templateDefinition?.cssVariables?.["--accent-color"] ?? "#3b82f6"

  if (layoutType === "two-column") {
    return (
      <div className="w-full aspect-[1/1.414] bg-zinc-100 rounded-sm mb-1.5 flex gap-0.5 p-1 overflow-hidden">
        {/* Narrow left column */}
        <div className="w-1/3 flex flex-col gap-0.5">
          <div className="h-0.5 bg-zinc-300 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/5" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-3/5" />
          <div className="h-0.5 bg-zinc-300 rounded-full w-full mt-1" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/5" />
        </div>
        {/* Wider right column */}
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="h-1 bg-zinc-300 rounded-full w-3/4" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
        </div>
      </div>
    )
  }

  if (layoutType === "modern-accent") {
    return (
      <div className="w-full aspect-[1/1.414] bg-white rounded-sm mb-1.5 overflow-hidden">
        {/* Accent header band */}
        <div className="h-3 w-full" style={{ backgroundColor: accentColor }} />
        {/* Content lines */}
        <div className="flex flex-col gap-0.5 p-1">
          <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
          <div className="h-1 bg-zinc-300 rounded-full w-1/2 mt-0.5" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
        </div>
      </div>
    )
  }

  // Default: single-column (also handles undefined layoutType — graceful fallback)
  return (
    <div className="w-full aspect-[1/1.414] bg-zinc-100 rounded-sm mb-1.5 flex flex-col gap-0.5 p-1 overflow-hidden">
      <div className="h-1 bg-zinc-300 rounded-full w-3/4" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-full mt-0.5" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
      <div className="h-1 bg-zinc-300 rounded-full w-1/2 mt-1" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
    </div>
  )
}

const FILTER_TABS = ["all", "minimal", "classic", "modern"] as const
type FilterTab = (typeof FILTER_TABS)[number]

export default function TemplateGallery({
  activeTemplateId,
  onApply,
}: TemplateGalleryProps) {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  // My Templates (custom) — own fetch / loading / error state (AC1)
  const [customTemplates, setCustomTemplates] = useState<TemplateDto[]>([])
  const [isCustomLoading, setIsCustomLoading] = useState(true)
  const [isCustomError, setIsCustomError] = useState(false)

  // Delete confirm state (AC7)
  const [deleteTarget, setDeleteTarget] = useState<TemplateDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<TemplateDto[]>("/api/v1/resume-templates")
      .then((data) => {
        if (!cancelled) {
          setTemplates(data)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<TemplateDto[]>("/api/v1/resume-templates/custom")
      .then((data) => {
        if (!cancelled) {
          setCustomTemplates(data)
          setIsCustomLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsCustomError(true)
          setIsCustomLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // UX-DR19: Cancel button is default-focused when the delete confirm dialog opens.
  useEffect(() => {
    if (deleteTarget) {
      const id = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [deleteTarget])

  const openCreate = () => {
    navigate("/templates/custom/new")
  }

  const openEdit = (template: TemplateDto) => {
    navigate(`/templates/custom/${template.id}/edit`)
  }

  const closeDeleteDialog = () => {
    if (!deletingId) setDeleteTarget(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const templateId = deleteTarget.id
    setDeletingId(templateId)
    try {
      await apiClient.delete(`/api/v1/resume-templates/custom/${templateId}`)
      setCustomTemplates((prev) => prev.filter((t) => t.id !== templateId))
      toast.success("Template deleted")
    } catch {
      toast.error("Failed to delete template")
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  const filteredTemplates = (tab: FilterTab) =>
    tab === "all"
      ? templates
      : templates.filter((t) => t.name.toLowerCase().includes(tab))

  const activeTemplate = templates.find(t => t.id === activeTemplateId)

  function renderTabContent(tab: FilterTab) {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-24 w-full rounded" />
          <Skeleton className="h-24 w-full rounded" />
          <Skeleton className="h-24 w-full rounded" />
        </div>
      )
    }
    const items = filteredTemplates(tab)
    if (items.length === 0) {
      return (
        <p className="text-xs text-muted-foreground text-center py-4">
          No templates in this category
        </p>
      )
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {items.map((template) => {
          const isActive = template.id === activeTemplateId
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onApply(template.id)}
              aria-label={`Apply ${template.name} template${isActive ? " (active)" : ""}`}
              aria-pressed={isActive}
              className={[
                "relative rounded border text-left p-2 transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                isActive
                  ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50"
                  : "border-border bg-card hover:border-zinc-400",
              ].join(" ")}
            >
              <TemplateThumbnail template={template} />

              <p className="text-xs font-medium truncate">{template.name}</p>

              {isActive && (
                <span
                  className="absolute top-1 right-1 text-[10px] bg-blue-500 text-white px-1 rounded"
                  aria-hidden="true"
                >
                  Active
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  function renderMyTemplates() {
    if (isCustomLoading) {
      return (
        <div className="grid grid-cols-2 gap-2" aria-busy="true">
          <Skeleton className="h-24 w-full rounded" />
          <Skeleton className="h-24 w-full rounded" />
        </div>
      )
    }
    if (isCustomError) {
      return (
        <p className="text-xs text-destructive text-center py-4">
          Failed to load your templates. Please try again.
        </p>
      )
    }
    return (
      <div className="space-y-3">
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={openCreate}
        >
          Create New Template
        </Button>
        {customTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            You have no custom templates yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {customTemplates.map((template) => {
              const isActive = template.id === activeTemplateId
              return (
                <div
                  key={template.id}
                  className={[
                    "relative rounded border p-2",
                    isActive
                      ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50"
                      : "border-border bg-card",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => onApply(template.id)}
                    aria-label={`Apply ${template.name} template${isActive ? " (active)" : ""}`}
                    aria-pressed={isActive}
                    className="block w-full text-left transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  >
                    <TemplateThumbnail template={template} />
                    <p className="text-xs font-medium truncate">{template.name}</p>
                  </button>
                  <div className="mt-1 flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 text-[10px]"
                      onClick={() => openEdit(template)}
                      aria-label={`Edit ${template.name} template`}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-6 flex-1 text-[10px]"
                      onClick={() => setDeleteTarget(template)}
                      disabled={deletingId === template.id}
                      aria-label={`Delete ${template.name} template`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      <p className="text-sm font-medium mb-3">Templates</p>
      {activeTemplate && (
        <p className="text-xs text-muted-foreground mb-2">
          Active template:{" "}
          <span className="font-medium text-foreground">{activeTemplate.name}</span>
        </p>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-3">
          <TabsTrigger value="all" className="flex-1 text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="minimal" className="flex-1 text-xs">
            Minimal
          </TabsTrigger>
          <TabsTrigger value="classic" className="flex-1 text-xs">
            Classic
          </TabsTrigger>
          <TabsTrigger value="modern" className="flex-1 text-xs">
            Modern
          </TabsTrigger>
          <TabsTrigger value="my" className="flex-1 text-xs">
            My Templates
          </TabsTrigger>
        </TabsList>

        {FILTER_TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
            {renderTabContent(tab)}
          </TabsContent>
        ))}
        <TabsContent value="my" className="mt-0">
          {renderMyTemplates()}
        </TabsContent>
      </Tabs>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDeleteDialog()
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete '${deleteTarget.name}'? Resumes using it will revert to the default template.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelRef}
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
