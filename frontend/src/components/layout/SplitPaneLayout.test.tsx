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

  // ─── Right panel toggle ──────────────────────────────────────────────────

  it("right chat panel chevron has aria-expanded=true when expanded (default)", () => {
    render(<SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />)
    const btn = screen.getByRole("button", { name: /collapse chat panel/i })
    expect(btn.getAttribute("aria-expanded")).toBe("true")
  })

  it("clicking right panel chevron collapses it and writes to localStorage", () => {
    render(
      <SplitPaneLayout
        leftSlot={null}
        centerSlot={null}
        rightSlot={<span>right-content</span>}
      />,
    )
    const btn = screen.getByRole("button", { name: /collapse chat panel/i })
    fireEvent.click(btn)
    const expandBtn = screen.getByRole("button", { name: /expand chat panel/i })
    expect(expandBtn.getAttribute("aria-expanded")).toBe("false")
    expect(localStorage.getItem("right-panel-collapsed")).toBe("true")
    // Collapsed panel hides its slot content
    expect(screen.queryByText("right-content")).not.toBeInTheDocument()
  })

  it("reads initial right-collapsed state from localStorage", () => {
    localStorage.setItem("right-panel-collapsed", "true")
    render(<SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />)
    expect(
      screen.getByRole("button", { name: /expand chat panel/i }).getAttribute("aria-expanded"),
    ).toBe("false")
  })

  it("] key press toggles the right chat panel", () => {
    render(<SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />)
    expect(
      screen.getByRole("button", { name: /collapse chat panel/i }).getAttribute("aria-expanded"),
    ).toBe("true")

    fireEvent.keyDown(document, { key: "]" })

    expect(
      screen.getByRole("button", { name: /expand chat panel/i }).getAttribute("aria-expanded"),
    ).toBe("false")
  })

  it("ignores shortcut keys when a modifier is held", () => {
    render(<SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />)
    fireEvent.keyDown(document, { key: "[", metaKey: true })
    // Sidebar should remain expanded
    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }).getAttribute("aria-expanded"),
    ).toBe("true")
  })

  it("ignores shortcut keys when focus is inside an input element", () => {
    render(
      <SplitPaneLayout
        leftSlot={<input aria-label="left-input" />}
        centerSlot={null}
        rightSlot={null}
      />,
    )
    const input = screen.getByLabelText("left-input")
    fireEvent.keyDown(input, { key: "[" })
    // Typing "[" in an input must not toggle the sidebar
    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }).getAttribute("aria-expanded"),
    ).toBe("true")
  })

  // ─── Drag-to-resize the right panel ──────────────────────────────────────

  it("dragging the resize handle updates the right panel width in localStorage", () => {
    const { container } = render(
      <SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />,
    )
    const handle = container.querySelector(".cursor-col-resize") as HTMLElement
    expect(handle).not.toBeNull()

    // Start drag at clientX=800; moving left (smaller clientX) increases the panel width
    fireEvent.mouseDown(handle, { clientX: 800 })
    fireEvent.mouseMove(document, { clientX: 700 }) // delta = +100
    fireEvent.mouseUp(document)

    // Default width 380 + 100 = 480 (within RIGHT_MIN..RIGHT_MAX)
    expect(localStorage.getItem("right-panel-width")).toBe("480")
  })

  it("drag width is clamped to the maximum bound", () => {
    const { container } = render(
      <SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />,
    )
    const handle = container.querySelector(".cursor-col-resize") as HTMLElement

    fireEvent.mouseDown(handle, { clientX: 1000 })
    fireEvent.mouseMove(document, { clientX: 0 }) // huge delta — clamps to RIGHT_MAX (600)
    fireEvent.mouseUp(document)

    expect(localStorage.getItem("right-panel-width")).toBe("600")
  })

  it("reads a valid stored right-panel width from localStorage", () => {
    localStorage.setItem("right-panel-width", "420")
    render(<SplitPaneLayout leftSlot={null} centerSlot={null} rightSlot={null} />)
    // No assertion on internal width directly; ensure it renders without falling back/throwing
    expect(screen.getByRole("button", { name: /collapse chat panel/i })).toBeInTheDocument()
  })
})
