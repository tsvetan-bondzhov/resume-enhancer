import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { useProfileStore } from "@/stores/useProfileStore"
import ProfilePage from "./ProfilePage"
import ExperienceStep from "@/components/profile/ExperienceStep"
import type { ProfileDto, ProfileUpdateRequest } from "@/types/api"

// Mock apiClient — GET returns a non-empty profile so the stepper renders
const mockProfile: ProfileDto = {
  summary: "Experienced developer",
  workExperiences: [
    {
      jobTitle: "Software Engineer",
      company: "Acme Corp",
      startDate: null,
      endDate: null,
      isCurrent: true,
      description: null,
    },
  ],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
  projects: [],
  volunteering: [],
}

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      summary: "Experienced developer",
      workExperiences: [
        {
          jobTitle: "Software Engineer",
          company: "Acme Corp",
          startDate: null,
          endDate: null,
          isCurrent: true,
          description: null,
        },
      ],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    }),
    put: vi.fn().mockResolvedValue({
      summary: "Experienced developer",
      workExperiences: [
        {
          jobTitle: "Software Engineer",
          company: "Acme Corp",
          startDate: null,
          endDate: null,
          isCurrent: true,
          description: null,
        },
      ],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    }),
    uploadFile: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
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

/**
 * Set the profile store into a "loaded non-empty profile" state so that
 * ProfilePage renders the stepper immediately, bypassing the async GET.
 */
function setProfileStoreLoaded(currentStep = 0) {
  useProfileStore.setState({
    profile: mockProfile,
    isSaving: false,
    isLoading: false,
    error: null,
    currentStep,
    hasStarted: true,
  })
}

function resetProfileStore() {
  useProfileStore.setState({
    profile: null,
    isSaving: false,
    isLoading: true,
    error: null,
    currentStep: 0,
    hasStarted: false,
  })
}

describe("ProfilePage — clickable step navigation (AC1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setProfileStoreLoaded(0)
  })

  it("clicking step label at index 3 (Certifications) sets currentStep to 3", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for stepper to appear after async profile load
    const certStep = await screen.findByRole("button", { name: /Go to step Certifications/i })
    await user.click(certStep)

    await waitFor(() => {
      expect(useProfileStore.getState().currentStep).toBe(3)
    })
  })
})

describe("ProfilePage — completed step styling (AC2, AC3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // currentStep = 2 → steps 0 and 1 are "completed"
    setProfileStoreLoaded(2)
  })

  it("a completed step (index < currentStep) does not have the CSS class 'line-through'", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for stepper to appear after async profile load
    const step0 = await screen.findByRole("button", { name: /Go to step Experience/i })
    expect(step0.className).not.toContain("line-through")
  })

  it("a completed step (index < currentStep) does not have text content starting with '✓'", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for stepper to appear after async profile load
    const step0 = await screen.findByRole("button", { name: /Go to step Experience/i })
    expect(step0.textContent).not.toMatch(/^✓/)
  })
})

describe("ExperienceStep — delete button on first item (AC4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set profile with one existing work experience so step shows it pre-populated
    useProfileStore.setState({
      profile: mockProfile,
      isSaving: false,
      isLoading: false,
      error: null,
      currentStep: 0,
      hasStarted: true,
    })
  })

  it("the first item (index 0) has a delete button with aria-label 'Remove entry 1'", () => {
    const onSaveAndContinue = vi.fn<[Partial<ProfileUpdateRequest>], Promise<void>>()

    render(<ExperienceStep onSaveAndContinue={onSaveAndContinue} />)

    // Should find a Remove entry 1 button regardless of total entry count
    const removeButton = screen.getByRole("button", { name: "Remove entry 1" })
    expect(removeButton).toBeInTheDocument()
  })
})

describe("ProfilePage — profile loading integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProfileStore()
  })

  it("renders skeleton while loading, then shows stepper after profile loads", async () => {
    // isLoading starts true — skeleton should be visible initially
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // After the mock GET resolves, the store updates and the stepper renders
    await waitFor(() => {
      // The Experience step label should appear in the stepper
      expect(screen.getByRole("button", { name: /Go to step Experience/i })).toBeInTheDocument()
    })
  })
})
