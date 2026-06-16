import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// Mock @base-ui/react/dialog so Sheet components render without needing a
// real browser dialog implementation in jsdom.
vi.mock("@base-ui/react/dialog", () => {
  const Root = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="sheet-root" {...props}>{children}</div>
  )
  const Trigger = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button data-testid="sheet-trigger" {...props}>{children}</button>
  )
  const Close = ({ children, render: renderProp, ...props }: React.PropsWithChildren<{ render?: React.ReactElement }> & Record<string, unknown>) => {
    if (renderProp) {
      return React.cloneElement(renderProp as React.ReactElement<Record<string, unknown>>, { ...props, children })
    }
    return <button data-testid="sheet-close" {...props}>{children}</button>
  }
  const Portal = ({ children }: React.PropsWithChildren) => <>{children}</>
  const Backdrop = ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="sheet-overlay" className={className} {...props}>{children}</div>
  )
  const Popup = ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="sheet-popup" className={className} {...props}>{children}</div>
  )
  const Title = ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
    <h2 data-testid="sheet-title" className={className} {...props}>{children}</h2>
  )
  const Description = ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
    <p data-testid="sheet-description" className={className} {...props}>{children}</p>
  )
  return {
    Dialog: { Root, Trigger, Close, Portal, Backdrop, Popup, Title, Description },
  }
})

import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet"

describe("Sheet components", () => {
  it("Sheet renders its children", () => {
    render(<Sheet open><div>sheet content</div></Sheet>)
    expect(screen.getByText("sheet content")).toBeInTheDocument()
  })

  it("SheetTrigger renders its children", () => {
    render(<SheetTrigger>Open</SheetTrigger>)
    expect(screen.getByText("Open")).toBeInTheDocument()
  })

  it("SheetClose renders its children", () => {
    render(<SheetClose>Close</SheetClose>)
    expect(screen.getByText("Close")).toBeInTheDocument()
  })

  it("SheetHeader renders children with data-slot attribute", () => {
    render(<SheetHeader><span>Header content</span></SheetHeader>)
    const header = screen.getByText("Header content").closest("[data-slot='sheet-header']")
    expect(header).toBeInTheDocument()
  })

  it("SheetFooter renders children with data-slot attribute", () => {
    render(<SheetFooter><span>Footer content</span></SheetFooter>)
    const footer = screen.getByText("Footer content").closest("[data-slot='sheet-footer']")
    expect(footer).toBeInTheDocument()
  })

  it("SheetTitle renders children", () => {
    render(<SheetTitle>My Title</SheetTitle>)
    expect(screen.getByText("My Title")).toBeInTheDocument()
  })

  it("SheetDescription renders children", () => {
    render(<SheetDescription>Some description</SheetDescription>)
    expect(screen.getByText("Some description")).toBeInTheDocument()
  })

  it("SheetContent renders children and close button by default", () => {
    render(
      <SheetContent>
        <div>Panel content</div>
      </SheetContent>
    )
    expect(screen.getByText("Panel content")).toBeInTheDocument()
    expect(screen.getByText("Close", { selector: ".sr-only" })).toBeInTheDocument()
  })

  it("SheetContent with showCloseButton=false hides the close button", () => {
    render(
      <SheetContent showCloseButton={false}>
        <div>No close button</div>
      </SheetContent>
    )
    expect(screen.getByText("No close button")).toBeInTheDocument()
    expect(screen.queryByText("Close", { selector: ".sr-only" })).not.toBeInTheDocument()
  })

  it("SheetContent renders with correct data-side attribute", () => {
    render(
      <SheetContent side="left">
        <div>Left panel</div>
      </SheetContent>
    )
    const popup = screen.getByTestId("sheet-popup")
    expect(popup).toHaveAttribute("data-side", "left")
  })

  it("SheetHeader merges extra className", () => {
    render(<SheetHeader className="extra-class"><span>H</span></SheetHeader>)
    const header = screen.getByText("H").parentElement
    expect(header).toHaveClass("extra-class")
  })

  it("SheetFooter merges extra className", () => {
    render(<SheetFooter className="extra-footer"><span>F</span></SheetFooter>)
    const footer = screen.getByText("F").parentElement
    expect(footer).toHaveClass("extra-footer")
  })
})
