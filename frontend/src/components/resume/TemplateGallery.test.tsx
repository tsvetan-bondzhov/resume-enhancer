import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { apiClient } from "@/lib/apiClient"
import type { TemplateDto } from "@/types/api"
import TemplateGallery from "./TemplateGallery"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock useNavigate so we can assert navigation calls without a real browser history.
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockGet = vi.mocked(apiClient.get)
const mockDelete = vi.mocked(apiClient.delete)

// Route the two gallery fetches to their respective fixtures.
function mockGalleryFetches(prebuilt: TemplateDto[], custom: TemplateDto[]) {
  mockGet.mockImplementation((path: string) => {
    if (path === "/api/v1/resume-templates/custom") return Promise.resolve(custom)
    if (path === "/api/v1/resume-templates") return Promise.resolve(prebuilt)
    return Promise.resolve([])
  })
}

function buildTemplate(overrides?: Partial<TemplateDto>): TemplateDto {
  return {
    id: "template-1",
    name: "Minimal",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: { layoutType: "single-column" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Wrap TemplateGallery in MemoryRouter so useNavigate works in tests.
function renderGallery(activeTemplateId: string | null = null, onApply = vi.fn()) {
  return render(
    <MemoryRouter>
      <TemplateGallery activeTemplateId={activeTemplateId} onApply={onApply} />
    </MemoryRouter>,
  )
}

describe("TemplateGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders skeleton while loading (AC4)", () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderGallery()
    // Three skeleton elements should be present
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders template cards after fetch (AC1)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGalleryFetches(templates, [])
    renderGallery()
    await waitFor(() =>
      expect(screen.getByLabelText(/apply minimal template/i)).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply classic template/i)).toBeInTheDocument()
  })

  it("marks currently active template with active badge (AC5)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGalleryFetches(templates, [])
    renderGallery("t1")
    await waitFor(() =>
      expect(screen.getByLabelText(/apply minimal template \(active\)/i)).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply classic template$/i)).toBeInTheDocument()
  })

  it("calls onApply with templateId when a template is clicked (AC3)", async () => {
    const onApply = vi.fn()
    mockGalleryFetches([buildTemplate({ id: "t1", name: "Minimal" })], [])
    renderGallery(null, onApply)
    await waitFor(() => screen.getByLabelText(/apply minimal template/i))
    fireEvent.click(screen.getByLabelText(/apply minimal template/i))
    expect(onApply).toHaveBeenCalledWith("t1")
  })

  it("filters to minimal tab when Minimal tab is clicked (AC1)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGalleryFetches(templates, [])
    renderGallery()
    await waitFor(() => screen.getByLabelText(/apply minimal template/i))
    fireEvent.click(screen.getByRole("tab", { name: /minimal/i }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/apply classic template/i)).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply minimal template/i)).toBeInTheDocument()
  })

  it("shows 'No templates in this category' when filtered list is empty (AC1)", async () => {
    // Only Classic template — clicking Modern tab should show empty state
    mockGalleryFetches([buildTemplate({ id: "t1", name: "Classic" })], [])
    renderGallery()
    await waitFor(() => screen.getByLabelText(/apply classic template/i))
    fireEvent.click(screen.getByRole("tab", { name: /modern/i }))
    await waitFor(() =>
      expect(screen.getByText(/no templates in this category/i)).toBeInTheDocument()
    )
  })

  // AC9: two-column thumbnail renders narrow left block alongside wider right block
  it("renders two-column thumbnail structure for classic layout (AC9)", async () => {
    mockGalleryFetches([
      buildTemplate({
        id: "t-classic",
        name: "Classic",
        templateDefinition: { layoutType: "two-column", cssVariables: { "--accent-color": "#1d4ed8" } },
      }),
    ], [])
    renderGallery()
    await waitFor(() => screen.getByLabelText(/apply classic template/i))
    // two-column thumbnail uses flex layout with two column divs
    const button = screen.getByLabelText(/apply classic template/i)
    // The two-column thumbnail has a flex container with gap-0.5
    const thumbContainer = button.querySelector(String.raw`.flex.gap-0\.5`)
    expect(thumbContainer).toBeInTheDocument()
  })

  // AC9: modern-accent thumbnail renders accent header band with accent color
  it("renders modern-accent thumbnail with accent band (AC9)", async () => {
    mockGalleryFetches([
      buildTemplate({
        id: "t-modern",
        name: "Modern",
        templateDefinition: {
          layoutType: "modern-accent",
          cssVariables: { "--accent-color": "#0d9488" },
        },
      }),
    ], [])
    renderGallery()
    await waitFor(() => screen.getByLabelText(/apply modern template/i))
    const button = screen.getByLabelText(/apply modern template/i)
    // The accent band div should have backgroundColor set via inline style
    const accentBand = button.querySelector("[style*='background-color']")
    expect(accentBand).toBeInTheDocument()
  })

  // AC1: My Templates tab lists custom templates from /custom and shows Create button
  it("lists custom templates and a Create New Template button in My Templates tab (AC1)", async () => {
    mockGalleryFetches(
      [buildTemplate({ id: "p1", name: "Minimal" })],
      [buildTemplate({ id: "c1", name: "My Custom", isPrebuilt: false, isPublished: false })],
    )
    renderGallery()

    fireEvent.click(screen.getByRole("tab", { name: /my templates/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/apply my custom template/i)).toBeInTheDocument()
    )
    expect(
      screen.getByRole("button", { name: /create new template/i })
    ).toBeInTheDocument()
    // Prebuilt template must NOT appear in My Templates
    expect(screen.queryByLabelText(/apply minimal template/i)).not.toBeInTheDocument()
  })

  // AC2: clicking Create New Template navigates to /templates/custom/new
  it("navigates to /templates/custom/new when Create New Template is clicked (AC2)", async () => {
    mockGalleryFetches([], [])
    renderGallery()
    fireEvent.click(screen.getByRole("tab", { name: /my templates/i }))
    await waitFor(() =>
      screen.getByRole("button", { name: /create new template/i })
    )
    fireEvent.click(screen.getByRole("button", { name: /create new template/i }))
    expect(mockNavigate).toHaveBeenCalledWith("/templates/custom/new")
  })

  // AC6: clicking Edit navigates to /templates/custom/:id/edit
  it("navigates to /templates/custom/:id/edit when Edit is clicked (AC6)", async () => {
    mockGalleryFetches(
      [],
      [buildTemplate({ id: "c1", name: "My Custom", isPrebuilt: false, isPublished: false })],
    )
    renderGallery()
    fireEvent.click(screen.getByRole("tab", { name: /my templates/i }))
    await waitFor(() => screen.getByLabelText(/edit my custom template/i))
    fireEvent.click(screen.getByLabelText(/edit my custom template/i))
    expect(mockNavigate).toHaveBeenCalledWith("/templates/custom/c1/edit")
  })

  // AC7: delete confirm calls apiClient.delete on the /custom endpoint and removes the card
  it("calls DELETE /custom/{id} when delete is confirmed and removes card from DOM (AC7)", async () => {
    mockGalleryFetches(
      [],
      [buildTemplate({ id: "c1", name: "ToDelete", isPrebuilt: false })],
    )
    mockDelete.mockResolvedValue(undefined)
    renderGallery()

    fireEvent.click(screen.getByRole("tab", { name: /my templates/i }))
    await waitFor(() => screen.getByLabelText(/delete todelete template/i))
    fireEvent.click(screen.getByLabelText(/delete todelete template/i))

    // Confirm dialog appears with the revert-to-default copy
    await waitFor(() =>
      expect(
        screen.getByText(/resumes using it will revert to the default template/i)
      ).toBeInTheDocument()
    )

    const confirmButton = screen.getByRole("button", { name: /^delete$/i })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith("/api/v1/resume-templates/custom/c1")
    )

    // Verify the deleted template's card is removed from the DOM (optimistic removal)
    await waitFor(() =>
      expect(screen.queryByLabelText(/apply todelete template/i)).not.toBeInTheDocument()
    )
  })
})
