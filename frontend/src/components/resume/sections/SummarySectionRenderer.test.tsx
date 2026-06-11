import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SummarySectionRenderer from "./SummarySectionRenderer"
import type { SummaryItemDto } from "@/types/api"

function buildItem(overrides?: Partial<SummaryItemDto>): SummaryItemDto {
  return {
    type: "SUMMARY",
    id: "summary-1",
    text: "Experienced software engineer with 10 years of experience.",
    linkedInUrl: null,
    personalPageUrl: null,
    blogUrl: null,
    contactEmail: null,
    locationCountry: null,
    locationCity: null,
    ...overrides,
  }
}

describe("SummarySectionRenderer", () => {
  it("renders exactly one <p> element with the text content", () => {
    const { container } = render(<SummarySectionRenderer items={[buildItem()]} />)
    const paragraphs = container.querySelectorAll("p")
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]).toHaveTextContent(
      "Experienced software engineer with 10 years of experience."
    )
  })

  it("renders text in a <p> with text-sm class", () => {
    render(<SummarySectionRenderer items={[buildItem()]} />)
    const p = screen.getByText("Experienced software engineer with 10 years of experience.")
    expect(p.tagName).toBe("P")
    expect(p).toHaveClass("text-sm")
  })

  it("does not render anything when text is null", () => {
    const { container } = render(
      <SummarySectionRenderer items={[buildItem({ text: null })]} />
    )
    const paragraphs = container.querySelectorAll("p")
    expect(paragraphs).toHaveLength(0)
  })

  it("in edit mode, the <p> is contentEditable and calls onFieldChange on blur", () => {
    const onFieldChange = vi.fn()
    render(<SummarySectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

    const p = screen.getByText("Experienced software engineer with 10 years of experience.")
    expect(p).toHaveAttribute("contenteditable", "true")
    fireEvent.blur(p, { target: { textContent: "Updated summary text." } })

    expect(onFieldChange).toHaveBeenCalledWith("summary-1", "text", "Updated summary text.")
  })

  it("renders contact row above text when linkedInUrl is non-null", () => {
    const { container } = render(
      <SummarySectionRenderer
        items={[buildItem({ linkedInUrl: "https://linkedin.com/in/johndoe" })]}
      />
    )
    const anchor = container.querySelector('a[href="https://linkedin.com/in/johndoe"]')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute("target", "_blank")
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("does not render contact row when all six contact fields are null", () => {
    const { container } = render(
      <SummarySectionRenderer items={[buildItem()]} />
    )
    const contactRow = container.querySelector(".flex.flex-wrap")
    expect(contactRow).toBeNull()
  })

  it("renders location as 'City, Country' when both locationCity and locationCountry are set", () => {
    render(
      <SummarySectionRenderer
        items={[buildItem({ locationCity: "Berlin", locationCountry: "Germany" })]}
      />
    )
    expect(screen.getByText("Berlin, Germany")).toBeInTheDocument()
  })

  it("renders contact row with contactEmail as plain text", () => {
    render(
      <SummarySectionRenderer
        items={[buildItem({ contactEmail: "jane@example.com" })]}
      />
    )
    expect(screen.getByText("jane@example.com")).toBeInTheDocument()
  })
})
