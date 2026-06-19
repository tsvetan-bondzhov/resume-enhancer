import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { EmptyState, EntryCardHeader, RequiredField, StepFooter, runSubmit, makeUpdateField, makeHandleBlur, makeAddAnother, makeRemoveEntry } from "./profileStepShared"
import type { LanguageProficiencyLevel, LanguageRequest, ProfileUpdateRequest } from "@/types/api"

const PROFICIENCY_LEVELS: LanguageProficiencyLevel[] = [
  "BEGINNER",
  "ELEMENTARY",
  "INTERMEDIATE",
  "UPPER_INTERMEDIATE",
  "ADVANCED",
  "NATIVE",
]

const PROFICIENCY_LABELS: Record<LanguageProficiencyLevel, string> = {
  BEGINNER: "Beginner",
  ELEMENTARY: "Elementary",
  INTERMEDIATE: "Intermediate",
  UPPER_INTERMEDIATE: "Upper Intermediate",
  ADVANCED: "Advanced",
  NATIVE: "Native",
}

interface LanguageDraft {
  id: string // stable key — generated once on entry creation
  name: string
  proficiencyLevel: LanguageProficiencyLevel | ""
}

interface FieldErrors {
  name?: string
  proficiencyLevel?: string
}

interface EntryState {
  draft: LanguageDraft
  errors: FieldErrors
}

function emptyDraft(): LanguageDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    proficiencyLevel: "",
  }
}

interface LanguagesStepProps {
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function LanguagesStep({
  onSaveAndContinue,
}: LanguagesStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [entries, setEntries] = useState<EntryState[]>(() => {
    const existing = profile?.languages ?? []
    if (existing.length === 0) {
      return [{ draft: emptyDraft(), errors: {} }]
    }
    return existing.map((lang) => ({
      draft: {
        id: crypto.randomUUID(),
        name: lang.name,
        proficiencyLevel: lang.proficiencyLevel,
      },
      errors: {},
    }))
  })

  const updateField = makeUpdateField<LanguageDraft, FieldErrors>(setEntries, ["name", "proficiencyLevel"])
  const handleBlur = makeHandleBlur<LanguageDraft, FieldErrors>(setEntries, "Language name is required")
  const addAnother = makeAddAnother(setEntries, emptyDraft, {})
  const removeEntry = makeRemoveEntry(setEntries)

  function validateAll(): EntryState[] {
    return entries.map((entry) => {
      const errors: FieldErrors = {}
      if (!entry.draft.name.trim()) errors.name = "Language name is required"
      if (!entry.draft.proficiencyLevel)
        errors.proficiencyLevel = "Proficiency level is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    await runSubmit(
      validateAll,
      setEntries,
      (validated) => validated.some((e) => e.errors.name || e.errors.proficiencyLevel),
      (validated) => ({
        languages: validated.map((e): LanguageRequest => ({
          name: e.draft.name,
          proficiencyLevel: e.draft.proficiencyLevel as LanguageProficiencyLevel,
        })),
      }),
      onSaveAndContinue,
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Languages</h2>

      {entries.length === 0 && (
        <EmptyState
          message="No languages added yet."
          addLabel="Add language"
          onAdd={addAnother}
        />
      )}

      {entries.map((entry, index) => (
        <div key={entry.draft.id} className="rounded-md border p-4 space-y-4">
          <EntryCardHeader index={index} onRemove={() => removeEntry(index)} />

          <RequiredField
            id={`name-${entry.draft.id}`}
            label="Language"
            value={entry.draft.name}
            placeholder="e.g. English"
            error={entry.errors.name}
            onChange={(v) => updateField(index, "name", v)}
            onBlur={() => handleBlur(index, "name")}
          />

          <div className="space-y-2">
            <label
              htmlFor={`proficiencyLevel-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Proficiency Level <span className="text-red-500">*</span>
            </label>
            <select
              id={`proficiencyLevel-${entry.draft.id}`}
              value={entry.draft.proficiencyLevel}
              onChange={(e) =>
                updateField(index, "proficiencyLevel", e.target.value)
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select level...</option>
              {PROFICIENCY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {PROFICIENCY_LABELS[level]}
                </option>
              ))}
            </select>
            {entry.errors.proficiencyLevel && (
              <p className="text-sm text-red-600">
                {entry.errors.proficiencyLevel}
              </p>
            )}
          </div>
        </div>
      ))}

      <StepFooter isSaving={isSaving} onAddAnother={addAnother} onSubmit={handleSubmit} />
    </div>
  )
}
