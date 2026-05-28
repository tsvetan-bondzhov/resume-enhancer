# Story 1.5: Protected Routes & Application Shell

Status: done

## Story

As an authenticated user,
I want all application routes to require authentication and have a consistent navigation shell,
So that the application is secure and easy to navigate.

## Acceptance Criteria

1. **Given** an unauthenticated user attempts to navigate to any route except `/login` or `/signup` **When** the router evaluates the route **Then** the user is redirected to `/login`.

2. **Given** the router configuration is inspected **When** routes are listed **Then** `/login` and `/signup` are public; `/`, `/resumes/:id`, `/profile`, and `/admin` are protected by `ProtectedRoute`.

3. **Given** an authenticated user with `USER` role attempts to access `/admin` **When** the route is evaluated **Then** they are redirected to the dashboard (role-gated at route level).

4. **Given** an authenticated user is on any protected page **When** the page renders **Then** a consistent `AppShell` navigation is visible with links to Dashboard, Profile, and (if ADMIN) Admin panel, plus a Sign Out button.

5. **Given** the application is viewed on a screen narrower than 768px **When** the layout renders **Then** the responsive base breakpoints are applied per UX-DR16 (no broken layouts below tablet width).

6. **Given** an unauthenticated user is on any route **When** their `apiClient` receives a 401 response **Then** `clearAuth()` is called AND the user is immediately redirected to `/login` — satisfying the deferred gap from Story 1.3 code review (deferred-work.md F1).

7. **Given** a user navigates to an unknown/unmatched URL **When** the router evaluates the path **Then** a 404/catch-all route renders a "Not Found" page — satisfying the deferred gap from Story 1.2 code review (deferred-work.md F10).

## Tasks / Subtasks

- [x] Task 1: Create `AppShell` layout component (AC: 4, 5)
  - [x] Create `frontend/src/components/layout/AppShell.tsx`
  - [x] Layout: top navigation bar (sticky, `border-b border-border bg-background`) with app name on the left and nav links + sign-out on the right
  - [x] Nav links: "Dashboard" → `/`, "Profile" → `/profile`; conditionally "Admin" → `/admin` only when `user?.role === "ADMIN"`
  - [x] Sign Out button: calls `useSignOut()` hook imported from `@/hooks/useSignOut`
  - [x] Responsive: on `<768px` (mobile), the nav bar is simplified — keep app name and sign-out only; hide nav links (Dashboard, Profile) behind a hamburger menu OR just hide them entirely (acceptable for v1 — Story 1.5 scope is not a full mobile menu, just no broken layouts)
  - [x] Use `<nav>` element with `aria-label="Main navigation"` for the nav bar
  - [x] Children rendered below the nav bar via `{children}` prop: `children: React.ReactNode`
  - [x] Active link state: use React Router `NavLink` component (not `<a>`) with `className` callback to apply active styling (`text-blue-600 font-medium` on active, `text-zinc-600 hover:text-zinc-900` on inactive)
  - [x] Place `AppShell.tsx` in `frontend/src/components/layout/` — create the `layout/` directory if it does not exist yet

- [x] Task 2: Wire `AppShell` into the router's protected routes (AC: 1, 2, 3, 4)
  - [x] Update `frontend/src/router/index.tsx`
  - [x] The existing `ProtectedRoute` component renders `<Outlet />` — wrap that `<Outlet />` with `<AppShell>` so every protected page is automatically wrapped in the shell
  - [x] Router config already has all required routes (`/`, `/resumes/:id`, `/profile`, `/admin`) — do NOT restructure the route tree; just add `AppShell` as the layout wrapper inside `ProtectedRoute`
  - [x] Add a catch-all route `{ path: "*", element: <NotFoundPage /> }` at the end of the router array (outside all protected wrappers) to handle unknown URLs (deferred-work.md F10)
  - [x] Existing `ProtectedRoute` already handles: no-token → `/login`, non-ADMIN → `/` for admin route — do NOT change that logic

- [x] Task 3: Create `NotFoundPage.tsx` (AC: 7)
  - [x] Create `frontend/src/pages/NotFoundPage.tsx`
  - [x] Simple page: "404 — Page Not Found" heading + "Go to Dashboard" link back to `/`
  - [x] Does NOT use `AppShell` (unauthenticated users may land here)
  - [x] Matches the visual style of `LoginPage.tsx` (centered card, same Tailwind classes)

