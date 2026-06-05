import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SplitPaneLayout from "./SplitPaneLayout"

describe("SplitPaneLayout", () => {
  afterEach(() => {
    localStorage.clear()
  })

  it("renders all three slots", () => {
    render(
      <SplitPaneLayout
        leftSlot={<span>left</span>}
        centerSlot={<span>center</span>}
        rightSlot={<span>right</span>}
      />,
    )
    expect(screen.getByText("left")).toBeInTheDocument()
    expect(screen.getByText("center")).toBeInTheDocument()
    expect(screen.getByText("right")).toBeInTheDocument()
  })

  it("chevron button has aria-expanded=true when expanded (default)", () => {
    render(
      <SplitPaneLayout
        leftSlot={null}
        centerSlot={null}
        rightSlot={null}
      />,
    )
    const btn = screen.getByRole("button", { name: /collapse sidebar/i })
    expect(btn.getAttribute("aria-expanded")).toBe("true")
  })

  it("clicking chevron updates aria-expanded", () => {
    render(
      <SplitPaneLayout
        leftSlot={null}
        centerSlot={null}
        rightSlot={null}
      />,
    )
    const btn = screen.getByRole("button", { name: /collapse sidebar/i })
    fireEvent.click(btn)
    const expandBtn = screen.getByRole("button", { name: /expand sidebar/i })
    expect(expandBtn.getAttribute("aria-expanded")).toBe("false")
  })

  it("reads initial collapsed state from localStorage", () => {
    localStorage.setItem("sidebar-collapsed", "true")
    render(
      <SplitPaneLayout
        leftSlot={null}
        centerSlot={null}
        rightSlot={null}
      />,
    )
    const btn = screen.getByRole("button", { name: /expand sidebar/i })
    expect(btn.getAttribute("aria-expanded")).toBe("false")
  })

  it("writes to localStorage on toggle", () => {
    render(
      <SplitPaneLayout
        leftSlot={null}
        centerSlot={null}
        rightSlot={null}
      />,
    )
    const btn = screen.getByRole("button", { name: /collapse sidebar/i })
    fireEvent.click(btn)
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true")
  })

  it("[ key press toggles sidebar", () => {
    render(
      <SplitPaneLayout
        leftSlot={null}
        centerSlot={null}
        rightSlot={null}
      />,
    )
    // Initially expanded: aria-expanded = true
    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }).getAttribute("aria-expanded"),
    ).toBe("true")

    fireEvent.keyDown(document, { key: "[" })

    // After keypress: collapsed
    expect(
      screen.getByRole("button", { name: /expand sidebar/i }).getAttribute("aria-expanded"),
    ).toBe("false")
  })
})
