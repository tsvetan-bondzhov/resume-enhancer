import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import NotFoundPage from "./NotFoundPage"

describe("NotFoundPage", () => {
  it("renders 404 heading and link to dashboard", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole("heading", { name: /404/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeInTheDocument()
  })
})
