import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { useProfileStore } from "@/stores/useProfileStore"
import type { ProfileUpdateRequest, ProfileDto } from "@/types/api"
import ExperienceStep from "./ExperienceStep"
import EducationStep from "./EducationStep"
import SkillsStep from "./SkillsStep"
import SummaryStep from "./SummaryStep"
import CertificationsStep from "./CertificationsStep"
import LanguagesStep from "./LanguagesStep"
import ProjectsStep from "./ProjectsStep"
import VolunteeringStep from "./VolunteeringStep"

// ── Test helpers ────────────────────────────────────────────────────────────

async function testAddAnotherAppendsEntry(
  Component: React.ComponentType<{ onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void> }>,
  placeholder: string,
) {
  const user = userEvent.setup()
  const onSaveAndContinue = vi.fn()

  render(<Component onSaveAndContinue={onSaveAndContinue} />)

  const initialInputs = screen.getAllByPlaceholderText(placeholder)
  expect(initialInputs).toHaveLength(1)

  const addButton = screen.getByRole("button", { name: /add another/i })
  await user.click(addButton)

  await waitFor(() => {
    const updatedInputs = screen.getAllByPlaceholderText(placeholder)
    expect(updatedInputs).toHaveLength(2)
  })
}

async function testEmptySubmitDoesNotCall(
  Component: React.ComponentType<{ onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void> }>,
  errorText: string,
  beforeSubmit?: (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
) {
  const user = userEvent.setup()
  const onSaveAndContinue = vi.fn()

  render(<Component onSaveAndContinue={onSaveAndContinue} />)

  if (beforeSubmit) {
    await beforeSubmit(user)
  }

  const saveButton = screen.getByRole("button", { name: /save & continue/i })
  await user.click(saveButton)

  expect(onSaveAndContinue).not.toHaveBeenCalled()

  await waitFor(() => {
    expect(screen.getByText(errorText)).toBeInTheDocument()
  })
}

// ────────────────────────────────────────────────────────────────────────────

// Mock apiClient
vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({
      summary: null,
      linkedInUrl: null,
      personalPageUrl: null,
      blogUrl: null,
      contactEmail: null,
      locationCountry: null,
      locationCity: null,
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    }),
    get: vi.fn().mockResolvedValue({
      summary: null,
      linkedInUrl: null,
      personalPageUrl: null,
      blogUrl: null,
      contactEmail: null,
      locationCountry: null,
      locationCity: null,
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    }),
  },
}))

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function resetProfileStore() {
  useProfileStore.setState({
    profile: {
      summary: null,
      linkedInUrl: null,
      personalPageUrl: null,
      blogUrl: null,
      contactEmail: null,
      locationCountry: null,
      locationCity: null,
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    } satisfies ProfileDto,
    isSaving: false,
    isLoading: false,
    error: null,
    currentStep: 0,
    hasStarted: false,
  })
}

describe("ExperienceStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("Test 1: blur on empty jobTitle renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ExperienceStep onSaveAndContinue={onSaveAndContinue} />)

    const jobTitleInput = screen.getByPlaceholderText("e.g. Software Engineer")
    await user.click(jobTitleInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Job title is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("Test 2: clicking 'Add another' appends a new entry (jobTitle input count increases by 1)", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ExperienceStep onSaveAndContinue={onSaveAndContinue} />)

    const initialInputs = screen.getAllByPlaceholderText(
      "e.g. Software Engineer",
    )
    expect(initialInputs).toHaveLength(1)

    const addButton = screen.getByRole("button", { name: /add another/i })
    await user.click(addButton)

    await waitFor(() => {
      const updatedInputs = screen.getAllByPlaceholderText(
        "e.g. Software Engineer",
      )
      expect(updatedInputs).toHaveLength(2)
    })
  })

  it("Test 3: filling a valid experience entry and clicking Save & Continue calls apiClient.put with correct payload shape", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<ExperienceStep onSaveAndContinue={onSaveAndContinue} />)

    // Fill required fields
    const jobTitleInput = screen.getByPlaceholderText("e.g. Software Engineer")
    await user.type(jobTitleInput, "Frontend Developer")

    const companyInput = screen.getByPlaceholderText("e.g. Acme Corp")
    await user.type(companyInput, "Tech Startup Inc")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.workExperiences).toBeDefined()
    expect(capturedPayload.current?.workExperiences![0].jobTitle).toBe(
      "Frontend Developer",
    )
    expect(capturedPayload.current?.workExperiences![0].company).toBe(
      "Tech Startup Inc",
    )
  })

  it("does not call onSaveAndContinue when required fields are empty on submit", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ExperienceStep onSaveAndContinue={onSaveAndContinue} />)

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    expect(onSaveAndContinue).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText("Job title is required")).toBeInTheDocument()
      expect(screen.getByText("Company is required")).toBeInTheDocument()
    })
  })
})

