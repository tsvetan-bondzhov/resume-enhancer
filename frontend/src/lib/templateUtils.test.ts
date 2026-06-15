import { describe, it, expect } from "vitest"
import { getOrderedSections } from "./templateUtils"
import type { ResumeSectionDto, TemplateDto } from "@/types/api"

// Helper to build a minimal visible section
function makeSection(sectionType: string): ResumeSectionDto {
  return { sectionType, title: sectionType, visible: true, items: [] } as unknown as ResumeSectionDto
}

// Helper to build a minimal hidden section
function makeHidden(sectionType: string): ResumeSectionDto {
  return { sectionType, title: sectionType, visible: false, items: [] } as unknown as ResumeSectionDto
}

// Helper to build a single-column template DTO
function buildSingleColumnTemplateDto(sectionOrder: string[]): TemplateDto {
  return {
    templateDefinition: {
      layoutType: "single-column",
      layout: { sectionOrder, columns: null, headerStyle: "name-contact" },
      accentColor: null,
      textColor: null,
    },
  } as unknown as TemplateDto
}

// Helper to build a two-column template DTO
function buildTwoColumnTemplateDto(columns: { left: string[]; right: string[] }): TemplateDto {
  return {
    templateDefinition: {
      layoutType: "two-column",
      layout: { sectionOrder: null, columns, headerStyle: "name-contact" },
      accentColor: null,
      textColor: null,
    },
  } as unknown as TemplateDto
}

describe("getOrderedSections", () => {
  // ── AC1 / AC4 ──────────────────────────────────────────────────────────────

  it("single-column: returns sections in user document order, not template sectionOrder", () => {
    // User has reordered: SKILLS first, then EDUCATION, then WORK_EXPERIENCE
    const sections: ResumeSectionDto[] = [
      makeSection("SKILLS"),
      makeSection("EDUCATION"),
      makeSection("WORK_EXPERIENCE"),
    ]
    const template = buildSingleColumnTemplateDto(["WORK_EXPERIENCE", "EDUCATION", "SKILLS"])

    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["SKILLS", "EDUCATION", "WORK_EXPERIENCE"])
  })

  it("modern-accent: returns sections in user document order, not template sectionOrder", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("CERTIFICATIONS"),
      makeSection("WORK_EXPERIENCE"),
    ]
    const template = {
      templateDefinition: {
        layoutType: "modern-accent",
        layout: {
          sectionOrder: ["WORK_EXPERIENCE", "CERTIFICATIONS"],
          columns: null,
          headerStyle: "name-contact",
        },
        accentColor: "#ff0000",
        textColor: null,
      },
    } as unknown as TemplateDto

    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["CERTIFICATIONS", "WORK_EXPERIENCE"])
  })

  it("single-column: sections absent from template sectionOrder are still returned (no drops)", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("WORK_EXPERIENCE"),
      makeSection("VOLUNTEER_WORK"), // not in template sectionOrder
    ]
    const template = buildSingleColumnTemplateDto(["WORK_EXPERIENCE"])

    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["WORK_EXPERIENCE", "VOLUNTEER_WORK"])
  })

  // ── AC2 / AC3 ──────────────────────────────────────────────────────────────

  it("two-column: assigns columns per template but preserves user order within each column", () => {
    // User has reordered: SKILLS before EDUCATION (both are left-column sections per template)
    const sections: ResumeSectionDto[] = [
      makeSection("WORK_EXPERIENCE"), // right column per template
      makeSection("SKILLS"),          // left column per template
      makeSection("EDUCATION"),       // left column per template
    ]
    const template = buildTwoColumnTemplateDto({ left: ["EDUCATION", "SKILLS"], right: ["WORK_EXPERIENCE"] })

    const result = getOrderedSections(sections, template)
    // Left column sections first (in user order: SKILLS before EDUCATION),
    // then right column sections (WORK_EXPERIENCE)
    expect(result.map((s) => s.sectionType)).toEqual(["SKILLS", "EDUCATION", "WORK_EXPERIENCE"])
  })

  it("two-column: unassigned sections are appended after right-column sections (AC3)", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("WORK_EXPERIENCE"),  // right column per template
      makeSection("EDUCATION"),        // left column per template
      makeSection("VOLUNTEER_WORK"),   // not in either column
    ]
    const template = buildTwoColumnTemplateDto({ left: ["EDUCATION"], right: ["WORK_EXPERIENCE"] })

    const result = getOrderedSections(sections, template)
    // left: EDUCATION, right: WORK_EXPERIENCE, unassigned: VOLUNTEER_WORK (appended at end)
    expect(result.map((s) => s.sectionType)).toEqual([
      "EDUCATION",
      "WORK_EXPERIENCE",
      "VOLUNTEER_WORK",
    ])
  })

  // ── AC4 ────────────────────────────────────────────────────────────────────

  it("null template: returns all visible sections in user array order unchanged", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("SKILLS"),
      makeSection("WORK_EXPERIENCE"),
      makeSection("EDUCATION"),
    ]
    const result = getOrderedSections(sections, null)
    expect(result.map((s) => s.sectionType)).toEqual(["SKILLS", "WORK_EXPERIENCE", "EDUCATION"])
  })

  it("template with no layout: returns all visible sections in user array order unchanged", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("SKILLS"),
      makeSection("WORK_EXPERIENCE"),
    ]
    const template = {
      templateDefinition: {
        layoutType: "single-column",
        layout: null,
        accentColor: null,
        textColor: null,
      },
    } as unknown as TemplateDto

    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["SKILLS", "WORK_EXPERIENCE"])
  })

  // ── Visibility filtering ───────────────────────────────────────────────────

  it("hidden sections are excluded regardless of layout (single-column)", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("WORK_EXPERIENCE"),
      makeHidden("EDUCATION"), // hidden — must be excluded
      makeSection("SKILLS"),
    ]
    const template = buildSingleColumnTemplateDto(["WORK_EXPERIENCE", "EDUCATION", "SKILLS"])

    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["WORK_EXPERIENCE", "SKILLS"])
  })

  it("hidden sections are excluded in two-column layout", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("WORK_EXPERIENCE"),
      makeHidden("SKILLS"),    // hidden left-column section — must be excluded
      makeSection("EDUCATION"),
    ]
    const template = buildTwoColumnTemplateDto({ left: ["SKILLS", "EDUCATION"], right: ["WORK_EXPERIENCE"] })

    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["EDUCATION", "WORK_EXPERIENCE"])
  })

  it("hidden sections excluded for null template", () => {
    const sections: ResumeSectionDto[] = [
      makeSection("WORK_EXPERIENCE"),
      makeHidden("EDUCATION"),
      makeSection("SKILLS"),
    ]
    const result = getOrderedSections(sections, null)
    expect(result.map((s) => s.sectionType)).toEqual(["WORK_EXPERIENCE", "SKILLS"])
  })
})
