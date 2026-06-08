import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { TemplateDto } from "@/types/api"
import TemplateGallery from "./TemplateGallery"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)

function buildTemplate(overrides?: Partial<TemplateDto>): TemplateDto {
  return {
    id: "template-1",
    name: "Minimal",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("TemplateGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders skeleton while loading (AC4)", () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    // Three skeleton elements should be present
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders template cards after fetch (AC1)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGet.mockResolvedValue(templates)
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
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
    mockGet.mockResolvedValue(templates)
    render(<TemplateGallery activeTemplateId="t1" onApply={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByLabelText(/apply minimal template \(active\)/i)).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply classic template$/i)).toBeInTheDocument()
  })

  it("calls onApply with templateId when a template is clicked (AC3)", async () => {
    const onApply = vi.fn()
    mockGet.mockResolvedValue([buildTemplate({ id: "t1", name: "Minimal" })])
    render(<TemplateGallery activeTemplateId={null} onApply={onApply} />)
    await waitFor(() => screen.getByLabelText(/apply minimal template/i))
    fireEvent.click(screen.getByLabelText(/apply minimal template/i))
    expect(onApply).toHaveBeenCalledWith("t1")
  })

  it("filters to minimal tab when Minimal tab is clicked (AC1)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGet.mockResolvedValue(templates)
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/apply minimal template/i))
    fireEvent.click(screen.getByRole("tab", { name: /minimal/i }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/apply classic template/i)).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply minimal template/i)).toBeInTheDocument()
  })

  it("shows 'No templates in this category' when filtered list is empty (AC1)", async () => {
    // Only Classic template — clicking Modern tab should show empty state
    mockGet.mockResolvedValue([buildTemplate({ id: "t1", name: "Classic" })])
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/apply classic template/i))
    fireEvent.click(screen.getByRole("tab", { name: /modern/i }))
    await waitFor(() =>
      expect(screen.getByText(/no templates in this category/i)).toBeInTheDocument()
    )
  })
})
