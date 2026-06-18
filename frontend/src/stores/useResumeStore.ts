import { create } from "zustand"
import type { ResumeDocumentDto, ResumeDto, ResumeSectionDto, ResumeSectionType, ResumeItemDto } from "@/types/api"
import { createEmptyItem } from "@/lib/resumeItemFactory"

interface ResumeState {
  resumes: ResumeDto[]
  currentResume: ResumeDto | null
  lastSavedDocument: ResumeDocumentDto | null
  isSaving: boolean
  isExporting: boolean
  setResumes: (resumes: ResumeDto[]) => void
  addResume: (resume: ResumeDto) => void
  removeResume: (id: string) => void
  syncCurrentResumeName: () => void
  setCurrentResume: (resume: ResumeDto | null) => void
  setLastSavedDocument: (doc: ResumeDocumentDto | null) => void
  setSaving: (isSaving: boolean) => void
  setExporting: (isExporting: boolean) => void
  updateSectionTitle: (sectionId: string, title: string) => void
  updateItemField: (sectionId: string, itemId: string, field: string, value: string) => void
  toggleSectionVisibility: (sectionId: string) => void
  reorderSections: (newSections: ResumeSectionDto[]) => void
  updateResumeName: (name: string) => void
  setCurrentResumeTemplateId: (templateId: string | null) => void
  setCurrentResumeTailored: (value: boolean, resumeId?: string) => void
  applyPatch: (patch: {
    sectionId: string
    itemIndex: number
    field: string
    newValue: string
  }) => void
  addItem: (sectionType: ResumeSectionType, position: number) => void
  deleteItem: (sectionType: ResumeSectionType, itemId: string) => void
  reorderItems: (sectionType: ResumeSectionType, newItems: ResumeItemDto[]) => void
}

function updateItem(
  item: ResumeItemDto,
  itemId: string,
  field: string,
  value: string
): ResumeItemDto {
  return item.id === itemId ? { ...item, [field]: value } : item
}

function updateSectionItems(
  section: ResumeSectionDto,
  sectionId: string,
  itemId: string,
  field: string,
  value: string
): ResumeSectionDto {
  if (section.sectionType !== sectionId) return section
  return {
    ...section,
    items: section.items.map((item) => updateItem(item, itemId, field, value)),
  }
}

function filterSectionItems(
  section: ResumeSectionDto,
  sectionType: ResumeSectionType,
  itemId: string
): ResumeSectionDto {
  if (section.sectionType !== sectionType) return section
  return { ...section, items: section.items.filter((item) => item.id !== itemId) }
}

export const useResumeStore = create<ResumeState>((set) => ({
  resumes: [],
  currentResume: null,
  lastSavedDocument: null,
  isSaving: false,
  isExporting: false,
  setResumes: (resumes) => set((state) => ({ ...state, resumes })),
  addResume: (resume) =>
    set((state) => ({
      ...state,
      resumes: state.resumes.some((r) => r.id === resume.id)
        ? state.resumes
        : [resume, ...state.resumes],
    })),
  removeResume: (id) =>
    set((state) => ({
      ...state,
      resumes: state.resumes.filter((r) => r.id !== id),
    })),
  syncCurrentResumeName: () =>
    set((state) => {
      if (!state.currentResume) return state
      const { id, name } = state.currentResume
      return {
        ...state,
        resumes: state.resumes.map((r) => (r.id === id ? { ...r, name } : r)),
      }
    }),
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
              s.sectionType === sectionId ? { ...s, title } : s
            ),
          },
        },
      }
    }),
  updateItemField: (sectionId, itemId, field, value) =>
    set((state) => {
      if (!state.currentResume) return state
      // Guard: never mutate reserved discriminant fields — would corrupt Jackson polymorphism
      if (field === "type" || field === "id") return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              updateSectionItems(s, sectionId, itemId, field, value)
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
              s.sectionType === sectionId ? { ...s, visible: !s.visible } : s
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
  setCurrentResumeTemplateId: (templateId) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: { ...state.currentResume, templateId },
      }
    }),
  setCurrentResumeTailored: (value, resumeId) =>
    set((state) => {
      // Resolve the target ID: prefer explicit resumeId arg, fall back to currentResume
      const targetId = resumeId ?? state.currentResume?.id
      return {
        ...state,
        currentResume:
          state.currentResume && (!targetId || state.currentResume.id === targetId)
            ? { ...state.currentResume, isTailored: value }
            : state.currentResume,
        resumes: targetId
          ? state.resumes.map((r) => (r.id === targetId ? { ...r, isTailored: value } : r))
          : state.resumes,
      }
    }),
  applyPatch: (patch) =>
    set((state) => {
      if (!state.currentResume) return state
      // Guard: never mutate reserved discriminant fields
      if (patch.field === "type" || patch.field === "id") return state
      const sections = state.currentResume.content.sections
      const sectionIndex = sections.findIndex((s) => s.sectionType === patch.sectionId)
      if (sectionIndex === -1) return state // unknown section — no-op (same as backend InvalidPatchException but frontend is lenient)
      const section = sections[sectionIndex]
      if (patch.itemIndex < 0 || patch.itemIndex >= section.items.length) return state // out-of-bounds — no-op
      const targetItem = section.items[patch.itemIndex]
      if (!(patch.field in targetItem)) return state // unknown field — no-op guard (D1 resolution)
      const updatedItem = { ...targetItem, [patch.field]: patch.newValue }
      const updatedSection: ResumeSectionDto = {
        ...section,
        items: section.items.map((item, idx) => (idx === patch.itemIndex ? updatedItem : item)),
      }
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: sections.map((s, idx) => (idx === sectionIndex ? updatedSection : s)),
          },
        },
      }
    }),
  addItem: (sectionType, position) =>
    set((state) => {
      if (!state.currentResume) return state
      const newItem = createEmptyItem(sectionType)
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.sectionType === sectionType
                ? {
                    ...s,
                    items: [
                      ...s.items.slice(0, position),
                      newItem,
                      ...s.items.slice(position),
                    ],
                  }
                : s
            ),
          },
        },
      }
    }),
  deleteItem: (sectionType, itemId) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              filterSectionItems(s, sectionType, itemId)
            ),
          },
        },
      }
    }),
  reorderItems: (sectionType, newItems) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.sectionType === sectionType ? { ...s, items: newItems } : s
            ),
          },
        },
      }
    }),
}))
