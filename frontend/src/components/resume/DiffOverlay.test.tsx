import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useDiffStore } from "@/stores/useDiffStore"
import type { DiffEntry } from "@/stores/useDiffStore"
import DiffOverlay from "./DiffOverlay"

// Mock useResumeStore — capture applyPatch calls
const mockApplyPatch = vi.fn()
vi.mock("@/stores/useResumeStore", () => ({
  useResumeStore: (selector: (state: { applyPatch: typeof mockApplyPatch }) => unknown) =>
    selector({ applyPatch: mockApplyPatch }),
}))

function buildDiff(overrides?: Partial<DiffEntry>): DiffEntry {
  return {
    id: "diff-1",
    sectionId: "WORK_EXPERIENCE",
    itemIndex: 0,
    field: "description",
    newValue: "Improved description",
    previousValue: "Old description",
    kind: "rewrite",
    state: "visible",
    ...overrides,
  }
}

describe("DiffOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDiffStore.setState({ diffs: [] })
  })

  it("renders nothing when there are no diffs for the section", () => {
    const { container } = render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when diffs are present but for a different section", () => {
    useDiffStore.setState({
      diffs: [buildDiff({ sectionId: "EDUCATION" })],
    })
    const { container } = render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when all diffs for the section are hidden", () => {
    useDiffStore.setState({
      diffs: [buildDiff({ state: "hidden" })],
    })
    const { container } = render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(container.firstChild).toBeNull()
  })

  it("renders a DiffHighlight for each visible diff in the section", () => {
    useDiffStore.setState({
      diffs: [
        buildDiff({ id: "diff-1", newValue: "First change" }),
        buildDiff({ id: "diff-2", newValue: "Second change" }),
      ],
    })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(screen.getByText("First change")).toBeInTheDocument()
    expect(screen.getByText("Second change")).toBeInTheDocument()
  })

  it("renders faded diffs (state=faded) as well", () => {
    useDiffStore.setState({
      diffs: [buildDiff({ state: "faded", newValue: "Faded content" })],
    })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(screen.getByText("Faded content")).toBeInTheDocument()
  })

  it("clicking Accept calls acceptDiff with the diff id", () => {
    useDiffStore.setState({ diffs: [buildDiff({ id: "diff-abc" })] })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    fireEvent.click(screen.getByRole("button", { name: /accept ai change/i }))
    expect(useDiffStore.getState().diffs[0].state).toBe("hidden")
  })

  it("clicking Reject calls applyPatch with previousValue and rejectDiff", () => {
    const diff = buildDiff({
      id: "diff-abc",
      sectionId: "WORK_EXPERIENCE",
      itemIndex: 1,
      field: "description",
      newValue: "New",
      previousValue: "Old",
    })
    useDiffStore.setState({ diffs: [diff] })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    fireEvent.click(screen.getByRole("button", { name: /reject ai change/i }))
    expect(mockApplyPatch).toHaveBeenCalledWith({
      sectionId: "WORK_EXPERIENCE",
      itemIndex: 1,
      field: "description",
      newValue: "Old",
    })
    expect(useDiffStore.getState().diffs[0].state).toBe("hidden")
  })

  it("renders addition kind diff with correct aria-label", () => {
    useDiffStore.setState({
      diffs: [buildDiff({ kind: "addition", newValue: "New bullet point" })],
    })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(screen.getByRole("mark", { name: /ai addition/i })).toBeInTheDocument()
  })

  it("renders rewrite kind diff with correct aria-label", () => {
    useDiffStore.setState({
      diffs: [buildDiff({ kind: "rewrite", newValue: "Rewritten text" })],
    })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(screen.getByRole("mark", { name: /ai rewrite/i })).toBeInTheDocument()
  })

  it("only shows diffs matching the given sectionId", () => {
    useDiffStore.setState({
      diffs: [
        buildDiff({ id: "diff-1", sectionId: "WORK_EXPERIENCE", newValue: "Work content" }),
        buildDiff({ id: "diff-2", sectionId: "EDUCATION", newValue: "Education content" }),
      ],
    })
    render(<DiffOverlay sectionId="WORK_EXPERIENCE" />)
    expect(screen.getByText("Work content")).toBeInTheDocument()
    expect(screen.queryByText("Education content")).not.toBeInTheDocument()
  })
})
