# Story 1.2: Frontend Scaffold & Design Token Foundation

Status: review

## Story

As a developer,
I want the React/TypeScript frontend scaffolded with shadcn/ui, Vite, Tailwind CSS, and the design token foundation configured,
so that all frontend stories have a consistent visual foundation and component library to build on.

## Acceptance Criteria

1. **Given** `npx shadcn@latest init -t vite` has been run in the `frontend/` directory **When** `cd frontend && npm run dev` is executed **Then** the Vite dev server starts on `:5173` and the default app renders without errors.

2. **Given** the frontend scaffold is complete **When** the Tailwind config is inspected **Then** the design token foundation is configured: primary accent `blue-600`, neutral palette `zinc/slate`, border radius `md`, `Inter` font family (UX-DR12).

3. **Given** shadcn/ui components are installed **When** the component list is checked **Then** `button`, `input`, `textarea`, `dialog`, `sheet`, `toast`, `tabs`, `badge`, `collapsible`, `checkbox`, `skeleton` are all present under `frontend/src/components/ui/`.

4. **Given** Zustand and React Router are installed **When** `frontend/package.json` is inspected **Then** `react-router-dom` and `zustand` are listed as dependencies.

5. **Given** the Vite config is set up **When** a request to `/api/**` is made from the dev server **Then** it is proxied to `http://localhost:8080`.

6. **Given** Vitest is configured **When** `npm run test` is executed **Then** the test runner starts and exits cleanly with 0 failures (no tests yet, but the runner is wired).

7. **Given** the `@/` path alias is configured **When** a TypeScript file uses `import { x } from '@/components/...'` **Then** TypeScript and Vite both resolve the alias without errors.

8. **Given** the four Zustand stores are created **When** `frontend/src/stores/` is inspected **Then** `useAuthStore.ts`, `useResumeStore.ts`, `useChatStore.ts`, and `useProfileStore.ts` each exist with typed initial state and no `useState` cross-component data.

9. **Given** the API client and SSE client are created **When** `frontend/src/lib/` is inspected **Then** `apiClient.ts` and `sseClient.ts` exist; `apiClient.ts` injects `Authorization: Bearer <token>` and redirects to `/login` on 401; `sseClient.ts` wraps `EventSource` (no raw `EventSource` elsewhere).

10. **Given** the router is set up **When** `frontend/src/router/index.tsx` is inspected **Then** `ProtectedRoute` redirects unauthenticated users to `/login`; public routes are `/login` and `/signup`; protected routes are `/`, `/resumes/:id`, `/profile`, `/admin`.

11. **Given** the `types/api.ts` file is created **When** it is inspected **Then** it contains at minimum typed interfaces for `AuthResponse`, `UserDto` — foundation for future DTO shapes.

12. **Given** the `frontend-maven-plugin` added in Story 1.1 **When** `mvn package` is run from the project root with the `frontend/` directory present **Then** `npm install` and `npm run build` execute and `frontend/dist/` is copied to `src/main/resources/static/`.

## Tasks / Subtasks

- [x] Task 1: Scaffold frontend with shadcn/ui CLI (AC: 1, 2, 3)
  - [x] Run `npx shadcn@latest init -t vite` from project root — creates `frontend/` subdirectory; when prompted: project name → `frontend`, base color → `zinc`
  - [x] Install shadcn/ui components: `npx shadcn@latest add button input textarea dialog sheet toast tabs badge collapsible checkbox skeleton` (run from `frontend/`)
  - [x] Install additional npm dependencies: `npm install react-router-dom zustand` (from `frontend/`)
  - [x] Install Vitest and testing libraries: `npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event` (from `frontend/`)

- [x] Task 2: Configure Tailwind design token foundation (AC: 2)
  - [x] In `frontend/src/index.css` (or Tailwind CSS v4 config): set `--font-sans: "Inter", system-ui, sans-serif`; import Inter from Google Fonts or use `@fontsource/inter` package
  - [x] Verify shadcn/ui's CSS variables are configured with zinc base: `--background: zinc-50`; `--foreground: zinc-900`; `--muted-foreground: zinc-500`; `--border: zinc-200`; `--primary: blue-600`
  - [x] Tailwind CSS v4 uses `@tailwindcss/vite` plugin — confirm it is present in `vite.config.ts`; do NOT use `tailwind.config.js` (v4 is CSS-first config); extend tokens in `index.css` using `@theme` block
  - [x] Add `border-radius: var(--radius-md)` override to match UX-DR12 `border radius: md`
  - [x] Install Inter font: `npm install @fontsource/inter` and import in `src/index.css`

