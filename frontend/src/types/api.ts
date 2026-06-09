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

export interface ResumeItemDto {
  id: string
  fields: Record<string, string>
}

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

export interface ProfileDto {
  summary: string | null
  workExperiences: WorkExperienceDto[]
  education: EducationDto[]
  skills: SkillDto[]
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

export interface ProfileUpdateRequest {
  summary: string | null
  workExperiences: WorkExperienceRequest[]
  education: EducationRequest[]
  skills: SkillRequest[]
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
