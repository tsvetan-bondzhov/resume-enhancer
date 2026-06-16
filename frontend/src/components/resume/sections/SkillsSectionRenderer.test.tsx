import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SkillsSectionRenderer from "./SkillsSectionRenderer"
import type { SkillItemDto } from "@/types/api"

function buildItem(overrides?: Partial<SkillItemDto>): SkillItemDto {
  return {
    type: "SKILLS",
    id: "skill-1",
    name: "TypeScript",
    ...overrides,
  }
}

describe("SkillsSectionRenderer", () => {
  it("renders skill name as a badge", () => {
    render(<SkillsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("TypeScript")).toBeInTheDocument()
  })

  it("does not render items with null name", () => {
    render(
      <SkillsSectionRenderer items={[buildItem({ id: "s-null", name: null })]} />
    )
    // Nothing meaningful rendered — no textbox or skill text
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("renders editable span when onFieldChange is provided", () => {
    const onFieldChange = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )
    const editable = screen.getByRole("textbox", { name: "Edit name" })
    expect(editable).toBeInTheDocument()
    expect(editable).toHaveTextContent("TypeScript")
  })

  it("calls onFieldChange with correct args on blur", () => {
    const onFieldChange = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )
    const editable = screen.getByRole("textbox", { name: "Edit name" })
    fireEvent.blur(editable, { target: { textContent: "JavaScript" } })
    expect(onFieldChange).toHaveBeenCalledWith("skill-1", "name", "JavaScript")
  })

  it("prevents newline on Enter key in editable skill name", () => {
    const onFieldChange = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )
    const editable = screen.getByRole("textbox", { name: "Edit name" })
    const event = fireEvent.keyDown(editable, { key: "Enter", code: "Enter" })
    // The handler calls e.preventDefault() — fireEvent returns false when default is prevented
    expect(event).toBe(false)
  })

  it("does not prevent non-Enter key events", () => {
    const onFieldChange = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />
    )
    const editable = screen.getByRole("textbox", { name: "Edit name" })
    const event = fireEvent.keyDown(editable, { key: "a", code: "KeyA" })
    // Default is NOT prevented for non-Enter keys
    expect(event).toBe(true)
  })

  it("renders add buttons at position 0 and after each item when onAddItem is provided", () => {
    const onAddItem = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onAddItem={onAddItem} />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("calls onAddItem(0) when the first add button is clicked", () => {
    const onAddItem = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onAddItem={onAddItem} />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    fireEvent.click(addButtons[0])
    expect(onAddItem).toHaveBeenCalledWith(0)
  })

  it("calls onAddItem(1) when the add button after the first item is clicked", () => {
    const onAddItem = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onAddItem={onAddItem} />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    fireEvent.click(addButtons[1])
    expect(onAddItem).toHaveBeenCalledWith(1)
  })

  it("does not render add buttons when onAddItem is not provided", () => {
    render(<SkillsSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })

  it("calls onDeleteItem with correct item.id when delete button is clicked", () => {
    const onDeleteItem = vi.fn()
    render(
      <SkillsSectionRenderer items={[buildItem()]} onDeleteItem={onDeleteItem} />
    )
    fireEvent.click(screen.getByLabelText("Delete item"))
    expect(onDeleteItem).toHaveBeenCalledWith("skill-1")
  })

  it("renders plain text skill name when onFieldChange is not provided", () => {
    render(<SkillsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("TypeScript")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
})
