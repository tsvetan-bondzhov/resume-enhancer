import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { TemplateDto } from "@/types/api"
import TemplateManager from "./TemplateManager"
import { apiClient } from "@/lib/apiClient"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

import { toast } from "sonner"

const mockedGet = vi.mocked(apiClient.get)
const mockedPatch = vi.mocked(apiClient.patch)
const mockedDelete = vi.mocked(apiClient.delete)

function buildTemplate(overrides?: Partial<TemplateDto>): TemplateDto {
  return {
    id: "t1",
    name: "Minimal",
    description: "A clean template",
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: { layoutType: "single-column" },
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    ...overrides,
  }
}

describe("TemplateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches and renders template rows including a Draft and a Published row", async () => {
    mockedGet.mockResolvedValue([
      buildTemplate({ id: "t1", name: "Minimal", isPublished: true }),
      buildTemplate({ id: "t2", name: "Draft One", isPublished: false }),
    ])

    render(<TemplateManager />)

    expect(await screen.findByText("Minimal")).toBeInTheDocument()
    expect(screen.getByText("Draft One")).toBeInTheDocument()
    expect(screen.getByText("Published")).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/resume-templates/admin")
  })

  it("shows an inline error and error toast when loading fails", async () => {
    mockedGet.mockRejectedValue(new Error("boom"))

    render(<TemplateManager />)

    expect(await screen.findByText("Failed to load templates.")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Failed to load templates")
  })

  it("opens the delete dialog, confirm calls DELETE, removes the row and fires success toast", async () => {
    mockedGet.mockResolvedValue([buildTemplate({ id: "t1", name: "Minimal" })])
    mockedDelete.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<TemplateManager />)
    await screen.findByText("Minimal")

    await user.click(screen.getByRole("button", { name: /delete/i }))
    expect(
      screen.getByText("Delete template 'Minimal'? This cannot be undone."),
    ).toBeInTheDocument()

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
    await user.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith("/api/v1/resume-templates/t1")
    })
    expect(toast.success).toHaveBeenCalledWith("Template deleted")
    await waitFor(() => {
      expect(screen.queryByText("Minimal")).not.toBeInTheDocument()
    })
  })

  it("Cancel closes the delete dialog without calling DELETE", async () => {
    mockedGet.mockResolvedValue([buildTemplate({ id: "t1", name: "Minimal" })])
    const user = userEvent.setup()

    render(<TemplateManager />)
    await screen.findByText("Minimal")

    await user.click(screen.getByRole("button", { name: /delete/i }))
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText(/this cannot be undone/i)).not.toBeInTheDocument()
    })
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it("clicking Publish on a draft calls the publish endpoint and flips the badge", async () => {
    mockedGet.mockResolvedValue([
      buildTemplate({ id: "t2", name: "Draft One", isPublished: false }),
    ])
    mockedPatch.mockResolvedValue(
      buildTemplate({ id: "t2", name: "Draft One", isPublished: true }),
    )
    const user = userEvent.setup()

    render(<TemplateManager />)
    await screen.findByText("Draft One")

    await user.click(screen.getByRole("button", { name: /^publish$/i }))

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith("/api/v1/resume-templates/t2/publish")
    })
    expect(toast.success).toHaveBeenCalledWith("Template published")
    expect(await screen.findByText("Published")).toBeInTheDocument()
  })

  it("clicking Unpublish on a published row calls the unpublish endpoint", async () => {
    mockedGet.mockResolvedValue([
      buildTemplate({ id: "t1", name: "Minimal", isPublished: true }),
    ])
    mockedPatch.mockResolvedValue(
      buildTemplate({ id: "t1", name: "Minimal", isPublished: false }),
    )
    const user = userEvent.setup()

    render(<TemplateManager />)
    await screen.findByText("Minimal")

    await user.click(screen.getByRole("button", { name: /unpublish/i }))

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith("/api/v1/resume-templates/t1/unpublish")
    })
    expect(toast.success).toHaveBeenCalledWith("Template unpublished")
    expect(await screen.findByText("Draft")).toBeInTheDocument()
  })

  it("shows an error toast and keeps the row when publish fails", async () => {
    mockedGet.mockResolvedValue([
      buildTemplate({ id: "t2", name: "Draft One", isPublished: false }),
    ])
    mockedPatch.mockRejectedValue(new Error("boom"))
    const user = userEvent.setup()

    render(<TemplateManager />)
    await screen.findByText("Draft One")

    await user.click(screen.getByRole("button", { name: /^publish$/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to publish template")
    })
    expect(screen.getByText("Draft")).toBeInTheDocument()
  })
})
