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

export interface ResumeSectionDto {
  id: string
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

export interface TemplateDto {
  id: string
  name: string
  description: string | null
  isPrebuilt: boolean
  isPublished: boolean
  /** Flexible JSONB map — format TBD in Epic 7 */
  templateDefinition: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TemplateRequest {
  name: string
  description: string | null
  templateDefinition: Record<string, unknown>
}
