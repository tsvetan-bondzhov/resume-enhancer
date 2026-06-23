import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import DiffHighlight from "./DiffHighlight"

describe("DiffHighlight", () => {
  it("visible addition — renders mark with emerald classes and aria-label", () => {
    render(
      <DiffHighlight
        kind="addition"
        state="visible"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      >
        new text
      </DiffHighlight>
    )
    const mark = screen.getByRole("region", { name: "AI addition" })
    expect(mark).toBeInTheDocument()
    expect(mark.className).toContain("bg-emerald-100")
    expect(mark.className).toContain("text-emerald-700")
    // + icon is present
    expect(mark.textContent).toContain("+")
  })

  it("visible rewrite — renders mark with amber classes and aria-label", () => {
    render(
      <DiffHighlight
        kind="rewrite"
        state="visible"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      >
        updated text
      </DiffHighlight>
    )
    const mark = screen.getByRole("region", {
      name: "Modified: hover to compare original and new text",
    })
    expect(mark).toBeInTheDocument()
    expect(mark.className).toContain("bg-amber-100")
    expect(mark.className).toContain("text-amber-700")
    // ~ icon is present
    expect(mark.textContent).toContain("~")
  })

  it("rewrite hover — shows tooltip with both old and new values; new value always rendered", async () => {
    render(
      <DiffHighlight
        kind="rewrite"
        state="visible"
        previousValue="old text"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      >
        new text
      </DiffHighlight>
    )
    const mark = screen.getByRole("region", {
      name: "Modified: hover to compare original and new text",
    })
    // new value is always visible (no jitter / text swap)
    expect(mark.textContent).toContain("new text")
    // tooltip hidden until hover
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    await userEvent.hover(mark)
    const tooltip = screen.getByRole("tooltip")
    expect(tooltip).toBeInTheDocument()
    expect(tooltip.textContent).toContain("old text")
    expect(tooltip.textContent).toContain("new text")

    await userEvent.unhover(mark)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("hidden state — renders nothing; mark not in DOM", () => {
    render(
      <DiffHighlight
        kind="addition"
        state="hidden"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      >
        hidden text
      </DiffHighlight>
    )
    expect(screen.queryByRole("region", { name: "AI addition" })).not.toBeInTheDocument()
    expect(screen.queryByText("hidden text")).not.toBeInTheDocument()
  })

  it("Accept button click — fires onAccept callback", async () => {
    const onAccept = vi.fn()
    render(
      <DiffHighlight
        kind="addition"
        state="visible"
        onAccept={onAccept}
        onReject={vi.fn()}
      >
        some text
      </DiffHighlight>
    )
    await userEvent.click(screen.getByRole("button", { name: /accept ai change/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it("Reject button click — fires onReject callback", async () => {
    const onReject = vi.fn()
    render(
      <DiffHighlight
        kind="rewrite"
        state="visible"
        onAccept={vi.fn()}
        onReject={onReject}
      >
        some text
      </DiffHighlight>
    )
    await userEvent.click(screen.getByRole("button", { name: /reject ai change/i }))
    expect(onReject).toHaveBeenCalledTimes(1)
  })
})
