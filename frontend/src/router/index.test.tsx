import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, Navigate, Outlet, RouterProvider } from "react-router-dom"

// Mock useAuthStore — state is controlled per test
let mockToken: string | null = null
let mockUserRole: string | null = null

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: () => ({
    token: mockToken,
    user: mockUserRole ? { role: mockUserRole } : null,
  }),
}))

// Mock AppShell to render children transparently
vi.mock("@/components/layout/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="appshell">{children}</div>,
}))

// Mock all page components to avoid heavy rendering in router integration tests
vi.mock("@/pages/LoginPage", () => ({ default: () => <div data-testid="login-page" /> }))
vi.mock("@/pages/SignupPage", () => ({ default: () => <div data-testid="signup-page" /> }))
vi.mock("@/pages/DashboardPage", () => ({ default: () => <div data-testid="dashboard-page" /> }))
vi.mock("@/pages/EditorPage", () => ({ default: () => <div data-testid="editor-page" /> }))
vi.mock("@/pages/ProfilePage", () => ({ default: () => <div data-testid="profile-page" /> }))
vi.mock("@/pages/SettingsPage", () => ({ default: () => <div data-testid="settings-page" /> }))
vi.mock("@/pages/NotFoundPage", () => ({ default: () => <div data-testid="not-found-page" /> }))
vi.mock("@/pages/AiTestPage", () => ({ default: () => <div data-testid="ai-test-page" /> }))
vi.mock("@/pages/AdminPage", () => ({ default: () => <div data-testid="admin-page" /> }))
vi.mock("@/pages/TemplateEditorPage", () => ({ default: () => <div data-testid="template-editor-page" /> }))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div data-testid="skeleton" /> }))

// ProtectedRoute is not exported, so we exercise it via the router config.
// We import the router to ensure line 32 (createBrowserRouter call) executes.
import { router } from "./index"

// Also import ProtectedRoute logic by rendering routes that replicate its behaviour
// using MemoryRouter (avoids the need for a real browser history).
// We re-implement the ProtectedRoute inline here because it is not exported,
// but the import above already executes all module-level lines.

import { useAuthStore } from "@/stores/useAuthStore"
import AppShell from "@/components/layout/AppShell"

/** Mirrors the real ProtectedRoute so we can unit-test the guard logic. */
function ProtectedRouteUnderTest({ requireAdmin = false }: Readonly<{ requireAdmin?: boolean }>) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (requireAdmin && (user as { role?: string } | null)?.role !== "ADMIN") return <Navigate to="/" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function renderWithRouter(path: string, requireAdmin = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/" element={<div>home-page</div>} />
        <Route element={<ProtectedRouteUnderTest requireAdmin={requireAdmin} />}>
          <Route path="/protected" element={<div>protected-content</div>} />
          <Route path="/admin" element={<div>admin-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToken = null
    mockUserRole = null
  })

  it("redirects to /login when token is absent", () => {
    mockToken = null
    renderWithRouter("/protected")
    expect(screen.getByText("login-page")).toBeInTheDocument()
  })

  it("renders protected content when token is present", () => {
    mockToken = "valid-token"
    mockUserRole = "USER"
    renderWithRouter("/protected")
    expect(screen.getByText("protected-content")).toBeInTheDocument()
    expect(screen.getByTestId("appshell")).toBeInTheDocument()
  })

  it("redirects to / when requireAdmin and user is not ADMIN", () => {
    mockToken = "valid-token"
    mockUserRole = "USER"
    renderWithRouter("/admin", true)
    expect(screen.getByText("home-page")).toBeInTheDocument()
  })

  it("renders admin content when requireAdmin and user role is ADMIN", () => {
    mockToken = "valid-token"
    mockUserRole = "ADMIN"
    renderWithRouter("/admin", true)
    expect(screen.getByText("admin-content")).toBeInTheDocument()
  })
})

describe("router module", () => {
  it("exports a router object", () => {
    expect(router).toBeDefined()
    expect(typeof router.navigate).toBe("function")
  })
})

// ─── RouterProvider integration tests — exercise the actual ProtectedRoute ───
// These tests render the real router via RouterProvider so that lines 22-26 of
// index.tsx (the ProtectedRoute function body) are executed directly.

describe("ProtectedRoute via RouterProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToken = null
    mockUserRole = null
  })

  it("redirects unauthenticated user from / to /login", async () => {
    mockToken = null
    mockUserRole = null
    router.navigate("/")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("login-page")
  })

  it("renders dashboard for authenticated non-admin user at /", async () => {
    mockToken = "tok"
    mockUserRole = "USER"
    router.navigate("/")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("dashboard-page")
  })

  it("redirects non-admin to / when accessing /admin", async () => {
    mockToken = "tok"
    mockUserRole = "USER"
    router.navigate("/admin")
    render(<RouterProvider router={router} />)
    // non-admin → redirected to / → dashboard shown
    await screen.findByTestId("dashboard-page")
  })

  it("renders admin page for ADMIN user at /admin", async () => {
    mockToken = "tok"
    mockUserRole = "ADMIN"
    router.navigate("/admin")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("admin-page")
  })

  it("renders template editor page for authenticated user at /templates/custom/new", async () => {
    mockToken = "tok"
    mockUserRole = "USER"
    router.navigate("/templates/custom/new")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("template-editor-page")
  })

  it("renders template editor page for authenticated user at /templates/custom/:id/edit", async () => {
    mockToken = "tok"
    mockUserRole = "USER"
    router.navigate("/templates/custom/some-id/edit")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("template-editor-page")
  })

  it("redirects unauthenticated user from /templates/custom/new to /login", async () => {
    mockToken = null
    mockUserRole = null
    router.navigate("/templates/custom/new")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("login-page")
  })

  it("redirects unauthenticated user from /templates/custom/:id/edit to /login", async () => {
    mockToken = null
    mockUserRole = null
    router.navigate("/templates/custom/some-id/edit")
    render(<RouterProvider router={router} />)
    await screen.findByTestId("login-page")
  })
})
