import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ResumeDto } from "@/types/api"
import ResumeSidebarItem from "./ResumeSidebarItem"

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
    templateId: null,
    content: { sections: [] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("ResumeSidebarItem", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("renders resume name and date", () => {
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("My Resume")).toBeInTheDocument()
  })

  it("applies blue background when isActive (AC5)", () => {
    const { container } = render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={true}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const item = container.firstChild as HTMLElement
    expect(item.className).toMatch(/bg-blue-50/)
  })

  it("does NOT apply blue background when not active (AC5)", () => {
    const { container } = render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const item = container.firstChild as HTMLElement
    expect(item.className).not.toMatch(/bg-blue-50/)
  })

  it("calls onOpen when item clicked (AC5)", () => {
    const onOpen = vi.fn()
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={onOpen}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "My Resume" }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it("calls onDelete when delete button clicked (AC5)", () => {
    const onDelete = vi.fn()
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /delete my resume/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("calls onDuplicate when duplicate button clicked (AC5)", () => {
    const onDuplicate = vi.fn()
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={onDuplicate}
        onDelete={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /duplicate my resume/i }))
    expect(onDuplicate).toHaveBeenCalledOnce()
  })

  it("shows Tailored badge when isTailored=true", () => {
    render(
      <ResumeSidebarItem
        resume={buildResume({ isTailored: true })}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("Tailored")).toBeInTheDocument()
  })

  it("shows Base badge when isTailored=false", () => {
    render(
      <ResumeSidebarItem
        resume={buildResume({ isTailored: false })}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("Base")).toBeInTheDocument()
  })
})