- [x] Task 4: Fix `apiClient.ts` 401 redirect gap (AC: 6)
  - [x] Update `frontend/src/lib/apiClient.ts`
  - [x] Current state: on 401, calls `useAuthStore.getState().clearAuth()` but does NOT redirect (known deferred gap from deferred-work.md F1 / Story 1.3 review)
  - [x] Required state: after `clearAuth()`, also redirect to `/login` using `window.location.href = '/login'` — this is intentional (not `useNavigate`) because `apiClient` is a plain module outside React's component tree and has no access to React Router context
  - [x] The redirect must only fire when the response is 401 (not for all error responses)
  - [x] The check `if (res.status === 401)` block already exists — add `window.location.href = '/login'` immediately after `useAuthStore.getState().clearAuth()`

- [x] Task 5: Update page stubs to render inside `AppShell` context (no change needed — automatic)
  - [x] `DashboardPage.tsx`, `EditorPage.tsx`, `ProfilePage.tsx`, `AdminPage.tsx` are all rendered as `<Outlet />` children inside `ProtectedRoute` which now wraps with `AppShell`
  - [x] These pages remain simple stubs (`<div>Dashboard Page</div>` etc.) — no changes needed; they will simply appear inside the `AppShell` wrapper automatically

- [x] Task 6: Write frontend tests (AC: 1, 2, 3, 4, 6)
  - [x] Create `frontend/src/components/layout/AppShell.test.tsx`
  - [x] Test: renders nav links for USER role (Dashboard, Profile visible; Admin NOT visible)
  - [x] Test: renders Admin nav link for ADMIN role
  - [x] Test: Sign Out button calls `useSignOut` (mock the hook)
  - [x] Test: `AppShell` renders children
  - [x] Co-locate test alongside component: `frontend/src/components/layout/AppShell.test.tsx`
  - [x] Use Vitest (already configured from Story 1.2) — no new test setup required

- [x] Task 7: Lint check (required before marking story `review`)
  - [x] Run `cd frontend && npm run lint` — must pass with 0 errors
  - [x] New router file uses `/* eslint-disable react-refresh/only-export-components */` at top — already present in `router/index.tsx`; keep it

## Dev Notes

### What Story 1.4 Built (Current State)

All of the following exist and are fully implemented — DO NOT recreate:

**Frontend (fully implemented):**
- `frontend/src/router/index.tsx` — complete router with `ProtectedRoute` (handles `requireAdmin`), all page routes, lazy `AdminPage`; does NOT yet wrap protected outlets in `AppShell`; no catch-all route
- `frontend/src/hooks/useSignOut.ts` — `useSignOut()` returns a function that calls `clearAuth()` then `navigate("/login", { replace: true })`; import and use this directly in `AppShell`
- `frontend/src/stores/useAuthStore.ts` — `{ token, user, setAuth, clearAuth }` — `user` is `UserDto | null`; `UserDto.role` is `"USER" | "ADMIN"`
- `frontend/src/lib/apiClient.ts` — on 401: calls `clearAuth()` but does NOT redirect; `window.location.href = '/login'` must be added in Task 4
- `frontend/src/pages/LoginPage.tsx` — fully implemented with redirect-if-authenticated guard
- `frontend/src/pages/SignupPage.tsx` — fully implemented; use as style reference for `NotFoundPage.tsx`
- `frontend/src/types/api.ts` — `UserDto`: `{ id: string; email: string; role: "USER" | "ADMIN" }` — use for admin role check
- `frontend/src/components/ui/` — shadcn-managed; do NOT edit. Available: `button`, `input`, `textarea`, `dialog`, `sheet`, `toast`, `tabs`, `badge`, `collapsible`, `checkbox`, `skeleton`, `sonner`

**Frontend (stubs — do not change their content):**
- `frontend/src/pages/DashboardPage.tsx` — `<div>Dashboard Page</div>` — stub, left to Epic 3
- `frontend/src/pages/EditorPage.tsx` — `<div>Editor Page</div>` — stub, left to Epic 3
- `frontend/src/pages/ProfilePage.tsx` — `<div>Profile Page</div>` — stub, left to Epic 2
- `frontend/src/pages/AdminPage.tsx` — `<div>Admin Page</div>` — stub, left to Epic 6

**No backend changes required for this story.**

### Critical: `AppShell` Implementation Pattern

The `ProtectedRoute` component already renders `<Outlet />`. Wrap it with `AppShell`:

```tsx
// router/index.tsx — updated ProtectedRoute render
function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (requireAdmin && user?.role !== "ADMIN") return <Navigate to="/" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
```

This means ALL protected routes automatically get the shell. No per-page changes needed.

### `AppShell` Component Structure