- [x] Task 3: Configure Vite — proxy, path alias, Vitest (AC: 5, 6, 7)
  - [x] `vite.config.ts`: add `server.proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }`
  - [x] `vite.config.ts`: verify `@/` → `src/` alias is present (shadcn init adds it); if not: `resolve.alias: { '@': path.resolve(__dirname, './src') }`
  - [x] `vite.config.ts`: add `test` block: `{ globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`
  - [x] Create `frontend/src/test/setup.ts`: `import '@testing-library/jest-dom'`
  - [x] `tsconfig.app.json`: add `"paths": { "@/*": ["./src/*"] }` (if not already added by shadcn init)
  - [x] `package.json`: add `"test": "vitest"` and `"test:ui": "vitest --ui"` scripts

- [x] Task 4: Create `types/api.ts` foundation (AC: 11)
  - [x] Create `frontend/src/types/api.ts` with initial DTO interfaces:
    - `AuthResponse { token: string; user: UserDto }`
    - `UserDto { id: string; email: string; role: 'USER' | 'ADMIN' }`
    - `ApiErrorResponse { type: string; title: string; status: number; detail: string; instance: string }` (RFC 7807 ProblemDetail shape)
  - [x] All date fields: type `string` — parse with `new Date()` only at display time (never `Date` type in DTOs)
  - [x] No `any` — strict TypeScript mode enforced

- [x] Task 5: Create Zustand stores (AC: 8)
  - [x] Create `frontend/src/stores/useAuthStore.ts`:
    ```ts
    interface AuthState { token: string | null; user: UserDto | null; setAuth: (token: string, user: UserDto) => void; clearAuth: () => void }
    ```
    Token stored in-memory only — never `localStorage` or `sessionStorage`
  - [x] Create `frontend/src/stores/useResumeStore.ts`: initial shape `{ resumes: ResumeDto[]; currentResume: ResumeDto | null; isSaving: boolean; isExporting: boolean; setCurrentResume: ...; applyPatch: ... }` — stub `applyPatch` as no-op for now (implemented fully in Story 4.2)
  - [x] Create `frontend/src/stores/useChatStore.ts`: initial shape `{ messages: ChatMessage[]; isStreaming: boolean; addMessage: ...; setStreaming: ... }`
  - [x] Create `frontend/src/stores/useProfileStore.ts`: initial shape `{ profile: ProfileDto | null; isSaving: boolean; setProfile: ... }`
  - [x] All stores use immutable update pattern: `set(state => ({ ...state, field: newValue }))` — never mutate directly
  - [x] Add stub types to `types/api.ts`: `ResumeDto`, `ChatMessage`, `ProfileDto` (minimal shape, expanded in later stories)

- [x] Task 6: Create `lib/apiClient.ts` and `lib/sseClient.ts` (AC: 9)
  - [x] `frontend/src/lib/apiClient.ts`:
    - Reads `VITE_API_BASE_URL` env var (default `''` — relies on Vite proxy in dev; set to actual URL in prod)
    - Injects `Authorization: Bearer <token>` from `useAuthStore.getState().token` on every request
    - On 401 response: calls `useAuthStore.getState().clearAuth()` then `window.location.href = '/login'`
    - Returns typed response or throws `ApiError extends Error { status: number; detail: string }`
    - No raw `fetch()` allowed anywhere else — all HTTP through this wrapper
  - [x] `frontend/src/lib/sseClient.ts`:
    - Exports `createSseConnection(url: string, handlers: { onToken, onPatch, onDone, onError }): () => void`
    - Opens `new EventSource(url)` internally; returns a cleanup function that calls `.close()`
    - Handles exactly 4 event types: `token`, `patch`, `done`, `error` — no others
    - No raw `EventSource` allowed outside this file
  - [x] Create `.env.example` in `frontend/`: `VITE_API_BASE_URL=`

