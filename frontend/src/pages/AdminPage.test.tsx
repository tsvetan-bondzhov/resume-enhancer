import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminPage from "./AdminPage"
import { apiClient } from "@/lib/apiClient"
import type { AdminUserDto, Page } from "@/types/api"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockedGet = vi.mocked(apiClient.get)

function emptyPage(): Page<AdminUserDto> {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the page heading and the user table", async () => {
    mockedGet.mockResolvedValue(emptyPage())

    render(<AdminPage />)

    expect(screen.getByRole("heading", { name: /user management/i })).toBeInTheDocument()
    // UserTable fetches on mount via the mocked apiClient
    expect(await screen.findByText("No users found.")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/users")
  })
})
