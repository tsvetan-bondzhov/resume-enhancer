import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import LanguagesSectionRenderer from "./LanguagesSectionRenderer"
import type { LanguageItemDto } from "@/types/api"

function buildItem(overrides?: Partial<LanguageItemDto>): LanguageItemDto {
  return {
    type: "LANGUAGES",
    id: "lang-1",
    language: "English",
    proficiency: "Native",
    ...overrides,
  }
}

function testBlurCallsOnFieldChange(label: string, fieldKey: string, value: string) {
  const onFieldChange = vi.fn()
  render(<LanguagesSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

  const field = screen.getByLabelText(label)
  fireEvent.blur(field, { target: { textContent: value } })

  expect(onFieldChange).toHaveBeenCalledWith("lang-1", fieldKey, value)
}

function testEnterKeyPreventsDefault(label: string) {
  const onFieldChange = vi.fn()
  render(<LanguagesSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

  const field = screen.getByLabelText(label)
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  const preventDefaultSpy = vi.spyOn(event, "preventDefault")
  field.dispatchEvent(event)

  expect(preventDefaultSpy).toHaveBeenCalled()
}

describe("LanguagesSectionRenderer", () => {
  it("renders language name in read-only mode", () => {
    render(<LanguagesSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("English")).toBeInTheDocument()
  })

  it("renders proficiency badge in read-only mode", () => {
    render(<LanguagesSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Native")).toBeInTheDocument()
  })

  it("renders editable language span when onFieldChange is provided", () => {
    const onFieldChange = vi.fn()
    render(<LanguagesSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)
    expect(screen.getByLabelText("Edit language")).toBeInTheDocument()
  })

  it("calls onFieldChange with (itemId, 'language', value) on blur of language field", () => {
    testBlurCallsOnFieldChange("Edit language", "language", "Spanish")
  })

  it("renders editable proficiency span when onFieldChange is provided", () => {
    const onFieldChange = vi.fn()
    render(<LanguagesSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)
    expect(screen.getByLabelText("Edit proficiency")).toBeInTheDocument()
  })

  it("calls onFieldChange with (itemId, 'proficiency', value) on blur of proficiency field", () => {
    testBlurCallsOnFieldChange("Edit proficiency", "proficiency", "Fluent")
  })

  it("does not render language field when language is null", () => {
    render(<LanguagesSectionRenderer items={[buildItem({ language: null })]} />)
    expect(screen.queryByLabelText("Edit language")).not.toBeInTheDocument()
  })

  it("does not render proficiency badge when proficiency is null", () => {
    render(<LanguagesSectionRenderer items={[buildItem({ proficiency: null })]} />)
    expect(screen.queryByLabelText("Edit proficiency")).not.toBeInTheDocument()
  })

  it("calls onDeleteItem with item.id when delete button is clicked", () => {
    const onDeleteItem = vi.fn()
    render(
      <LanguagesSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />,
    )
    fireEvent.click(screen.getByLabelText("Delete item"))
    expect(onDeleteItem).toHaveBeenCalledWith("lang-1")
  })

  it("renders add buttons when onAddItem is provided", () => {
    const onAddItem = vi.fn()
    render(
      <LanguagesSectionRenderer
        items={[buildItem()]}
        onAddItem={onAddItem}
      />,
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("does not render add buttons when onAddItem is not provided", () => {
    render(<LanguagesSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })

  it("prevents Enter key default in language editable field", () => {
    testEnterKeyPreventsDefault("Edit language")
  })

  it("prevents Enter key default in proficiency editable field", () => {
    testEnterKeyPreventsDefault("Edit proficiency")
  })
})
