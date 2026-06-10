import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CertificationRequest, ProfileUpdateRequest } from "@/types/api"

interface CertificationDraft {
  id: string // stable key — generated once on entry creation
  name: string
  issuer: string
  issueDate: string
  expirationDate: string
}

interface FieldErrors {
  name?: string
}

interface EntryState {
  draft: CertificationDraft
  errors: FieldErrors
}

function emptyDraft(): CertificationDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    issuer: "",
    issueDate: "",
    expirationDate: "",
  }
}

interface CertificationsStepProps {
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function CertificationsStep({
  onSaveAndContinue,
}: CertificationsStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const existing = profile?.certifications ?? []
    if (existing.length === 0) {
      return [{ draft: emptyDraft(), errors: {} }]
    }
    return existing.map((cert) => ({
      draft: {
        id: crypto.randomUUID(),
        name: cert.name,
        issuer: cert.issuer ?? "",
        issueDate: cert.issueDate ?? "",
        expirationDate: cert.expirationDate ?? "",
      },
      errors: {},
    }))
  })

  function updateField(
    index: number,
    field: keyof Omit<CertificationDraft, "id">,
    value: string,
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
            errors: { ...entry.errors, [field]: "Certification name is required" },
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
      if (!entry.draft.name.trim()) errors.name = "Certification name is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    const validated = validateAll()
    setEntries(validated)
    const hasErrors = validated.some((e) => e.errors.name)
    if (hasErrors) return

    const certifications: CertificationRequest[] = validated.map((e) => ({
      name: e.draft.name,
      issuer: e.draft.issuer || null,
      issueDate: e.draft.issueDate || null,
      expirationDate: e.draft.expirationDate || null,
    }))

    await onSaveAndContinue({ certifications })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Certifications</h2>

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
              htmlFor={`name-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Certification Name <span className="text-red-500">*</span>
            </label>
            <Input
              id={`name-${entry.draft.id}`}
              value={entry.draft.name}
              onChange={(e) => updateField(index, "name", e.target.value)}
              onBlur={() => handleBlur(index, "name")}
              placeholder="e.g. AWS Cloud Practitioner"
            />
            {entry.errors.name && (
              <p className="text-sm text-red-600">{entry.errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor={`issuer-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Issuer
            </label>
            <Input
              id={`issuer-${entry.draft.id}`}
              value={entry.draft.issuer}
              onChange={(e) => updateField(index, "issuer", e.target.value)}
              placeholder="e.g. Amazon Web Services"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor={`issueDate-${entry.draft.id}`}
                className="text-sm font-medium"
              >
                Issue Date
              </label>
              <Input
                id={`issueDate-${entry.draft.id}`}
                type="date"
                value={entry.draft.issueDate}
                onChange={(e) => updateField(index, "issueDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`expirationDate-${entry.draft.id}`}
                className="text-sm font-medium"
              >
                Expiration Date
              </label>
              <Input
                id={`expirationDate-${entry.draft.id}`}
                type="date"
                value={entry.draft.expirationDate}
                onChange={(e) =>
                  updateField(index, "expirationDate", e.target.value)
                }
              />
            </div>
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
