import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useResumeStore } from "@/stores/useResumeStore"
import SectionsPanel from "./SectionsPanel"
import type { ResumeSectionDto, ResumeDto } from "@/types/api"

// ── DnD-kit stubs ─────────────────────────────────────────────────────────────
// jsdom does not implement the pointer / drag APIs required by @dnd-kit.
// We stub the two hooks used by SortableSectionRow so the component renders
// without errors and we can focus on the business logic (toggle, move up/down).

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/sortable")>()
  return {
    ...original,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => undefined,
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  }
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSection(
  sectionType: string,
  title: string,
  visible = true
): ResumeSectionDto {
  return {
    sectionType,
    title,
    visible,
    items: [],
  } as unknown as ResumeSectionDto
}

const defaultSections: ResumeSectionDto[] = [
  makeSection("WORK_EXPERIENCE", "Work Experience", true),
  makeSection("EDUCATION", "Education", true),
  makeSection("SKILLS", "Skills", false),
]

function buildResume(sections: ResumeSectionDto[] = defaultSections): ResumeDto {
  return {
    id: "resume-1",
    name: "Test Resume",
    templateId: null,
    content: { sections },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SectionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const resume = buildResume()
    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })
  })

  afterEach(() => {
    useResumeStore.setState({ currentResume: null, lastSavedDocument: null })
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  it("renders the collapsible trigger with label 'Sections'", () => {
    render(<SectionsPanel sections={defaultSections} />)
    expect(screen.getByText("Sections")).toBeInTheDocument()
  })

  it("renders section rows after opening the collapsible", () => {
    render(<SectionsPanel sections={defaultSections} />)
    fireEvent.click(screen.getByLabelText("Toggle sections panel"))
    expect(screen.getByText("Work Experience")).toBeInTheDocument()
    expect(screen.getByText("Education")).toBeInTheDocument()
    expect(screen.getByText("Skills")).toBeInTheDocument()
  })

  it("renders checkbox as checked for visible sections", () => {
    render(<SectionsPanel sections={defaultSections} />)
    fireEvent.click(screen.getByLabelText("Toggle sections panel"))

    const workCheckbox = screen.getByLabelText("Show Work Experience section")
    expect(workCheckbox).toBeChecked()
  })

  it("renders checkbox as unchecked for hidden sections", () => {
    render(<SectionsPanel sections={defaultSections} />)
    fireEvent.click(screen.getByLabelText("Toggle sections panel"))

    const skillsCheckbox = screen.getByLabelText("Show Skills section")
    expect(skillsCheckbox).not.toBeChecked()
  })

  // ── Toggle visibility ─────────────────────────────────────────────────────

  it("calls toggleSectionVisibility when a checkbox is clicked", () => {
    const toggleSectionVisibility = vi.fn()
    useResumeStore.setState({ toggleSectionVisibility } as never)

    render(<SectionsPanel sections={defaultSections} />)
    fireEvent.click(screen.getByLabelText("Toggle sections panel"))

    fireEvent.click(screen.getByLabelText("Show Work Experience section"))
    expect(toggleSectionVisibility).toHaveBeenCalledWith("WORK_EXPERIENCE")
  })

  // ── Reorder helpers ───────────────────────────────────────────────────────

  function renderWithReorder() {
    const reorderSections = vi.fn()
    useResumeStore.setState({ reorderSections } as never)
    render(<SectionsPanel sections={defaultSections} />)
    fireEvent.click(screen.getByLabelText("Toggle sections panel"))
    return { reorderSections }
  }

  // ── Reorder assertion helper ──────────────────────────────────────────────

  function assertSwappedToEducationFirst(reorderSections: ReturnType<typeof vi.fn>) {
    expect(reorderSections).toHaveBeenCalledOnce()
    const newOrder = reorderSections.mock.calls[0][0] as ResumeSectionDto[]
    expect(newOrder[0].sectionType).toBe("EDUCATION")
    expect(newOrder[1].sectionType).toBe("WORK_EXPERIENCE")
  }

  // ── Move up ───────────────────────────────────────────────────────────────

  it("calls reorderSections with new order when Move Up is clicked", () => {
    const { reorderSections } = renderWithReorder()

    // Move "Education" (index 1) up → should swap with "Work Experience" (index 0)
    fireEvent.click(screen.getByLabelText("Move Education up"))
    assertSwappedToEducationFirst(reorderSections)
  })

  it("does not call reorderSections when Move Up is clicked for the first section", () => {
    const { reorderSections } = renderWithReorder()

    // "Work Experience" is at index 0 — moving it up is a no-op
    fireEvent.click(screen.getByLabelText("Move Work Experience up"))
    expect(reorderSections).not.toHaveBeenCalled()
  })

  // ── Move down ─────────────────────────────────────────────────────────────

  it("calls reorderSections with new order when Move Down is clicked", () => {
    const { reorderSections } = renderWithReorder()

    // Move "Work Experience" (index 0) down → should swap with "Education" (index 1)
    fireEvent.click(screen.getByLabelText("Move Work Experience down"))
    assertSwappedToEducationFirst(reorderSections)
  })

  it("does not call reorderSections when Move Down is clicked for the last section", () => {
    const { reorderSections } = renderWithReorder()

    // "Skills" is the last section (index 2) — moving it down is a no-op
    fireEvent.click(screen.getByLabelText("Move Skills down"))
    expect(reorderSections).not.toHaveBeenCalled()
  })

  // ── Keyboard reorder (ArrowUp / ArrowDown) ────────────────────────────────

  it("moves section up on ArrowUp keydown on the move-up button", () => {
    const { reorderSections } = renderWithReorder()

    const moveUpBtn = screen.getByLabelText("Move Education up")
    fireEvent.keyDown(moveUpBtn, { key: "ArrowUp" })
    expect(reorderSections).toHaveBeenCalledOnce()
  })

  it("moves section down on ArrowDown keydown on the move-down button", () => {
    const { reorderSections } = renderWithReorder()

    const moveDownBtn = screen.getByLabelText("Move Work Experience down")
    fireEvent.keyDown(moveDownBtn, { key: "ArrowDown" })
    expect(reorderSections).toHaveBeenCalledOnce()
  })

  it("does not move on unrelated key press on the move-up button", () => {
    const { reorderSections } = renderWithReorder()

    const moveUpBtn = screen.getByLabelText("Move Education up")
    fireEvent.keyDown(moveUpBtn, { key: "Enter" })
    expect(reorderSections).not.toHaveBeenCalled()
  })

  // ── Empty sections list ───────────────────────────────────────────────────

  it("renders without errors when sections list is empty", () => {
    render(<SectionsPanel sections={[]} />)
    fireEvent.click(screen.getByLabelText("Toggle sections panel"))
    // No section rows should be present
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })
})
