import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
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

  function updateField(
    index: number,
    field: keyof Omit<VolunteeringDraft, "id">,
    value: string | boolean,
  ) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const newDraft = { ...entry.draft, [field]: value }
        const newErrors = { ...entry.errors }
        if (field === "role" || field === "organization") {
          delete newErrors[field as keyof FieldErrors]
        }
        return { draft: newDraft, errors: newErrors }
      }),
    )
  }

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
    const validated = validateAll()
    setEntries(validated)
    const hasErrors = validated.some(
      (e) => e.errors.role || e.errors.organization,
    )
    if (hasErrors) return

    const volunteering: VolunteeringRequest[] = validated.map((e) => ({
      role: e.draft.role,
      organization: e.draft.organization,
      description: e.draft.description || null,
      startDate: e.draft.startDate || null,
      endDate: e.draft.isCurrent ? null : e.draft.endDate || null,
      isCurrent: e.draft.isCurrent,
    }))

    await onSaveAndContinue({ volunteering })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Volunteering</h2>

      {entries.map((entry, index) => (
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600">
              Entry {index + 1}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                aria-label={`Remove entry ${index + 1}`}
                onClick={() => removeEntry(index)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                ×
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`role-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Role <span className="text-red-500">*</span>
            </label>
            <Input
              id={`role-${entry.draft.id}`}
              value={entry.draft.role}
              onChange={(e) => updateField(index, "role", e.target.value)}
              onBlur={() => handleBlur(index, "role")}
              placeholder="e.g. Mentor"
            />
            {entry.errors.role && (
              <p className="text-sm text-red-600">{entry.errors.role}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`organization-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Organization <span className="text-red-500">*</span>
            </label>
            <Input
              id={`organization-${entry.draft.id}`}
              value={entry.draft.organization}
              onChange={(e) =>
                updateField(index, "organization", e.target.value)
              }
              onBlur={() => handleBlur(index, "organization")}
              placeholder="e.g. Code.org"
            />
            {entry.errors.organization && (
              <p className="text-sm text-red-600">{entry.errors.organization}</p>
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
              I currently volunteer here
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
              placeholder="Describe your volunteering responsibilities and impact..."
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
