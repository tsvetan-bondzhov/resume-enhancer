import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useProfileStore } from "@/stores/useProfileStore"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { ProfileDto, ProfileUpdateRequest } from "@/types/api"
import ExperienceStep from "@/components/profile/ExperienceStep"
import EducationStep from "@/components/profile/EducationStep"
import SkillsStep from "@/components/profile/SkillsStep"
import CertificationsStep from "@/components/profile/CertificationsStep"
import LanguagesStep from "@/components/profile/LanguagesStep"
import ProjectsStep from "@/components/profile/ProjectsStep"
import VolunteeringStep from "@/components/profile/VolunteeringStep"
import SummaryStep from "@/components/profile/SummaryStep"
import { useResumeUpload } from "@/hooks/useResumeUpload"

const STEPS = ["Experience", "Education", "Skills", "Certifications", "Languages", "Projects", "Volunteering", "Summary"]
const LAST_STEP = STEPS.length - 1 // 7 — SummaryStep handles its own navigation

const EMPTY_PROFILE: ProfileDto = {
  summary: null,
  contactEmail: null,
  linkedInUrl: null,
  personalPageUrl: null,
  blogUrl: null,
  locationCity: null,
  locationCountry: null,
  workExperiences: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
  projects: [],
  volunteering: [],
}

function mergeProfilePayload(
  partial: Partial<ProfileUpdateRequest>,
  current: ProfileDto
): ProfileUpdateRequest {
  return {
    summary: partial.summary ?? current.summary,
    contactEmail: partial.contactEmail ?? current.contactEmail,
    linkedInUrl: partial.linkedInUrl ?? current.linkedInUrl,
    personalPageUrl: partial.personalPageUrl ?? current.personalPageUrl,
    blogUrl: partial.blogUrl ?? current.blogUrl,
    locationCity: partial.locationCity ?? current.locationCity,
    locationCountry: partial.locationCountry ?? current.locationCountry,
    workExperiences: partial.workExperiences ?? current.workExperiences,
    education: partial.education ?? current.education,
    skills: partial.skills ?? current.skills,
    certifications: partial.certifications ?? current.certifications ?? [],
    languages: partial.languages ?? current.languages ?? [],
    projects: partial.projects ?? current.projects ?? [],
    volunteering: partial.volunteering ?? current.volunteering ?? [],
  }
}

function isEmptyProfile(profile: ProfileDto): boolean {
  return (
    // Use !profile.summary to catch both null and empty string ""
    !profile.summary &&
    profile.workExperiences.length === 0 &&
    profile.education.length === 0 &&
    profile.skills.length === 0 &&
    (profile.certifications ?? []).length === 0 &&
    (profile.languages ?? []).length === 0 &&
    (profile.projects ?? []).length === 0 &&
    (profile.volunteering ?? []).length === 0
  )
}