describe("EducationStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("blur on empty institution renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<EducationStep onSaveAndContinue={onSaveAndContinue} />)

    const institutionInput = screen.getByPlaceholderText("e.g. State University")
    await user.click(institutionInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Institution is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("clicking 'Add another' appends a new education entry", async () => {
    await testAddAnotherAppendsEntry(EducationStep, "e.g. State University")
  })

  it("filling a valid institution and clicking Save & Continue calls onSaveAndContinue with correct payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<EducationStep onSaveAndContinue={onSaveAndContinue} />)

    const institutionInput = screen.getByPlaceholderText("e.g. State University")
    await user.type(institutionInput, "MIT")

    const degreeInput = screen.getByPlaceholderText("e.g. Bachelor of Science")
    await user.type(degreeInput, "BSc Computer Science")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.education).toBeDefined()
    expect(capturedPayload.current?.education![0].institution).toBe("MIT")
    expect(capturedPayload.current?.education![0].degree).toBe("BSc Computer Science")
  })

  it("does not call onSaveAndContinue when institution is empty on submit", async () => {
    await testEmptySubmitDoesNotCall(EducationStep, "Institution is required")
  })
})

describe("SkillsStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("blur on empty skill name renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<SkillsStep onSaveAndContinue={onSaveAndContinue} />)

    const skillInput = screen.getByPlaceholderText("e.g. TypeScript")
    await user.click(skillInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Skill name is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("clicking 'Add another' appends a new skill entry", async () => {
    await testAddAnotherAppendsEntry(SkillsStep, "e.g. TypeScript")
  })

  it("filling a valid skill and clicking Save & Continue calls onSaveAndContinue with correct payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<SkillsStep onSaveAndContinue={onSaveAndContinue} />)

    const skillInput = screen.getByPlaceholderText("e.g. TypeScript")
    await user.type(skillInput, "React")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.skills).toBeDefined()
    expect(capturedPayload.current?.skills![0].name).toBe("React")
  })

  it("does not call onSaveAndContinue when skill name is empty on submit", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<SkillsStep onSaveAndContinue={onSaveAndContinue} />)

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    expect(onSaveAndContinue).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText("Skill name is required")).toBeInTheDocument()
    })
  })
})

describe("SummaryStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it("'Save & Finish' calls onSaveAndContinue with the summary payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(
      <MemoryRouter>
        <SummaryStep onSaveAndContinue={onSaveAndContinue} />
      </MemoryRouter>,
    )

    const textarea = screen.getByPlaceholderText(/Experienced software engineer/i)
    await user.type(textarea, "Passionate developer with 3 years experience.")

    const saveButton = screen.getByRole("button", { name: /save & finish/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.summary).toBe(
      "Passionate developer with 3 years experience.",
    )
  })

  it("'Skip' navigates away without calling onSaveAndContinue", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(
      <MemoryRouter>
        <SummaryStep onSaveAndContinue={onSaveAndContinue} />
      </MemoryRouter>,
    )

    const skipButton = screen.getByRole("button", { name: /skip/i })
    await user.click(skipButton)

    expect(onSaveAndContinue).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })
})

