import { create } from "zustand"
import type { ResumeDto } from "@/types/api"

interface ResumeState {
  resumes: ResumeDto[]
  currentResume: ResumeDto | null
  isSaving: boolean
  isExporting: boolean
  setResumes: (resumes: ResumeDto[]) => void
  setCurrentResume: (resume: ResumeDto | null) => void
  setSaving: (isSaving: boolean) => void
  setExporting: (isExporting: boolean) => void
  applyPatch: (patch: {
    sectionId: string
    itemIndex: number
    field: string
    newValue: string
  }) => void
}

export const useResumeStore = create<ResumeState>((set) => ({
  resumes: [],
  currentResume: null,
  isSaving: false,
  isExporting: false,
  setResumes: (resumes) => set((state) => ({ ...state, resumes })),
  setCurrentResume: (resume) =>
    set((state) => ({ ...state, currentResume: resume })),
  setSaving: (isSaving) => set((state) => ({ ...state, isSaving })),
  setExporting: (isExporting) => set((state) => ({ ...state, isExporting })),
  applyPatch: (_patch) => {
    // No-op stub — fully implemented in Story 4.2
  },
}))
