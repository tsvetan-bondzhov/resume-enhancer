import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { ResumeDocumentDto, TemplateDto } from "@/types/api"
import ResumeCanvas from "./ResumeCanvas"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn() },
}))
const mockGet = vi.mocked(apiClient.get)

const mockDocument: ResumeDocumentDto = {
  sections: [
    { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items: [{ type: "WORK_EXPERIENCE", id: "i1", jobTitle: "Engineer", company: null, startDate: null, endDate: null, isCurrent: false, description: null }] },
    { sectionType: "SKILLS",          title: "Skills",     visible: true, items: [{ type: "SKILLS", id: "i2", name: "Java", category: null, proficiency: null }] },
    { sectionType: "EDUCATION",       title: "Education",  visible: false, items: [] },
  ],
}

function buildTemplate(overrides: Partial<TemplateDto> = {}): TemplateDto {
  return {
    id: "t1",
    name: "Minimal",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: {
      layoutType: "single-column",
      cssVariables: { "--accent-color": "#3b82f6", "--font-size-base": "11px" },
      layout: { headerFormat: "name-contact", sectionOrder: ["SKILLS", "WORK_EXPERIENCE"] },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function buildTwoColumnTemplate(): TemplateDto {
  return buildTemplate({
    templateDefinition: {
      layoutType: "two-column",
      cssVariables: { "--accent-color": "#1d4ed8" },
      layout: {
        columns: { left: ["SKILLS"], right: ["WORK_EXPERIENCE"] },
      },
    },
  })
}

describe("ResumeCanvas", () => {
  beforeEach(() => vi.clearAllMocks())

  // AC4: cssVariables injected as inline style on root <article>
  it("applies cssVariables as inline style on root article when template loaded", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/api/v1/resume-templates/t1"))
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() =>
      expect(article.getAttribute("style")).toContain("--accent-color")
    )
  })

  // AC4: section render order follows template sectionOrder
  it("renders sections in template sectionOrder (skills before experience)", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await waitFor(() => {
      const sectionHeadings = container.querySelectorAll("h2")
      const titles = Array.from(sectionHeadings).map((h) => h.textContent)
      expect(titles.indexOf("Skills")).toBeLessThan(titles.indexOf("Experience"))
    })
  })

  // AC5: templateId null — no API call, defaults applied
  it("does not call apiClient when templateId is null", () => {
    render(<ResumeCanvas document={mockDocument} templateId={null} />)
    expect(mockGet).not.toHaveBeenCalled()
  })

  // AC11: hidden sections excluded regardless of template sectionOrder
  it("excludes hidden sections even if listed in template sectionOrder", async () => {
    const template = buildTemplate({
      templateDefinition: {
        layoutType: "single-column",
        layout: { sectionOrder: ["EDUCATION", "WORK_EXPERIENCE", "SKILLS"] },
      },
    })
    mockGet.mockResolvedValue(template)
    render(<ResumeCanvas document={mockDocument} templateId="t1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    // education section has visible: false — must not appear
    await waitFor(() => {
      expect(screen.queryByText("Education")).not.toBeInTheDocument()
      expect(screen.getByText("Experience")).toBeInTheDocument()
    })
  })

  // AC1, AC2, AC4: two-column layout renders two sibling flex containers
  it("renders two sibling flex column containers for two-column template", async () => {
    mockGet.mockResolvedValue(buildTwoColumnTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      // Outer flex wrapper containing both columns
      const flexWrapper = article.querySelector(".flex.gap-6")
      expect(flexWrapper).not.toBeNull()
      expect(flexWrapper).toBeInTheDocument()
      // Left column: basis-1/3
      expect(flexWrapper!.querySelector(".basis-1\\/3")).toBeInTheDocument()
      // Right column: flex-1
      expect(flexWrapper!.querySelector(".flex-1")).toBeInTheDocument()
    })
  })

  // AC2: no gridTemplateColumns injected for two-column (flex approach, not grid)
  it("does not inject gridTemplateColumns inline style for two-column template", async () => {
    mockGet.mockResolvedValue(buildTwoColumnTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await waitFor(() => {
      const article = container.querySelector("#resume-canvas")!
      expect(article.getAttribute("style") ?? "").not.toContain("grid-template-columns")
    })
  })

  // AC5 regression: single-column template renders a flat list without .flex.gap-6 wrapper
  it("renders sections without a flex wrapper for single-column template", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument()
      expect(article.querySelector(".flex.gap-6")).not.toBeInTheDocument()
    })
  })

  // AC5 regression: modern-accent template renders a flat list without .flex.gap-6 wrapper
  it("renders sections without a flex wrapper for modern-accent template", async () => {
    const template = buildTemplate({
      templateDefinition: {
        layoutType: "modern-accent",
        cssVariables: { "--accent-color": "#7c3aed" },
        layout: { sectionOrder: ["SKILLS", "WORK_EXPERIENCE"] },
      },
    })
    mockGet.mockResolvedValue(template)
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument()
      expect(article.querySelector(".flex.gap-6")).not.toBeInTheDocument()
    })
  })

  // Graceful degradation: two-column with empty column arrays falls back to single-column rendering
  it("falls back to single-column rendering when two-column column arrays are empty", async () => {
    const template = buildTemplate({
      templateDefinition: {
        layoutType: "two-column",
        cssVariables: {},
        layout: {
          columns: { left: [], right: [] },
        },
      },
    })
    mockGet.mockResolvedValue(template)
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument()
      expect(article.querySelector(".flex.gap-6")).not.toBeInTheDocument()
    })
  })
})