describe("CertificationsStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("blur on empty certification name renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<CertificationsStep onSaveAndContinue={onSaveAndContinue} />)

    const nameInput = screen.getByPlaceholderText("e.g. AWS Cloud Practitioner")
    await user.click(nameInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Certification name is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("clicking 'Add another' appends a new certification entry", async () => {
    await testAddAnotherAppendsEntry(CertificationsStep, "e.g. AWS Cloud Practitioner")
  })

  it("filling a valid certification and clicking Save & Continue calls onSaveAndContinue with correct payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<CertificationsStep onSaveAndContinue={onSaveAndContinue} />)

    const nameInput = screen.getByPlaceholderText("e.g. AWS Cloud Practitioner")
    await user.type(nameInput, "AWS Solutions Architect")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.certifications).toBeDefined()
    expect(capturedPayload.current?.certifications![0].name).toBe("AWS Solutions Architect")
  })

  it("does not call onSaveAndContinue when certification name is empty on submit", async () => {
    await testEmptySubmitDoesNotCall(CertificationsStep, "Certification name is required")
  })
})

describe("LanguagesStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("blur on empty language name renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<LanguagesStep onSaveAndContinue={onSaveAndContinue} />)

    const nameInput = screen.getByPlaceholderText("e.g. English")
    await user.click(nameInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Language name is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("clicking 'Add another' appends a new language entry", async () => {
    await testAddAnotherAppendsEntry(LanguagesStep, "e.g. English")
  })

  it("filling a valid language with proficiency and clicking Save & Continue calls onSaveAndContinue with correct payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<LanguagesStep onSaveAndContinue={onSaveAndContinue} />)

    const nameInput = screen.getByPlaceholderText("e.g. English")
    await user.type(nameInput, "German")

    const select = screen.getByRole("combobox")
    await user.selectOptions(select, "ADVANCED")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.languages).toBeDefined()
    expect(capturedPayload.current?.languages![0].name).toBe("German")
    expect(capturedPayload.current?.languages![0].proficiencyLevel).toBe("ADVANCED")
  })

  it("does not call onSaveAndContinue when proficiency level is not selected on submit", async () => {
    await testEmptySubmitDoesNotCall(
      LanguagesStep,
      "Proficiency level is required",
      async (user) => {
        const nameInput = screen.getByPlaceholderText("e.g. English")
        await user.type(nameInput, "German")
      },
    )
  })
})

describe("ProjectsStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("blur on empty project name renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    const nameInput = screen.getByPlaceholderText("e.g. Resume Enhancer")
    await user.click(nameInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Project name is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("clicking 'Add another' appends a new project entry", async () => {
    await testAddAnotherAppendsEntry(ProjectsStep, "e.g. Resume Enhancer")
  })

  it("filling a valid project and clicking Save & Continue calls onSaveAndContinue with correct payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    const nameInput = screen.getByPlaceholderText("e.g. Resume Enhancer")
    await user.type(nameInput, "My Portfolio Site")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.projects).toBeDefined()
    expect(capturedPayload.current?.projects![0].name).toBe("My Portfolio Site")
  })

  it("initialises entries from existing profile projects (lines 53-61)", () => {
    // Seed the store with pre-existing projects so the else-branch is exercised
    useProfileStore.setState((s) => ({
      ...s,
      profile: {
        ...s.profile!,
        projects: [
          {
            name: "Seeded Project",
            description: "Desc",
            technologies: "React",
            link: "https://github.com/x",
            startDate: "2022-01-01",
            endDate: "2022-12-01",
            isCurrent: false,
          },
        ],
      },
    }))

    const onSaveAndContinue = vi.fn()
    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    // The pre-existing project name should appear as the input value
    const nameInput = screen.getByPlaceholderText("e.g. Resume Enhancer") as HTMLInputElement
    expect(nameInput.value).toBe("Seeded Project")
  })

  it("removes an entry when the remove button is clicked (line 107)", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    // Add a second entry so we have two to work with
    const addButton = screen.getByRole("button", { name: /add another/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("e.g. Resume Enhancer")).toHaveLength(2)
    })

    // Click the first "Remove entry" button (EntryCardHeader renders one per entry)
    const removeButtons = screen.getAllByRole("button", { name: /remove entry/i })
    await user.click(removeButtons[0])

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("e.g. Resume Enhancer")).toHaveLength(1)
    })
  })

  it("updates technologies field via updateField (line 174)", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    const techInput = screen.getByPlaceholderText("e.g. Java, React, PostgreSQL") as HTMLInputElement
    await user.type(techInput, "TypeScript")

    expect(techInput.value).toBe("TypeScript")
  })

  it("updates link field via updateField (line 190)", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    const linkInput = screen.getByPlaceholderText("e.g. https://github.com/user/project") as HTMLInputElement
    await user.type(linkInput, "https://example.com")

    expect(linkInput.value).toBe("https://example.com")
  })

  it("does not call onSaveAndContinue when project name is empty on submit", async () => {
    await testEmptySubmitDoesNotCall(ProjectsStep, "Project name is required")
  })

  it("isCurrent toggle and description change update the draft (lines 201-202, 211-212)", async () => {
    const user = userEvent.setup()
    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<ProjectsStep onSaveAndContinue={onSaveAndContinue} />)

    // Fill required project name
    const nameInput = screen.getByPlaceholderText("e.g. Resume Enhancer")
    await user.type(nameInput, "Toggle Project")

    // Toggle the "ongoing project" checkbox (CurrentToggleAndDescription)
    const ongoingCheckbox = screen.getByRole("checkbox", { name: /ongoing project/i })
    await user.click(ongoingCheckbox)
    expect(ongoingCheckbox).toBeChecked()

    // Fill description
    const descTextarea = screen.getByPlaceholderText("Describe the project, your role, and impact...")
    await user.type(descTextarea, "Great project description")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current?.projects![0].isCurrent).toBe(true)
    expect(capturedPayload.current?.projects![0].endDate).toBeNull()
    expect(capturedPayload.current?.projects![0].description).toBe("Great project description")
  })
})

