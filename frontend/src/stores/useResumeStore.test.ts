import { describe, it, expect, beforeEach } from "vitest"
import { useResumeStore } from "./useResumeStore"
import type { ResumeDto, ResumeSectionDto, WorkExperienceItemDto } from "@/types/api"

function buildItem(id: string): WorkExperienceItemDto {
  return {
    type: "WORK_EXPERIENCE",
    id,
    jobTitle: "Dev",
    company: "Acme",
    startDate: null,
    endDate: null,
    isCurrent: false,
    description: null,
  }
}

function buildSection(items = [buildItem("i1"), buildItem("i2")]): ResumeSectionDto {
  return { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items }
}

function buildResume(section = buildSection()): ResumeDto {
  return {
    id: "r1",
    name: "Resume",
    templateId: null,
    content: { sections: [section] },
    isTailored: false,
    createdAt: "",
    updatedAt: "",
  }
}

describe("useResumeStore — addItem", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("inserts at position 0 — existing items shift to index 1 and 2", () => {
    useResumeStore.getState().addItem("WORK_EXPERIENCE", 0)
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(items).toHaveLength(3)
    expect(items[1].id).toBe("i1")
    expect(items[2].id).toBe("i2")
  })

  it("inserts between existing items at position 1", () => {
    useResumeStore.getState().addItem("WORK_EXPERIENCE", 1)
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(items).toHaveLength(3)
    expect(items[0].id).toBe("i1")
    expect(items[2].id).toBe("i2")
  })

  it("appends at position items.length", () => {
    useResumeStore.getState().addItem("WORK_EXPERIENCE", 2)
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(items).toHaveLength(3)
    expect(items[0].id).toBe("i1")
    expect(items[1].id).toBe("i2")
  })

  it("new item has a non-empty string id", () => {
    useResumeStore.getState().addItem("WORK_EXPERIENCE", 0)
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(typeof items[0].id).toBe("string")
    expect(items[0].id.length).toBeGreaterThan(0)
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() => useResumeStore.getState().addItem("WORK_EXPERIENCE", 0)).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})

describe("useResumeStore — deleteItem", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("removes item by id; remaining items order preserved", () => {
    useResumeStore.getState().deleteItem("WORK_EXPERIENCE", "i1")
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("i2")
  })

  it("is a no-op when id does not exist (items array unchanged)", () => {
    useResumeStore.getState().deleteItem("WORK_EXPERIENCE", "non-existent")
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(items).toHaveLength(2)
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() => useResumeStore.getState().deleteItem("WORK_EXPERIENCE", "i1")).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})

describe("useResumeStore — reorderItems", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("replaces items array with new order", () => {
    const newOrder = [buildItem("i2"), buildItem("i1")]
    useResumeStore.getState().reorderItems("WORK_EXPERIENCE", newOrder)
    const items = useResumeStore.getState().currentResume!.content.sections[0].items
    expect(items[0].id).toBe("i2")
    expect(items[1].id).toBe("i1")
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    const newOrder = [buildItem("i2"), buildItem("i1")]
    expect(() => useResumeStore.getState().reorderItems("WORK_EXPERIENCE", newOrder)).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})
