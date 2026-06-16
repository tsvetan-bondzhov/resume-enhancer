import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "./card"

describe("Card UI components", () => {
  it("Card renders its children with data-slot=card", () => {
    render(<Card><span>card body</span></Card>)
    expect(screen.getByText("card body")).toBeInTheDocument()
    const card = screen.getByText("card body").closest("[data-slot='card']")
    expect(card).toBeInTheDocument()
  })

  it("CardHeader renders its children with data-slot=card-header", () => {
    render(<CardHeader><span>header</span></CardHeader>)
    const header = screen.getByText("header").closest("[data-slot='card-header']")
    expect(header).toBeInTheDocument()
  })

  it("CardTitle renders its children with data-slot=card-title", () => {
    render(<CardTitle>My Title</CardTitle>)
    expect(screen.getByText("My Title")).toBeInTheDocument()
    const title = screen.getByText("My Title").closest("[data-slot='card-title']")
    expect(title).toBeInTheDocument()
  })

  it("CardContent renders its children with data-slot=card-content", () => {
    render(<CardContent><span>content</span></CardContent>)
    const content = screen.getByText("content").closest("[data-slot='card-content']")
    expect(content).toBeInTheDocument()
  })

  // Line 50 — CardDescription
  it("CardDescription renders its children with data-slot=card-description", () => {
    render(<CardDescription>A description</CardDescription>)
    expect(screen.getByText("A description")).toBeInTheDocument()
    const desc = screen.getByText("A description").closest("[data-slot='card-description']")
    expect(desc).toBeInTheDocument()
  })

  it("CardDescription merges extra className", () => {
    render(<CardDescription className="extra-class">desc</CardDescription>)
    const desc = screen.getByText("desc").closest("[data-slot='card-description']")
    expect(desc).toHaveClass("extra-class")
    expect(desc).toHaveClass("text-muted-foreground")
  })

  // Line 60 — CardAction
  it("CardAction renders its children with data-slot=card-action", () => {
    render(<CardAction><button>action</button></CardAction>)
    expect(screen.getByRole("button", { name: "action" })).toBeInTheDocument()
    const action = screen.getByRole("button", { name: "action" }).closest("[data-slot='card-action']")
    expect(action).toBeInTheDocument()
  })

  it("CardAction merges extra className", () => {
    render(<CardAction className="my-action">act</CardAction>)
    const action = screen.getByText("act").closest("[data-slot='card-action']")
    expect(action).toHaveClass("my-action")
  })

  // Line 83 — CardFooter
  it("CardFooter renders its children with data-slot=card-footer", () => {
    render(<CardFooter><span>footer</span></CardFooter>)
    const footer = screen.getByText("footer").closest("[data-slot='card-footer']")
    expect(footer).toBeInTheDocument()
  })

  it("CardFooter merges extra className", () => {
    render(<CardFooter className="ft-extra"><span>ft</span></CardFooter>)
    const footer = screen.getByText("ft").closest("[data-slot='card-footer']")
    expect(footer).toHaveClass("ft-extra")
  })

  it("Card renders with sm size via data-size attribute", () => {
    const { container } = render(<Card size="sm"><span>sm card</span></Card>)
    const card = container.querySelector("[data-slot='card']")
    expect(card).toHaveAttribute("data-size", "sm")
  })
})
