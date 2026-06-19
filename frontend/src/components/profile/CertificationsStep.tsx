import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Input } from "@/components/ui/input"
import { EmptyState, EntryCardHeader, RequiredField, StepFooter, runSubmit, makeUpdateField, makeHandleBlur, makeAddAnother, makeRemoveEntry } from "./profileStepShared"
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
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
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

  const updateField = makeUpdateField<CertificationDraft, FieldErrors>(setEntries, ["name"])
  const handleBlur = makeHandleBlur<CertificationDraft, FieldErrors>(setEntries, "Certification name is required")
  const addAnother = makeAddAnother(setEntries, emptyDraft, {} as FieldErrors)
  const removeEntry = makeRemoveEntry(setEntries)

  function validateAll(): EntryState[] {
    return entries.map((entry) => {
      const errors: FieldErrors = {}
      if (!entry.draft.name.trim()) errors.name = "Certification name is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    await runSubmit(
      validateAll,
      setEntries,
      (validated) => validated.some((e) => e.errors.name),
      (validated) => ({
        certifications: validated.map((e): CertificationRequest => ({
          name: e.draft.name,
          issuer: e.draft.issuer || null,
          issueDate: e.draft.issueDate || null,
          expirationDate: e.draft.expirationDate || null,
        })),
      }),
      onSaveAndContinue,
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Certifications</h2>

      {entries.length === 0 && (
        <EmptyState
          message="No certifications added yet."
          addLabel="Add certification"
          onAdd={addAnother}
        />
      )}

      {entries.map((entry, index) => (
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <EntryCardHeader index={index} onRemove={() => removeEntry(index)} />

          <RequiredField
            id={`name-${entry.draft.id}`}
            label="Certification Name"
            value={entry.draft.name}
            placeholder="e.g. AWS Cloud Practitioner"
            error={entry.errors.name}
            onChange={(v) => updateField(index, "name", v)}
            onBlur={() => handleBlur(index, "name")}
          />

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

      <StepFooter isSaving={isSaving} onAddAnother={addAnother} onSubmit={handleSubmit} />
    </div>
  )
}
