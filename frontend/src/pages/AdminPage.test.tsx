import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import AdminPage from "./AdminPage"
import { apiClient } from "@/lib/apiClient"
import type { AdminUserDto, CustomTemplateAdminDto, Page, TemplateDto } from "@/types/api"

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

const mockedGet = vi.mocked(apiClient.get)

function emptyUserPage(): Page<AdminUserDto> {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
}

function buildTemplate(): TemplateDto {
  return {
    id: "t1",
    name: "Minimal",
    description: "A clean template",
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: { layoutType: "single-column" },
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  }
}

function buildCustomTemplate(): CustomTemplateAdminDto {
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
  }
}

// Route the mocked apiClient.get by path so all tabs can fetch independently.
function mockGetByPath() {
  mockedGet.mockImplementation((path: string) => {
    if (path === "/api/v1/admin/users") return Promise.resolve(emptyUserPage())
    if (path === "/api/v1/resume-templates/admin") {
      return Promise.resolve([buildTemplate()])
    }
    if (path === "/api/v1/resume-templates/admin/custom") {
      return Promise.resolve([buildCustomTemplate()])
    }
    return Promise.reject(new Error(`unexpected path: ${path}`))
  })
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the Administration heading and the Users tab table by default", async () => {
    mockGetByPath()

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: /administration/i })).toBeInTheDocument()
    // Users tab is active by default; UserTable fetches on mount
    expect(await screen.findByText("No users found.")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/users")
  })

  it("renders System Templates sub-view when the Templates tab is activated", async () => {
    mockGetByPath()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    )
    await screen.findByText("No users found.")

    await user.click(screen.getByRole("tab", { name: /^templates$/i }))

    // System Templates is the default sub-tab; TemplateManager fetches the admin list
    expect(await screen.findByText("Minimal")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/resume-templates/admin")
  })

  it("renders User Templates sub-view with the owner email when selected", async () => {
    mockGetByPath()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    )
    await screen.findByText("No users found.")

    await user.click(screen.getByRole("tab", { name: /^templates$/i }))
    await screen.findByText("Minimal")

    await user.click(screen.getByRole("tab", { name: /user templates/i }))

    expect(await screen.findByText("User Custom")).toBeInTheDocument()
    expect(screen.getByText("owner@example.com")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/resume-templates/admin/custom")
  })
})
