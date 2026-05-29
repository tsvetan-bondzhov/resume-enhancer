import { create } from "zustand"
import type { ProfileDto } from "@/types/api"

interface ProfileState {
  profile: ProfileDto | null
  isSaving: boolean
  // isLoading initialises to true so the skeleton shows immediately on first
  // render — avoids a blank frame before the GET /api/v1/profile resolves.
  isLoading: boolean
  // error is set when loadProfile fails; cleared on each load attempt.
  // When non-null and profile === null, ProfilePage renders an error UI with
  // a Retry button instead of a blank screen.
  error: string | null
  currentStep: number
  // hasStarted tracks whether the user has clicked "Get Started" on the
  // empty-state screen.  Kept separate from isEmptyProfile so that a truly
  // empty profile still shows the CTA on first visit.
  hasStarted: boolean
  setProfile: (profile: ProfileDto | null) => void
  setSaving: (isSaving: boolean) => void
  setLoading: (v: boolean) => void
  setError: (error: string | null) => void
  setStep: (step: number) => void
  // resetStep resets currentStep to 0; called when a non-empty profile loads
  // so that returning mid-flow users start from the beginning.
  resetStep: () => void
  setHasStarted: (v: boolean) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isSaving: false,
  isLoading: true, // true → skeleton on first render, no blank flash
  error: null,
  currentStep: 0,
  hasStarted: false,
  setProfile: (profile) => set((state) => ({ ...state, profile })),
  setSaving: (isSaving) => set((state) => ({ ...state, isSaving })),
  setLoading: (v) => set((state) => ({ ...state, isLoading: v })),
  setError: (error) => set((state) => ({ ...state, error })),
  setStep: (step) => set((state) => ({ ...state, currentStep: step })),
  resetStep: () => set((state) => ({ ...state, currentStep: 0 })),
  setHasStarted: (v) => set((state) => ({ ...state, hasStarted: v })),
}))
