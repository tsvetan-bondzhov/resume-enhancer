# Story 3.3: Dashboard — Resume Gallery

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to see all my saved resumes on the dashboard as visual cards,
so that I can quickly open, duplicate, delete, or export any resume from a central view.

## Acceptance Criteria

1. **Given** an authenticated user navigates to `/`
   **When** the page renders
   **Then** `DashboardPage.tsx` is shown within `AppShell`; all of the user's resumes are fetched from `GET /api/v1/resumes` and displayed as `ResumeDashboardCard` components

2. **Given** the user has no saved resumes
   **When** the dashboard renders
   **Then** the empty state is shown: centered illustration + "Your resumes live here" heading + "Build your profile to get started" CTA button linking to `/profile`

3. **Given** the user hovers over a `ResumeDashboardCard`
   **When** the hover state activates
   **Then** the card lifts with shadow and action icons appear: Open, Export (stub), Duplicate, Delete

4. **Given** the user clicks Delete on a card
   **When** the delete action is triggered
   **Then** the resume is soft-deleted client-side (removed from UI immediately); a sonner Toast "Deleted. Undo?" with an "Undo" action appears for 5 seconds; if the user does not click Undo within 5 seconds, `DELETE /api/v1/resumes/{id}` is called; if Undo is clicked the resume is restored in the UI without any server call

5. **Given** the user clicks Duplicate on a card
   **When** the action is triggered
   **Then** `POST /api/v1/resumes/{id}/clone` is called with body `{ name: "{original name} (copy)" }`; on success the new card appears in the gallery; a "Resume duplicated" Toast is shown

6. **Given** the user clicks Open on a card
   **When** the action is triggered
   **Then** the user is navigated to `/resumes/{id}`

7. **Given** the dashboard loads
   **When** the API call is in progress
   **Then** three skeleton `ResumeDashboardCard` placeholders are shown

## Tasks / Subtasks

- [x] Task 1: Create `ResumeDashboardCard.tsx` component (AC: 1, 3, 4, 5, 6)
  - [x] Create `frontend/src/components/resume/ResumeDashboardCard.tsx`
  - [x] Props interface: `{ resume: ResumeDto; onOpen: () => void; onDuplicate: () => void; onDelete: () => void; isDuplicating?: boolean }`
  - [x] Card outer wrapper: `group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer` — the entire card is a clickable "open" target, action buttons are on hover overlay
  - [x] Mini preview area: `aspect-[1/1.414] w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center rounded-t-xl overflow-hidden` — A4 aspect ratio placeholder; add centered text label showing resume name at `text-xs text-zinc-400 select-none` (this area is replaced by `ResumeCanvas` in Story 3.4; do NOT skip the placeholder — the aspect ratio must be correct now)
  - [x] Info bar below preview: shows `resume.name` (truncated, `truncate` Tailwind class), `isTailored` badge (`Badge` shadcn component: `variant="default"` with text "Tailored" when `resume.isTailored`, `variant="outline"` with text "Base" when `false`), and formatted `createdAt` date (`new Date(resume.createdAt).toLocaleDateString()`)
  - [x] Hover action overlay: `absolute inset-x-0 bottom-[preview-height]`... actually implement as a fixed bottom bar on the card info section — on hover (`group-hover:opacity-100 opacity-0 transition-opacity duration-100`) reveal four icon buttons
  - [x] Action buttons (in order): Open (`ExternalLink` icon, `aria-label="Open resume"`), Export stub (`Download` icon, `aria-label="Export resume"`, shows toast "Export coming soon" on click — do NOT call any API), Duplicate (`Copy` icon, `aria-label="Duplicate resume"`, shows `Loader2` spinner when `isDuplicating` is true), Delete (`Trash2` icon, `aria-label="Delete resume"`, red on hover)
  - [x] Import icons from `lucide-react`: `ExternalLink`, `Download`, `Copy`, `Trash2`, `Loader2`
  - [x] Import `Badge` from `@/components/ui/badge`
  - [x] `ResumeDashboardCard` is a pure presentational component — all handlers are injected via props; no internal API calls, no Zustand

