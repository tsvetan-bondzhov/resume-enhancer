import React, { useRef, useState } from "react"
import { toast } from "sonner"
import { apiClient, ApiError } from "@/lib/apiClient"
import { useProfileStore } from "@/stores/useProfileStore"
import type {
  ParsedResumeDtoResponse,
  ProfileDto,
  WorkExperienceRequest,
  EducationRequest,
  SkillRequest,
  CertificationRequest,
  LanguageRequest,
  ProjectRequest,
  VolunteeringRequest,
} from "@/types/api"

export function mapParsedToProfile(
  parsed: ParsedResumeDtoResponse,
): Partial<ProfileDto> {
  const workExperiences: WorkExperienceRequest[] = (parsed.workExperiences ?? []).map((item) => ({
    jobTitle: item.jobTitle ?? "",
    company: item.company ?? "",
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    isCurrent: item.isCurrent ?? false,
    description: item.description ?? null,
  }))

  const education: EducationRequest[] = (parsed.education ?? []).map((item) => ({
    institution: item.institution ?? "",
    degree: item.degree ?? null,
    fieldOfStudy: item.fieldOfStudy ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
  }))

  const skills: SkillRequest[] = (parsed.skills ?? []).map((item) => ({
    name: item.name ?? "",
  }))

  const certifications: CertificationRequest[] = (parsed.certifications ?? []).map((item) => ({
    name: item.name ?? "",
    issuer: item.issuer ?? null,
    issueDate: item.issueDate ?? null,
    expirationDate: item.expirationDate ?? null,
  }))

  const languages: LanguageRequest[] = (parsed.languages ?? []).map((item) => ({
    name: item.language ?? "",
    proficiencyLevel: "INTERMEDIATE",
  }))

  const projects: ProjectRequest[] = (parsed.projects ?? []).map((item) => ({
    name: item.name ?? "",
    description: item.description ?? null,
    technologies: item.technologies ?? null,
    link: item.link ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    isCurrent: item.isCurrent ?? false,
  }))

  const volunteering: VolunteeringRequest[] = (parsed.volunteering ?? []).map((item) => ({
    role: item.role ?? "",
    organization: item.organization ?? "",
    description: item.description ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    isCurrent: item.isCurrent ?? false,
  }))

  const isEmpty =
    workExperiences.length === 0 &&
    education.length === 0 &&
    skills.length === 0 &&
    certifications.length === 0 &&
    languages.length === 0 &&
    projects.length === 0 &&
    volunteering.length === 0 &&
    !parsed.summary?.text

  if (isEmpty) {
    return {}
  }

  return {
    workExperiences,
    education,
    skills,
    certifications,
    languages,
    projects,
    volunteering,
  }
}

export function useResumeUpload(): {
  isUploading: boolean
  triggerUpload: () => void
  renderFileInput: () => React.ReactElement
} {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { setProfile, setHasStarted, setStep } = useProfileStore()

  function triggerUpload() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const parsed = await apiClient.uploadFile<ParsedResumeDtoResponse>(
        "/api/v1/upload",
        formData,
      )

      const mapped = mapParsedToProfile(parsed)

      if (Object.keys(mapped).length === 0) {
        toast.warning("We couldn't extract profile data — please enter your details manually")
        setHasStarted(true)
        setStep(0)
      } else {
        const seeded: ProfileDto = {
          summary: parsed.summary?.text ?? null,
          linkedInUrl: null,
          personalPageUrl: null,
          blogUrl: null,
          contactEmail: null,
          locationCountry: null,
          locationCity: null,
          workExperiences: mapped.workExperiences ?? [],
          education: mapped.education ?? [],
          skills: mapped.skills ?? [],
          certifications: mapped.certifications ?? [],
          languages: mapped.languages ?? [],
          projects: mapped.projects ?? [],
          volunteering: mapped.volunteering ?? [],
        }
        setProfile(seeded)
        setHasStarted(true)
        setStep(0)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        toast.error("File rejected — must be a PDF or DOCX under 10MB")
      } else {
        toast.error("Upload failed — please try again")
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function renderFileInput(): React.ReactElement {
    return React.createElement("input", {
      ref: fileInputRef,
      type: "file",
      accept: ".pdf,.docx",
      "aria-label": "Upload resume file",
      className: "hidden",
      onChange: handleFileChange,
    })
  }

  return {
    isUploading,
    triggerUpload,
    renderFileInput,
  }
}
