import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { useResumeStore } from "@/stores/useResumeStore"
import { useAutosave } from "@/hooks/useAutosave"
import { apiClient } from "@/lib/apiClient"
import ResumeSection from "./ResumeSection"
import type {
  ResumeSectionDto,
  ResumeDto,
  WorkExperienceItemDto,
  SummaryItemDto,
  GenericItemDto,
  EducationItemDto,
  SkillItemDto,
  CertificationItemDto,
  LanguageItemDto,
  ProjectItemDto,
  VolunteeringItemDto,
} from "@/types/api"

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
      linkedInUrl: null,
      personalPageUrl: null,
      blogUrl: null,
      contactEmail: null,
      locationCountry: null,
      locationCity: null,
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

  // ─── Additional section type dispatches ──────────────────────────────────

  it("sectionType EDUCATION dispatches to EducationSectionRenderer", () => {
    const item: EducationItemDto = {
      type: "EDUCATION",
      id: "edu-1",
      institution: "MIT",
      degree: "B.Sc.",
      fieldOfStudy: "Computer Science",
      startDate: "2018-09-01",
      endDate: "2022-06-01",
    }
    const section: ResumeSectionDto = {
      sectionType: "EDUCATION",
      title: "Education",
      visible: true,
      items: [item],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("MIT")).toBeInTheDocument()
  })

  it("sectionType SKILLS dispatches to SkillsSectionRenderer", () => {
    const item: SkillItemDto = {
      type: "SKILLS",
      id: "skill-1",
      name: "TypeScript",
    }
    const section: ResumeSectionDto = {
      sectionType: "SKILLS",
      title: "Skills",
      visible: true,
      items: [item],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("TypeScript")).toBeInTheDocument()
  })

  it("sectionType CERTIFICATIONS dispatches to CertificationsSectionRenderer", () => {
    const item: CertificationItemDto = {
      type: "CERTIFICATIONS",
      id: "cert-1",
      name: "AWS Certified",
      issuer: "Amazon",
      issueDate: "2023-01-01",
      expirationDate: null,
    }
    const section: ResumeSectionDto = {
      sectionType: "CERTIFICATIONS",
      title: "Certifications",
      visible: true,
      items: [item],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("AWS Certified")).toBeInTheDocument()
  })

  it("sectionType LANGUAGES dispatches to LanguagesSectionRenderer", () => {
    const item: LanguageItemDto = {
      type: "LANGUAGES",
      id: "lang-1",
      language: "English",
      proficiency: "Native",
    }
    const section: ResumeSectionDto = {
      sectionType: "LANGUAGES",
      title: "Languages",
      visible: true,
      items: [item],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("English")).toBeInTheDocument()
  })

  it("sectionType PROJECTS dispatches to ProjectsSectionRenderer", () => {
    const item: ProjectItemDto = {
      type: "PROJECTS",
      id: "proj-1",
      name: "My Portfolio",
      description: "A personal site",
      technologies: "React",
      link: null,
      startDate: "2022-01-01",
      endDate: "2022-06-01",
      isCurrent: false,
    }
    const section: ResumeSectionDto = {
      sectionType: "PROJECTS",
      title: "Projects",
      visible: true,
      items: [item],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("My Portfolio")).toBeInTheDocument()
  })

  it("sectionType VOLUNTEERING dispatches to VolunteeringSectionRenderer", () => {
    const item: VolunteeringItemDto = {
      type: "VOLUNTEERING",
      id: "vol-1",
      role: "Mentor",
      organization: "Code Club",
      description: null,
      startDate: "2021-01-01",
      endDate: "2022-06-01",
      isCurrent: false,
    }
    const section: ResumeSectionDto = {
      sectionType: "VOLUNTEERING",
      title: "Volunteering",
      visible: true,
      items: [item],
    }
    render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    expect(screen.getByText("Mentor")).toBeInTheDocument()
  })

  it("renders title heading with contentEditable regardless of onTitleChange", () => {
    const section = buildSection()
    const { container } = render(
      <ResumeSection
        section={section}
        onTitleChange={undefined as unknown as (title: string) => void}
        onFieldChange={vi.fn()}
      />
    )
    // The heading always has contentEditable — onTitleChange is called optionally via ?.()
    const heading = container.querySelector("h2")
    expect(heading).toBeInTheDocument()
    expect(heading?.getAttribute("contenteditable")).toBe("true")
  })

  // ─── handleTitleFocus / handleTitleBlur edge cases ───────────────────────

  it("handleTitleFocus clears placeholder text when section title is empty", () => {
    // Build a section with no title — isTitleEmpty=true means onFocus=handleTitleFocus
    const section = buildSection({ title: "" })
    const { container } = render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    const heading = container.querySelector("h2")!
    // The heading should show the placeholder text before focus
    expect(heading.textContent).toBe("Click to add section title")

    // Simulate focus — heading.textContent matches SECTION_TITLE_PLACEHOLDER so it clears
    fireEvent.focus(heading)

    // After focus the placeholder text should have been cleared
    expect(heading.textContent).toBe("")
  })

  it("handleTitleBlur restores placeholder when blurred with empty text", () => {
    const section = buildSection({ title: "" })
    const onTitleChange = vi.fn()
    const { container } = render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={vi.fn()}
      />
    )
    const heading = container.querySelector("h2")!

    // Blur with empty text — handler calls onTitleChange and restores placeholder styles
    fireEvent.blur(heading, { target: { textContent: "" } })

    // onTitleChange is called with empty string
    expect(onTitleChange).toHaveBeenCalledWith("")
    // After blur with empty content, the heading's class list gains the placeholder classes
    expect(heading.classList.contains("text-gray-300")).toBe(true)
    expect(heading.classList.contains("italic")).toBe(true)
  })

  it("handleTitleFocus is NOT attached when section title is non-empty", () => {
    // When isTitleEmpty=false, onFocus is undefined — focusing should not clear the text
    const section = buildSection({ title: "Work Experience" })
    const { container } = render(
      <ResumeSection
        section={section}
        onTitleChange={vi.fn()}
        onFieldChange={vi.fn()}
      />
    )
    const heading = container.querySelector("h2")!
    expect(heading.textContent).toBe("Work Experience")

    // Fire focus — should not mutate the text since onFocus is undefined
    fireEvent.focus(heading)

    expect(heading.textContent).toBe("Work Experience")
  })

  it("handleTitleBlur calls onTitleChange with the non-empty blurred text", () => {
    const section = buildSection({ title: "" })
    const onTitleChange = vi.fn()
    const { container } = render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={vi.fn()}
      />
    )
    const heading = container.querySelector("h2")!

    fireEvent.blur(heading, { target: { textContent: "New Title" } })

    // Non-empty text — onTitleChange should be called but placeholder should NOT be restored
    expect(onTitleChange).toHaveBeenCalledWith("New Title")
    // Heading should NOT be set to placeholder when text is non-empty
    expect(heading.textContent).not.toBe("Click to add section title")
  })
})