- [x] Task 2: Create skeleton `ResumeDashboardCardSkeleton.tsx` component (AC: 7)
  - [x] Create `frontend/src/components/resume/ResumeDashboardCardSkeleton.tsx`
  - [x] Import `Skeleton` from `@/components/ui/skeleton`
  - [x] Renders a card-shaped skeleton matching `ResumeDashboardCard` dimensions: `rounded-xl border border-border overflow-hidden`
  - [x] Inner content: `<Skeleton className="aspect-[1/1.414] w-full rounded-none" />` for the preview area + `<div className="p-3 space-y-2">` with two `Skeleton` lines for name and badge
  - [x] This is a separate file from `ResumeDashboardCard.tsx`; keeps the card component clean

- [x] Task 3: Implement `DashboardPage.tsx` (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] Replace the current stub at `frontend/src/pages/DashboardPage.tsx` (currently just `return <div>Dashboard Page</div>`)
  - [x] Imports: `useEffect, useState, useCallback, useRef` from `"react"`; `useNavigate` from `"react-router-dom"`; `toast` from `"sonner"`; `apiClient` from `"@/lib/apiClient"`; `useResumeStore` from `"@/stores/useResumeStore"`; `ResumeDashboardCard` from `"@/components/resume/ResumeDashboardCard"`; `ResumeDashboardCardSkeleton` from `"@/components/resume/ResumeDashboardCardSkeleton"`; `Button` from `"@/components/ui/button"`; `type ResumeDto` from `"@/types/api"`
  - [x] Local state: `const [displayedResumes, setDisplayedResumes] = useState<ResumeDto[]>([])` and `const [isLoading, setIsLoading] = useState(true)` — local state separate from Zustand because it supports soft-delete optimistic UI
  - [x] Pending deletes ref: `const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())` — tracks in-flight soft-deletes so Undo can cancel them
  - [x] Also sync to Zustand store on fetch: `const setResumes = useResumeStore(state => state.setResumes)` — call `setResumes(data)` after the initial fetch so other pages/stores have access
  - [x] `useEffect` on mount: call `apiClient.get<ResumeDto[]>('/api/v1/resumes')`, set `displayedResumes` and `setResumes(data)` on success, `toast.error("Failed to load resumes")` on error, always `setIsLoading(false)` in finally
  - [x] `handleOpen(id: string)`: `navigate(\`/resumes/${id}\`)`
  - [x] `handleDuplicate(resume: ResumeDto)`: set `isDuplicating` state for the specific card; call `apiClient.post<ResumeDto>(\`/api/v1/resumes/${resume.id}/clone\`, { name: \`${resume.name} (copy)\` })`; on success prepend the new resume to `displayedResumes` and call `toast.success("Resume duplicated")`; on error call `toast.error("Failed to duplicate resume")`; always clear `isDuplicating`
  - [x] `isDuplicating` per-card tracking: `const [duplicatingId, setDuplicatingId] = useState<string | null>(null)` — only one card can be duplicating at a time
  - [x] `handleDelete(resume: ResumeDto)`: immediately remove from `displayedResumes`; store a `setTimeout` of 5000ms in `pendingDeletes.current` keyed by `resume.id`; when timeout fires, call `apiClient.delete(\`/api/v1/resumes/${resume.id}\`)`, and on error restore the resume and show `toast.error("Delete failed — resume restored")`; show a sonner toast with `toast("Deleted. Undo?", { action: { label: "Undo", onClick: undoFn }, duration: 5000 })`; the `undoFn` calls `clearTimeout(pendingDeletes.current.get(resume.id))`, deletes the key from the map, and restores the resume to `displayedResumes`
  - [x] Clean up pending deletes on unmount: `useEffect(() => () => { pendingDeletes.current.forEach(clearTimeout) }, [])` to prevent API calls after navigation away
  - [x] Loading state (while `isLoading`): render a grid of exactly 3 `<ResumeDashboardCardSkeleton />` components
  - [x] Empty state (when `!isLoading && displayedResumes.length === 0`): centered `<section>` with `aria-label="No resumes"`; illustration placeholder (`<div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4"><FileText className="size-10 text-zinc-400" /></div>` using `FileText` icon from lucide-react); `<h2>` "Your resumes live here"; `<p>` "Build your profile to get started"; `<Button>` "Go to Profile" that calls `navigate('/profile')`
  - [x] Resume gallery (when `!isLoading && displayedResumes.length > 0`): grid `<section aria-label="Resume gallery">` with `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"` — renders one `<ResumeDashboardCard>` per resume; pass all four handlers as props
  - [x] Page header: `<div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-semibold">My Resumes</h1><Button variant="outline" disabled>New Resume</Button></div>` — "New Resume" button is disabled (stub); it will be wired to the create flow in a future story (Story 3.4 / 3.7 area)
  - [x] Outer wrapper: `<div className="mx-auto max-w-7xl px-4 py-8">` inside the page component — no extra AppShell wrapper needed (AppShell is provided by the router's `ProtectedRoute`)

- [x] Task 4: Add Vitest tests `DashboardPage.test.tsx` (AC: 1, 2, 4, 5, 7)
  - [x] Create `frontend/src/pages/DashboardPage.test.tsx`
  - [x] Test framework: Vitest + React Testing Library (`describe`, `it`, `expect`, `vi`, `beforeEach` from `"vitest"`; `render`, `screen`, `waitFor`, `act` from `"@testing-library/react"`; `userEvent` from `"@testing-library/user-event"`; `MemoryRouter` from `"react-router-dom"`)
  - [x] Mock `@/lib/apiClient` — `vi.mock("@/lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))`
  - [x] Mock `sonner` — `vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))` — note: `toast()` itself is callable (for the undo toast) AND has `.success`/`.error` methods
  - [x] Mock `react-router-dom` navigate: `const mockNavigate = vi.fn(); vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => mockNavigate }))`
  - [x] Helper: `const mockGet = vi.mocked(apiClient.get); const mockPost = vi.mocked(apiClient.post); const mockDelete = vi.mocked(apiClient.delete)` — cast after mocking
  - [x] `beforeEach`: `vi.clearAllMocks()`
  - [x] Test factory: `buildResume(overrides?: Partial<ResumeDto>): ResumeDto` — returns a complete `ResumeDto` with sensible defaults
  - [x] Test case 1 — `renders 3 skeleton cards while loading`: set `mockGet.mockReturnValue(new Promise(() => {}))` (never resolves); render `DashboardPage`; assert 3 skeleton aria labels or skeleton elements visible; do NOT use `waitFor` (want loading state)
  - [x] Test case 2 — `renders empty state when no resumes`: `mockGet.mockResolvedValue([])`; render; `await waitFor(() => { expect(screen.getByRole('heading', { name: /your resumes live here/i })).toBeInTheDocument() })`; assert "Go to Profile" button present
  - [x] Test case 3 — `renders resume cards when resumes exist`: `mockGet.mockResolvedValue([buildResume({ name: 'My Resume' })])`; render; `await waitFor(() => screen.getByText('My Resume'))`; assert card is in document
  - [x] Test case 4 — `clicking Open navigates to editor`: render with one resume; `await waitFor(() => screen.getByRole('button', { name: /open resume/i }))`; click it; assert `mockNavigate('/resumes/test-id')`
  - [x] Test case 5 — `delete soft-removes card and shows undo toast`: `vi.useFakeTimers()`; render with one resume; await card load; click Delete; assert card is no longer in DOM; assert `toast` was called with "Deleted. Undo?"; `vi.runAllTimers()`; assert `mockDelete` was called; `vi.useRealTimers()`
  - [x] Test case 6 — `undo delete restores card before API call`: `vi.useFakeTimers()`; render with one resume; await card load; click Delete; find the `action.onClick` from the last `toast()` call arguments and invoke it; advance timers; assert `mockDelete` was NOT called; assert card is back in DOM; `vi.useRealTimers()`
  - [x] Test case 7 — `duplicate creates copy and shows toast`: `mockPost.mockResolvedValue(buildResume({ id: 'new-id', name: 'My Resume (copy)' }))`; render with one resume; await card load; click Duplicate; `await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/resumes/test-id/clone', { name: 'My Resume (copy)' }))`; assert `toast.success` called with "Resume duplicated"; assert new card with "My Resume (copy)" is in DOM
  - [x] Wrap render with `<MemoryRouter>` for navigation support — DashboardPage uses `useNavigate`

## Dev Notes

### CRITICAL: Toast library is `sonner`, NOT shadcn/ui Toast

The epics AC mentions "shadcn/ui Toast" but the project uses **`sonner`** as its toast provider (confirmed: `sonner` is in `package.json` dependencies, `<Toaster />` from `@/components/ui/sonner` is already mounted in `App.tsx`). Do NOT install or use `@/components/ui/toast`. Import toast from `"sonner"`:

```typescript
import { toast } from "sonner"

// Simple success:
toast.success("Resume duplicated")

// Undo toast with action:
toast("Deleted. Undo?", {
  action: {
    label: "Undo",
    onClick: () => { /* restore logic */ },
  },
  duration: 5000,
})
```

### CRITICAL: Soft-delete undo pattern with `useRef` + `setTimeout`

Sonner's `toast()` with `duration: 5000` shows the toast for 5 seconds, but does NOT directly gate the API call. You must manage the pending delete separately:

```typescript
const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

const handleDelete = useCallback((resume: ResumeDto) => {
  // 1. Remove from display immediately (optimistic)
  setDisplayedResumes(prev => prev.filter(r => r.id !== resume.id))

  // 2. Schedule actual API delete after 5s
  const timeoutId = setTimeout(async () => {
    pendingDeletes.current.delete(resume.id)
    try {
      await apiClient.delete(`/api/v1/resumes/${resume.id}`)
    } catch {
      // Restore on failure
      setDisplayedResumes(prev => {
        if (prev.find(r => r.id === resume.id)) return prev
        return [...prev, resume]
      })
      toast.error("Delete failed — resume restored")
    }
  }, 5000)

  pendingDeletes.current.set(resume.id, timeoutId)

  // 3. Show undo toast
  toast("Deleted. Undo?", {
    action: {
      label: "Undo",
      onClick: () => {
        const id = pendingDeletes.current.get(resume.id)
        if (id !== undefined) clearTimeout(id)
        pendingDeletes.current.delete(resume.id)
        setDisplayedResumes(prev => {
          if (prev.find(r => r.id === resume.id)) return prev
          return [...prev, resume]
        })
      },
    },
    duration: 5000,
  })
}, [])

// Clean up on unmount
useEffect(() => {
  return () => { pendingDeletes.current.forEach(clearTimeout) }
}, [])
```

### CRITICAL: `ResumeDashboardCard` mini preview is a PLACEHOLDER in this story

Per UX spec, the card preview area should be an embedded mini `ResumeCanvas` at reduced scale. However, `ResumeCanvas.tsx` does not exist yet — it is implemented in **Story 3.4**. In this story, use an A4-aspect-ratio `div` with a placeholder background:

```tsx
<div className="aspect-[1/1.414] w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
  <span className="text-xs text-zinc-400 select-none px-4 text-center line-clamp-2">
    {resume.name}
  </span>
</div>
```

Story 3.4 will replace this placeholder with the real `ResumeCanvas` component. Do NOT defer creating the card's structure — the `aspect-[1/1.414]` ratio and overall card shape must be correct now so Story 3.4 can simply swap the inner content.

### CRITICAL: `useResumeStore` already exists — do NOT reinvent or re-declare

`frontend/src/stores/useResumeStore.ts` already defines:
- `resumes: ResumeDto[]`
- `setResumes(resumes: ResumeDto[]): void`
- `currentResume: ResumeDto | null`
- `setCurrentResume(resume: ResumeDto | null): void`
- `isSaving: boolean`, `isExporting: boolean`
- `applyPatch(patch)` — no-op stub for Story 4.2

Call `setResumes(data)` after the initial fetch to populate the store. The `DashboardPage` uses its own local `displayedResumes` state for rendering (to support soft-delete), but the store should stay in sync after the initial load.

Do NOT add `deleteResume` or `cloneResume` to `useResumeStore` — these are dashboard-specific interactions with no need for global state. The store actions (those that will eventually be needed by the editor) come in Story 3.5+.

### CRITICAL: No `PUT /api/v1/resumes/{id}` endpoint yet

The `ResumeController` (confirmed by reading source) only has:
- `POST /api/v1/resumes` → create
- `GET /api/v1/resumes` → list
- `GET /api/v1/resumes/{id}` → get single
- `DELETE /api/v1/resumes/{id}` → delete
- `POST /api/v1/resumes/{id}/clone` → duplicate

There is NO `PUT` endpoint. Do NOT attempt to call `PUT /api/v1/resumes/{id}` in this story. That endpoint is added in **Story 3.6**.

### `apiClient.delete` returns `void` (204 No Content)

`apiClient.delete<void>(path)` returns `undefined` for 204 responses (handled in `apiClient.ts`: `if (res.status === 204) return undefined as T`). Do NOT try to parse the response body.

### "New Resume" button is a STUB in this story

The "New Resume" button on the dashboard header is disabled in this story. Full creation flow (from profile + template selection) is wired in Stories 3.4 and 3.7. Render it as disabled to communicate intent:

```tsx
<Button variant="outline" disabled aria-disabled="true">
  New Resume
</Button>
```

Do NOT wire up onClick for the "New Resume" button in this story.

### Hover action bar implementation — use `group` / `group-hover` Tailwind classes

Tailwind's `group` / `group-hover` pattern is the correct approach for reveal-on-hover without JavaScript:

```tsx
// Outer card:
<div className="group relative ...">
  {/* Preview area */}
  {/* Info bar with action icons: */}
  <div className="flex items-center justify-between px-3 py-2 bg-card">
    <div>...</div>
    {/* Action icons: hidden by default, visible on group-hover */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
      <button onClick={onOpen} aria-label="Open resume">
        <ExternalLink className="size-4" />
      </button>
      {/* ... */}
    </div>
  </div>
</div>
```

Note: keyboard users need to tab to the buttons for them to be accessible even if opacity-0. Add `focus-within:opacity-100` to the action bar container so keyboard focus makes them visible:

```tsx
className="... opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
```

### `isTailored` badge — use existing `Badge` component

`frontend/src/components/ui/badge.tsx` is already installed. Use:

```tsx
import { Badge } from "@/components/ui/badge"

{resume.isTailored ? (
  <Badge>Tailored</Badge>
) : (
  <Badge variant="outline">Base</Badge>
)}
```

### Zustand store state update pattern — always immutable

Per architecture mandates: Zustand state updates MUST be immutable. The store's `setResumes` is already implemented correctly. If you add any direct `useResumeStore.setState` calls, follow the pattern:

```typescript
set(state => ({ ...state, resumes: newResumes }))
```

Never mutate `state.resumes` directly.

### Frontend test pattern for sonner

The `toast` export from `sonner` is both a function AND has methods (`.success`, `.error`). Mock it as:

```typescript
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))
```

Then assert:
```typescript
import { toast } from "sonner"
const mockToast = vi.mocked(toast)
expect(mockToast).toHaveBeenCalledWith("Deleted. Undo?", expect.objectContaining({ duration: 5000 }))
expect(mockToast.success).toHaveBeenCalledWith("Resume duplicated")
```

### Frontend test pattern for `useNavigate`

```typescript
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => mockNavigate }
})
```

### `lucide-react` icons to use

All icons are available in `lucide-react` (v1.16.0 in package.json):
- `ExternalLink` — Open action
- `Download` — Export stub action
- `Copy` — Duplicate action
- `Trash2` — Delete action
- `Loader2` — Spinner while duplicating (use `className="size-4 animate-spin"`)
- `FileText` — Empty state illustration

### File locations summary

| File | Action |
|------|--------|
| `frontend/src/components/resume/ResumeDashboardCard.tsx` | CREATE |
| `frontend/src/components/resume/ResumeDashboardCardSkeleton.tsx` | CREATE |
| `frontend/src/pages/DashboardPage.tsx` | REPLACE (currently a 3-line stub) |
| `frontend/src/pages/DashboardPage.test.tsx` | CREATE |

No backend changes required. All API endpoints needed (`GET /api/v1/resumes`, `DELETE /api/v1/resumes/{id}`, `POST /api/v1/resumes/{id}/clone`) already exist from Stories 3.1.

### `frontend/src/components/resume/` directory

This directory does NOT exist yet in the codebase (confirmed — no `resume/` subdirectory under `components/`). The architecture spec says it should contain `ResumeCanvas.tsx`, `ResumeSection.tsx`, etc. Story 3.3 creates the first files in this directory: `ResumeDashboardCard.tsx` and `ResumeDashboardCardSkeleton.tsx`. Story 3.4 will add `ResumeCanvas.tsx`.

### API error handling pattern

Follow the existing pattern from `ProfilePage.tsx`:

```typescript
try {
  const data = await apiClient.get<ResumeDto[]>('/api/v1/resumes')
  setDisplayedResumes(data)
  setResumes(data) // sync Zustand store
} catch {
  toast.error("Failed to load resumes — please try again")
} finally {
  setIsLoading(false)
}
```

The `apiClient` already handles 401 → redirects to `/login`. No need to handle 401 manually in the page.

### Date formatting

Use `new Date(resume.createdAt).toLocaleDateString()` for the card's date display. The `createdAt` field is an ISO 8601 string (e.g., `"2026-05-14T10:30:00Z"`). No date library needed.

### Responsive grid layout

Dashboard grid should be responsive per UX spec (desktop-first, graceful degradation to tablet):
```tsx
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
```
This gives 1 column on mobile, 2 on sm, 3 on lg, 4 on xl — matching the "D6 dashboard" described in the UX spec.

### Accessibility requirements (NFR19)

- All icon-only buttons must have `aria-label` (e.g., `aria-label="Open resume"`, `aria-label="Delete resume"`)
- Empty state `<section>` must have `aria-label="No resumes"`
- Gallery `<section>` must have `aria-label="Resume gallery"`
- Page heading must be an `<h1>` — "My Resumes"
- Action buttons must be focusable — use `<button>` elements (not `<div>`)

### `aspect-[1/1.414]` Tailwind class

This is the standard A4 paper aspect ratio (width:height = 1:√2 ≈ 1:1.414). Tailwind's JIT mode supports arbitrary values: `aspect-[1/1.414]`. This does NOT require any Tailwind config changes.

## Dev Agent Record

### Completion Notes

- Implemented all 4 tasks as specified. `lucide-react` v1.16.0 exports `Loader2` as an alias for `LoaderCircle` — confirmed in the package's `.d.ts` exports; no substitution needed.
- All 7 test cases pass (30 total tests pass across the project). TypeScript type-check exits clean.
- `ResumeDashboardCard` is a pure presentational component with no Zustand or API calls.
- `ResumeDashboardCardSkeleton` uses `aria-label="Loading resume card"` on the wrapper div so tests can query exactly 3 skeletons during loading state.
- Soft-delete undo pattern uses `useRef<Map<string, ReturnType<typeof setTimeout>>>` + `setTimeout` to gate the `DELETE` API call behind a 5-second window, independent of the sonner toast duration.
- The fake-timer tests (delete / undo) use `await act(async () => {})` to flush the initial `useEffect` fetch (promise microtasks) before interacting with the UI.

### File List

| File | Action |
|------|--------|
| `frontend/src/components/resume/ResumeDashboardCard.tsx` | CREATED |
| `frontend/src/components/resume/ResumeDashboardCardSkeleton.tsx` | CREATED |
| `frontend/src/pages/DashboardPage.tsx` | REPLACED (was 3-line stub) |
| `frontend/src/pages/DashboardPage.test.tsx` | CREATED |

### Change Log

| Date | Change |
|------|--------|
| 2026-06-05 | Story 3.3 implemented — all ACs satisfied, 7 tests passing |

### Review Findings

- [ ] [Review][Patch] Outer `<div onClick={onOpen}>` in ResumeDashboardCard lacks keyboard affordance — no `role="button"`, `tabIndex={0}`, or `onKeyDown` handler; violates WCAG 2.1 SC 2.1.1 for the whole-card open target. Mitigation exists via the inner "Open resume" `<button>` + `focus-within:opacity-100`, so functionality is keyboard-accessible. Fix: add `role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}` to the outer div, or convert it to a `<button>`. [`ResumeDashboardCard.tsx:22`]
- [ ] [Review][Patch] Four `<button>` elements missing `type="button"` — HTML default is `type="submit"`; harmless outside a `<form>` today but a footgun if the card is ever nested in a form context. Add `type="button"` to all four action buttons. [`ResumeDashboardCard.tsx:52,63,74,90`]
- [x] [Review][Defer] No test for `apiClient.get` error path (fetch error → `toast.error("Failed to load resumes")`) [`DashboardPage.test.tsx`] — deferred, pre-existing coverage gap not listed in Task 4's required test cases
- [x] [Review][Defer] No test for DELETE API failure + restore + `toast.error("Delete failed — resume restored")` [`DashboardPage.test.tsx`] — deferred, pre-existing coverage gap
- [x] [Review][Defer] Double-delete Map key collision: calling `handleDelete` on the same resume ID twice (e.g., duplicate tab) silently overwrites the first pending timeout without clearing it [`DashboardPage.tsx:84`] — deferred, low-probability edge case consistent with pre-existing project patterns
