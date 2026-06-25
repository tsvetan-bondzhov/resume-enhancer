import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { ResumeDto } from "@/types/api"
import ExportablePreview from "./ExportablePreview"

// Stub ResumeCanvas to render a deterministic page count so the rAF settle loop fires.
vi.mock("@/components/resume/ResumeCanvas", () => ({
  default: () => (
    <div>
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

describe("ExportablePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls onReady with a container holding the rendered pages (provided document path)", async () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    render(
      <ExportablePreview
        resumeId="r1"
        document={{ sections: [] }}
        templateId="tmpl-1"
        onReady={onReady}
        onError={onError}
      />,
    )
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    const container = onReady.mock.calls[0][0] as HTMLElement
    expect(container.querySelectorAll('article[aria-label^="Resume page"]')).toHaveLength(2)
    expect(onError).not.toHaveBeenCalled()
    // No fetch when document is supplied
    expect(vi.mocked(apiClient.get)).not.toHaveBeenCalled()
  })

  it("fetches the resume by id when no document is provided", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(buildResume())
    const onReady = vi.fn()
    render(
      <ExportablePreview resumeId="r1" onReady={onReady} onError={vi.fn()} />,
    )
    await waitFor(() =>
      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/api/v1/resumes/r1"),
    )
    await waitFor(() => expect(onReady).toHaveBeenCalled())
  })

  it("calls onError when the fetch fails", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("boom"))
    const onError = vi.fn()
    render(
      <ExportablePreview resumeId="r1" onReady={vi.fn()} onError={onError} />,
    )
    await waitFor(() => expect(onError).toHaveBeenCalled())
  })
})
