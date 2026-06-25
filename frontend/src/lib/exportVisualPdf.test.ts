import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Spies are defined via vi.hoisted so they exist before the hoisted vi.mock factories run.
const { toCanvas, addImage, addPage, output } = vi.hoisted(() => ({
  toCanvas: vi.fn(async () => globalThis.document.createElement("canvas")),
  addImage: vi.fn(),
  addPage: vi.fn(),
  output: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
}))

// Mock html-to-image's toCanvas to return a fake canvas element per page.
vi.mock("html-to-image", () => ({ toCanvas }))

// Mock jsPDF — track addImage / addPage / output calls.
vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function () {
    return { addImage, addPage, output }
  }),
}))

import { exportVisualPdf } from "./exportVisualPdf"

function buildContainer(pageCount: number): HTMLElement {
  const container = document.createElement("div")
  for (let i = 0; i < pageCount; i++) {
    const article = document.createElement("article")
    article.setAttribute("aria-label", `Resume page ${i + 1}`)
    container.appendChild(article)
  }
  // A non-page article should be ignored.
  const other = document.createElement("article")
  other.setAttribute("aria-label", "Something else")
  container.appendChild(other)
  return container
}

describe("exportVisualPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders one image per resume page and one fewer addPage calls", async () => {
    const container = buildContainer(3)
    await exportVisualPdf(container, "My Resume")

    expect(toCanvas).toHaveBeenCalledTimes(3)
    expect(addImage).toHaveBeenCalledTimes(3)
    // addPage is called between pages only (page count - 1)
    expect(addPage).toHaveBeenCalledTimes(2)
  })

  it("triggers a download with the .pdf filename", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    const container = buildContainer(1)

    await exportVisualPdf(container, "My Resume")

    expect(output).toHaveBeenCalledWith("blob")
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test")
  })

  it("throws when there are no resume pages", async () => {
    const container = document.createElement("div")
    await expect(exportVisualPdf(container, "Empty")).rejects.toThrow(/no resume pages/i)
  })
})
