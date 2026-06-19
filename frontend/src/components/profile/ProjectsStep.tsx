import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Input } from "@/components/ui/input"
import { EntryDateRangeAndActivity, EmptyState, EntryCardHeader, RequiredField, StepFooter, runSubmit, makeUpdateField, makeHandleBlur, makeAddAnother, makeRemoveEntry } from "./profileStepShared"
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

  const updateField = makeUpdateField<ProjectDraft, FieldErrors>(setEntries, ["name"])
  const handleBlur = makeHandleBlur<ProjectDraft, FieldErrors>(setEntries, "Project name is required")
  const addAnother = makeAddAnother(setEntries, emptyDraft, {} as FieldErrors)
  const removeEntry = makeRemoveEntry(setEntries)

  function validateAll(): EntryState[] {
    return entries.map((entry) => {
      const errors: FieldErrors = {}
      if (!entry.draft.name.trim()) errors.name = "Project name is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    await runSubmit(
      validateAll,
      setEntries,
      (validated) => validated.some((e) => e.errors.name),
      (validated) => ({
        projects: validated.map((e): ProjectRequest => ({
          name: e.draft.name,
          description: e.draft.description || null,
          technologies: e.draft.technologies || null,
          link: e.draft.link || null,
          startDate: e.draft.startDate || null,
          endDate: e.draft.isCurrent ? null : e.draft.endDate || null,
          isCurrent: e.draft.isCurrent,
        })),
      }),
      onSaveAndContinue,
    )
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

          <EntryDateRangeAndActivity
            entryId={entry.draft.id}
            startValue={entry.draft.startDate}
            endValue={entry.draft.endDate}
            isCurrent={entry.draft.isCurrent}
            currentLabel="This is an ongoing project"
            descriptionValue={entry.draft.description}
            descriptionPlaceholder="Describe the project, your role, and impact..."
            onStartChange={(v) => updateField(index, "startDate", v)}
            onEndChange={(v) => updateField(index, "endDate", v)}
            onCurrentChange={(checked) => updateField(index, "isCurrent", checked)}
            onDescriptionChange={(v) => updateField(index, "description", v)}
          />
        </div>
      ))}

      <StepFooter isSaving={isSaving} onAddAnother={addAnother} onSubmit={handleSubmit} />
    </div>
  )
}
