import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminPage from "./AdminPage"

describe("AdminPage", () => {
  it("renders the Admin Page text", () => {
    render(<AdminPage />)
    expect(screen.getByText("Admin Page")).toBeInTheDocument()
  })
})
