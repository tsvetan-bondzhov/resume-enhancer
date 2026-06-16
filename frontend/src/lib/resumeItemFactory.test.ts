import { describe, it, expect, vi, beforeEach } from "vitest"
import { createEmptyItem } from "./resumeItemFactory"
import type {
  WorkExperienceItemDto,
  EducationItemDto,
  SkillItemDto,
  CertificationItemDto,
  LanguageItemDto,
  ProjectItemDto,
  VolunteeringItemDto,
  SummaryItemDto,
  GenericItemDto,
} from "@/types/api"

const FIXED_UUID = "00000000-0000-0000-0000-000000000001"

beforeEach(() => {
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(FIXED_UUID)
})

describe("createEmptyItem", () => {
  it("creates a WORK_EXPERIENCE item with correct shape", () => {
    const item = createEmptyItem("WORK_EXPERIENCE") as WorkExperienceItemDto
    expect(item.type).toBe("WORK_EXPERIENCE")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.jobTitle).toBe("")
    expect(item.company).toBe("")
    expect(item.startDate).toBeNull()
    expect(item.endDate).toBeNull()
    expect(item.isCurrent).toBe(false)
    expect(item.description).toBe("")
  })

  it("creates an EDUCATION item with correct shape", () => {
    const item = createEmptyItem("EDUCATION") as EducationItemDto
    expect(item.type).toBe("EDUCATION")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.institution).toBe("")
    expect(item.degree).toBe("")
    expect(item.fieldOfStudy).toBe("")
    expect(item.startDate).toBeNull()
    expect(item.endDate).toBeNull()
  })

  it("creates a SKILLS item with correct shape", () => {
    const item = createEmptyItem("SKILLS") as SkillItemDto
    expect(item.type).toBe("SKILLS")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.name).toBe("")
  })

  it("creates a CERTIFICATIONS item with correct shape", () => {
    const item = createEmptyItem("CERTIFICATIONS") as CertificationItemDto
    expect(item.type).toBe("CERTIFICATIONS")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.name).toBe("")
    expect(item.issuer).toBe("")
    expect(item.issueDate).toBeNull()
    expect(item.expirationDate).toBeNull()
  })

  it("creates a LANGUAGES item with correct shape", () => {
    const item = createEmptyItem("LANGUAGES") as LanguageItemDto
    expect(item.type).toBe("LANGUAGES")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.language).toBe("")
    expect(item.proficiency).toBe("")
  })

  it("creates a PROJECTS item with correct shape", () => {
    const item = createEmptyItem("PROJECTS") as ProjectItemDto
    expect(item.type).toBe("PROJECTS")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.name).toBe("")
    expect(item.description).toBe("")
    expect(item.technologies).toBe("")
    expect(item.link).toBeNull()
    expect(item.startDate).toBeNull()
    expect(item.endDate).toBeNull()
    expect(item.isCurrent).toBe(false)
  })

  it("creates a VOLUNTEERING item with correct shape", () => {
    const item = createEmptyItem("VOLUNTEERING") as VolunteeringItemDto
    expect(item.type).toBe("VOLUNTEERING")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.role).toBe("")
    expect(item.organization).toBe("")
    expect(item.description).toBe("")
    expect(item.startDate).toBeNull()
    expect(item.endDate).toBeNull()
    expect(item.isCurrent).toBe(false)
  })

  it("creates a SUMMARY item with correct shape", () => {
    const item = createEmptyItem("SUMMARY") as SummaryItemDto
    expect(item.type).toBe("SUMMARY")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.text).toBe("")
    expect(item.linkedInUrl).toBeNull()
    expect(item.personalPageUrl).toBeNull()
    expect(item.blogUrl).toBeNull()
    expect(item.contactEmail).toBeNull()
    expect(item.locationCountry).toBeNull()
    expect(item.locationCity).toBeNull()
  })

  it("creates an UNKNOWN item with empty fields map", () => {
    const item = createEmptyItem("UNKNOWN") as GenericItemDto
    expect(item.type).toBe("UNKNOWN")
    expect(item.id).toBe(FIXED_UUID)
    expect(item.fields).toEqual({})
  })

  it("assigns a unique id per call via crypto.randomUUID", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000001")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000002")

    const a = createEmptyItem("SKILLS")
    const b = createEmptyItem("SKILLS")
    expect(a.id).toBe("00000000-0000-0000-0000-000000000001")
    expect(b.id).toBe("00000000-0000-0000-0000-000000000002")
  })
})
