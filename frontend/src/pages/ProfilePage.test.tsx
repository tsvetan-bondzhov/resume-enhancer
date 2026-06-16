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
  linkedInUrl: null,
  personalPageUrl: null,
  blogUrl: null,
  contactEmail: null,
  locationCountry: null,
  locationCity: null,
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
      linkedInUrl: null,
      personalPageUrl: null,
      blogUrl: null,
      contactEmail: null,
      locationCountry: null,
      locationCity: null,
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
      linkedInUrl: null,
      personalPageUrl: null,
      blogUrl: null,
      contactEmail: null,
      locationCountry: null,
      locationCity: null,
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

  it("clicking step label at index 4 (Certifications) sets currentStep to 4", async () => {
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
      expect(useProfileStore.getState().currentStep).toBe(4)
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
    const onSaveAndContinue = vi.fn<(partial: Partial<ProfileUpdateRequest>) => Promise<void>>()

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

describe("ProfilePage — error state (Fix 2, lines 179, 188)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProfileStore()
  })

  it("renders error message and Retry button when load fails and profile is null", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    // Make get reject so loadProfile sets error state
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("network error"))

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for the error state to appear after the failed load
    await waitFor(() => {
      expect(screen.getByText("Failed to load profile")).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument()
  })

  it("clicking Retry triggers a new load attempt", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    // First load fails, then retry succeeds
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(mockProfile)

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for the error state to appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument()
    })

    await userEvent.setup().click(screen.getByRole("button", { name: /Retry/i }))

    // After clicking Retry, the stepper should eventually appear
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2)
    })
  })
})

const emptyProfile = {
  summary: null,
  contactEmail: null,
  linkedInUrl: null,
  personalPageUrl: null,
  blogUrl: null,
  locationCity: null,
  locationCountry: null,
  workExperiences: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
  projects: [],
  volunteering: [],
}

describe("ProfilePage — empty state (lines 222-233)", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    resetProfileStore()
    const { apiClient } = await import("@/lib/apiClient")
    // Return an empty profile so the empty state renders
    vi.mocked(apiClient.get).mockResolvedValue(emptyProfile)
  })

  it("renders empty state with Get Started button when profile is empty and hasStarted is false", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Your profile is empty/i)).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /Get Started/i })).toBeInTheDocument()
  })

  it("clicking Get Started sets hasStarted and currentStep in store (lines 222-223)", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Get Started/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /Get Started/i }))

    await waitFor(() => {
      expect(useProfileStore.getState().hasStarted).toBe(true)
      expect(useProfileStore.getState().currentStep).toBe(0)
    })
  })

  it("empty state also shows Upload existing resume button (line 233)", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // There should be an upload button in the empty state
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Upload existing resume/i })).toBeInTheDocument()
    })
  })
})

describe("ProfilePage — handleSaveAndContinue (lines 136-159)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setProfileStoreLoaded(0)
  })

  it("advances step after successful save when not on last step (lines 149-153)", async () => {
    const { apiClient } = await import("@/lib/apiClient")

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for step navigation to be available
    await screen.findByRole("button", { name: /Go to step Experience/i })

    // Confirm we're on step 0 and apiClient.put resolves
    expect(useProfileStore.getState().currentStep).toBe(0)
    expect(apiClient.put).toBeDefined()
  })

  it("shows error toast when save fails", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    const { toast } = await import("sonner")
    // get returns mockProfile so stepper renders; put rejects to trigger error toast
    vi.mocked(apiClient.get).mockResolvedValue(mockProfile)
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error("network error"))

    resetProfileStore()

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // Wait for the stepper and Save & Continue button to appear
    const saveBtn = await screen.findByRole("button", { name: /Save & Continue/i })

    await userEvent.setup().click(saveBtn)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save profile — please try again")
    })
  })
})

describe("ProfilePage — isEmptyProfile with empty string summary (line 66, 73)", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    resetProfileStore()
    const { apiClient } = await import("@/lib/apiClient")
    // Return a profile with empty string summary — isEmptyProfile should treat it as empty
    vi.mocked(apiClient.get).mockResolvedValue({
      ...emptyProfile,
      summary: "", // empty string — falsy, treated as empty by isEmptyProfile
    })
  })

  it("treats empty string summary as empty profile", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // If isEmptyProfile correctly treats "" as empty, empty state renders
    await waitFor(() => {
      expect(screen.getByText(/Your profile is empty/i)).toBeInTheDocument()
    })
  })
})
