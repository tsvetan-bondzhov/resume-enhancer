import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SummarySectionRenderer from "./SummarySectionRenderer"
import type { SummaryItemDto } from "@/types/api"

function buildItem(overrides?: Partial<SummaryItemDto>): SummaryItemDto {
  return {
    type: "SUMMARY",
    id: "summary-1",
    text: "Experienced software engineer with 10 years of experience.",
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
})
