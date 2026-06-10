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
})