```tsx
// frontend/src/components/layout/AppShell.tsx
import { NavLink } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/useAuthStore"
import { useSignOut } from "@/hooks/useSignOut"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((state) => state.user)
  const signOut = useSignOut()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"
        >
          <span className="text-lg font-semibold">Resume Enhancer</span>
          <div className="flex items-center gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? "text-sm font-medium text-blue-600"
                  : "text-sm text-zinc-600 hover:text-zinc-900"
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                isActive
                  ? "text-sm font-medium text-blue-600"
                  : "text-sm text-zinc-600 hover:text-zinc-900"
              }
            >
              Profile
            </NavLink>
            {user?.role === "ADMIN" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  isActive
                    ? "text-sm font-medium text-blue-600"
                    : "text-sm text-zinc-600 hover:text-zinc-900"
                }
              >
                Admin
              </NavLink>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### `apiClient.ts` 401 Fix — Exact Change Required

Current (lines 30–33 of `apiClient.ts`):
```ts
if (res.status === 401) {
  useAuthStore.getState().clearAuth()
  throw new ApiError(401, "Unauthorized")
}
```

Required change:
```ts
if (res.status === 401) {
  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
  throw new ApiError(401, "Unauthorized")
}
```

**Why `window.location.href` and NOT `useNavigate`:** `apiClient.ts` is a plain TypeScript module (not a React component or hook). It has no access to React Router's context or `useNavigate`. Using `window.location.href` is the correct approach for redirects outside React's component tree. This pattern is explicitly required by the project-context rule: "apiClient receives a 401 → clears useAuthStore token + redirects to `/login`".

**Note for `LoginPage.tsx`:** `LoginPage.tsx` calls `apiClient.post` for the login request itself. The 401 response on bad credentials is caught in the `catch (err)` block and shown as a Toast — it does NOT trigger the global 401 redirect because `LoginPage.tsx` explicitly handles `ApiError` with `err.status === 401`. The `window.location.href` redirect fires after `throw new ApiError(401, "Unauthorized")` — but the `throw` happens before `window.location.href`... 

**CRITICAL ORDER FIX:** `window.location.href` assignment must happen BEFORE `throw` to guarantee it executes, because after `throw` the browser receives the navigation but the JS call stack may not complete. Place it as:
```ts
if (res.status === 401) {
  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
  throw new ApiError(401, "Unauthorized")
}
```
In practice the assignment happens synchronously before the throw unwinds the stack, so the navigation is queued. However, to avoid the redirect firing on the login page itself when a user enters wrong credentials: the login page catch block catches the `ApiError` before it propagates. Since `LoginPage` catches `ApiError` and handles 401 as a Toast, this is fine — the redirect will be queued but the `LoginPage` is already at `/login`.

**Alternative approach (preferred to avoid login-page redirect noise):** Only redirect if the current path is NOT `/login` and NOT `/signup`:

```ts
if (res.status === 401) {
  useAuthStore.getState().clearAuth()
  if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
    window.location.href = '/login'
  }
  throw new ApiError(401, "Unauthorized")
}
```

Use this conditional approach — it prevents the unnecessary redirect when the login page itself receives a 401 (bad credentials).

### Router `index.tsx` — Exact Structure After Changes

```tsx
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from "react"
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/stores/useAuthStore"
import { Skeleton } from "@/components/ui/skeleton"
import AppShell from "@/components/layout/AppShell"
import LoginPage from "@/pages/LoginPage"
import SignupPage from "@/pages/SignupPage"
import DashboardPage from "@/pages/DashboardPage"
import EditorPage from "@/pages/EditorPage"
import ProfilePage from "@/pages/ProfilePage"
import NotFoundPage from "@/pages/NotFoundPage"

const AdminPage = lazy(() => import("@/pages/AdminPage"))

