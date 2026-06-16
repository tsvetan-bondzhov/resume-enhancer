import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAuthStore } from "@/stores/useAuthStore"
import { useSignOut } from "./useSignOut"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}))

describe("useSignOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ token: "test-token", user: { id: "u1", email: "test@example.com", role: "USER" } })
  })

  it("clears auth state when sign out is called", () => {
    const { result } = renderHook(() => useSignOut())

    act(() => {
      result.current()
    })

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("navigates to /login with replace:true when sign out is called", () => {
    const { result } = renderHook(() => useSignOut())

    act(() => {
      result.current()
    })

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true })
  })
})
