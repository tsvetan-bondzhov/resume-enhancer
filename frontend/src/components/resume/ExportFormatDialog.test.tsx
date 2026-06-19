import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ExportFormatDialog from "./ExportFormatDialog"

function buildProps(overrides?: Partial<Parameters<typeof ExportFormatDialog>[0]>) {
  return {
    open: true,
    resumeName: "My Resume",
    isExporting: false,
    onExport: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe("ExportFormatDialog — renders format buttons", () => {
  it("renders PDF and DOCX buttons", () => {
    render(<ExportFormatDialog {...buildProps()} />)
    expect(screen.getByRole("button", { name: /pdf/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /docx/i })).toBeInTheDocument()
  })

  it("calls onExport with 'pdf' when PDF clicked", () => {
    const onExport = vi.fn()
    render(<ExportFormatDialog {...buildProps({ onExport })} />)
    fireEvent.click(screen.getByRole("button", { name: /export as pdf/i }))
    expect(onExport).toHaveBeenCalledWith("pdf")
  })

  it("calls onExport with 'docx' when DOCX clicked", () => {
    const onExport = vi.fn()
    render(<ExportFormatDialog {...buildProps({ onExport })} />)
    fireEvent.click(screen.getByRole("button", { name: /export as docx/i }))
    expect(onExport).toHaveBeenCalledWith("docx")
  })

  it("disables export buttons while isExporting", () => {
    render(<ExportFormatDialog {...buildProps({ isExporting: true })} />)
    expect(screen.getByRole("button", { name: /export as pdf/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /export as docx/i })).toBeDisabled()
  })
})
