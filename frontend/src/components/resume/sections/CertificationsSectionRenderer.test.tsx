import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import CertificationsSectionRenderer from "./CertificationsSectionRenderer"
import type { CertificationItemDto } from "@/types/api"

function buildItem(overrides?: Partial<CertificationItemDto>): CertificationItemDto {
  return {
    type: "CERTIFICATIONS",
    id: "cert-1",
    name: "AWS Certified Developer",
    issuer: "Amazon Web Services",
    issueDate: "2023-01-01",
    expirationDate: "2026-01-01",
    ...overrides,
  }
}

describe("CertificationsSectionRenderer", () => {
  it("renders certification name in read-only mode", () => {
    render(<CertificationsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("AWS Certified Developer")).toBeInTheDocument()
  })

  it("renders issuer in read-only mode", () => {
    render(<CertificationsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("Amazon Web Services")).toBeInTheDocument()
  })

  it("renders issueDate and expirationDate in read-only mode", () => {
    render(<CertificationsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("2023-01-01")).toBeInTheDocument()
    expect(screen.getByText("2026-01-01")).toBeInTheDocument()
  })

  it("does not render name when name is null", () => {
    render(<CertificationsSectionRenderer items={[buildItem({ name: null })]} />)
    expect(screen.queryByText("AWS Certified Developer")).not.toBeInTheDocument()
  })

  it("does not render issuer separator when issuer is null", () => {
    render(
      <CertificationsSectionRenderer
        items={[buildItem({ issuer: null })]}
      />
    )
    expect(screen.queryByText("Amazon Web Services")).not.toBeInTheDocument()
  })

  it("does not render issueDate when issueDate is null in read-only mode", () => {
    render(
      <CertificationsSectionRenderer
        items={[buildItem({ issueDate: null, expirationDate: null })]}
      />
    )
    expect(screen.queryByText("2023-01-01")).not.toBeInTheDocument()
  })

  it("renders editable name field in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <CertificationsSectionRenderer
        items={[buildItem()]}
        onFieldChange={onFieldChange}
      />
    )
    expect(screen.getByLabelText("Edit name")).toBeInTheDocument()
  })

  it("calls onFieldChange for name field on blur in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <CertificationsSectionRenderer
        items={[buildItem()]}
        onFieldChange={onFieldChange}
      />
    )
    const field = screen.getByLabelText("Edit name")
    fireEvent.blur(field, { target: { textContent: "GCP Associate" } })
    expect(onFieldChange).toHaveBeenCalledWith("cert-1", "name", "GCP Associate")
  })

  it("calls onFieldChange for issuer field on blur in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <CertificationsSectionRenderer
        items={[buildItem()]}
        onFieldChange={onFieldChange}
      />
    )
    const field = screen.getByLabelText("Edit issuer")
    fireEvent.blur(field, { target: { textContent: "Google" } })
    expect(onFieldChange).toHaveBeenCalledWith("cert-1", "issuer", "Google")
  })

  it("calls onDeleteItem with item id when delete button is clicked", () => {
    const onDeleteItem = vi.fn()
    render(
      <CertificationsSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    fireEvent.click(screen.getByLabelText("Delete item"))
    expect(onDeleteItem).toHaveBeenCalledWith("cert-1")
  })

  it("renders add buttons when onAddItem is provided", () => {
    const onAddItem = vi.fn()
    render(
      <CertificationsSectionRenderer
        items={[buildItem()]}
        onAddItem={onAddItem}
      />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("does not render add buttons when onAddItem is not provided", () => {
    render(<CertificationsSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })

  it("renders an empty list without errors", () => {
    const { container } = render(<CertificationsSectionRenderer items={[]} />)
    expect(container).toBeInTheDocument()
  })

  it("renders expirationDate separator when expirationDate is null and onFieldChange provided", () => {
    const onFieldChange = vi.fn()
    render(
      <CertificationsSectionRenderer
        items={[buildItem({ expirationDate: null })]}
        onFieldChange={onFieldChange}
      />
    )
    // The separator " — " is always rendered when onFieldChange is provided
    expect(screen.getByLabelText("Edit expirationDate")).toBeInTheDocument()
  })
})
