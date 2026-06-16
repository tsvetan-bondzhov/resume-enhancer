import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import GenericSectionRenderer from "./GenericSectionRenderer"
import type { GenericItemDto } from "@/types/api"

function buildItem(overrides?: Partial<GenericItemDto>): GenericItemDto {
  return {
    type: "UNKNOWN",
    id: "generic-1",
    fields: {
      title: "Some Title",
      detail: "Some Detail",
    },
    ...overrides,
  }
}

describe("GenericSectionRenderer", () => {
  it("renders non-null field values", () => {
    render(<GenericSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Some Title")).toBeInTheDocument()
    expect(screen.getByText("Some Detail")).toBeInTheDocument()
  })

  it("omits null/empty values", () => {
    render(
      <GenericSectionRenderer
        items={[
          buildItem({
            fields: {
              title: "Visible",
              empty: "",
            },
          }),
        ]}
      />
    )
    expect(screen.getByText("Visible")).toBeInTheDocument()
    // Empty string filtered out — no empty li rendered
    const lis = document.querySelectorAll("li")
    expect(lis).toHaveLength(1)
  })

  it("does not render fields with empty string values", () => {
    render(
      <GenericSectionRenderer
        items={[buildItem({ fields: { a: "", b: "present" } })]}
      />
    )
    expect(screen.queryByText("a")).not.toBeInTheDocument()
    expect(screen.getByText("present")).toBeInTheDocument()
  })

  it("calls onFieldChange on blur in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <GenericSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )

    const field = screen.getByLabelText("Edit title")
    fireEvent.blur(field, { target: { textContent: "Updated Title" } })

    expect(onFieldChange).toHaveBeenCalledWith("generic-1", "title", "Updated Title")
  })

  // Line 22: onAddItem not provided — AddItemButton (aria-label "Add item here") is not rendered
  it("does not render AddItemButton when onAddItem is not provided", () => {
    render(<GenericSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })

  // Line 22 and 61: onAddItem provided — AddItemButton rendered before and after items
  it("renders AddItemButton before and after items when onAddItem is provided", () => {
    const onAddItem = vi.fn()
    render(
      <GenericSectionRenderer items={[buildItem()]} onAddItem={onAddItem} />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    // One button before the item (position 0) and one after (position 1)
    expect(addButtons).toHaveLength(2)
  })

  // Line 61: onAddItem callback called with correct index after items
  it("calls onAddItem with correct position when AddItemButton after item is clicked", () => {
    const onAddItem = vi.fn()
    render(
      <GenericSectionRenderer items={[buildItem()]} onAddItem={onAddItem} />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    // Last button is after the first item → position = index + 1 = 1
    fireEvent.click(addButtons[addButtons.length - 1])
    expect(onAddItem).toHaveBeenCalledWith(1)
  })

  // Lines 45-46: Enter key on contentEditable span is prevented (non-composing)
  it("prevents default on Enter keydown in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <GenericSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )
    const field = screen.getByLabelText("Edit title")
    // fireEvent.keyDown returns false when preventDefault() was called
    const result = fireEvent.keyDown(field, { key: "Enter" })
    expect(result).toBe(false)
  })

  // Lines 45-46: Non-Enter key is not prevented
  it("does not prevent default on non-Enter keydown", () => {
    const onFieldChange = vi.fn()
    render(
      <GenericSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )
    const field = screen.getByLabelText("Edit title")
    // Non-Enter key → no preventDefault
    const result = fireEvent.keyDown(field, { key: "a" })
    expect(result).toBe(true)
  })
})
