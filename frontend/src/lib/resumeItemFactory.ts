import type {
  ResumeItemDto,
  ResumeSectionType,
  WorkExperienceItemDto,
  EducationItemDto,
  SkillItemDto,
  CertificationItemDto,
  LanguageItemDto,
  ProjectItemDto,
  VolunteeringItemDto,
  SummaryItemDto,
  FullNameItemDto,
  GenericItemDto,
} from "@/types/api"

export function createEmptyItem(sectionType: ResumeSectionType): ResumeItemDto {
  const id = crypto.randomUUID()
  switch (sectionType) {
    case "WORK_EXPERIENCE": {
      const item: WorkExperienceItemDto = { type: "WORK_EXPERIENCE", id, jobTitle: "", company: "", startDate: null, endDate: null, isCurrent: false, description: "" }
      return item
    }
    case "EDUCATION": {
      const item: EducationItemDto = { type: "EDUCATION", id, institution: "", degree: "", fieldOfStudy: "", startDate: null, endDate: null }
      return item
    }
    case "SKILLS": {
      const item: SkillItemDto = { type: "SKILLS", id, name: "" }
      return item
    }
    case "CERTIFICATIONS": {
      const item: CertificationItemDto = { type: "CERTIFICATIONS", id, name: "", issuer: "", issueDate: null, expirationDate: null }
      return item
    }
    case "LANGUAGES": {
      const item: LanguageItemDto = { type: "LANGUAGES", id, language: "", proficiency: "" }
      return item
    }
    case "PROJECTS": {
      const item: ProjectItemDto = { type: "PROJECTS", id, name: "", description: "", technologies: "", link: null, startDate: null, endDate: null, isCurrent: false }
      return item
    }
    case "VOLUNTEERING": {
      const item: VolunteeringItemDto = { type: "VOLUNTEERING", id, role: "", organization: "", description: "", startDate: null, endDate: null, isCurrent: false }
      return item
    }
    case "SUMMARY": {
      const item: SummaryItemDto = { type: "SUMMARY", id, text: "", linkedInUrl: null, personalPageUrl: null, blogUrl: null, contactEmail: null, locationCountry: null, locationCity: null }
      return item
    }
    case "FULL_NAME": {
      const item: FullNameItemDto = { type: "FULL_NAME", id, firstName: "", lastName: "" }
      return item
    }
    case "UNKNOWN": {
      const item: GenericItemDto = { type: "UNKNOWN", id, fields: {} }
      return item
    }
    default: {
      const _exhaustive: never = sectionType
      throw new Error(`Unknown section type: ${String(_exhaustive)}`)
    }
  }
}
