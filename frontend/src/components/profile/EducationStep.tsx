import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Input } from "@/components/ui/input"
import { DateRangeGrid, EntryCardHeader, StepFooter } from "./profileStepShared"
import type { ProfileUpdateRequest, EducationRequest } from "@/types/api"

interface EducationDraft {
  id: string // stable key — generated once on entry creation
  institution: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate: string
}

interface FieldErrors {
  institution?: string
}

interface EntryState {
  draft: EducationDraft
  errors: FieldErrors
}

function emptyDraft(): EducationDraft {
  return {
    id: crypto.randomUUID(),
    institution: "",
    degree: "",
    fieldOfStudy: "",
    startDate: "",
    endDate: "",
  }
}

interface EducationStepProps {
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function EducationStep({
  onSaveAndContinue,
}: EducationStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const existing = profile?.education ?? []
    if (existing.length === 0) {
      return [{ draft: emptyDraft(), errors: {} }]
    }
    return existing.map((edu) => ({
      draft: {
        id: crypto.randomUUID(),
        institution: edu.institution,
        degree: edu.degree ?? "",
        fieldOfStudy: edu.fieldOfStudy ?? "",
        startDate: edu.startDate ?? "",
        endDate: edu.endDate ?? "",
      },
      errors: {},
    }))
  })

  function updateField(
    index: number,
    field: keyof Omit<EducationDraft, "id">,
    value: string,
  ) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const newDraft = { ...entry.draft, [field]: value }
        const newErrors = { ...entry.errors }
        if (field === "institution") {
          delete newErrors.institution
        }
        return { draft: newDraft, errors: newErrors }
      }),
    )
  }

  function handleBlur(index: number) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        if (!entry.draft.institution.trim()) {
          return {
            ...entry,
            errors: { ...entry.errors, institution: "Institution is required" },
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
      if (!entry.draft.institution.trim())
        errors.institution = "Institution is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    const validated = validateAll()
    setEntries(validated)
    const hasErrors = validated.some((e) => e.errors.institution)
    if (hasErrors) return

    const education: EducationRequest[] = validated.map((e) => ({
      institution: e.draft.institution,
      degree: e.draft.degree || null,
      fieldOfStudy: e.draft.fieldOfStudy || null,
      startDate: e.draft.startDate || null,
      endDate: e.draft.endDate || null,
    }))

    await onSaveAndContinue({ education })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Education</h2>

      {entries.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-500">
          No education added yet.{" "}
          <button type="button" onClick={addAnother} className="text-blue-600 underline">
            Add education
          </button>
        </div>
      )}

      {entries.map((entry, index) => (
        // Use stable id as key — avoids React reconciliation bugs when entries
        // are removed from the middle of the list.
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <EntryCardHeader index={index} onRemove={() => removeEntry(index)} />

          <div className="space-y-2">
            <label
              htmlFor={`institution-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Institution <span className="text-red-500">*</span>
            </label>
            <Input
              id={`institution-${entry.draft.id}`}
              value={entry.draft.institution}
              onChange={(e) =>
                updateField(index, "institution", e.target.value)
              }
              onBlur={() => handleBlur(index)}
              placeholder="e.g. State University"
            />
            {entry.errors.institution && (
              <p className="text-sm text-red-600">{entry.errors.institution}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor={`degree-${entry.draft.id}`}
                className="text-sm font-medium"
              >
                Degree
              </label>
              <Input
                id={`degree-${entry.draft.id}`}
                value={entry.draft.degree}
                onChange={(e) => updateField(index, "degree", e.target.value)}
                placeholder="e.g. Bachelor of Science"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`fieldOfStudy-${entry.draft.id}`}
                className="text-sm font-medium"
              >
                Field of Study
              </label>
              <Input
                id={`fieldOfStudy-${entry.draft.id}`}
                value={entry.draft.fieldOfStudy}
                onChange={(e) =>
                  updateField(index, "fieldOfStudy", e.target.value)
                }
                placeholder="e.g. Computer Science"
              />
            </div>
          </div>

          <DateRangeGrid
            startId={`eduStartDate-${entry.draft.id}`}
            endId={`eduEndDate-${entry.draft.id}`}
            startValue={entry.draft.startDate}
            endValue={entry.draft.endDate}
            onStartChange={(v) => updateField(index, "startDate", v)}
            onEndChange={(v) => updateField(index, "endDate", v)}
          />
        </div>
      ))}

      <StepFooter isSaving={isSaving} onAddAnother={addAnother} onSubmit={handleSubmit} />
    </div>
  )
}