function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (requireAdmin && user?.role !== "ADMIN") return <Navigate to="/" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/resumes/:id", element: <EditorPage /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
  {
    element: <ProtectedRoute requireAdmin />,
    children: [
      {
        path: "/admin",
        element: (
          <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <AdminPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
```

### `NotFoundPage.tsx` Pattern

```tsx
import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-background p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">404 — Page Not Found</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
```

### Responsive Behaviour (AC 5 — UX-DR16)

The `AppShell` nav bar must not break on mobile (`<768px`). The simplest compliant implementation:
- On mobile, keep app name and Sign Out button visible
- Hide nav links (Dashboard, Profile, Admin) with `hidden md:flex` on the nav links container
- This is acceptable for v1 — mobile is read-only only (UX-DR16) and the dashboard is still accessible via the app root

```tsx
<div className="hidden md:flex items-center gap-4">
  {/* NavLink for Dashboard */}
  {/* NavLink for Profile */}
  {/* NavLink for Admin (conditional) */}
</div>
<Button variant="ghost" size="sm" onClick={signOut} className="md:ml-4">
  Sign Out
</Button>
```

### File Structure — This Story Creates / Modifies

**NEW files:**
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/AppShell.test.tsx`
- `frontend/src/pages/NotFoundPage.tsx`

**MODIFIED files:**
- `frontend/src/router/index.tsx` — add `AppShell` wrapper in `ProtectedRoute`, add `NotFoundPage` catch-all
- `frontend/src/lib/apiClient.ts` — add redirect after `clearAuth()` on 401 (with path guard)

**DO NOT touch:**
- `frontend/src/stores/useAuthStore.ts` — already correct
- `frontend/src/hooks/useSignOut.ts` — already implemented in Story 1.4; import and use as-is
- `frontend/src/pages/DashboardPage.tsx` — stub, untouched
- `frontend/src/pages/EditorPage.tsx` — stub, untouched
- `frontend/src/pages/ProfilePage.tsx` — stub, untouched
- `frontend/src/pages/AdminPage.tsx` — stub, untouched
- Any files under `frontend/src/components/ui/` — shadcn-managed, never edit
- No backend files — this story is frontend-only

### No Backend Changes

This story is **100% frontend-only**. No Java changes, no Flyway migrations, no Spring Security changes.

### Deferred Work Items Addressed

This story closes two deferred items from previous code reviews (in `_bmad-output/implementation-artifacts/deferred-work.md`):
- **F10** (from Story 1.2 review): No 404/catch-all route → addressed by Task 3 + Task 2 catch-all route
- **F1** (from Story 1.3 review): `apiClient.ts` missing `window.location.href = '/login'` redirect on 401 → addressed by Task 4

### Vitest Testing Pattern (from Story 1.2)

Tests are co-located alongside source files as `<Component>.test.tsx`. Vitest is already configured — no new setup required.

For `AppShell.test.tsx`, mock `useAuthStore` and `useSignOut`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import AppShell from './AppShell'
import * as authStore from '@/stores/useAuthStore'
import * as signOutHook from '@/hooks/useSignOut'

// Mock useAuthStore to control user.role
vi.mock('@/stores/useAuthStore')
vi.mock('@/hooks/useSignOut')
```

### Lint Requirement

Before marking story `review`: run `cd frontend && npm run lint` — must pass with 0 errors.

ESLint reminder: `router/index.tsx` already has `/* eslint-disable react-refresh/only-export-components */` at the top — keep it when modifying the file.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_none_

### Completion Notes List

- Created `AppShell` layout component with sticky nav bar, responsive mobile handling (`hidden md:flex` for nav links), `NavLink` active styling, conditional Admin link for ADMIN role, and Sign Out button wired to `useSignOut()`.
- Updated `ProtectedRoute` in `router/index.tsx` to wrap `<Outlet />` with `<AppShell>`, so all protected routes automatically render within the shell. Added `NotFoundPage` catch-all route `{ path: "*" }` to close deferred-work.md F10.
- Created `NotFoundPage.tsx` as a centered card page (matching `LoginPage.tsx` visual style) with "404 — Page Not Found" heading and "Go to Dashboard" link.
- Fixed `apiClient.ts` 401 gap (deferred-work.md F1): added conditional `window.location.href = '/login'` redirect after `clearAuth()`, guarded to not fire when already on `/login` or `/signup` to avoid redirect noise on bad credentials.
- Task 5 required no code changes — page stubs automatically render inside `AppShell` via `ProtectedRoute`.
- Wrote 5 Vitest unit tests for `AppShell`: USER role nav visibility, ADMIN role nav visibility, Sign Out click, children rendering, and nav landmark. All 5 tests pass.
- Lint (`npm run lint`) passes with 0 errors.

### File List

- `frontend/src/components/layout/AppShell.tsx` (new)
- `frontend/src/components/layout/AppShell.test.tsx` (new)
- `frontend/src/pages/NotFoundPage.tsx` (new)
- `frontend/src/router/index.tsx` (modified)
- `frontend/src/lib/apiClient.ts` (modified)

### Change Log

- 2026-05-20: Story 1.5 implemented — created AppShell layout component, wired into protected routes, added NotFoundPage with catch-all route, fixed apiClient 401 redirect gap. 5 tests added and passing. Lint clean.

## Review Findings

_Reviewed by bmad-code-review on 2026-05-20_

- [x] [Review][Defer] AppShell.test.tsx — `mockUseAuthStore.mockReturnValue(userObject)` ignores the selector function [frontend/src/components/layout/AppShell.test.tsx:24] — deferred, pre-existing test mock pattern; tests pass correctly in practice; selector-aware mock is a quality improvement for a future test refactor pass
