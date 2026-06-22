import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import VolunteeringSectionRenderer from "./VolunteeringSectionRenderer"
import type { VolunteeringItemDto } from "@/types/api"

function buildItem(overrides?: Partial<VolunteeringItemDto>): VolunteeringItemDto {
  return {
    type: "VOLUNTEERING",
    id: "vol-1",
    role: "Mentor",
    organization: "Code Club",
    startDate: "2021-01-01",
    endDate: "2022-06-01",
    isCurrent: false,
    description: "Helped students learn programming.",
    ...overrides,
  }
}

describe("VolunteeringSectionRenderer", () => {
  it("renders the role as a heading", () => {
    render(<VolunteeringSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Mentor")).toBeInTheDocument()
  })

  it("renders organization name", () => {
    render(<VolunteeringSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Code Club")).toBeInTheDocument()
  })

  it("renders formatted date range in read-only mode", () => {
    render(
      <VolunteeringSectionRenderer
        items={[buildItem({ startDate: "2021-03-01", endDate: "2022-06-01", isCurrent: false })]}
      />
    )
    expect(screen.queryByText(/2021-03-01/)).not.toBeInTheDocument()
    // formatDateRange for volunteering uses "Mar 2021 — Jun 2022" format
    expect(screen.getByText(/Mar 2021 — Jun 2022/)).toBeInTheDocument()
  })

  it("renders description", () => {
    render(<VolunteeringSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Helped students learn programming.")).toBeInTheDocument()
  })

  it("renders add buttons when onAddItem is provided", () => {
    const onAddItem = vi.fn()
    render(
      <VolunteeringSectionRenderer
        items={[buildItem()]}
        onAddItem={onAddItem}
      />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("does not render add buttons when onAddItem is not provided", () => {
    render(<VolunteeringSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })

  it("renders delete button when onDeleteItem is provided", () => {
    const onDeleteItem = vi.fn()
    render(
      <VolunteeringSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    expect(screen.getByLabelText("Delete item")).toBeInTheDocument()
  })

  it("calls onDeleteItem with item.id when delete button is clicked", () => {
    const onDeleteItem = vi.fn()
    render(
      <VolunteeringSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    fireEvent.click(screen.getByLabelText("Delete item"))
    expect(onDeleteItem).toHaveBeenCalledWith("vol-1")
  })

  it("calls onFieldChange with correct args on role blur", () => {
    const onFieldChange = vi.fn()
    render(
      <VolunteeringSectionRenderer
        items={[buildItem()]}
        onFieldChange={onFieldChange}
      />
    )
    const roleField = screen.getByLabelText("Edit role")
    fireEvent.blur(roleField, { target: { textContent: "Lead Mentor" } })
    expect(onFieldChange).toHaveBeenCalledWith("vol-1", "role", "Lead Mentor")
  })

  it("shows Present when isCurrent is true", () => {
    render(
      <VolunteeringSectionRenderer
        items={[buildItem({ isCurrent: true, endDate: null })]}
      />
    )
    expect(screen.getByText(/Present/)).toBeInTheDocument()
  })

  it("renders add button when onAddItem is provided and items list is empty (line 23)", () => {
    const onAddItem = vi.fn()
    render(
      <VolunteeringSectionRenderer
        items={[]}
        onAddItem={onAddItem}
      />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons).toHaveLength(1)
    fireEvent.click(addButtons[0])
    expect(onAddItem).toHaveBeenCalledWith(0)
  })

  it("calls onAddItem with index+1 when add button after an item is clicked (line 53)", () => {
    const onAddItem = vi.fn()
    render(
      <VolunteeringSectionRenderer
        items={[buildItem({ id: "vol-1" }), buildItem({ id: "vol-2" })]}
        onAddItem={onAddItem}
      />
    )
    // There should be 3 add buttons: before item 0, after item 0, after item 1
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(3)
    // Click the second add button (after item 0 → position 1)
    fireEvent.click(addButtons[1])
    expect(onAddItem).toHaveBeenCalledWith(1)
  })

  it("renders read-only date range when onFieldChange is not provided and dates exist", () => {
    render(
      <VolunteeringSectionRenderer
        items={[buildItem({ startDate: "2020-01-01", endDate: "2021-01-01", isCurrent: false })]}
      />
    )
    expect(screen.getByText(/Jan 2020/)).toBeInTheDocument()
  })
})
