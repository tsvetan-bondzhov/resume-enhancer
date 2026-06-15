import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Input } from "@/components/ui/input"
import { CurrentToggleAndDescription, DateRangeGrid, EmptyState, EntryCardHeader, RequiredField, StepFooter } from "./profileStepShared"
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
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
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
        <EmptyState
          message="No projects added yet."
          addLabel="Add project"
          onAdd={addAnother}
        />
      )}

      {entries.map((entry, index) => (
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <EntryCardHeader index={index} onRemove={() => removeEntry(index)} />

          <RequiredField
            id={`name-${entry.draft.id}`}
            label="Project Name"
            value={entry.draft.name}
            placeholder="e.g. Resume Enhancer"
            error={entry.errors.name}
            onChange={(v) => updateField(index, "name", v)}
            onBlur={() => handleBlur(index, "name")}
          />

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

          <DateRangeGrid
            startId={`startDate-${entry.draft.id}`}
            endId={`endDate-${entry.draft.id}`}
            startValue={entry.draft.startDate}
            endValue={entry.draft.endDate}
            endDateDisabled={entry.draft.isCurrent}
            onStartChange={(v) => updateField(index, "startDate", v)}
            onEndChange={(v) => updateField(index, "endDate", v)}
          />

          <CurrentToggleAndDescription
            entryId={entry.draft.id}
            isCurrentChecked={entry.draft.isCurrent}
            currentLabel="This is an ongoing project"
            descriptionValue={entry.draft.description}
            descriptionPlaceholder="Describe the project, your role, and impact..."
            onCurrentChange={(checked) => updateField(index, "isCurrent", checked)}
            onDescriptionChange={(v) => updateField(index, "description", v)}
          />
        </div>
      ))}

      <StepFooter isSaving={isSaving} onAddAnother={addAnother} onSubmit={handleSubmit} />
    </div>
  )
}
