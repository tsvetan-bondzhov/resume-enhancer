import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { ResumeDto, TemplateDto } from "@/types/api"
import ExportablePreview from "./ExportablePreview"

// Stub ResumeCanvas to render a deterministic page count so the rAF settle loop fires.
// Expose the templatePreview prop so tests can assert the resolved theme is passed in.
vi.mock("@/components/resume/ResumeCanvas", () => ({
  default: ({ templatePreview }: { templatePreview?: unknown }) => (
    <div data-has-preview={templatePreview ? "yes" : "no"}>
      <article aria-label="Resume page 1" />
      <article aria-label="Resume page 2" />
    </div>
  ),
}))

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn() },
}))

function buildResume(): ResumeDto {
  return {
    id: "r1",
    name: "R1",
    templateId: "tmpl-1",
    content: { sections: [] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function buildTemplate(): TemplateDto {
  return {
    id: "tmpl-1",
    name: "Tmpl",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: { layoutType: "two-column" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe("ExportablePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // window.document.fonts.ready resolves immediately by default
    Object.defineProperty(globalThis.document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
  })

  it("resolves the template definition, applies it, and only then calls onReady (provided document path)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(buildTemplate())
    const onReady = vi.fn()
    const onError = vi.fn()
    const { container } = render(
      <ExportablePreview
        resumeId="r1"
        document={{ sections: [] }}
        templateId="tmpl-1"
        onReady={onReady}
        onError={onError}
      />,
    )
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    const readyContainer = onReady.mock.calls[0][0] as HTMLElement
    expect(readyContainer.querySelectorAll('article[aria-label^="Resume page"]')).toHaveLength(2)
    expect(onError).not.toHaveBeenCalled()
    // The template definition was fetched and passed to the canvas as templatePreview.
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/api/v1/resume-templates/tmpl-1")
    expect(container.querySelector('[data-has-preview="yes"]')).toBeInTheDocument()
  })

  it("fetches the resume by id when no document is provided, then resolves the template", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.resolve(buildTemplate())
      return Promise.resolve(buildResume())
    })
    const onReady = vi.fn()
    render(
      <ExportablePreview resumeId="r1" onReady={onReady} onError={vi.fn()} />,
    )
    await waitFor(() =>
      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/api/v1/resumes/r1"),
    )
    await waitFor(() =>
      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/api/v1/resume-templates/tmpl-1"),
    )
    await waitFor(() => expect(onReady).toHaveBeenCalled())
  })

  it("still calls onReady (unthemed) when the template fetch fails", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.reject(new Error("no template"))
      return Promise.resolve(buildResume())
    })
    const onReady = vi.fn()
    const onError = vi.fn()
    const { container } = render(
      <ExportablePreview resumeId="r1" onReady={onReady} onError={onError} />,
    )
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    // Falls back to no preview — still produces a PDF rather than erroring out.
    expect(container.querySelector('[data-has-preview="no"]')).toBeInTheDocument()
  })

  it("calls onError when the resume fetch fails", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("boom"))
    const onError = vi.fn()
    render(
      <ExportablePreview resumeId="r1" onReady={vi.fn()} onError={onError} />,
    )
    await waitFor(() => expect(onError).toHaveBeenCalled())
  })
})