describe("VolunteeringStep", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("blur on empty role renders text-red-600 error below the field", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<VolunteeringStep onSaveAndContinue={onSaveAndContinue} />)

    const roleInput = screen.getByPlaceholderText("e.g. Mentor")
    await user.click(roleInput)
    await user.tab() // blur

    await waitFor(() => {
      const errorEl = screen.getByText("Role is required")
      expect(errorEl).toBeInTheDocument()
      expect(errorEl).toHaveClass("text-red-600")
    })
  })

  it("clicking 'Add another' appends a new volunteering entry", async () => {
    await testAddAnotherAppendsEntry(VolunteeringStep, "e.g. Mentor")
  })

  it("filling valid role and organization and clicking Save & Continue calls onSaveAndContinue with correct payload", async () => {
    const user = userEvent.setup()

    const capturedPayload = { current: null as Partial<ProfileUpdateRequest> | null }
    const onSaveAndContinue = vi
      .fn()
      .mockImplementation(async (partial: Partial<ProfileUpdateRequest>) => {
        capturedPayload.current = partial
      })

    render(<VolunteeringStep onSaveAndContinue={onSaveAndContinue} />)

    const roleInput = screen.getByPlaceholderText("e.g. Mentor")
    await user.type(roleInput, "Code Instructor")

    const orgInput = screen.getByPlaceholderText("e.g. Code.org")
    await user.type(orgInput, "Local School")

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1)
    })

    expect(capturedPayload.current).not.toBeNull()
    expect(capturedPayload.current?.volunteering).toBeDefined()
    expect(capturedPayload.current?.volunteering![0].role).toBe("Code Instructor")
    expect(capturedPayload.current?.volunteering![0].organization).toBe("Local School")
  })

  it("does not call onSaveAndContinue when required fields are empty on submit", async () => {
    const user = userEvent.setup()
    const onSaveAndContinue = vi.fn()

    render(<VolunteeringStep onSaveAndContinue={onSaveAndContinue} />)

    const saveButton = screen.getByRole("button", { name: /save & continue/i })
    await user.click(saveButton)

    expect(onSaveAndContinue).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText("Role is required")).toBeInTheDocument()
      expect(screen.getByText("Organization is required")).toBeInTheDocument()
    })
  })
})
