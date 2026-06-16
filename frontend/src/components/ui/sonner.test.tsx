import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ theme: "light" })),
}))

// Mock sonner - the underlying Toaster
vi.mock("sonner", () => ({
  Toaster: ({ theme, className, ...props }: Record<string, unknown>) => (
    <div
      data-testid="sonner-toaster"
      data-theme={theme as string}
      className={className as string}
      {...props}
    />
  ),
}))

import { Toaster } from "./sonner"
import { useTheme } from "next-themes"

const mockUseTheme = vi.mocked(useTheme)

describe("Toaster (sonner wrapper)", () => {
  it("renders the underlying Sonner Toaster", () => {
    render(<Toaster />)
    expect(screen.getByTestId("sonner-toaster")).toBeInTheDocument()
  })

  it("passes the current theme to the Sonner Toaster", () => {
    mockUseTheme.mockReturnValue({ theme: "dark" } as ReturnType<typeof useTheme>)
    render(<Toaster />)
    expect(screen.getByTestId("sonner-toaster")).toHaveAttribute("data-theme", "dark")
  })

  it("defaults to system theme when useTheme returns undefined", () => {
    mockUseTheme.mockReturnValue({ theme: undefined } as unknown as ReturnType<typeof useTheme>)
    render(<Toaster />)
    expect(screen.getByTestId("sonner-toaster")).toHaveAttribute("data-theme", "system")
  })
})
