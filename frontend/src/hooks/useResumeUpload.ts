import { useRef, useState } from "react"
import React from "react"
import { toast } from "sonner"
import { apiClient, ApiError } from "@/lib/apiClient"
import { useProfileStore } from "@/stores/useProfileStore"
import type {
  ParsedResumeDtoResponse,
  ProfileDto,
  WorkExperienceRequest,
  EducationRequest,
  SkillRequest,
} from "@/types/api"

export function mapParsedToProfile(
  parsed: ParsedResumeDtoResponse,
): Partial<{ workExperiences: WorkExperienceRequest[]; education: EducationRequest[]; skills: SkillRequest[] }> {
  const workExperiences: WorkExperienceRequest[] = parsed.workExperienceLines
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      jobTitle: line,
      company: "",
      startDate: null,
      endDate: null,
      isCurrent: false,
      description: null,
    }))

  const education: EducationRequest[] = parsed.educationLines
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      institution: line,
      degree: null,
      fieldOfStudy: null,
      startDate: null,
      endDate: null,
    }))

  const skills: SkillRequest[] = parsed.skillLines
    .filter((line) => line.trim().length > 0)
    .map((line) => ({ name: line }))

  if (workExperiences.length === 0 && education.length === 0 && skills.length === 0) {
    return {}
  }

  return { workExperiences, education, skills }
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
          summary: null,
          linkedInUrl: null,
          personalPageUrl: null,
          blogUrl: null,
          contactEmail: null,
          locationCountry: null,
          locationCity: null,
          workExperiences: mapped.workExperiences ?? [],
          education: mapped.education ?? [],
          skills: mapped.skills ?? [],
          certifications: [],
          languages: [],
          projects: [],
          volunteering: [],
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
