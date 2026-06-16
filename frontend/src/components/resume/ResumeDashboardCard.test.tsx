import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  async function pressKeyOnCard(key: string) {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const { container } = render(
      <ResumeDashboardCard
        resume={buildResume()}
        onOpen={onOpen}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const outerCard = container.querySelector("[role='button'][tabindex='0']") as HTMLElement
    outerCard.focus()
    await user.keyboard(key)
    return { onOpen }
  }

  // Line 31: onKeyDown — pressing Enter triggers onOpen
  it("pressing Enter on the card triggers onOpen", async () => {
    const { onOpen } = await pressKeyOnCard("{Enter}")
    expect(onOpen).toHaveBeenCalled()
  })

  // Line 31: onKeyDown — pressing Space triggers onOpen
  it("pressing Space on the card triggers onOpen", async () => {
    const { onOpen } = await pressKeyOnCard(" ")
    expect(onOpen).toHaveBeenCalled()
  })

  // Lines 84-85: Export button calls toast
  it("clicking the Export button calls toast with 'Export coming soon'", async () => {
    const { toast } = await import("sonner")
    const user = userEvent.setup()
    renderCard()
    const exportButton = screen.getByLabelText("Export resume")
    await user.click(exportButton)
    expect(toast).toHaveBeenCalledWith("Export coming soon")
  })

  // Line 31: onKeyDown — pressing an unrelated key does NOT trigger onOpen
  it("pressing other keys on the card does not trigger onOpen", async () => {
    const { onOpen } = await pressKeyOnCard("{Escape}")
    expect(onOpen).not.toHaveBeenCalled()
  })

  // ResumeDashboardCard shows "Tailored" badge when isTailored is true
  it("shows Tailored badge when isTailored is true (line 58 branch)", () => {
    renderCard(buildResume({ isTailored: true }))
    expect(screen.getByText("Tailored")).toBeInTheDocument()
  })

  // ResumeDashboardCard shows "Base" badge when isTailored is false
  it("shows Base badge when isTailored is false (line 58 else branch)", () => {
    renderCard(buildResume({ isTailored: false }))
    expect(screen.getByText("Base")).toBeInTheDocument()
  })

  // isDuplicating=true shows spinner
  it("shows Loader2 spinner when isDuplicating is true", () => {
    const { container } = render(
      <ResumeDashboardCard
        resume={buildResume()}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        isDuplicating={true}
      />,
    )
    // Loader2 renders an svg with animate-spin class
    const spinner = container.querySelector(".animate-spin")
    expect(spinner).toBeInTheDocument()
  })
})
