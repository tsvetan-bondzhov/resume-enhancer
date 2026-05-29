import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProfileUpdateRequest, SkillRequest } from "@/types/api"

interface SkillEntryState {
  id: string // stable key — generated once on entry creation
  name: string
  error?: string
}

interface SkillsStepProps {
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function SkillsStep({ onSaveAndContinue }: SkillsStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [skills, setSkills] = useState<SkillEntryState[]>(() => {
    const existing = profile?.skills ?? []
    if (existing.length === 0) {
      return [{ id: crypto.randomUUID(), name: "" }]
    }
    return existing.map((s) => ({ id: crypto.randomUUID(), name: s.name }))
  })

  function updateSkill(index: number, value: string) {
    setSkills((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s
        return { ...s, name: value, error: undefined }
      }),
    )
  }

  function handleBlur(index: number) {
    setSkills((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s
        if (!s.name.trim()) {
          return { ...s, error: "Skill name is required" }
        }
        return s
      }),
    )
  }

  function addAnother() {
    setSkills((prev) => [...prev, { id: crypto.randomUUID(), name: "" }])
  }

  function removeSkill(index: number) {
    setSkills((prev) => prev.filter((_, i) => i !== index))
  }

  function validateAll(): SkillEntryState[] {
    return skills.map((s) => {
      if (!s.name.trim()) {
        return { ...s, error: "Skill name is required" }
      }
      return { ...s, error: undefined }
    })
  }

  async function handleSubmit() {
    const validated = validateAll()
    setSkills(validated)
    const hasErrors = validated.some((s) => s.error)
    if (hasErrors) return

    const skillsList: SkillRequest[] = validated.map((s) => ({ name: s.name }))
    await onSaveAndContinue({ skills: skillsList })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Skills</h2>

      <div className="space-y-3">
        {skills.map((skill, index) => (
          // Use stable id as key — avoids React reconciliation bugs when skills
          // are removed from the middle of the list.
          <div key={skill.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                id={`skill-${skill.id}`}
                aria-label={`Skill ${index + 1}`}
                value={skill.name}
                onChange={(e) => updateSkill(index, e.target.value)}
                onBlur={() => handleBlur(index)}
                placeholder="e.g. TypeScript"
              />
              {/* Show remove button only when more than one skill exists —
                  consistent with ExperienceStep and EducationStep. */}
              {skills.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove skill ${index + 1}`}
                  onClick={() => removeSkill(index)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              )}
            </div>
            {skill.error && (
              <p className="text-sm text-red-600">{skill.error}</p>
            )}
          </div>
        ))}
      </div>

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
