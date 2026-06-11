import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { ProjectRequest, ProfileUpdateRequest } from "@/types/api"

interface ProjectDraft {
  id: string // stable key — generated once on entry creation
  name: string
  description: string
  technologies: string
  link: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface FieldErrors {
  name?: string
}

interface EntryState {
  draft: ProjectDraft
  errors: FieldErrors
}

function emptyDraft(): ProjectDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    technologies: "",
    link: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
  }
}

interface ProjectsStepProps {
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function ProjectsStep({ onSaveAndContinue }: ProjectsStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const existing = profile?.projects ?? []
    if (existing.length === 0) {
      return [{ draft: emptyDraft(), errors: {} }]
    }
    return existing.map((proj) => ({
      draft: {
        id: crypto.randomUUID(),
        name: proj.name,
        description: proj.description ?? "",
        technologies: proj.technologies ?? "",
        link: proj.link ?? "",
        startDate: proj.startDate ?? "",
        endDate: proj.endDate ?? "",
        isCurrent: proj.isCurrent,
      },
      errors: {},
    }))
  })

  function updateField(
    index: number,
    field: keyof Omit<ProjectDraft, "id">,
    value: string | boolean,
  ) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const newDraft = { ...entry.draft, [field]: value }
        const newErrors = { ...entry.errors }
        if (field === "name") {
          delete newErrors.name
        }
        return { draft: newDraft, errors: newErrors }
      }),
    )
  }

  function handleBlur(index: number, field: "name") {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const value = entry.draft[field]
        if (!value.trim()) {
          return {
            ...entry,
            errors: { ...entry.errors, [field]: "Project name is required" },
          }
        }
        return entry
      }),
    )
  }

  function addAnother() {
    setEntries((prev) => [...prev, { draft: emptyDraft(), errors: {} }])
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  function validateAll(): EntryState[] {
    return entries.map((entry) => {
      const errors: FieldErrors = {}
      if (!entry.draft.name.trim()) errors.name = "Project name is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    const validated = validateAll()
    setEntries(validated)
    const hasErrors = validated.some((e) => e.errors.name)
    if (hasErrors) return

    const projects: ProjectRequest[] = validated.map((e) => ({
      name: e.draft.name,
      description: e.draft.description || null,
      technologies: e.draft.technologies || null,
      link: e.draft.link || null,
      startDate: e.draft.startDate || null,
      endDate: e.draft.isCurrent ? null : e.draft.endDate || null,
      isCurrent: e.draft.isCurrent,
    }))

    await onSaveAndContinue({ projects })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Projects</h2>

      {entries.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-500">
          No projects added yet.{" "}
          <button type="button" onClick={addAnother} className="text-blue-600 underline">
            Add project
          </button>
        </div>
      )}

      {entries.map((entry, index) => (
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600">
              Entry {index + 1}
            </span>
            <button
              type="button"
              aria-label={`Remove entry ${index + 1}`}
              onClick={() => removeEntry(index)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`name-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              id={`name-${entry.draft.id}`}
              value={entry.draft.name}
              onChange={(e) => updateField(index, "name", e.target.value)}
              onBlur={() => handleBlur(index, "name")}
              placeholder="e.g. Resume Enhancer"
            />
            {entry.errors.name && (
              <p className="text-sm text-red-600">{entry.errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`technologies-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Technologies
            </label>
            <Input
              id={`technologies-${entry.draft.id}`}
              value={entry.draft.technologies}
              onChange={(e) =>
                updateField(index, "technologies", e.target.value)
              }
              placeholder="e.g. Java, React, PostgreSQL"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`link-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Link
            </label>
            <Input
              id={`link-${entry.draft.id}`}
              value={entry.draft.link}
              onChange={(e) => updateField(index, "link", e.target.value)}
              placeholder="e.g. https://github.com/user/project"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor={`startDate-${entry.draft.id}`}
                className="text-sm font-medium"
              >
                Start Date
              </label>
              <Input
                id={`startDate-${entry.draft.id}`}
                type="date"
                value={entry.draft.startDate}
                onChange={(e) =>
                  updateField(index, "startDate", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`endDate-${entry.draft.id}`}
                className="text-sm font-medium"
              >
                End Date
              </label>
              <Input
                id={`endDate-${entry.draft.id}`}
                type="date"
                value={entry.draft.endDate}
                disabled={entry.draft.isCurrent}
                onChange={(e) => updateField(index, "endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`isCurrent-${entry.draft.id}`}
              checked={entry.draft.isCurrent}
              onCheckedChange={(checked) =>
                updateField(index, "isCurrent", checked === true)
              }
            />
            <label
              htmlFor={`isCurrent-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              This is an ongoing project
            </label>
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`description-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id={`description-${entry.draft.id}`}
              value={entry.draft.description}
              onChange={(e) =>
                updateField(index, "description", e.target.value)
              }
              placeholder="Describe the project, your role, and impact..."
              rows={3}
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addAnother}>
        + Add another
      </Button>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </div>
  )
}