export default function ProfilePage() {
  // Uniform hook destructure — no getState() mixing inside this component
  const {
    profile,
    isLoading,
    error,
    currentStep,
    hasStarted,
    setProfile,
    setLoading,
    setError,
    setStep,
    resetStep,
    setSaving,
    setHasStarted,
  } = useProfileStore()

  const { isUploading, triggerUpload, renderFileInput } = useResumeUpload()

  // isSavingRef is a synchronous lock set on the very first tick of a click —
  // before any await — so concurrent double-clicks are rejected even in the
  // brief gap before isSaving (Zustand state) propagates to the button's
  // disabled prop.
  const isSavingRef = useRef(false)

  // Wrapped in useCallback with stable store actions as deps so the effect
  // dep array is complete and loadProfile identity is stable — no re-fetch
  // loop on re-renders.
  const loadProfile = useCallback(async () => {
    setLoading(true)
    // Clear any previous error before each attempt
    setError(null)
    try {
      const data = await apiClient.get<ProfileDto>("/api/v1/profile")
      setProfile(data)
      // Fix 3: if a saved profile loads with content, reset step to 0 so
      // users who navigate away mid-flow always start from the beginning
      // rather than resuming at a stale step index.
      if (!isEmptyProfile(data)) {
        resetStep()
      }
    } catch {
      toast.error("Failed to load profile — please try again")
      // Fix 2: persist error message so ProfilePage can render retry UI
      // instead of a blank screen (profile stays null but isLoading is false).
      setError("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError, setProfile, resetStep])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleSaveAndContinue(partial: Partial<ProfileUpdateRequest>) {
    // Fix 4: synchronous ref-based lock — prevents double-submission even in
    // the one-tick gap before Zustand isSaving propagates to the button's
    // disabled prop.
    if (isSavingRef.current) return
    isSavingRef.current = true
    // Set isSaving BEFORE the try — closes the race window on double-click.
    // Always cleared in finally.
    setSaving(true)
    try {
      const current = profile ?? EMPTY_PROFILE
      const payload = mergeProfilePayload(partial, current)
      const updated = await apiClient.put<ProfileDto>("/api/v1/profile", payload)
      setProfile(updated)
      // Fix 1: suppress generic "Profile saved" toast on the last step —
      // SummaryStep.handleSaveAndFinish shows its own "Profile complete!" toast,
      // so firing both would stack two toasts on the user.
      if (currentStep < LAST_STEP) {
        toast.success("Profile saved")
        // Only advance step when NOT on the last step — SummaryStep navigates
        // itself; incrementing here would push currentStep to 4 (broken limbo).
        setStep(currentStep + 1)
      }
    } catch {
      toast.error("Failed to save profile — please try again")
    } finally {
      setSaving(false)
      isSavingRef.current = false
    }
  }

  // Guard: null profile is only possible while isLoading (store init is true).
  // Reordering the null-guard BEFORE the loading check would show nothing
  // during load; instead we rely on isLoading initialising to true so the
  // skeleton always shows first.
  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Fix 2: render an error state with a Retry button instead of a blank screen
  // when loadProfile failed and profile was never populated.
  if (!isLoading && error && profile === null) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="mb-4 text-zinc-600">{error}</p>
        <Button onClick={loadProfile}>Retry</Button>
      </div>
    )
  }

  if (profile === null) {
    return null
  }

  // Empty-state is only shown when the profile is empty AND the user hasn't
  // clicked "Get Started" yet — prevents the CTA from re-appearing if the
  // user navigates back without saving.
  const showEmptyState = isEmptyProfile(profile) && !hasStarted

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Hidden file input — always in the tree, invisible */}
      {renderFileInput()}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Profile</h1>
        {!showEmptyState && (
          <Button
            variant="outline"
            onClick={triggerUpload}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload existing resume"}
          </Button>
        )}
      </div>

      {showEmptyState ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="mb-4 text-zinc-500">
            Your profile is empty — start building below
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={() => {
                setHasStarted(true)
                setStep(0)
              }}
            >
              Get Started
            </Button>
            <Button
              variant="outline"
              onClick={triggerUpload}
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Upload existing resume"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Progress indicator */}
          <ol
            aria-label="Profile completion steps"
            className="mb-8 flex gap-4"
          >
            {STEPS.map((label, index) => {
              const className = index === currentStep
                ? "font-semibold text-zinc-900" // current — highlighted
                : "text-zinc-400 font-normal" // unvisited or completed — muted
              return (
                <li
                  key={label}
                  className={`${className} cursor-pointer select-none`}
                  onClick={() => setStep(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setStep(index)
                    }
                  }}
                  aria-label={`Go to step ${label}`}
                  aria-current={index === currentStep ? "step" : undefined}
                >
                  {label}
                </li>
              )
            })}
          </ol>

          {/* Active step */}
          {currentStep === 0 && (
            <ExperienceStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 1 && (
            <EducationStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 2 && (
            <SkillsStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 3 && (
            <CertificationsStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 4 && (
            <LanguagesStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 5 && (
            <ProjectsStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 6 && (
            <VolunteeringStep onSaveAndContinue={handleSaveAndContinue} />
          )}
          {currentStep === 7 && (
            <SummaryStep onSaveAndContinue={handleSaveAndContinue} />
          )}
        </>
      )}
    </div>
  )
}
