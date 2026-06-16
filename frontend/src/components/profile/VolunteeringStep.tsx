import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { EntryDateRangeAndActivity, EmptyState, EntryCardHeader, RequiredField, StepFooter, runSubmit, makeUpdateField } from "./profileStepShared"
import type { VolunteeringRequest, ProfileUpdateRequest } from "@/types/api"

interface VolunteeringDraft {
  id: string // stable key — generated once on entry creation
  role: string
  organization: string
  description: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface FieldErrors {
  role?: string
  organization?: string
}

interface EntryState {
  draft: VolunteeringDraft
  errors: FieldErrors
}

function emptyDraft(): VolunteeringDraft {
  return {
    id: crypto.randomUUID(),
    role: "",
    organization: "",
    description: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
  }
}

interface VolunteeringStepProps {
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function VolunteeringStep({
  onSaveAndContinue,
}: VolunteeringStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const existing = profile?.volunteering ?? []
    if (existing.length === 0) {
      return [{ draft: emptyDraft(), errors: {} }]
    }
    return existing.map((vol) => ({
      draft: {
        id: crypto.randomUUID(),
        role: vol.role,
        organization: vol.organization,
        description: vol.description ?? "",
        startDate: vol.startDate ?? "",
        endDate: vol.endDate ?? "",
        isCurrent: vol.isCurrent,
      },
      errors: {},
    }))
  })

  const updateField = makeUpdateField<VolunteeringDraft, FieldErrors>(setEntries, ["role", "organization"])

  function handleBlur(index: number, field: "role" | "organization") {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const value = entry.draft[field]
        if (!value.trim()) {
          const label = field === "role" ? "Role" : "Organization"
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
      if (!entry.draft.role.trim()) errors.role = "Role is required"
      if (!entry.draft.organization.trim())
        errors.organization = "Organization is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    await runSubmit(
      validateAll,
      setEntries,
      (validated) => validated.some((e) => e.errors.role || e.errors.organization),
      (validated) => ({
        volunteering: validated.map((e): VolunteeringRequest => ({
          role: e.draft.role,
          organization: e.draft.organization,
          description: e.draft.description || null,
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
      <h2 className="text-xl font-semibold">Volunteering</h2>

      {entries.length === 0 && (
        <EmptyState
          message="No volunteering added yet."
          addLabel="Add volunteering"
          onAdd={addAnother}
        />
      )}

      {entries.map((entry, index) => (
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <EntryCardHeader index={index} onRemove={() => removeEntry(index)} />

          <RequiredField
            id={`role-${entry.draft.id}`}
            label="Role"
            value={entry.draft.role}
            placeholder="e.g. Mentor"
            error={entry.errors.role}
            onChange={(v) => updateField(index, "role", v)}
            onBlur={() => handleBlur(index, "role")}
          />

          <RequiredField
            id={`organization-${entry.draft.id}`}
            label="Organization"
            value={entry.draft.organization}
            placeholder="e.g. Code.org"
            error={entry.errors.organization}
            onChange={(v) => updateField(index, "organization", v)}
            onBlur={() => handleBlur(index, "organization")}
          />

          <EntryDateRangeAndActivity
            entryId={entry.draft.id}
            startValue={entry.draft.startDate}
            endValue={entry.draft.endDate}
            isCurrent={entry.draft.isCurrent}
            currentLabel="I currently volunteer here"
            descriptionValue={entry.draft.description}
            descriptionPlaceholder="Describe your volunteering responsibilities and impact..."
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