- [x] Task 7: Create router with ProtectedRoute (AC: 10)
  - [x] Create `frontend/src/router/index.tsx`:
    - `ProtectedRoute` component: checks `useAuthStore().token`; if null → `<Navigate to="/login" replace />`; if role check needed (admin): also check `user.role === 'ADMIN'`
    - Route tree: `/login` (public), `/signup` (public), `/` (protected → `DashboardPage`), `/resumes/:id` (protected → `EditorPage`), `/profile` (protected → `ProfilePage`), `/admin` (protected + ADMIN role → lazy `AdminPage`)
    - `AdminPage` must be lazy-loaded: `const AdminPage = lazy(() => import('@/pages/AdminPage'))` wrapped in `<Suspense fallback={<Skeleton />}>`
  - [x] Create stub page components (minimal — just return a `<div>` with page name for now):
    - `frontend/src/pages/LoginPage.tsx`
    - `frontend/src/pages/SignupPage.tsx`
    - `frontend/src/pages/DashboardPage.tsx`
    - `frontend/src/pages/EditorPage.tsx`
    - `frontend/src/pages/ProfilePage.tsx`
    - `frontend/src/pages/AdminPage.tsx`
  - [x] Wire `App.tsx` to use `<RouterProvider router={router} />` from React Router v6

- [x] Task 8: Create `.env.example` and verify maven plugin integration (AC: 12)
  - [x] Create `frontend/.env.example` with `VITE_API_BASE_URL=`
  - [x] Verify `frontend-maven-plugin` in `pom.xml` (added in Story 1.1) picks up `frontend/` directory correctly
  - [x] If Story 1.1 is not yet complete and `frontend-maven-plugin` is absent: add `<plugin>` declaration to `pom.xml` now (same config as Story 1.1 Dev Notes); otherwise skip
  - [x] Run `cd frontend && npm run build` — verify `dist/` is generated without errors

- [x] Task 9: Verify end-to-end scaffold health (AC: 1, 6)
  - [x] Run `npm run dev` from `frontend/` — Vite starts on `:5173`, no TypeScript errors
  - [x] Run `npm run test` from `frontend/` — Vitest starts, exits with 0 failures
  - [x] Verify `@/` imports resolve correctly in at least one file (e.g., import in `App.tsx`)

## Dev Notes

### Scaffold Command Exact Sequence

```bash
# From project root:
npx shadcn@latest init -t vite
# Prompts: project name = "frontend", base color = Zinc, CSS variables = yes

cd frontend
npm install react-router-dom zustand @fontsource/inter
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event

npx shadcn@latest add button input textarea dialog sheet toast tabs badge collapsible checkbox skeleton
```

**Critical:** `shadcn@latest init -t vite` creates the `frontend/` subdirectory from the project root. Do NOT `cd frontend` before running init.

### Tailwind CSS v4 — CSS-First Configuration

Tailwind CSS v4 has no `tailwind.config.js`. All configuration is in CSS via `@theme` block in `index.css`. The shadcn CLI for vite already sets this up. Design tokens are CSS custom properties — shadcn/ui components use `--primary`, `--background`, `--foreground` etc.

To apply the required design tokens (UX-DR12), add/verify in `frontend/src/index.css`:

```css
@import "@fontsource/inter";
@import "tailwindcss";
@import "@tailwindcss/vite"; /* already handled by vite plugin, may not need explicit import */

@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --radius: 0.375rem; /* md */
  --color-primary: var(--blue-600);
}
```

The shadcn/ui Zinc base color init sets `--background`, `--foreground`, `--muted-foreground`, `--border` automatically to zinc values. Verify they align with UX spec:
- `--background`: `oklch(...)` equivalent of `zinc-50`
- `--foreground`: `zinc-900`
- `--muted-foreground`: `zinc-500`
- `--border`: `zinc-200`
- `--primary`: `blue-600`

### Vite Config Final Shape

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

### `apiClient.ts` Critical Rules

- `VITE_API_BASE_URL` is empty string by default — Vite proxy handles `/api/**` in dev; in production the JAR serves both API and SPA on the same origin so it also works as empty string
- **Never hardcode `http://localhost:8080`** in components or this file — always use the env var
- The 401 handler clears auth state AND redirects — no silent re-auth in v1
- All API functions return typed promises; errors throw `ApiError` (not raw `Response`)

