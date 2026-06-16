import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ProjectsSectionRenderer from "./ProjectsSectionRenderer"
import type { ProjectItemDto } from "@/types/api"

function buildItem(overrides?: Partial<ProjectItemDto>): ProjectItemDto {
  return {
    type: "PROJECTS",
    id: "proj-1",
    name: "My Project",
    description: "A great project",
    technologies: "React, TypeScript",
    link: null,
    startDate: "2023-01-01",
    endDate: "2023-12-01",
    isCurrent: false,
    ...overrides,
  }
}

describe("ProjectsSectionRenderer", () => {
  it("renders project name in read-only mode", () => {
    render(<ProjectsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("My Project")).toBeInTheDocument()
  })

  it("renders description in read-only mode", () => {
    render(<ProjectsSectionRenderer items={[buildItem()]} />)
    expect(screen.getByText("A great project")).toBeInTheDocument()
  })

  it("renders formatted date range in read-only mode", () => {
    render(
      <ProjectsSectionRenderer
        items={[buildItem({ startDate: "2022-03-01", endDate: "2024-06-01", isCurrent: false })]}
      />
    )
    expect(screen.queryByText(/2022-03-01/)).not.toBeInTheDocument()
    expect(screen.getByText(/03\/2022 — 06\/2024/)).toBeInTheDocument()
  })

  it("shows Present when isCurrent is true", () => {
    render(
      <ProjectsSectionRenderer
        items={[buildItem({ isCurrent: true, endDate: null })]}
      />
    )
    expect(screen.getByText(/Present/)).toBeInTheDocument()
  })

  it("renders technology badges in read-only mode", () => {
    render(
      <ProjectsSectionRenderer
        items={[buildItem({ technologies: "React, TypeScript, Node.js" })]}
      />
    )
    expect(screen.getByText("React")).toBeInTheDocument()
    expect(screen.getByText("TypeScript")).toBeInTheDocument()
    expect(screen.getByText("Node.js")).toBeInTheDocument()
  })

  it("does not render technologies section when technologies is null", () => {
    render(<ProjectsSectionRenderer items={[buildItem({ technologies: null })]} />)
    // technology badges should not appear
    expect(screen.queryByText("React")).not.toBeInTheDocument()
  })

  it("renders link as an anchor in read-only mode", () => {
    render(
      <ProjectsSectionRenderer
        items={[buildItem({ link: "https://github.com/example/repo" })]}
      />
    )
    const anchor = screen.getByRole("link")
    expect(anchor).toHaveAttribute("href", "https://github.com/example/repo")
    expect(anchor).toHaveAttribute("target", "_blank")
  })

  it("does not render link section when link is null", () => {
    render(<ProjectsSectionRenderer items={[buildItem({ link: null })]} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("calls onFieldChange with correct args on name blur in edit mode", () => {
    const onFieldChange = vi.fn()
    render(<ProjectsSectionRenderer items={[buildItem()]} onFieldChange={onFieldChange} />)

    const field = screen.getByText("My Project")
    fireEvent.blur(field, { target: { textContent: "Updated Project" } })

    expect(onFieldChange).toHaveBeenCalledWith("proj-1", "name", "Updated Project")
  })

  it("renders delete button when onDeleteItem is provided", () => {
    const onDeleteItem = vi.fn()
    render(
      <ProjectsSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    expect(screen.getByLabelText("Delete item")).toBeInTheDocument()
  })

  it("calls onDeleteItem with item.id when delete button is clicked", () => {
    const onDeleteItem = vi.fn()
    render(
      <ProjectsSectionRenderer
        items={[buildItem()]}
        onDeleteItem={onDeleteItem}
      />
    )
    fireEvent.click(screen.getByLabelText("Delete item"))
    expect(onDeleteItem).toHaveBeenCalledWith("proj-1")
  })

  it("renders add buttons when onAddItem is provided — at least 2 for a 1-item section", () => {
    const onAddItem = vi.fn()
    render(
      <ProjectsSectionRenderer
        items={[buildItem()]}
        onAddItem={onAddItem}
      />
    )
    const addButtons = screen.getAllByLabelText("Add item here")
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it("does not render add buttons when onAddItem is not provided", () => {
    render(<ProjectsSectionRenderer items={[buildItem()]} />)
    expect(screen.queryByLabelText("Add item here")).not.toBeInTheDocument()
  })

  it("renders editable technologies field in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <ProjectsSectionRenderer
        items={[buildItem({ technologies: "React, TypeScript" })]}
        onFieldChange={onFieldChange}
      />
    )
    const field = screen.getByLabelText("Edit technologies")
    expect(field).toBeInTheDocument()
  })

  it("renders editable link field in edit mode", () => {
    const onFieldChange = vi.fn()
    render(
      <ProjectsSectionRenderer
        items={[buildItem({ link: "https://example.com" })]}
        onFieldChange={onFieldChange}
      />
    )
    const field = screen.getByLabelText("Edit link")
    expect(field).toBeInTheDocument()
  })

  it("renders empty list without crashing", () => {
    render(<ProjectsSectionRenderer items={[]} />)
    expect(screen.queryByText("My Project")).not.toBeInTheDocument()
  })
})
