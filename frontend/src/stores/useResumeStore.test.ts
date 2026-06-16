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

  it("does not modify sections of different sectionType (branch line 209)", () => {
    const educationSection: ResumeSectionDto = {
      sectionType: "EDUCATION",
      title: "Education",
      visible: true,
      items: [],
    }
    const resume = buildResume(buildSection())
    resume.content.sections.push(educationSection)
    useResumeStore.setState({ currentResume: resume })
    const newOrder = [buildItem("i2"), buildItem("i1")]
    useResumeStore.getState().reorderItems("WORK_EXPERIENCE", newOrder)
    const eduItems = useResumeStore.getState().currentResume!.content.sections.find(
      (s) => s.sectionType === "EDUCATION"
    )!.items
    expect(eduItems).toHaveLength(0)
  })
})

describe("useResumeStore — setSaving / setExporting (lines 75-76)", () => {
  beforeEach(() => {
    useResumeStore.setState({ isSaving: false, isExporting: false })
  })

  it("setSaving sets isSaving to true", () => {
    useResumeStore.getState().setSaving(true)
    expect(useResumeStore.getState().isSaving).toBe(true)
  })

  it("setSaving sets isSaving to false", () => {
    useResumeStore.setState({ isSaving: true })
    useResumeStore.getState().setSaving(false)
    expect(useResumeStore.getState().isSaving).toBe(false)
  })

  it("setExporting sets isExporting to true", () => {
    useResumeStore.getState().setExporting(true)
    expect(useResumeStore.getState().isExporting).toBe(true)
  })

  it("setExporting sets isExporting to false", () => {
    useResumeStore.setState({ isExporting: true })
    useResumeStore.getState().setExporting(false)
    expect(useResumeStore.getState().isExporting).toBe(false)
  })
})

describe("useResumeStore — toggleSectionVisibility (lines 112-121)", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("toggles visible from true to false for the matching section", () => {
    useResumeStore.getState().toggleSectionVisibility("WORK_EXPERIENCE")
    const section = useResumeStore.getState().currentResume!.content.sections[0]
    expect(section.visible).toBe(false)
  })

  it("toggles visible from false to true for the matching section", () => {
    useResumeStore.setState({
      currentResume: buildResume(buildSection([buildItem("i1")])),
    })
    // Force it to false first
    useResumeStore.getState().toggleSectionVisibility("WORK_EXPERIENCE")
    useResumeStore.getState().toggleSectionVisibility("WORK_EXPERIENCE")
    const section = useResumeStore.getState().currentResume!.content.sections[0]
    expect(section.visible).toBe(true)
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() => useResumeStore.getState().toggleSectionVisibility("WORK_EXPERIENCE")).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })

  it("does not toggle sections of a different sectionType (branch)", () => {
    const educationSection: ResumeSectionDto = {
      sectionType: "EDUCATION",
      title: "Education",
      visible: true,
      items: [],
    }
    const resume = buildResume(buildSection())
    resume.content.sections.push(educationSection)
    useResumeStore.setState({ currentResume: resume })
    useResumeStore.getState().toggleSectionVisibility("WORK_EXPERIENCE")
    const eduSection = useResumeStore.getState().currentResume!.content.sections.find(
      (s) => s.sectionType === "EDUCATION"
    )!
    expect(eduSection.visible).toBe(true)
  })
})

describe("useResumeStore — reorderSections (lines 128-130)", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("replaces content.sections with new array", () => {
    const educationSection: ResumeSectionDto = {
      sectionType: "EDUCATION",
      title: "Education",
      visible: true,
      items: [],
    }
    const newSections = [educationSection, buildSection()]
    useResumeStore.getState().reorderSections(newSections)
    const sections = useResumeStore.getState().currentResume!.content.sections
    expect(sections[0].sectionType).toBe("EDUCATION")
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() => useResumeStore.getState().reorderSections([])).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})

describe("useResumeStore — updateResumeName (lines 139-141)", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("updates name on currentResume", () => {
    useResumeStore.getState().updateResumeName("Updated Name")
    expect(useResumeStore.getState().currentResume?.name).toBe("Updated Name")
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() => useResumeStore.getState().updateResumeName("New Name")).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})

describe("useResumeStore — setCurrentResumeTemplateId (lines 146-148)", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("sets templateId on currentResume", () => {
    useResumeStore.getState().setCurrentResumeTemplateId("template-abc")
    expect(useResumeStore.getState().currentResume?.templateId).toBe("template-abc")
  })

  it("sets templateId to null on currentResume", () => {
    useResumeStore.setState({
      currentResume: { ...buildResume(), templateId: "old-template" },
    })
    useResumeStore.getState().setCurrentResumeTemplateId(null)
    expect(useResumeStore.getState().currentResume?.templateId).toBeNull()
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() => useResumeStore.getState().setCurrentResumeTemplateId("template-abc")).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})

describe("useResumeStore — updateItemField guard (lines 95-97)", () => {
  beforeEach(() => {
    useResumeStore.setState({ currentResume: buildResume() })
  })

  it("does not mutate state when field is 'type'", () => {
    const before = useResumeStore.getState().currentResume!.content.sections[0].items[0]
    useResumeStore.getState().updateItemField("WORK_EXPERIENCE", "i1", "type", "OTHER")
    const after = useResumeStore.getState().currentResume!.content.sections[0].items[0]
    expect(after).toStrictEqual(before)
  })

  it("does not mutate state when field is 'id'", () => {
    const before = useResumeStore.getState().currentResume!.content.sections[0].items[0]
    useResumeStore.getState().updateItemField("WORK_EXPERIENCE", "i1", "id", "hacked-id")
    const after = useResumeStore.getState().currentResume!.content.sections[0].items[0]
    expect(after).toStrictEqual(before)
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() =>
      useResumeStore.getState().updateItemField("WORK_EXPERIENCE", "i1", "jobTitle", "Dev")
    ).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})

describe("useResumeStore — updateSectionTitle (line 79, 87)", () => {
  beforeEach(() => {
    const educationSection: ResumeSectionDto = {
      sectionType: "EDUCATION",
      title: "Education",
      visible: true,
      items: [],
    }
    const resume = buildResume(buildSection())
    resume.content.sections.push(educationSection)
    useResumeStore.setState({ currentResume: resume })
  })

  it("updates title for matching section only", () => {
    useResumeStore.getState().updateSectionTitle("WORK_EXPERIENCE", "Professional Experience")
    const sections = useResumeStore.getState().currentResume!.content.sections
    expect(sections.find((s) => s.sectionType === "WORK_EXPERIENCE")?.title).toBe("Professional Experience")
    // Education section title should be unchanged
    expect(sections.find((s) => s.sectionType === "EDUCATION")?.title).toBe("Education")
  })

  it("is a no-op when currentResume is null", () => {
    useResumeStore.setState({ currentResume: null })
    expect(() =>
      useResumeStore.getState().updateSectionTitle("WORK_EXPERIENCE", "Work")
    ).not.toThrow()
    expect(useResumeStore.getState().currentResume).toBeNull()
  })
})
