import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useProfileStore } from "@/stores/useProfileStore"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ProfileUpdateRequest } from "@/types/api"

interface SummaryStepProps {
  onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function SummaryStep({ onSaveAndContinue }: SummaryStepProps) {
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)

  const [summary, setSummary] = useState(profile?.summary ?? "")

  async function handleSaveAndFinish() {
    try {
      await onSaveAndContinue({ summary: summary || null })
      // Only show success toast and navigate if the save succeeded —
      // if onSaveAndContinue throws, these lines are skipped.
      toast.success("Profile complete!")
      navigate("/")
    } catch {
      // Error toast is already shown by ProfilePage.handleSaveAndContinue;
      // nothing additional to do here.
    }
  }

  function handleSkip() {
    navigate("/")
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Professional Summary</h2>
      <p className="text-sm text-zinc-500">
        Optional — write a brief summary about yourself.
      </p>

      <div className="space-y-2">
        <label htmlFor="summary" className="text-sm font-medium">
          Summary
        </label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Experienced software engineer with 5+ years building scalable web applications..."
          rows={5}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-zinc-500 hover:text-zinc-700 underline"
        >
          Skip
        </button>
        <Button onClick={handleSaveAndFinish} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save & Finish"}
        </Button>
      </div>
    </div>
  )
}
