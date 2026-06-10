import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import EducationSectionRenderer from "./EducationSectionRenderer"
import type { EducationItemDto } from "@/types/api"

function buildItem(overrides?: Partial<EducationItemDto>): EducationItemDto {
  return {
    type: "EDUCATION",
    id: "edu-1",
    institution: "MIT",
    degree: "B.Sc.",
    fieldOfStudy: "Computer Science",
    startDate: "2016-09-01",
    endDate: "2020-06-01",
    ...overrides,
  }
}

describe("EducationSectionRenderer", () => {
  it("renders degree and field of study as font-semibold", () => {
    render(<EducationSectionRenderer items={[buildItem()]} />)
    const combined = screen.getByText(/B\.Sc\. — Computer Science/)
    expect(combined.closest("p")).toHaveClass("font-semibold")
  })

  it("renders institution in muted italic", () => {
    render(<EducationSectionRenderer items={[buildItem()]} />)
    const institution = screen.getByText("MIT")
    expect(institution.closest("p")).toHaveClass("text-muted-foreground")
    expect(institution.closest("p")).toHaveClass("italic")
  })

  it("renders date range", () => {
    render(<EducationSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText(/2016/)).toBeInTheDocument()
    expect(screen.getByText(/2020/)).toBeInTheDocument()
  })

  it("renders year-only date range in read-only mode", () => {
    render(
      <EducationSectionRenderer
        items={[buildItem({ startDate: "2018-09-01", endDate: "2022-06-01" })]}
      />
    )
    expect(screen.getByText(/2018 — 2022/)).toBeInTheDocument()
  })

  it("calls onFieldChange with (itemId, 'institution', value) on blur", () => {
    const onFieldChange = vi.fn()
    render(<EducationSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

    const field = screen.getByLabelText("Edit institution")
    fireEvent.blur(field, { target: { textContent: "Harvard" } })

    expect(onFieldChange).toHaveBeenCalledWith("edu-1", "institution", "Harvard")
  })

  it("does not render null degree", () => {
    render(<EducationSectionRenderer items={[buildItem({ degree: null, fieldOfStudy: null })]} />)
    expect(screen.queryByText(/B\.Sc\./)).not.toBeInTheDocument()
  })
})
