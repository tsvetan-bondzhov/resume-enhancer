import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import WorkExperienceSectionRenderer from "./WorkExperienceSectionRenderer"
import type { WorkExperienceItemDto } from "@/types/api"

function buildItem(overrides?: Partial<WorkExperienceItemDto>): WorkExperienceItemDto {
  return {
    type: "WORK_EXPERIENCE",
    id: "item-1",
    jobTitle: "Software Engineer",
    company: "Acme Corp",
    startDate: "2020-01-01",
    endDate: "2023-06-01",
    isCurrent: false,
    description: "Built stuff",
    ...overrides,
  }
}

describe("WorkExperienceSectionRenderer", () => {
  it("renders job title with font-semibold class", () => {
    render(<WorkExperienceSectionRenderer items={[buildItem()]} />)
    const jobTitleEl = screen.getByText("Software Engineer")
    // The parent <p> has font-semibold
    expect(jobTitleEl.closest("p")).toHaveClass("font-semibold")
  })

  it("renders formatted date range (not raw YYYY-MM-DD) in read-only mode", () => {
    render(<WorkExperienceSectionRenderer items={[buildItem()]} />)
    // Should contain year indicators but not raw ISO
    expect(screen.queryByText(/2020-01-01/)).not.toBeInTheDocument()
    // Should show formatted dates
    expect(screen.getByText(/2020/)).toBeInTheDocument()
    expect(screen.getByText(/2023/)).toBeInTheDocument()
  })

  it("renders company name", () => {
    render(<WorkExperienceSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
  })

  it("renders description", () => {
    render(<WorkExperienceSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Built stuff")).toBeInTheDocument()
  })

  it("calls onFieldChange with (itemId, 'jobTitle', value) on blur of job title", () => {
    const onFieldChange = vi.fn()
    render(<WorkExperienceSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

    const field = screen.getByText("Software Engineer")
    fireEvent.blur(field, { target: { textContent: "Senior Engineer" } })

    expect(onFieldChange).toHaveBeenCalledWith("item-1", "jobTitle", "Senior Engineer")
  })

  it("does not render null fields", () => {
    render(
      <WorkExperienceSectionRenderer
        items={[buildItem({ jobTitle: null, description: null })]}
      />
    )
    expect(screen.queryByLabelText("Edit jobTitle")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Edit description")).not.toBeInTheDocument()
  })

  it("shows Present when isCurrent is true", () => {
    render(
      <WorkExperienceSectionRenderer
        items={[buildItem({ isCurrent: true, endDate: null })]}
      />
    )
    // In read-only mode, formatDateRange is used
    expect(screen.getByText(/Present/)).toBeInTheDocument()
  })
})
