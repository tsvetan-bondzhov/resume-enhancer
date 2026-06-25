import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { apiClient } from "@/lib/apiClient"
import type { TemplateDto } from "@/types/api"
import TemplateEditorPage from "./TemplateEditorPage"

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

// ResumeCanvas does its own work (pagination, ResizeObserver) — stub it so this
// test focuses on the editor and asserts the parsed preview definition is passed in.
vi.mock("@/components/resume/ResumeCanvas", () => ({
  __esModule: true,
  default: ({ templatePreview }: { templatePreview?: { layoutType?: string } }) => (
    <div data-testid="preview" data-layout={templatePreview?.layoutType ?? ""} />
  ),
}))

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)

function buildTemplate(overrides?: Partial<TemplateDto>): TemplateDto {
  return {
    id: "custom-1",
    name: "My Template",
    description: null,
    isPrebuilt: false,
    isPublished: false,
    templateDefinition: {
      layoutType: "two-column",
      cssVariables: { "--accent-color": "#0d9488", "--font-size-base": "12px" },
      layout: { columns: { left: ["SKILLS"], right: ["WORK_EXPERIENCE"] } },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/** Render TemplateEditorPage at the /new (create) route. */
function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/templates/custom/new"]}>
      <Routes>
        <Route path="/templates/custom/new" element={<TemplateEditorPage />} />
        <Route path="*" element={<div data-testid="back-page" />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Render TemplateEditorPage at the edit route for a given templateId. */
function renderEdit(templateId: string) {
  return render(
    <MemoryRouter initialEntries={[`/templates/custom/${templateId}/edit`]}>
      <Routes>
        <Route path="/templates/custom/:templateId/edit" element={<TemplateEditorPage />} />
        <Route path="*" element={<div data-testid="back-page" />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Render TemplateEditorPage at the ADMIN system-template edit route. */
function renderEditSystem(templateId: string) {
  return render(
    <MemoryRouter initialEntries={[`/templates/system/${templateId}/edit`]}>
      <Routes>
        <Route path="/templates/system/:templateId/edit" element={<TemplateEditorPage />} />
        <Route path="*" element={<div data-testid="back-page" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("TemplateEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // AC9(a): typing in the definition field triggers a debounced preview update.
  it("updates the live preview after the debounce window when definition changes", async () => {
    vi.useFakeTimers()
    renderCreate()

    // Default seed is single-column.
    expect(screen.getByTestId("preview").dataset.layout).toBe("single-column")

    const textarea = screen.getByLabelText(/template definition/i)
    const newDef = JSON.stringify({
      layoutType: "modern-accent",
      cssVariables: { "--accent-color": "#111111", "--font-size-base": "11px" },
    })
    fireEvent.change(textarea, { target: { value: newDef } })

    // Before the debounce flush the preview still shows the previous valid def.
    expect(screen.getByTestId("preview").dataset.layout).toBe("single-column")

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByTestId("preview").dataset.layout).toBe("modern-accent")
  })

  // AC9(b): invalid definition shows a validation error and does NOT call apiClient.post.
  it("blocks save and shows an error when the definition is invalid JSON", async () => {
    renderCreate()

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Broken" } })
    fireEvent.change(screen.getByLabelText(/template definition/i), {
      target: { value: "{ not valid json" },
    })

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())

    const saveButton = screen.getByRole("button", { name: /^save$/i })
    expect(saveButton).toBeDisabled()

    fireEvent.click(saveButton)
    expect(mockPost).not.toHaveBeenCalled()
  })

  // AC9(b) variant: rem/em CSS units are rejected client-side (backend would 400).
  it("rejects rem/em CSS units with a validation error and blocks save", async () => {
    renderCreate()

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "RemTemplate" } })
    fireEvent.change(screen.getByLabelText(/template definition/i), {
      target: {
        value: JSON.stringify({
          layoutType: "single-column",
          cssVariables: { "--font-size-base": "1.2rem" },
        }),
      },
    })

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/px or in/i))
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  // AC9(c): valid definition calls POST with the correct payload.
  it("calls POST /custom with the correct payload on create save", async () => {
    const saved = buildTemplate({ id: "new-1", name: "Created", isPrebuilt: false })
    mockPost.mockResolvedValue(saved)

    renderCreate()

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Created" } })
    const def = {
      layoutType: "single-column",
      cssVariables: { "--accent-color": "#3b82f6", "--font-size-base": "11px" },
      layout: { sectionOrder: ["WORK_EXPERIENCE"] },
    }
    fireEvent.change(screen.getByLabelText(/template definition/i), {
      target: { value: JSON.stringify(def) },
    })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^save$/i })).not.toBeDisabled()
    )
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("/api/v1/resume-templates/custom", {
        name: "Created",
        description: null,
        templateDefinition: def,
      })
    )
  })

  // AC9(d): edit mode loads template via GET, pre-fills and saves via PUT /custom/{id}.
  it("loads template via GET, pre-fills fields, and calls PUT /custom/{id} in edit mode", async () => {
    const template = buildTemplate()
    mockGet.mockResolvedValue(template)
    mockPut.mockResolvedValue({ ...template, name: "Renamed" })

    renderEdit("custom-1")

    // Wait for template to load and fields to be pre-filled.
    await waitFor(() =>
      expect(screen.getByLabelText(/^name$/i)).toHaveValue("My Template")
    )
    expect(screen.getByLabelText(/template definition/i)).toHaveValue(
      JSON.stringify(template.templateDefinition, null, 2)
    )
    expect(mockGet).toHaveBeenCalledWith("/api/v1/resume-templates/custom/custom-1")

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Renamed" } })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^save$/i })).not.toBeDisabled()
    )
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(
        "/api/v1/resume-templates/custom/custom-1",
        expect.objectContaining({ name: "Renamed", description: null })
      )
    )
    expect(mockPost).not.toHaveBeenCalled()
  })

  // Admin system mode: loads via the admin GET /{id} and saves via PUT /{id}.
  it("loads via GET /{id} and saves via PUT /{id} in admin system mode", async () => {
    const template = buildTemplate({ id: "sys-1", name: "System One", isPrebuilt: true })
    mockGet.mockResolvedValue(template)
    mockPut.mockResolvedValue({ ...template, name: "System Renamed" })

    renderEditSystem("sys-1")

    await waitFor(() =>
      expect(screen.getByLabelText(/^name$/i)).toHaveValue("System One")
    )
    expect(mockGet).toHaveBeenCalledWith("/api/v1/resume-templates/sys-1")
    expect(mockGet).not.toHaveBeenCalledWith("/api/v1/resume-templates/custom/sys-1")

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "System Renamed" } })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^save$/i })).not.toBeDisabled()
    )
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(
        "/api/v1/resume-templates/sys-1",
        expect.objectContaining({ name: "System Renamed" })
      )
    )
    expect(mockPost).not.toHaveBeenCalled()
  })

  // Heading renders correctly for create vs edit mode.
  it("shows 'Create new template' heading in create mode", () => {
    renderCreate()
    expect(screen.getByRole("heading", { name: /create new template/i })).toBeInTheDocument()
  })

  it("shows 'Edit template' heading in edit mode after template loads", async () => {
    const template = buildTemplate()
    mockGet.mockResolvedValue(template)

    renderEdit("custom-1")

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /edit template/i })).toBeInTheDocument()
    )
  })

  // Error state: GET fails shows error message with Go back button.
  it("shows load error and a Go back button when GET fails in edit mode", async () => {
    mockGet.mockRejectedValue(new Error("Not found"))

    renderEdit("nonexistent-id")

    await waitFor(() =>
      expect(screen.getByText(/failed to load template/i)).toBeInTheDocument()
    )
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument()
  })

  // Sidebar toggle shows/hides the instructions pane.
  it("toggles the instructions sidebar open and closed", () => {
    renderCreate()

    // Sidebar is open by default.
    expect(screen.getByTestId("template-editor-sidebar")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /css variables/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /hide instructions/i }))
    expect(screen.queryByTestId("template-editor-sidebar")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /show instructions/i }))
    expect(screen.getByTestId("template-editor-sidebar")).toBeInTheDocument()
  })

  // Clicking a layout preset prefills the definition textarea with that layout.
  it("prefills the definition textarea when a layout preset is clicked", () => {
    renderCreate()

    const textarea = screen.getByLabelText(/template definition/i) as HTMLTextAreaElement

    fireEvent.click(screen.getByRole("button", { name: /apply two column preset/i }))
    expect(textarea.value).toContain('"layoutType": "two-column"')
    // Two-column preset must include a columns split.
    expect(textarea.value).toContain('"left"')

    fireEvent.click(screen.getByRole("button", { name: /apply modern accent preset/i }))
    expect(textarea.value).toContain('"layoutType": "modern-accent"')
  })

  // DEFAULT_DEFINITION is valid: create mode renders without a validation error.
  it("seeds a valid DEFAULT_DEFINITION with no validation error in create mode", () => {
    renderCreate()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByTestId("preview").dataset.layout).toBe("single-column")
  })
})
