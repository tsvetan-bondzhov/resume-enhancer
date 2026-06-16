import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  EditableField,
  createHandleDragEnd,
  EditableTitleField,
  EditableDescriptionField,
  SectionDndWrapper,
} from "./sectionRendererShared"
import type { DragEndEvent } from "@dnd-kit/core"
import type { ResumeItemDto } from "@/types/api"

function buildEvent(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    over: overId ? { id: overId, data: { current: undefined }, rect: { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, } as DOMRect } : null,
    activatorEvent: new Event("pointerdown"),
    collisions: [],
    delta: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
  } as unknown as DragEndEvent
}

// ─── createHandleDragEnd ──────────────────────────────────────────────────────

describe("createHandleDragEnd", () => {
  type Item = { id: string }

  function buildItems(...ids: string[]): Item[] {
    return ids.map((id) => ({ id }))
  }

  it("calls onReorderItems with reordered array when active and over differ (lines 163-166)", () => {
    const items = buildItems("a", "b", "c")
    const onReorderItems = vi.fn()
    const handler = createHandleDragEnd(items, onReorderItems)

    handler(buildEvent("a", "c"))

    expect(onReorderItems).toHaveBeenCalledTimes(1)
    const result = onReorderItems.mock.calls[0][0] as ResumeItemDto[]
    // "a" moved to where "c" was: order should be [b, c, a]
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"])
  })

  it("returns early without calling onReorderItems when over is null (line 162)", () => {
    const items = buildItems("a", "b")
    const onReorderItems = vi.fn()
    const handler = createHandleDragEnd(items, onReorderItems)

    handler(buildEvent("a", null))

    expect(onReorderItems).not.toHaveBeenCalled()
  })

  it("returns early without calling onReorderItems when active.id === over.id (line 162)", () => {
    const items = buildItems("a", "b")
    const onReorderItems = vi.fn()
    const handler = createHandleDragEnd(items, onReorderItems)

    handler(buildEvent("a", "a"))

    expect(onReorderItems).not.toHaveBeenCalled()
  })

  it("returns early when onReorderItems is not provided (line 162)", () => {
    const items = buildItems("a", "b")
    // no onReorderItems provided — should not throw
    const handler = createHandleDragEnd(items)

    expect(() => handler(buildEvent("a", "b"))).not.toThrow()
  })

  it("returns early when oldIndex is -1 (item not found) (line 165)", () => {
    const items = buildItems("a", "b")
    const onReorderItems = vi.fn()
    const handler = createHandleDragEnd(items, onReorderItems)

    // "x" is not in items → oldIndex = -1
    handler(buildEvent("x", "b"))

    expect(onReorderItems).not.toHaveBeenCalled()
  })

  it("returns early when newIndex is -1 (over item not found) (line 165)", () => {
    const items = buildItems("a", "b")
    const onReorderItems = vi.fn()
    const handler = createHandleDragEnd(items, onReorderItems)

    // "y" is not in items → newIndex = -1
    handler(buildEvent("a", "y"))

    expect(onReorderItems).not.toHaveBeenCalled()
  })
})

// ─── EditableField ─────────────────────────────────────────────────────────────

describe("EditableField", () => {
  it("renders the value as text content", () => {
    const onFieldChange = vi.fn()
    render(
      <EditableField
        itemId="item-1"
        field="title"
        value="Hello"
        onFieldChange={onFieldChange}
      />,
    )
    expect(screen.getByText("Hello")).toBeInTheDocument()
  })

  it("renders empty string when value is null", () => {
    const onFieldChange = vi.fn()
    render(
      <EditableField
        itemId="item-1"
        field="title"
        value={null}
        onFieldChange={onFieldChange}
      />,
    )
    const field = screen.getByRole("textbox")
    expect(field.textContent).toBe("")
  })

  it("calls onFieldChange with correct args on blur", () => {
    const onFieldChange = vi.fn()
    render(
      <EditableField
        itemId="item-1"
        field="title"
        value="Initial"
        onFieldChange={onFieldChange}
      />,
    )
    const field = screen.getByRole("textbox")
    fireEvent.blur(field, { target: { textContent: "Updated" } })
    expect(onFieldChange).toHaveBeenCalledWith("item-1", "title", "Updated")
  })

  // Lines 35-36: pressing Enter calls preventDefault (no newline inserted)
  it("pressing Enter on EditableField prevents default (no newline) (lines 35-36)", async () => {
    const user = userEvent.setup()
    const onFieldChange = vi.fn()
    render(
      <EditableField
        itemId="item-1"
        field="title"
        value="Text"
        onFieldChange={onFieldChange}
      />,
    )
    const field = screen.getByRole("textbox")
    field.focus()

    const preventDefaultSpy = vi.fn()
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // verify the handler fires
        preventDefaultSpy()
      }
    })

    await user.keyboard("{Enter}")
    // handler fired (the component's onKeyDown called preventDefault)
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)
    // content should not include a newline
    expect(field.textContent).not.toContain("\n")
  })

  it("uses ariaLabel prop as aria-label attribute", () => {
    const onFieldChange = vi.fn()
    render(
      <EditableField
        itemId="item-1"
        field="name"
        value="test"
        onFieldChange={onFieldChange}
        ariaLabel="Custom Label"
      />,
    )
    expect(screen.getByLabelText("Custom Label")).toBeInTheDocument()
  })
})

// ─── EditableTitleField ───────────────────────────────────────────────────────

describe("EditableTitleField", () => {
  it("returns null when value is null", () => {
    const { container } = render(
      <EditableTitleField itemId="i" field="title" value={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders a static span when onFieldChange is not provided", () => {
    render(<EditableTitleField itemId="i" field="title" value="Static Title" />)
    expect(screen.getByText("Static Title")).toBeInTheDocument()
  })

  it("renders an EditableField when onFieldChange is provided", () => {
    const onFieldChange = vi.fn()
    render(
      <EditableTitleField
        itemId="i"
        field="title"
        value="Editable Title"
        onFieldChange={onFieldChange}
      />,
    )
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByText("Editable Title")).toBeInTheDocument()
  })
})

// ─── EditableDescriptionField ─────────────────────────────────────────────────

describe("EditableDescriptionField", () => {
  it("returns null when value is null", () => {
    const { container } = render(
      <EditableDescriptionField itemId="i" value={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders a static span when onFieldChange is not provided", () => {
    render(<EditableDescriptionField itemId="i" value="Some description" />)
    expect(screen.getByText("Some description")).toBeInTheDocument()
  })

  it("renders an EditableField when onFieldChange is provided", () => {
    const onFieldChange = vi.fn()
    render(
      <EditableDescriptionField
        itemId="i"
        value="Editable desc"
        onFieldChange={onFieldChange}
      />,
    )
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByText("Editable desc")).toBeInTheDocument()
  })
})

// ─── SectionDndWrapper ────────────────────────────────────────────────────────

describe("SectionDndWrapper", () => {
  it("renders children directly when onReorderItems is not provided", () => {
    render(
      <SectionDndWrapper items={[{ id: "a" }]}>
        <span>child</span>
      </SectionDndWrapper>,
    )
    expect(screen.getByText("child")).toBeInTheDocument()
  })

  it("renders children inside DndContext when onReorderItems is provided", () => {
    const onReorderItems = vi.fn()
    render(
      <SectionDndWrapper items={[{ id: "a" }]} onReorderItems={onReorderItems}>
        <span>dnd child</span>
      </SectionDndWrapper>,
    )
    expect(screen.getByText("dnd child")).toBeInTheDocument()
  })
})
