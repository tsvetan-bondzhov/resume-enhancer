import { create } from "zustand"
import type { ResumeDocumentDto, ResumeDto, ResumeSectionDto } from "@/types/api"

interface ResumeState {
  resumes: ResumeDto[]
  currentResume: ResumeDto | null
  lastSavedDocument: ResumeDocumentDto | null
  isSaving: boolean
  isExporting: boolean
  setResumes: (resumes: ResumeDto[]) => void
  setCurrentResume: (resume: ResumeDto | null) => void
  setLastSavedDocument: (doc: ResumeDocumentDto | null) => void
  setSaving: (isSaving: boolean) => void
  setExporting: (isExporting: boolean) => void
  updateSectionTitle: (sectionId: string, title: string) => void
  updateItemField: (sectionId: string, itemId: string, field: string, value: string) => void
  toggleSectionVisibility: (sectionId: string) => void
  reorderSections: (newSections: ResumeSectionDto[]) => void
  updateResumeName: (name: string) => void
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
  lastSavedDocument: null,
  isSaving: false,
  isExporting: false,
  setResumes: (resumes) => set((state) => ({ ...state, resumes })),
  setCurrentResume: (resume) =>
    set((state) => ({ ...state, currentResume: resume })),
  setLastSavedDocument: (doc) => set((state) => ({ ...state, lastSavedDocument: doc })),
  setSaving: (isSaving) => set((state) => ({ ...state, isSaving })),
  setExporting: (isExporting) => set((state) => ({ ...state, isExporting })),
  updateSectionTitle: (sectionId, title) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.id === sectionId ? { ...s, title } : s
            ),
          },
        },
      }
    }),
  updateItemField: (sectionId, itemId, field, value) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.id !== sectionId
                ? s
                : {
                    ...s,
                    items: s.items.map((item) =>
                      item.id !== itemId
                        ? item
                        : { ...item, fields: { ...item.fields, [field]: value } }
                    ),
                  }
            ),
          },
        },
      }
    }),
  toggleSectionVisibility: (sectionId) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.id === sectionId ? { ...s, visible: !s.visible } : s
            ),
          },
        },
      }
    }),
  reorderSections: (newSections) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: { ...state.currentResume.content, sections: newSections },
        },
      }
    }),
  updateResumeName: (name) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        currentResume: { ...state.currentResume, name },
      }
    }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  applyPatch: (_patch) => {
    // No-op stub — fully implemented in Story 4.2
  },
}))
