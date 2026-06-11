import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
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

  function updateField(
    index: number,
    field: keyof Omit<LanguageDraft, "id">,
    value: string,
  ) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const newDraft = { ...entry.draft, [field]: value }
        const newErrors = { ...entry.errors }
        if (field === "name") delete newErrors.name
        if (field === "proficiencyLevel") delete newErrors.proficiencyLevel
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
            errors: { ...entry.errors, [field]: "Language name is required" },
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
      if (!entry.draft.name.trim()) errors.name = "Language name is required"
      if (!entry.draft.proficiencyLevel)
        errors.proficiencyLevel = "Proficiency level is required"
      return { ...entry, errors }
    })
  }

  async function handleSubmit() {
    const validated = validateAll()
    setEntries(validated)
    const hasErrors = validated.some(
      (e) => e.errors.name || e.errors.proficiencyLevel,
    )
    if (hasErrors) return

    const languages: LanguageRequest[] = validated.map((e) => ({
      name: e.draft.name,
      proficiencyLevel: e.draft.proficiencyLevel as LanguageProficiencyLevel,
    }))

    await onSaveAndContinue({ languages })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Languages</h2>

      {entries.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-500">
          No languages added yet.{" "}
          <button type="button" onClick={addAnother} className="text-blue-600 underline">
            Add language
          </button>
        </div>
      )}

      {entries.map((entry, index) => (
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
              htmlFor={`name-${entry.draft.id}`}
              className="text-sm font-medium"
            >
              Language <span className="text-red-500">*</span>
            </label>
            <Input
              id={`name-${entry.draft.id}`}
              value={entry.draft.name}
              onChange={(e) => updateField(index, "name", e.target.value)}
              onBlur={() => handleBlur(index, "name")}
              placeholder="e.g. English"
            />
            {entry.errors.name && (
              <p className="text-sm text-red-600">{entry.errors.name}</p>
            )}
          </div>

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
