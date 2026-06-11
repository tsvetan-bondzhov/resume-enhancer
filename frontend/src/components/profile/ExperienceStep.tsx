import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
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

  function updateField(
    index: number,
    field: keyof Omit<ExperienceDraft, "id">,
    value: string | boolean,
  ) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const newDraft = { ...entry.draft, [field]: value }
        // Clear error on change for text fields
        const newErrors = { ...entry.errors }
        if (field === "jobTitle" || field === "company") {
          delete newErrors[field as keyof FieldErrors]
        }
        return { draft: newDraft, errors: newErrors }
      }),
    )
  }

  function handleBlur(index: number, field: "jobTitle" | "company") {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const value = entry.draft[field]
        if (!value.trim()) {
          const label = field === "jobTitle" ? "Job title" : "Company"
          return {
            ...entry,
            errors: { ...entry.errors, [field]: `${label} is required` },
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
      if (!entry.draft.jobTitle.trim()) errors.jobTitle = "Job title is required"
      if (!entry.draft.company.trim()) errors.company = "Company is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    const validated = validateAll()
    setEntries(validated)
    const hasErrors = validated.some(
      (e) => e.errors.jobTitle || e.errors.company,
    )
    if (hasErrors) return

    const workExperiences: WorkExperienceRequest[] = validated.map((e) => ({
      jobTitle: e.draft.jobTitle,
      company: e.draft.company,
      startDate: e.draft.startDate || null,
      endDate: e.draft.isCurrent ? null : e.draft.endDate || null,
      isCurrent: e.draft.isCurrent,
      description: e.draft.description || null,
    }))

    await onSaveAndContinue({ workExperiences })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Work Experience</h2>

      {entries.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-500">
          No experience added yet.{" "}
          <button type="button" onClick={addAnother} className="text-blue-600 underline">
            Add experience
          </button>
        </div>
      )}

      {entries.map((entry, index) => (
        // Use stable id as key — avoids React reconciliation bugs when entries
        // are removed from the middle of the list.
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
              htmlFor={`jobTitle-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Job Title <span className="text-red-500">*</span>
            </label>
            <Input
              id={`jobTitle-${entry.draft.id}`}
              value={entry.draft.jobTitle}
              onChange={(e) => updateField(index, "jobTitle", e.target.value)}
              onBlur={() => handleBlur(index, "jobTitle")}
              placeholder="e.g. Software Engineer"
            />
            {entry.errors.jobTitle && (
              <p className="text-sm text-red-600">{entry.errors.jobTitle}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`company-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Company <span className="text-red-500">*</span>
            </label>
            <Input
              id={`company-${entry.draft.id}`}
              value={entry.draft.company}
              onChange={(e) => updateField(index, "company", e.target.value)}
              onBlur={() => handleBlur(index, "company")}
              placeholder="e.g. Acme Corp"
            />
            {entry.errors.company && (
              <p className="text-sm text-red-600">{entry.errors.company}</p>
            )}
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
              I currently work here
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
              placeholder="Describe your responsibilities and accomplishments..."
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
