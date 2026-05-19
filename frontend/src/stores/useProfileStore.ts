import { create } from "zustand"
import type { ProfileDto } from "@/types/api"

interface ProfileState {
  profile: ProfileDto | null
  isSaving: boolean
  setProfile: (profile: ProfileDto | null) => void
  setSaving: (isSaving: boolean) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isSaving: false,
  setProfile: (profile) => set((state) => ({ ...state, profile })),
  setSaving: (isSaving) => set((state) => ({ ...state, isSaving })),
}))
