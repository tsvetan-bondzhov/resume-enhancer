import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ResumeDto } from "@/types/api"
import ResumeDashboardCard from "./ResumeDashboardCard"

// Mock ResumeCanvas to avoid apiClient calls for template fetch in tests
vi.mock("@/components/resume/ResumeCanvas", () => ({
  default: vi.fn(() => <div data-testid="resume-canvas-mock" />),
}))

// Mock sonner to avoid unresolved toasts in tests
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

function buildResume(overrides?: Partial<ResumeDto>): ResumeDto {
  return {
    id: "r1",
    name: "My Resume",
    templateId: "t1",
    content: { sections: [] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderCard(resume: ResumeDto = buildResume()) {
  return render(
    <ResumeDashboardCard
      resume={resume}
      onOpen={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
}

describe("ResumeDashboardCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC1: ResumeCanvas is rendered inside the preview area
  it("renders ResumeCanvas inside the preview area", () => {
    renderCard()
    expect(screen.getByTestId("resume-canvas-mock")).toBeInTheDocument()
  })

  // AC4: pointer-events-none applied to inner transformed div
  it("preview inner div has pointer-events-none", () => {
    const { container } = renderCard()
    const pointerNoneDiv = container.querySelector(".pointer-events-none")
    expect(pointerNoneDiv).toBeInTheDocument()
  })

  // AC5: info bar (name, action buttons) still renders
  it("preserves resume name and action buttons", () => {
    renderCard(buildResume({ name: "My Resume" }))
    // Name appears in the info bar (at least once — the preview area no longer shows it)
    expect(screen.getByText("My Resume")).toBeInTheDocument()
    expect(screen.getByLabelText("Open resume")).toBeInTheDocument()
    expect(screen.getByLabelText("Delete resume")).toBeInTheDocument()
  })

  // AC1: old placeholder with resume.name text-only span is gone
  it("does not render the old placeholder span with resume name", () => {
    const { container } = renderCard(buildResume({ name: "Unique Resume Name" }))
    // The old placeholder had a <span class="text-xs text-zinc-400 ..."> with just the name.
    // That span should no longer exist.
    const spans = container.querySelectorAll("span.text-xs.text-zinc-400")
    expect(spans).toHaveLength(0)
  })

  // AC4: outer clipping wrapper does not carry pointer-events-none (parent onClick must fire)
  it("outer preview wrapper does not have pointer-events-none", () => {
    const { container } = renderCard()
    // The outer wrapper is the div with h-200px; it should NOT have pointer-events-none
    const outerWrapper = container.querySelector("[style*='height: 200px']")
    expect(outerWrapper).toBeInTheDocument()
    expect(outerWrapper?.classList.contains("pointer-events-none")).toBe(false)
  })
})
