import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { App } from "./App"

// Mock the router to avoid needing a full browser environment
vi.mock("@/router", () => ({
  router: {
    routes: [],
    navigate: vi.fn(),
    state: { location: { pathname: "/", search: "", hash: "", state: null, key: "default" } },
    subscribe: vi.fn(() => () => {}),
  },
}))

// Mock RouterProvider to avoid complex router setup in unit tests
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    RouterProvider: () => <div data-testid="router-provider" />,
  }
})

// Mock Toaster
vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

describe("App", () => {
  it("renders RouterProvider and Toaster", () => {
    render(<App />)
    expect(screen.getByTestId("router-provider")).toBeInTheDocument()
    expect(screen.getByTestId("toaster")).toBeInTheDocument()
  })
})
