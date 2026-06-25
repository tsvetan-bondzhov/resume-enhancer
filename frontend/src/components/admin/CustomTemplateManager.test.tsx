import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { CustomTemplateAdminDto } from "@/types/api"
import CustomTemplateManager from "./CustomTemplateManager"
import { apiClient } from "@/lib/apiClient"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
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

function buildCustomTemplate(
  overrides?: Partial<CustomTemplateAdminDto>,
): CustomTemplateAdminDto {
  return {
    id: "c1",
    name: "User Custom",
    description: "owned",
    isPrebuilt: false,
    isPublished: false,
    templateDefinition: { layoutType: "single-column" },
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    ownerId: "u1",
    ownerEmail: "owner@example.com",
    ...overrides,
  }
}

describe("CustomTemplateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches and renders user templates with the owner email", async () => {
    mockedGet.mockResolvedValue([
      buildCustomTemplate({ id: "c1", name: "User Custom", ownerEmail: "owner@example.com" }),
    ])

    render(<CustomTemplateManager />)

    expect(await screen.findByText("User Custom")).toBeInTheDocument()
    expect(screen.getByText("owner@example.com")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/resume-templates/admin/custom")
  })

  it("shows an empty state when there are no user templates", async () => {
    mockedGet.mockResolvedValue([])

    render(<CustomTemplateManager />)

    expect(await screen.findByText("No user templates found.")).toBeInTheDocument()
  })

  it("filters templates by name, owner email, and status, and shows the empty state for no matches", async () => {
    mockedGet.mockResolvedValue([
      buildCustomTemplate({
        id: "c1",
        name: "Alpha Resume",
        ownerEmail: "alice@example.com",
        isPublished: true,
      }),
      buildCustomTemplate({
        id: "c2",
        name: "Beta Resume",
        ownerEmail: "bob@example.com",
        isPublished: false,
      }),
    ])
    const user = userEvent.setup()

    render(<CustomTemplateManager />)
    await screen.findByText("Alpha Resume")

    const searchBox = screen.getByLabelText(/search user templates/i)

    // Filter by name
    await user.type(searchBox, "alpha")
    expect(screen.getByText("Alpha Resume")).toBeInTheDocument()
    expect(screen.queryByText("Beta Resume")).not.toBeInTheDocument()

    // Filter by owner email
    await user.clear(searchBox)
    await user.type(searchBox, "bob@example.com")
    expect(screen.getByText("Beta Resume")).toBeInTheDocument()
    expect(screen.queryByText("Alpha Resume")).not.toBeInTheDocument()

    // Filter by status
    await user.clear(searchBox)
    await user.type(searchBox, "draft")
    expect(screen.getByText("Beta Resume")).toBeInTheDocument()
    expect(screen.queryByText("Alpha Resume")).not.toBeInTheDocument()

    // Non-matching query shows empty state
    await user.clear(searchBox)
    await user.type(searchBox, "zzz-no-match")
    expect(screen.getByText("No user templates found.")).toBeInTheDocument()
  })

  it("shows an inline error and error toast when loading fails", async () => {
    mockedGet.mockRejectedValue(new Error("boom"))

    render(<CustomTemplateManager />)

    expect(await screen.findByText("Failed to load user templates.")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Failed to load user templates")
  })
})