```ts
// frontend/src/lib/apiClient.ts (skeleton)
import { useAuthStore } from '@/stores/useAuthStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json()
    throw new ApiError(res.status, err.detail ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

### Zustand Store Rules (Critical)

- Token is **in-memory only** — `useAuthStore` MUST NOT persist to `localStorage` via `persist` middleware
- All state updates must be immutable: `set(state => ({ ...state, field: value }))`
- `useAuthStore.getState()` (not `useAuthStore()`) must be used in `apiClient.ts` — not inside React components, so the hook form is unavailable
- Never introduce `useState` for data shared across components — always use the appropriate Zustand store

### `sseClient.ts` Event Types

Exactly 4 event types — no others will ever be emitted by the backend:
```
token  → { token: string }
patch  → { sectionId: string; itemIndex: number; field: string; newValue: string }
done   → { summary: string }
error  → { detail: string }
```

```ts
// frontend/src/lib/sseClient.ts (skeleton)
export interface SseHandlers {
  onToken: (data: { token: string }) => void
  onPatch: (data: { sectionId: string; itemIndex: number; field: string; newValue: string }) => void
  onDone: (data: { summary: string }) => void
  onError: (data: { detail: string }) => void
}

export function createSseConnection(url: string, handlers: SseHandlers): () => void {
  const es = new EventSource(url)
  es.addEventListener('token', (e) => handlers.onToken(JSON.parse(e.data)))
  es.addEventListener('patch', (e) => handlers.onPatch(JSON.parse(e.data)))
  es.addEventListener('done', (e) => { handlers.onDone(JSON.parse(e.data)); es.close() })
  es.addEventListener('error', (e) => { handlers.onError(JSON.parse((e as MessageEvent).data)); es.close() })
  return () => es.close()
}
```

### ProtectedRoute Pattern

```tsx
// frontend/src/router/index.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'

