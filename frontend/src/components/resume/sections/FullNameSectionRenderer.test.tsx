import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import FullNameSectionRenderer from "./FullNameSectionRenderer"
import type { FullNameItemDto } from "@/types/api"

function buildItem(overrides?: Partial<FullNameItemDto>): FullNameItemDto {
  return {
    type: "FULL_NAME",
    id: "fullname-1",
    firstName: "Jane",
    lastName: "Doe",
    ...overrides,
  }
}

describe("FullNameSectionRenderer", () => {
  it("renders full name as 'First Last' in read-only mode", () => {
    render(<FullNameSectionRenderer items={[buildItem()]} />)
    const p = screen.getByText("Jane Doe")
    expect(p.tagName).toBe("P")
    expect(p).toHaveClass("text-xl", "font-bold")
  })

  it("joins only the non-empty name parts in read-only mode", () => {
    render(<FullNameSectionRenderer items={[buildItem({ lastName: null })]} />)
    expect(screen.getByText("Jane")).toBeInTheDocument()
  })

  it("skips items with both name parts null in read-only mode", () => {
    const { container } = render(
      <FullNameSectionRenderer items={[buildItem({ firstName: null, lastName: null })]} />
    )
    expect(container.querySelectorAll("p")).toHaveLength(0)
  })

  it("renders editable fields in edit mode even when both name parts are null", () => {
    const onFieldChange = vi.fn()
    render(
      <FullNameSectionRenderer
        items={[buildItem({ firstName: null, lastName: null })]}
        onFieldChange={onFieldChange}
      />
    )
    expect(screen.getByLabelText("Edit firstName")).toBeInTheDocument()
    expect(screen.getByLabelText("Edit lastName")).toBeInTheDocument()
    // No read-only <p> rendered in edit mode
    expect(document.querySelector("p.text-xl")).toBeNull()
  })

  it("calls onFieldChange on blur of the firstName field", () => {
    const onFieldChange = vi.fn()
    render(<FullNameSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

    const firstName = screen.getByLabelText("Edit firstName")
    fireEvent.blur(firstName, { target: { textContent: "Janet" } })

    expect(onFieldChange).toHaveBeenCalledWith("fullname-1", "firstName", "Janet")
  })

  it("calls onFieldChange on blur of the lastName field", () => {
    const onFieldChange = vi.fn()
    render(<FullNameSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

    const lastName = screen.getByLabelText("Edit lastName")
    fireEvent.blur(lastName, { target: { textContent: "Smith" } })

    expect(onFieldChange).toHaveBeenCalledWith("fullname-1", "lastName", "Smith")
  })

  it("renders the add-item button and calls onAddItem with the items length", () => {
    const onAddItem = vi.fn()
    render(<FullNameSectionRenderer items={[buildItem()]} onAddItem={onAddItem} />)

    const addButton = screen.getByLabelText("Add item here")
    fireEvent.click(addButton)

    expect(onAddItem).toHaveBeenCalledWith(1)
  })

  it("does not render the add-item button when onAddItem is not provided", () => {
    render(<FullNameSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).toBeNull()
  })
})
