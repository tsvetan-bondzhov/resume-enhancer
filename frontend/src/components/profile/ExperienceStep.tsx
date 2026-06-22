import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { EntryDateRangeAndActivity, EmptyState, EntryCardHeader, RequiredField, StepFooter, runSubmit, makeUpdateField, makeHandleBlur } from "./profileStepShared"
import type { ProfileUpdateRequest, WorkExperienceRequest } from "@/types/api"

interface ExperienceDraft {
  id: string // stable key — generated once on entry creation
  jobTitle: string
  company: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
}

interface FieldErrors {
  jobTitle?: string
  company?: string
}

interface EntryState {
  draft: ExperienceDraft
  errors: FieldErrors
}

function emptyDraft(): ExperienceDraft {
  return {
    id: crypto.randomUUID(),
    jobTitle: "",
    company: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
  }
}

interface ExperienceStepProps {
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function ExperienceStep({
  onSaveAndContinue,
}: ExperienceStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const existing = profile?.workExperiences ?? []
    if (existing.length === 0) {
      return [{ draft: emptyDraft(), errors: {} }]
    }
    return existing.map((exp) => ({
      draft: {
        id: crypto.randomUUID(),
        jobTitle: exp.jobTitle,
        company: exp.company,
        startDate: exp.startDate ?? "",
        endDate: exp.endDate ?? "",
        isCurrent: exp.isCurrent,
        description: exp.description ?? "",
      },
      errors: {},
    }))
  })

  const updateField = makeUpdateField<ExperienceDraft, FieldErrors>(setEntries, ["jobTitle", "company"])
  const handleBlur = makeHandleBlur<ExperienceDraft, FieldErrors>(setEntries, { jobTitle: "Job title", company: "Company" })

  function addAnother() {
    setEntries((prev) => [...prev, { draft: emptyDraft(), errors: {} }])
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  function validateAll(): EntryState[] {
    return entries.map((entry) => {
      const errors: FieldErrors = {}
      if (!entry.draft.jobTitle.trim()) errors.jobTitle = "Job title is required"
      if (!entry.draft.company.trim()) errors.company = "Company is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    await runSubmit(
      validateAll,
      setEntries,
      (validated) => validated.some((e) => e.errors.jobTitle || e.errors.company),
      (validated) => ({
        workExperiences: validated.map((e): WorkExperienceRequest => ({
          jobTitle: e.draft.jobTitle,
          company: e.draft.company,
          startDate: e.draft.startDate || null,
          endDate: e.draft.isCurrent ? null : e.draft.endDate || null,
          isCurrent: e.draft.isCurrent,
          description: e.draft.description || null,
        })),
      }),
      onSaveAndContinue,
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Work Experience</h2>

      {entries.length === 0 && (
        <EmptyState
          message="No experience added yet."
          addLabel="Add experience"
          onAdd={addAnother}
        />
      )}

      {entries.map((entry, index) => (
        // Use stable id as key — avoids React reconciliation bugs when entries
        // are removed from the middle of the list.
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <EntryCardHeader index={index} onRemove={() => removeEntry(index)} />

          <RequiredField
            id={`jobTitle-${entry.draft.id}`}
            label="Job Title"
            value={entry.draft.jobTitle}
            placeholder="e.g. Software Engineer"
            error={entry.errors.jobTitle}
            onChange={(v) => updateField(index, "jobTitle", v)}
            onBlur={() => handleBlur(index, "jobTitle")}
          />

          <RequiredField
            id={`company-${entry.draft.id}`}
            label="Company"
            value={entry.draft.company}
            placeholder="e.g. Acme Corp"
            error={entry.errors.company}
            onChange={(v) => updateField(index, "company", v)}
            onBlur={() => handleBlur(index, "company")}
          />

          <EntryDateRangeAndActivity
            entryId={entry.draft.id}
            startValue={entry.draft.startDate}
            endValue={entry.draft.endDate}
            isCurrent={entry.draft.isCurrent}
            currentLabel="I currently work here"
            descriptionValue={entry.draft.description}
            descriptionPlaceholder="Describe your responsibilities and accomplishments..."
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
