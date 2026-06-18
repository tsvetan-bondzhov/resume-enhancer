import { useState } from "react"
import { useProfileStore } from "@/stores/useProfileStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import type { ProfileUpdateRequest } from "@/types/api"

interface SummaryStepProps {
  readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>
}

export default function SummaryStep({ onSaveAndContinue }: SummaryStepProps) {
  const profile = useProfileStore((s) => s.profile)
  const isSaving = useProfileStore((s) => s.isSaving)
  const user = useAuthStore((s) => s.user)

  const [summary, setSummary] = useState(profile?.summary ?? "")
  const [contactEmail, setContactEmail] = useState(profile?.contactEmail ?? user?.email ?? "")
  const [linkedInUrl, setLinkedInUrl] = useState(profile?.linkedInUrl ?? "")
  const [personalPageUrl, setPersonalPageUrl] = useState(profile?.personalPageUrl ?? "")
  const [blogUrl, setBlogUrl] = useState(profile?.blogUrl ?? "")
  const [locationCity, setLocationCity] = useState(profile?.locationCity ?? "")
  const [locationCountry, setLocationCountry] = useState(profile?.locationCountry ?? "")

  async function handleSaveAndContinue() {
    await onSaveAndContinue({
      summary: summary || null,
      contactEmail: contactEmail || null,
      linkedInUrl: linkedInUrl || null,
      personalPageUrl: personalPageUrl || null,
      blogUrl: blogUrl || null,
      locationCity: locationCity || null,
      locationCountry: locationCountry || null,
    })
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

      <div className="space-y-2">
        <label htmlFor="contactEmail" className="text-sm font-medium">
          Contact Email
        </label>
        <Input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="linkedInUrl" className="text-sm font-medium">
          LinkedIn URL
        </label>
        <Input
          id="linkedInUrl"
          type="url"
          value={linkedInUrl}
          onChange={(e) => setLinkedInUrl(e.target.value)}
          placeholder="https://linkedin.com/in/..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="personalPageUrl" className="text-sm font-medium">
          Personal Website
        </label>
        <Input
          id="personalPageUrl"
          type="url"
          value={personalPageUrl}
          onChange={(e) => setPersonalPageUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="blogUrl" className="text-sm font-medium">
          Blog URL
        </label>
        <Input
          id="blogUrl"
          type="url"
          value={blogUrl}
          onChange={(e) => setBlogUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="locationCity" className="text-sm font-medium">
          City
        </label>
        <Input
          id="locationCity"
          value={locationCity}
          onChange={(e) => setLocationCity(e.target.value)}
          placeholder="City"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="locationCountry" className="text-sm font-medium">
          Country
        </label>
        <Input
          id="locationCountry"
          value={locationCountry}
          onChange={(e) => setLocationCountry(e.target.value)}
          placeholder="Country"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveAndContinue} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </div>
  )
}
