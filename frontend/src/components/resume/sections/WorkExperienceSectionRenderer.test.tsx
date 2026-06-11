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
    render(
      <WorkExperienceSectionRenderer
        items={[buildItem({ startDate: "2022-03-01", endDate: "2024-06-01", isCurrent: false })]}
      />
    )
    // Should not show raw ISO format
    expect(screen.queryByText(/2022-03-01/)).not.toBeInTheDocument()
    // Should show MM/YYYY — MM/YYYY format
    expect(screen.getByText(/03\/2022 — 06\/2024/)).toBeInTheDocument()
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

  it("renders delete button with aria-label when onDeleteItem is provided", () => {
    const onDeleteItem = vi.fn()
    render(
      <WorkExperienceSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    expect(screen.getByLabelText("Delete item")).toBeInTheDocument()
  })

  it("calls onDeleteItem with item.id when delete button is clicked", () => {
    const onDeleteItem = vi.fn()
    render(
      <WorkExperienceSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    fireEvent.click(screen.getByLabelText("Delete item"))
    expect(onDeleteItem).toHaveBeenCalledWith("item-1")
  })

  it("renders add buttons when onAddItem is provided — at least 2 for a 1-item section", () => {
    const onAddItem = vi.fn()
    render(
      <WorkExperienceSectionRenderer
        items={[buildItem()]}
        onAddItem={onAddItem}
      />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("does not render add buttons when onAddItem is not provided", () => {
    render(<WorkExperienceSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })
})
