export interface AuthResponse {
  token: string
  user?: UserDto
}

export interface SignupRequest {
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface UserDto {
  id: string
  email: string
  role: "USER" | "ADMIN"
}

export interface ApiErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance: string
}

export interface WorkExperienceItemDto {
  type: "WORK_EXPERIENCE"
  id: string
  jobTitle: string | null
  company: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  description: string | null
}

export interface EducationItemDto {
  type: "EDUCATION"
  id: string
  institution: string | null
  degree: string | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
}

export interface SkillItemDto {
  type: "SKILLS"
  id: string
  name: string | null
}

export interface CertificationItemDto {
  type: "CERTIFICATIONS"
  id: string
  name: string | null
  issuer: string | null
  issueDate: string | null
  expirationDate: string | null
}

export interface LanguageItemDto {
  type: "LANGUAGES"
  id: string
  language: string | null
  proficiency: string | null
}

export interface ProjectItemDto {
  type: "PROJECTS"
  id: string
  name: string | null
  description: string | null
  technologies: string | null
  link: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface VolunteeringItemDto {
  type: "VOLUNTEERING"
  id: string
  role: string | null
  organization: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface SummaryItemDto {
  type: "SUMMARY"
  id: string
  text: string | null
  linkedInUrl: string | null
  personalPageUrl: string | null
  blogUrl: string | null
  contactEmail: string | null
  locationCountry: string | null
  locationCity: string | null
}

export interface GenericItemDto {
  type: "UNKNOWN"
  id: string
  fields: Record<string, string>
}

export type ResumeItemDto =
  | WorkExperienceItemDto
  | EducationItemDto
  | SkillItemDto
  | CertificationItemDto
  | LanguageItemDto
  | ProjectItemDto
  | VolunteeringItemDto
  | SummaryItemDto
  | GenericItemDto

export type ResumeSectionType =
  | "WORK_EXPERIENCE"
  | "EDUCATION"
  | "SKILLS"
  | "CERTIFICATIONS"
  | "PROJECTS"
  | "SUMMARY"
  | "LANGUAGES"
  | "VOLUNTEERING"
  | "UNKNOWN"

export interface ResumeSectionDto {
  sectionType: ResumeSectionType
  title: string
  visible: boolean
  items: ResumeItemDto[]
}

export interface ResumeDocumentDto {
  sections: ResumeSectionDto[]
}

export interface ResumeDto {
  id: string
  name: string
  /** UUID */
  templateId: string | null
  content: ResumeDocumentDto
  isTailored: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateResumeRequest {
  name: string
  /** UUID */
  templateId: string | null
}

export interface SaveAsRequest {
  name: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface WorkExperienceDto {
  jobTitle: string
  company: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  description: string | null
}

export interface EducationDto {
  institution: string
  degree: string | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
}

export interface SkillDto {
  name: string
}

export type LanguageProficiencyLevel =
  | "BEGINNER"
  | "ELEMENTARY"
  | "INTERMEDIATE"
  | "UPPER_INTERMEDIATE"
  | "ADVANCED"
  | "NATIVE"

export interface CertificationDto {
  name: string
  issuer: string | null
  issueDate: string | null
  expirationDate: string | null
}

export interface LanguageDto {
  name: string
  proficiencyLevel: LanguageProficiencyLevel
}

export interface ProjectDto {
  name: string
  description: string | null
  technologies: string | null
  link: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface VolunteeringDto {
  role: string
  organization: string
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface ProfileDto {
  summary: string | null
  linkedInUrl: string | null
  personalPageUrl: string | null
  blogUrl: string | null
  contactEmail: string | null
  locationCountry: string | null
  locationCity: string | null
  workExperiences: WorkExperienceDto[]
  education: EducationDto[]
  skills: SkillDto[]
  certifications: CertificationDto[]
  languages: LanguageDto[]
  projects: ProjectDto[]
  volunteering: VolunteeringDto[]
}

// WorkExperienceRequest is structurally identical to WorkExperienceDto.
// The backend PUT /api/v1/profile accepts the same shape it returns.
// Kept as a type alias so consumer code stays explicit about intent.
export type WorkExperienceRequest = WorkExperienceDto

export interface EducationRequest {
  institution: string
  degree: string | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
}

export interface SkillRequest {
  name: string
}

export interface CertificationRequest {
  name: string
  issuer: string | null
  issueDate: string | null
  expirationDate: string | null
}

export interface LanguageRequest {
  name: string
  proficiencyLevel: LanguageProficiencyLevel
}

export interface ProjectRequest {
  name: string
  description: string | null
  technologies: string | null
  link: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface VolunteeringRequest {
  role: string
  organization: string
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface ProfileUpdateRequest {
  summary: string | null
  linkedInUrl: string | null
  personalPageUrl: string | null
  blogUrl: string | null
  contactEmail: string | null
  locationCountry: string | null
  locationCity: string | null
  workExperiences: WorkExperienceRequest[]
  education: EducationRequest[]
  skills: SkillRequest[]
  certifications: CertificationRequest[]
  languages: LanguageRequest[]
  projects: ProjectRequest[]
  volunteering: VolunteeringRequest[]
}

export interface ParsedResumeDtoResponse {
  rawText: string
  workExperienceLines: string[]
  educationLines: string[]
  skillLines: string[]
}

export interface TemplateCssVariables {
  "--primary-color"?: string
  "--accent-color"?: string
  "--text-color"?: string
  "--font-family-sans"?: string
  "--font-size-base"?: string
  "--line-height-base"?: string
  "--section-spacing"?: string
  "--item-spacing"?: string
  "--page-margin-top"?: string
  "--page-margin-right"?: string
  "--page-margin-bottom"?: string
  "--page-margin-left"?: string
  [key: string]: string | undefined
}

export interface TemplateSectionStyle {
  titleFormat?: string
  itemSeparator?: string
  showDates?: boolean
  showDescriptions?: boolean
}

export interface TemplateColumns {
  left: string[]
  right: string[]
}

export interface TemplateLayout {
  headerFormat?: string
  sectionOrder?: string[]
  columns?: TemplateColumns
  sectionStyles?: Record<string, TemplateSectionStyle>
}

export interface TemplateDefinitionDto {
  layoutType: "single-column" | "two-column" | "modern-accent" | string
  cssVariables?: TemplateCssVariables
  layout?: TemplateLayout
  metadata?: Record<string, unknown>
}

export interface TemplateDto {
  id: string
  name: string
  description: string | null
  isPrebuilt: boolean
  isPublished: boolean
  templateDefinition: TemplateDefinitionDto
  createdAt: string
  updatedAt: string
}

export interface TemplateRequest {
  name: string
  description: string | null
  templateDefinition: Record<string, unknown>
}
