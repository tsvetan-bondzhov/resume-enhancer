import { describe, it, expect, beforeEach } from "vitest"
import { useDiffStore } from "./useDiffStore"
import type { DiffEntry } from "./useDiffStore"

function buildDiff(overrides?: Partial<DiffEntry>): DiffEntry {
  return {
    id: "diff-1",
    sectionId: "WORK_EXPERIENCE",
    itemIndex: 0,
    field: "description",
    newValue: "New description",
    previousValue: "Old description",
    kind: "rewrite",
    state: "visible",
    ...overrides,
  }
}

describe("useDiffStore", () => {
  beforeEach(() => {
    useDiffStore.setState({ diffs: [] })
  })

  it("initial state has empty diffs array", () => {
    expect(useDiffStore.getState().diffs).toHaveLength(0)
  })

  it("addDiff appends an entry to the diffs array", () => {
    const diff = buildDiff()
    useDiffStore.getState().addDiff(diff)
    expect(useDiffStore.getState().diffs).toHaveLength(1)
    expect(useDiffStore.getState().diffs[0]).toEqual(diff)
  })

  it("addDiff appends multiple diffs in order", () => {
    const diff1 = buildDiff({ id: "diff-1", newValue: "First" })
    const diff2 = buildDiff({ id: "diff-2", newValue: "Second" })
    useDiffStore.getState().addDiff(diff1)
    useDiffStore.getState().addDiff(diff2)
    const { diffs } = useDiffStore.getState()
    expect(diffs).toHaveLength(2)
    expect(diffs[0].id).toBe("diff-1")
    expect(diffs[1].id).toBe("diff-2")
  })

  it("acceptDiff sets state to hidden for matching id", () => {
    const diff = buildDiff({ id: "diff-1", state: "visible" })
    useDiffStore.getState().addDiff(diff)
    useDiffStore.getState().acceptDiff("diff-1")
    expect(useDiffStore.getState().diffs[0].state).toBe("hidden")
  })

  it("acceptDiff does not change other diffs", () => {
    const diff1 = buildDiff({ id: "diff-1", state: "visible" })
    const diff2 = buildDiff({ id: "diff-2", state: "visible" })
    useDiffStore.getState().addDiff(diff1)
    useDiffStore.getState().addDiff(diff2)
    useDiffStore.getState().acceptDiff("diff-1")
    expect(useDiffStore.getState().diffs[1].state).toBe("visible")
  })

  it("rejectDiff sets state to hidden for matching id", () => {
    const diff = buildDiff({ id: "diff-1", state: "visible" })
    useDiffStore.getState().addDiff(diff)
    useDiffStore.getState().rejectDiff("diff-1")
    expect(useDiffStore.getState().diffs[0].state).toBe("hidden")
  })

  it("rejectDiff does not change other diffs", () => {
    const diff1 = buildDiff({ id: "diff-1", state: "visible" })
    const diff2 = buildDiff({ id: "diff-2", state: "visible" })
    useDiffStore.getState().addDiff(diff1)
    useDiffStore.getState().addDiff(diff2)
    useDiffStore.getState().rejectDiff("diff-2")
    expect(useDiffStore.getState().diffs[0].state).toBe("visible")
  })

  it("clearAll empties the diffs array", () => {
    useDiffStore.getState().addDiff(buildDiff({ id: "diff-1" }))
    useDiffStore.getState().addDiff(buildDiff({ id: "diff-2" }))
    useDiffStore.getState().clearAll()
    expect(useDiffStore.getState().diffs).toHaveLength(0)
  })

  it("addDiff supports addition kind", () => {
    const diff = buildDiff({ kind: "addition", previousValue: "" })
    useDiffStore.getState().addDiff(diff)
    expect(useDiffStore.getState().diffs[0].kind).toBe("addition")
  })
})
