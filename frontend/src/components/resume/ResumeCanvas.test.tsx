import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, waitFor, act } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { ResumeDocumentDto, TemplateDto } from "@/types/api"
import ResumeCanvas, { PAGE_HEIGHT_PX } from "./ResumeCanvas"
import { resizeObserverTracker } from "@/test/setup"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn() },
}))
const mockGet = vi.mocked(apiClient.get)

const mockDocument: ResumeDocumentDto = {
  sections: [
    { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items: [{ type: "WORK_EXPERIENCE", id: "i1", jobTitle: "Engineer", company: null, startDate: null, endDate: null, isCurrent: false, description: null }] },
    { sectionType: "SKILLS",          title: "Skills",     visible: true, items: [{ type: "SKILLS", id: "i2", name: "Java" }] },
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

// Helper: fire the most recently constructed ResizeObserver callback with a given height.
function fireResizeObserver(height: number) {
  const instance = resizeObserverTracker.last
  if (!instance) throw new Error("No ResizeObserver instance found — component not mounted?")
  act(() => {
    instance.callback(
      [{ contentRect: { height } } as unknown as ResizeObserverEntry],
      instance
    )
  })
}

// Helper: assert that the canvas renders sections without the two-column flex wrapper.
async function assertSingleColumnLayout(container: HTMLElement) {
  const canvas = container.querySelector("#resume-canvas")!
  await waitFor(() => {
    const headings = Array.from(canvas.querySelectorAll("h2")).map((h) => h.textContent)
    expect(headings).toContain("Skills")
    expect(canvas.querySelector(".flex.gap-6")).not.toBeInTheDocument()
  })
}

describe("ResumeCanvas", () => {
  beforeEach(() => vi.clearAllMocks())

  // AC4: cssVariables injected as inline style on the first <article> page element
  it("applies cssVariables as inline style on first page article when template loaded", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/api/v1/resume-templates/t1"))
    // After this story, #resume-canvas is the wrapper <div>; CSS vars are on each <article>
    const article = container.querySelector("article")!
    await waitFor(() =>
      expect(article.getAttribute("style")).toContain("--accent-color")
    )
  })

  // AC1: section render order follows user document array order, not template sectionOrder
  it("renders sections in user document order (experience before skills), ignoring template sectionOrder", async () => {
    // mockDocument has WORK_EXPERIENCE first, then SKILLS — template sectionOrder has SKILLS first
    // After the fix, user array order wins: Experience should appear before Skills
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    await waitFor(() => {
      const sectionHeadings = container.querySelectorAll("h2")
      const titles = Array.from(sectionHeadings).map((h) => h.textContent)
      expect(titles.indexOf("Experience")).toBeLessThan(titles.indexOf("Skills"))
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
    const { container } = render(<ResumeCanvas document={mockDocument} templateId="t1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    // education section has visible: false — must not appear in the visible pages
    const canvas = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      // "Education" heading must not be in any visible page article
      const headings = Array.from(canvas.querySelectorAll("h2")).map((h) => h.textContent)
      expect(headings).not.toContain("Education")
      expect(headings).toContain("Experience")
    })
  })

  // AC1, AC2, AC4: two-column layout renders two sibling flex containers
  it("renders two sibling flex column containers for two-column template", async () => {
    mockGet.mockResolvedValue(buildTwoColumnTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    // #resume-canvas is now the outer <div> wrapping all pages
    const canvas = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      // Outer flex wrapper containing both columns — lives inside the page article
      const flexWrapper = canvas.querySelector(".flex.gap-6")
      expect(flexWrapper).not.toBeNull()
      expect(flexWrapper).toBeInTheDocument()
      // Left column: basis-1/3
      expect(flexWrapper!.querySelector(String.raw`.basis-1\/3`)).toBeInTheDocument()
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
      const article = container.querySelector("article")!
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
    await assertSingleColumnLayout(container)
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
    await assertSingleColumnLayout(container)
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
    await assertSingleColumnLayout(container)
  })

  // AC1, AC5: multiple pages rendered when content height > one page (multi-page test)
  it("renders multiple page articles when content height exceeds one page", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    // Simulate measured content height = 2.5 pages → should yield 3 page articles
    fireResizeObserver(PAGE_HEIGHT_PX * 2.5)

    await waitFor(() => {
      // querySelectorAll("article") returns the visible page articles.
      const articles = container.querySelectorAll("article")
      expect(articles.length).toBe(3)
    })

    expect(container.querySelector("[aria-label='Resume page 1']")).toBeInTheDocument()
    expect(container.querySelector("[aria-label='Resume page 2']")).toBeInTheDocument()
    expect(container.querySelector("[aria-label='Resume page 3']")).toBeInTheDocument()
  })

  // AC5: exactly one page article for short content (single-page test)
  it("renders exactly one page article when content fits within one page", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    // Simulate short content — 0.8 of a page → should yield exactly 1 page article
    fireResizeObserver(PAGE_HEIGHT_PX * 0.8)

    await waitFor(() => {
      const articles = container.querySelectorAll("article")
      expect(articles.length).toBe(1)
    })

    expect(container.querySelector("[aria-label='Resume page 1']")).toBeInTheDocument()
    expect(container.querySelector("[aria-label='Resume page 2']")).not.toBeInTheDocument()
  })

  // AC1: #resume-canvas is on the outer wrapper <div>, not an <article>
  it("places id=resume-canvas on the outer wrapper div, not an article", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    const canvas = container.querySelector("#resume-canvas")!
    expect(canvas.tagName.toLowerCase()).toBe("div")
  })
})