export function ProtectedRoute({ requireAdmin = false }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (requireAdmin && user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}
```

### shadcn/ui Components — Do Not Edit

Files under `frontend/src/components/ui/` are shadcn-managed — **NEVER manually edit them**. Customization is via CSS variables in `index.css` only. All custom components live alongside in `components/layout/`, `components/resume/`, etc.

### Story 1.1 Dependency Note

This story assumes Story 1.1 has been completed (or is being worked in parallel):
- `frontend-maven-plugin` must be in `pom.xml` for Task 8 AC:12 to be verifiable
- If Story 1.1 is not yet done, complete Tasks 1–9 of this story; mark Task 8's maven verification as pending Story 1.1 completion

### Frontend Directory Structure (After This Story)

```
frontend/
├── package.json           ← react-router-dom, zustand, @fontsource/inter, vitest, @testing-library/*
├── vite.config.ts         ← proxy /api, @/ alias, test block
├── tsconfig.json
├── tsconfig.app.json      ← paths: { "@/*": ["./src/*"] }
├── .env.example           ← VITE_API_BASE_URL=
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx             ← <RouterProvider router={router} />
    ├── index.css           ← @theme tokens, @fontsource/inter import
    ├── test/
    │   └── setup.ts        ← import '@testing-library/jest-dom'
    ├── router/
    │   └── index.tsx       ← React Router config + ProtectedRoute
    ├── pages/              ← stub components: Login, Signup, Dashboard, Editor, Profile, Admin
    ├── components/
    │   └── ui/             ← shadcn managed; button, input, textarea, dialog, sheet, toast, tabs, badge, collapsible, checkbox, skeleton
    ├── stores/
    │   ├── useAuthStore.ts
    │   ├── useResumeStore.ts
    │   ├── useChatStore.ts
    │   └── useProfileStore.ts
    ├── hooks/              ← empty directory (populated in later stories)
    ├── lib/
    │   ├── apiClient.ts
    │   ├── sseClient.ts
    │   └── utils.ts        ← empty stub
    └── types/
        └── api.ts          ← AuthResponse, UserDto, ApiErrorResponse + stubs
```

### Anti-Patterns to Avoid in This Story

- **Do NOT** use `localStorage` or `sessionStorage` in `useAuthStore` — token in Zustand memory only
- **Do NOT** use raw `fetch()` in any component or page — always `apiClient`
- **Do NOT** use raw `new EventSource()` outside `sseClient.ts`
- **Do NOT** manually edit `frontend/src/components/ui/` — shadcn-managed
- **Do NOT** use `any` in TypeScript — strict mode, always type explicitly
- **Do NOT** use `tailwind.config.js` — Tailwind v4 is CSS-first; config goes in `index.css` `@theme` block
- **Do NOT** introduce `useState` for cross-component state — use Zustand stores
- **Do NOT** hardcode `http://localhost:8080` — use `VITE_API_BASE_URL` env var via `apiClient`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2 — Acceptance Criteria & Additional Requirements]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend Starter: shadcn/ui CLI, Frontend Architecture, Frontend Directory Structure]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Design System Choice, Color System (UX-DR12), Typography System]
- [Source: `_bmad-output/planning-artifacts/epics.md` — UX-DR12, UX-DR16 (responsive base breakpoints)]
- [Source: `_bmad-output/project-context.md` — TypeScript rules, Framework rules (React/Frontend), Anti-Patterns]
- [Source: `pom.xml` — existing dependency baseline confirming Spring Boot 4.0.6 is present]

## Dev Agent Record

### Agent Model Used

cascade (bmad-create-story workflow, 2026-05-14)

### Debug Log References

- TS1294 fix: `erasableSyntaxOnly` disallows parameter properties in classes — used explicit field declarations in `ApiError`
- TS2769 fix: `test` field in vite.config.ts not recognized — added `/// <reference types="vitest" />` and `"vitest/config"` to tsconfig.node.json types
- shadcn `toast` component deprecated — used `sonner` instead
- shadcn defaulted to `base-nova` style (Base UI + React 19) — user approved keeping this over Radix + React 18
- Vitest exits with code 1 when no test files — added `--passWithNoTests` flag

### Completion Notes List

- Frontend scaffolded with `npx shadcn@latest init -t vite --no-monorepo -n frontend -d`
- shadcn/ui components installed: button, input, textarea, dialog, sheet, sonner (replaces deprecated toast), tabs, badge, collapsible, checkbox, skeleton
- Design tokens configured: Inter font, blue-600 primary (oklch), 0.375rem border radius
- Vite proxy /api → localhost:8080, @/ path alias, Vitest configured
- 4 Zustand stores created with immutable update patterns, token in-memory only
- apiClient.ts with Bearer token injection + 401 handling, sseClient.ts with 4 event types
- React Router v6 with ProtectedRoute (auth + admin role check), AdminPage lazy-loaded
- All 6 stub pages created, App.tsx wired with RouterProvider
- maven-resources-plugin added to copy frontend/dist/ → target/classes/static/
- Build passes (`tsc -b && vite build`), Vitest exits cleanly, dev server starts on :5173

### Change Log

- 2026-05-14: Story 1.2 implemented — full frontend scaffold with design tokens, stores, routing, and build pipeline

### File List

**Files CREATED:**
- `frontend/` directory (entire scaffold via shadcn CLI)
- `frontend/src/types/api.ts`
- `frontend/src/stores/useAuthStore.ts`
- `frontend/src/stores/useResumeStore.ts`
- `frontend/src/stores/useChatStore.ts`
- `frontend/src/stores/useProfileStore.ts`
- `frontend/src/lib/apiClient.ts`
- `frontend/src/lib/sseClient.ts`
- `frontend/src/lib/utils.ts` (shadcn-managed)
- `frontend/src/router/index.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/SignupPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/AdminPage.tsx`
- `frontend/src/test/setup.ts`
- `frontend/.env.example`
- `frontend/src/hooks/.gitkeep`
- `frontend/src/components/ui/` (button, input, textarea, dialog, sheet, sonner, tabs, badge, collapsible, checkbox, skeleton)
- `frontend/src/components/theme-provider.tsx` (shadcn-generated)

**Files MODIFIED:**
- `frontend/vite.config.ts` — added proxy, test block, vitest reference
- `frontend/tsconfig.node.json` — added vitest/config to types
- `frontend/package.json` — added test scripts, dependencies
- `frontend/src/index.css` — Inter font, blue-600 primary, 0.375rem radius
- `frontend/src/App.tsx` — wired RouterProvider
- `pom.xml` — added maven-resources-plugin to copy frontend/dist/ to static/
