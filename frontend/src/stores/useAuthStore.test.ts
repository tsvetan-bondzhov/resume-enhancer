import { describe, it, expect, beforeEach } from "vitest"
import { useAuthStore } from "./useAuthStore"
import type { UserDto } from "@/types/api"

function buildUser(overrides?: Partial<UserDto>): UserDto {
  return {
    id: "user-1",
    email: "test@example.com",
    role: "USER",
    ...overrides,
  }
}

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it("initial state has null token and null user", () => {
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("setAuth stores the token and user", () => {
    const user = buildUser()
    useAuthStore.getState().setAuth("my-token", user)
    expect(useAuthStore.getState().token).toBe("my-token")
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it("setAuth stores null user when user argument is null", () => {
    useAuthStore.getState().setAuth("token-only", null)
    expect(useAuthStore.getState().token).toBe("token-only")
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("clearAuth resets token and user to null", () => {
    useAuthStore.setState({ token: "existing-token", user: buildUser() })
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("setAuth called twice overwrites previous token and user", () => {
    const firstUser = buildUser({ id: "user-1", email: "first@example.com" })
    const secondUser = buildUser({ id: "user-2", email: "second@example.com" })
    useAuthStore.getState().setAuth("token-1", firstUser)
    useAuthStore.getState().setAuth("token-2", secondUser)
    expect(useAuthStore.getState().token).toBe("token-2")
    expect(useAuthStore.getState().user?.email).toBe("second@example.com")
  })
})
