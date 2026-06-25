import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/apiClient"
import type { TemplateDto, TemplateRequest } from "@/types/api"

export default function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Delete flow
  const [deleteTarget, setDeleteTarget] = useState<TemplateDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Publish/unpublish flow
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Edit flow
  const [editTarget, setEditTarget] = useState<TemplateDto | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<TemplateDto[]>("/api/v1/resume-templates/admin")
      .then((data) => {
        if (!cancelled) {
          setTemplates(data)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          toast.error("Failed to load templates")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // UX-DR19: Cancel button is default-focused when the confirm dialog opens.
  useEffect(() => {
    if (deleteTarget) {
      const id = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [deleteTarget])

  const closeDeleteDialog = () => {
    if (!deletingId) setDeleteTarget(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const templateId = deleteTarget.id
    setDeletingId(templateId)
    try {
      await apiClient.delete(`/api/v1/resume-templates/${templateId}`)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      toast.success("Template deleted")
      setDeleteTarget(null)
    } catch {
      toast.error("Failed to delete template")
    } finally {
      setDeletingId(null)
    }
  }

  const handleTogglePublish = async (template: TemplateDto) => {
    const action = template.isPublished ? "unpublish" : "publish"
    setTogglingId(template.id)
    try {
      const updated = await apiClient.patch<TemplateDto>(
        `/api/v1/resume-templates/${template.id}/${action}`,
      )
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, isPublished: updated.isPublished } : t,
        ),
      )
      toast.success(template.isPublished ? "Template unpublished" : "Template published")
    } catch {
      toast.error(
        template.isPublished
          ? "Failed to unpublish template"
          : "Failed to publish template",
      )
    } finally {
      setTogglingId(null)
    }
  }

  const openEditDialog = (template: TemplateDto) => {
    setEditTarget(template)
    setEditName(template.name)
    setEditDescription(template.description ?? "")
  }

  const closeEditDialog = () => {
    if (!savingEdit) setEditTarget(null)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    const templateId = editTarget.id
    setSavingEdit(true)
    try {
      // Send the existing templateDefinition unchanged so backend validation passes.
      const body: TemplateRequest = {
        name: editName,
        description: editDescription.trim() === "" ? null : editDescription,
        templateDefinition: editTarget.templateDefinition as unknown as Record<string, unknown>,
      }
      const updated = await apiClient.put<TemplateDto>(
        `/api/v1/resume-templates/${templateId}`,
        body,
      )
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId
            ? { ...t, name: updated.name, description: updated.description }
            : t,
        ),
      )
      toast.success("Template updated")
      setEditTarget(null)
    } catch {
      toast.error("Failed to update template")
    } finally {
      setSavingEdit(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (loadError) {
    return <p className="text-sm text-destructive">Failed to load templates.</p>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Name</th>
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
              <th scope="col" className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No templates found.
                </td>
              </tr>
            ) : (
              templates.map((template) => {
                const inFlight = togglingId === template.id
                return (
                  <tr key={template.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{template.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant={template.isPublished ? "secondary" : "outline"}>
                        {template.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePublish(template)}
                          disabled={inFlight}
                        >
                          {template.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(template)}
                          disabled={deletingId === template.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

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
                ? `Delete template '${deleteTarget.name}'? This cannot be undone.`
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
              {deletingId === null ? "Delete" : "Deleting…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeEditDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>
              Update the template name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={savingEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={savingEdit}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditDialog}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit || editName.trim() === ""}
            >
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
