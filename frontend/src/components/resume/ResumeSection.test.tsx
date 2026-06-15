import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { useResumeStore } from "@/stores/useResumeStore"
import { useAutosave } from "@/hooks/useAutosave"
import { apiClient } from "@/lib/apiClient"
import ResumeSection from "./ResumeSection"
import type { ResumeSectionDto, ResumeDto, WorkExperienceItemDto, SummaryItemDto, GenericItemDto } from "@/types/api"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

function buildWorkExperienceItem(overrides?: Partial<WorkExperienceItemDto>): WorkExperienceItemDto {
  return {
    type: "WORK_EXPERIENCE",
    id: "item-1",
    jobTitle: "Engineer",
    company: "Acme Corp",
    startDate: null,
    endDate: null,
    isCurrent: false,
    description: null,
    ...overrides,
  }
}

function buildSection(overrides?: Partial<ResumeSectionDto>): ResumeSectionDto {
  return {
    sectionType: "WORK_EXPERIENCE",
    title: "Work Experience",
    visible: true,
    items: [buildWorkExperienceItem()],
    ...overrides,
  }
}

function buildResumeWithSection(
  section: ResumeSectionDto = buildSection()
): ResumeDto {
  return {
    id: "resume-1",
    name: "Test Resume",
    templateId: null,
    content: { sections: [section] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe("ResumeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    useResumeStore.setState({ currentResume: null, lastSavedDocument: null })
  })

  it("editing a field dispatches onFieldChange callback", () => {
    const section = buildSection()
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    const field = screen.getByText("Engineer")
    fireEvent.blur(field, { target: { textContent: "Senior Engineer" } })

    expect(onFieldChange).toHaveBeenCalledWith(
      "item-1",
      "jobTitle",
      "Senior Engineer"
    )
  })

  it("editing the section title dispatches onTitleChange callback", () => {
    const section = buildSection()
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    const title = screen.getByRole("heading", { name: /work experience/i })
    fireEvent.blur(title, { target: { textContent: "Professional Experience" } })

    expect(onTitleChange).toHaveBeenCalledWith("Professional Experience")
  })

  it("renders section title and item fields", () => {
    const section = buildSection()
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    expect(
      screen.getByRole("heading", { name: /edit section title/i })
    ).toBeInTheDocument()
    expect(screen.getByText("Engineer")).toBeInTheDocument()
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
  })

  it("does not render items with empty field values", () => {
    const section = buildSection({
      items: [
        buildWorkExperienceItem({ id: "item-empty", jobTitle: null, company: "Only Company" }),
      ],
    })
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    expect(screen.getByText("Only Company")).toBeInTheDocument()
    // Null jobTitle should not be rendered
    expect(screen.queryByText("jobTitle")).not.toBeInTheDocument()
  })

  // ─── AC7: store + autosave lifecycle integration ──────────────────────────

  function renderWithStoreCallbacks(section: ResumeSectionDto, resume: ReturnType<typeof buildResumeWithSection>) {
    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })
    render(
      <ResumeSection
        section={section}
        onTitleChange={(title) =>
          useResumeStore.getState().updateSectionTitle(section.sectionType, title)
        }
        onFieldChange={(itemId, field, value) =>
          useResumeStore.getState().updateItemField(section.sectionType, itemId, field, value)
        }
      />
    )
  }

  it("onFieldChange wired to updateItemField mutates useResumeStore state", () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)
    renderWithStoreCallbacks(section, resume)

    const field = screen.getByText("Engineer")
    fireEvent.blur(field, { target: { textContent: "Senior Engineer" } })

    const updatedItem =
      useResumeStore.getState().currentResume?.content.sections[0].items[0]
    // After updateItemField with { ...item, [field]: value }, the field is set at top level
    expect((updatedItem as WorkExperienceItemDto).jobTitle).toBe("Senior Engineer")
  })

  it("onTitleChange wired to updateSectionTitle mutates useResumeStore state", () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)
    renderWithStoreCallbacks(section, resume)

    const heading = screen.getByRole("heading", { name: /work experience/i })
    fireEvent.blur(heading, { target: { textContent: "Professional Experience" } })

    const updatedTitle =
      useResumeStore.getState().currentResume?.content.sections[0].title
    expect(updatedTitle).toBe("Professional Experience")
  })

  it("debounced PUT fires 500ms after a field edit via useAutosave", async () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)
    const updatedResume: ResumeDto = {
      ...resume,
      content: {
        sections: [
          {
            ...section,
            items: [buildWorkExperienceItem({ jobTitle: "Senior Engineer" })],
          },
        ],
      },
    }

    vi.mocked(apiClient.put).mockResolvedValue(updatedResume)

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    renderHook(() => useAutosave(resume.id))

    // Simulate a field change via store action (makes content differ from lastSaved)
    act(() => {
      useResumeStore
        .getState()
        .updateItemField(section.sectionType, "item-1", "jobTitle", "Senior Engineer")
    })

    // Before 500ms elapses, PUT should not have been called
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(apiClient.put).not.toHaveBeenCalled()

    // Advance past the 500ms debounce to trigger the PUT
    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    // Let the resolved promise settle
    await act(async () => {
      await Promise.resolve()
    })

    expect(apiClient.put).toHaveBeenCalledWith(
      `/api/v1/resumes/${resume.id}`,
      expect.objectContaining({ name: resume.name })
    )
  })

  it("on PUT failure, useAutosave reverts store to lastSavedDocument", async () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)

    vi.mocked(apiClient.put).mockRejectedValue(new Error("Network error"))

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    renderHook(() => useAutosave(resume.id))

    // Simulate a field change via store action (makes content differ from lastSaved)
    act(() => {
      useResumeStore
        .getState()
        .updateItemField(section.sectionType, "item-1", "jobTitle", "Changed Title")
    })

    // Advance past the 500ms debounce to trigger the PUT
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    // Let the rejected promise settle
    await act(async () => {
      await Promise.resolve()
    })

    // Store should have reverted to the original field value
    const revertedItem =
      useResumeStore.getState().currentResume?.content.sections[0].items[0]
    expect((revertedItem as WorkExperienceItemDto).jobTitle).toBe("Engineer")
  })

  // ─── AC5: sectionType-based routing dispatch ─────────────────────────────

  it("sectionType WORK_EXPERIENCE dispatches to WorkExperienceSectionRenderer", () => {
    const section = buildSection({ sectionType: "WORK_EXPERIENCE" })
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    // WorkExperienceSectionRenderer renders jobTitle with font-semibold <p>
    const jobTitleEl = screen.getByText("Engineer")
    expect(jobTitleEl.closest("p")).toHaveClass("font-semibold")
  })

  it("sectionType SUMMARY dispatches to SummarySectionRenderer (textbox div)", () => {
    const summaryItem: SummaryItemDto = {
      type: "SUMMARY",
      id: "summary-1",
      text: "A brief professional summary.",
    }
    const section: ResumeSectionDto = {
      sectionType: "SUMMARY",
      title: "Summary",
      visible: true,
      items: [summaryItem],
    }
    const { container } = render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    // SummarySectionRenderer renders the text in a div[role="textbox"] (ARIA-compliant; <p> is not
    // a valid host for role="textbox" per ARIA-in-HTML spec)
    const textboxes = container.querySelectorAll("div[role='textbox']")
    expect(textboxes).toHaveLength(1)
    expect(textboxes[0]).toHaveTextContent("A brief professional summary.")
  })

  it("sectionType UNKNOWN dispatches to GenericSectionRenderer (ul/li list)", () => {
    const genericItem: GenericItemDto = {
      type: "UNKNOWN",
      id: "generic-1",
      fields: { skill: "TypeScript", tool: "Vite" },
    }
    const section: ResumeSectionDto = {
      sectionType: "UNKNOWN",
      title: "Other",
      visible: true,
      items: [genericItem],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("TypeScript")).toBeInTheDocument()
    expect(screen.getByText("Vite")).toBeInTheDocument()
  })
})
