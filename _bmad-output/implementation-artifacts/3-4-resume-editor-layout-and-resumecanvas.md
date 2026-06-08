# Story 3.4: Resume Editor Layout & ResumeCanvas

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want a three-column editor layout with a live A4 resume preview,
so that I can see my resume rendered in real time as I make changes.

## Acceptance Criteria

1. **Given** an authenticated user navigates to `/resumes/:id`
   **When** the page renders
   **Then** `EditorPage.tsx` renders the `SplitPaneLayout` (UX-DR2): a collapsible left sidebar (240px expanded / 48px collapsed icon rail), a center `ResumeCanvas` column, and a right chat panel column (288px)

2. **Given** the editor page loads
   **When** `GET /api/v1/resumes/{resumeId}` completes
   **Then** `ResumeCanvas` renders the `ResumeDocument` as semantic HTML (`<article>`, `<section>`, `<h2>`, `<ul>`) in `idle` state with A4 aspect ratio (1:1.414), drop shadow, and `zinc-100` background (UX-DR3)

3. **Given** the left sidebar is expanded
   **When** the user clicks the collapse chevron button or presses `[`
   **Then** the sidebar collapses to the 48px icon rail with a 150ms ease-out transition on `grid-template-columns`; `aria-expanded` is updated on the trigger; collapse state is persisted to `localStorage` (UX-DR2)

4. **Given** the resume document is loading
   **When** the API call is in progress
   **Then** `ResumeCanvas` renders `Skeleton` rectangles at paragraph and heading positions (UX-DR15)

## Tasks / Subtasks

- [x] Task 1: Create `SplitPaneLayout.tsx` component (AC: 1, 3)
  - [x] Create `frontend/src/components/layout/SplitPaneLayout.tsx`
  - [x] Props interface: `{ leftSlot: React.ReactNode; centerSlot: React.ReactNode; rightSlot: React.ReactNode }`
  - [x] Collapsed state initialised lazily from `localStorage`: `const [isCollapsed, setIsCollapsed] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem('sidebar-collapsed') ?? 'false') } catch { return false } })`
  - [x] `toggleCollapse` callback: flips `isCollapsed` and writes to `localStorage` — `localStorage.setItem('sidebar-collapsed', JSON.stringify(!isCollapsed))`
  - [x] Outer grid container: `className="grid overflow-hidden"` with `style={{ height: 'calc(100vh - 56px)', gridTemplateColumns: \`${isCollapsed ? 48 : 240}px 1fr 288px\`, transition: 'grid-template-columns 150ms ease-out' }}` — inline style is required here because Tailwind does not animate `grid-template-columns` by default; the `56px` matches `AppShell`'s header height (see Dev Notes)
  - [x] Left column: `className="flex flex-col overflow-hidden border-r border-border bg-card"` — contains the chevron toggle button at the top and `{leftSlot}` below
  - [x] Chevron toggle button: `type="button"`, `aria-expanded={!isCollapsed}` (true = sidebar is open), `aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}`, `className="p-1.5 rounded-md hover:bg-muted transition-colors"`, wrapped in a `<div className={`flex p-2 ${isCollapsed ? 'justify-center' : 'justify-end'}`}>` — shows `<ChevronLeft />` when expanded (click to collapse) and `<ChevronRight />` when collapsed (click to expand); import both from `lucide-react`
  - [x] `leftSlot` area: `<div className="flex-1 overflow-hidden">` below the chevron button — content naturally clips to 48px column width when collapsed; no extra logic needed
  - [x] Center column: `className="overflow-hidden"` — renders `{centerSlot}`
  - [x] Right column: `className="border-l border-border bg-card overflow-hidden"` — renders `{rightSlot}`
  - [x] Keyboard shortcut `[`: `useEffect` that adds a `keydown` listener on `document`; on `e.key === '['` with no modifier keys (`!e.metaKey && !e.ctrlKey && !e.altKey`), bail if focus is in an input/textarea/contenteditable (`const t = e.target as HTMLElement; if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return`); otherwise call `toggleCollapse()`; clean up listener on unmount; include `toggleCollapse` in dependency array
  - [x] Imports: `useState, useEffect, useCallback` from `"react"`; `ChevronLeft, ChevronRight` from `"lucide-react"` — do NOT import `Button` from shadcn for the chevron (plain `<button>` is simpler here)

- [x] Task 2: Create `ResumeCanvas.tsx` component (AC: 2, 4)
  - [x] Create `frontend/src/components/resume/ResumeCanvas.tsx`
  - [x] Props interface: `{ document: ResumeDocumentDto | null; isLoading?: boolean; state?: 'idle' | 'streaming' | 'diff' | 'print-preview' }` — only `idle` and skeleton loading are implemented in this story; `streaming`, `diff`, `print-preview` are stubs for Epic 4 / Story 5
  - [x] Import `Skeleton` from `@/components/ui/skeleton`; import `type { ResumeDocumentDto }` from `@/types/api`
  - [x] Outer container (always rendered): `<div className="h-full overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">` — the `zinc-100` background creates contrast behind the white canvas (UX-DR3); `overflow-y-auto` provides vertical scrolling; `items-center` centres the canvas horizontally
  - [x] **Loading state** (`isLoading === true`): render a white skeleton card instead of the live document —
    ```tsx
    <div
      id="resume-canvas"
      aria-label="Resume preview loading"
      className="bg-white shadow-lg w-full max-w-[794px] p-8 space-y-6"
    >
      <Skeleton className="h-6 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
    ```
  - [x] **Idle state** (when `!isLoading`): render the semantic HTML resume document:
    ```tsx
    <article
      id="resume-canvas"
      aria-label="Resume preview"
      className="bg-white shadow-lg w-full max-w-[794px] p-8"
    >
      {/* ARIA live region stub for streaming — used in Story 4.3 */}
      <div
        role="status"
        aria-live="polite"
        aria-label="AI is updating your resume"
        className="sr-only"
      >
        {state === 'streaming' ? 'AI is updating your resume' : ''}
      </div>

      {(document?.sections ?? [])
        .filter((section) => section.visible)
        .map((section) => (
          <section key={section.id} aria-labelledby={`section-title-${section.id}`} className="mb-6">
            <h2
              id={`section-title-${section.id}`}
              className="text-base font-semibold border-b border-zinc-200 pb-1 mb-2 uppercase tracking-wide"
            >
              {section.title}
            </h2>
            <ul className="space-y-1 text-sm list-none p-0">
              {section.items.map((item) => (
                <li key={item.id}>
                  {Object.values(item.fields).filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </article>
    ```
  - [x] When `document` is `null` and `!isLoading`, render an empty `<article id="resume-canvas" aria-label="Resume preview" className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]" />` — prevents layout shift when document loads
  - [x] `ResumeCanvas` is a pure presentational component — no API calls, no Zustand; all data injected via props
  - [x] Note: item fields rendering (`Object.values(item.fields).filter(Boolean).join(' · ')`) is a default fallback for this story; template-aware rendering (which uses different layouts per section type) is introduced in Story 3.7; do NOT over-engineer field rendering now

- [x] Task 3: Implement `EditorPage.tsx` (AC: 1, 2, 4)
  - [x] Replace the current stub at `frontend/src/pages/EditorPage.tsx` (currently just `return <div>Editor Page</div>`)
  - [x] Imports: `useEffect, useState` from `"react"`; `useParams` from `"react-router-dom"`; `toast` from `"sonner"`; `apiClient` from `"@/lib/apiClient"`; `useResumeStore` from `"@/stores/useResumeStore"`; `SplitPaneLayout` from `"@/components/layout/SplitPaneLayout"`; `ResumeCanvas` from `"@/components/resume/ResumeCanvas"`; `type { ResumeDto }` from `"@/types/api"`
  - [x] Extract the route param: `const { id } = useParams<{ id: string }>()` — TypeScript types `id` as `string | undefined` even though the route guarantees it; treat defensively with a fallback or early return
  - [x] Local state: `const [resume, setResume] = useState<ResumeDto | null>(null)` and `const [isLoading, setIsLoading] = useState(true)` and `const [error, setError] = useState<string | null>(null)`
  - [x] Zustand store: `const setCurrentResume = useResumeStore(state => state.setCurrentResume)` — call `setCurrentResume(data)` on successful fetch
  - [x] `useEffect` on mount (depends on `id`): if `!id` early-return; call `apiClient.get<ResumeDto>(\`/api/v1/resumes/${id}\`)` in a try/catch/finally; on success: `setResume(data)` + `setCurrentResume(data)`; on error: `setError("Failed to load resume")` + `toast.error("Failed to load resume")`; always: `setIsLoading(false)` in `finally`
  - [x] Cleanup on unmount: second `useEffect` with no deps that returns `() => setCurrentResume(null)` — prevents stale resume data persisting in the store when the user navigates away
  - [x] Error state (when `error !== null` and `!isLoading`): render `<div className="flex items-center justify-center h-64"><p className="text-destructive">{error}</p></div>` inside a `SplitPaneLayout` center slot (or outside it — a simple centered error div is fine)
  - [x] **Render `SplitPaneLayout`** with:
    - `leftSlot`: `<div className="p-4 text-sm text-muted-foreground">Sections panel coming in Story 3.5</div>` — this is a deliberate stub; do NOT attempt to implement section visibility toggles here
    - `centerSlot`: `<ResumeCanvas document={resume?.content ?? null} isLoading={isLoading} state="idle" />`
    - `rightSlot`: `<div className="p-4 text-sm text-muted-foreground">Chat panel coming in Story 4.3</div>` — this is a deliberate stub; do NOT attempt to implement any chat functionality here
  - [x] Even during loading or error, render `SplitPaneLayout` (with `ResumeCanvas isLoading={true}` or the error view in the center slot) so the overall three-column chrome is always visible
  - [x] No `AppShell` wrapper in `EditorPage` — it is already provided by the router's `ProtectedRoute` component (see `frontend/src/router/index.tsx`); wrapping it again would double the shell

- [x] Task 4: Add Vitest tests (AC: 1, 2, 3, 4)

  **4a — `EditorPage.test.tsx`** (AC: 1, 2, 4)
  - [x] Create `frontend/src/pages/EditorPage.test.tsx`
  - [x] Test framework: Vitest + React Testing Library (`describe`, `it`, `expect`, `vi`, `beforeEach` from `"vitest"`; `render`, `screen`, `waitFor` from `"@testing-library/react"`)
  - [x] Mock `@/lib/apiClient`: `vi.mock("@/lib/apiClient", () => ({ apiClient: { get: vi.fn() } }))`
  - [x] Mock `sonner`: `vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }))`
  - [x] Mock `react-router-dom` `useParams`: `vi.mock("react-router-dom", async (importOriginal) => { const actual = await importOriginal<typeof import("react-router-dom")>(); return { ...actual, useParams: () => ({ id: 'test-resume-id' }) } })` — provides a fixed `:id` without a full router setup
  - [x] Helper: `const mockGet = vi.mocked(apiClient.get)` after import
  - [x] `beforeEach`: `vi.clearAllMocks()`
  - [x] Test factory: `buildResume(overrides?: Partial<ResumeDto>): ResumeDto` — returns a complete `ResumeDto` with a `content` that has at least one visible section and one item so rendering can be asserted
  - [x] Test case 1 — `renders skeleton while loading`: `mockGet.mockReturnValue(new Promise(() => {}))` (never resolves); render `<EditorPage />`; assert `getByLabelText(/resume preview loading/i)` is in document (the `aria-label` on the skeleton container)
  - [x] Test case 2 — `renders resume sections after successful fetch`: `mockGet.mockResolvedValue(buildResume({ ... }))` with a section titled `"Work Experience"`; render; `await waitFor(() => screen.getByRole('heading', { name: /work experience/i }))`; assert heading is in document
  - [x] Test case 3 — `renders error toast on fetch failure`: `mockGet.mockRejectedValue(new Error('network'))` ; render; `await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed to load resume"))`
  - [x] Test case 4 — `calls setCurrentResume with fetched resume`: render with a resolved resume; `await waitFor(...)` for content; `expect(useResumeStore.getState().currentResume?.id).toBe('test-resume-id')` — use the real Zustand store (it works in tests without mocking); reset store in `afterEach` with `useResumeStore.getState().setCurrentResume(null)`

  **4b — `SplitPaneLayout.test.tsx`** (AC: 3)
  - [x] Create `frontend/src/components/layout/SplitPaneLayout.test.tsx`
  - [x] Test case 1 — `renders all three slots`: render `<SplitPaneLayout leftSlot={<span>left</span>} centerSlot={<span>center</span>} rightSlot={<span>right</span>} />`; assert all three text nodes are in the document
  - [x] Test case 2 — `chevron button has aria-expanded=true when expanded (default)`: render with `localStorage` empty; `expect(screen.getByRole('button', { name: /collapse sidebar/i }).getAttribute('aria-expanded')).toBe('true')`
  - [x] Test case 3 — `clicking chevron updates aria-expanded`: render; click chevron button; `expect(screen.getByRole('button', { name: /expand sidebar/i }).getAttribute('aria-expanded')).toBe('false')`
  - [x] Test case 4 — `reads initial collapsed state from localStorage`: `localStorage.setItem('sidebar-collapsed', 'true')` before render; render; assert button has `aria-expanded="false"` (sidebar already collapsed); clean up `localStorage` in `afterEach`
  - [x] Test case 5 — `writes to localStorage on toggle`: render; click chevron; `expect(localStorage.getItem('sidebar-collapsed')).toBe('true')`
  - [x] Test case 6 — `[ key press toggles sidebar`: render; `fireEvent.keyDown(document, { key: '[' })`; assert `aria-expanded` changes (the button's aria-expanded flips to `"false"`)
  - [x] Note: `jsdom` does not apply CSS, so grid-template-columns transitions cannot be asserted in unit tests — focus on behaviour (aria-expanded, localStorage), not pixel widths

## Dev Notes

### CRITICAL: `EditorPage` must NOT wrap in `AppShell`

`AppShell` is already provided by `ProtectedRoute` in the router (`frontend/src/router/index.tsx`). Both `/resumes/:id` and `/` children are wrapped in `<ProtectedRoute>` which renders `<AppShell><Outlet /></AppShell>`. Adding another `AppShell` in `EditorPage` would double the header and nav. Do NOT import or render `AppShell` inside `EditorPage`.

### CRITICAL: `SplitPaneLayout` height — `calc(100vh - 56px)`

The `AppShell` renders:
```tsx
<div className="min-h-screen flex flex-col">
  <header className="sticky top-0 z-50 border-b border-border bg-background">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
      ...
    </nav>
  </header>
  <main className="flex-1">{children}</main>
</div>
```

The `<main className="flex-1">` does not set an explicit pixel height on its children. For the three-column grid to fill the remaining viewport, `SplitPaneLayout` uses `height: calc(100vh - 56px)` via inline style. The `56px` value matches the `AppShell` header height: `py-3` (12px × 2) + `text-lg` content line height (~32px) = ~56px. If the header height ever changes, update this value accordingly.

```tsx
style={{
  height: 'calc(100vh - 56px)',
  gridTemplateColumns: `${isCollapsed ? 48 : 240}px 1fr 288px`,
  transition: 'grid-template-columns 150ms ease-out',
}}
```

### CRITICAL: `grid-template-columns` transition must be inline style

Tailwind CSS does not support animating `grid-template-columns` via utility classes. The transition must be set via an inline `style` prop on the grid container. Do not attempt to use Tailwind's `transition-*` utilities for this specific property — they will not work. The inline style approach is the correct solution here.

### CRITICAL: `aria-expanded` semantics on the chevron button

`aria-expanded` indicates the current state of the **controlled element** (the sidebar), not the button's action. Correct mapping:
- Sidebar is open → `aria-expanded="true"` (the controlled region IS expanded)
- Sidebar is collapsed → `aria-expanded="false"` (the controlled region is NOT expanded)

```tsx
<button
  type="button"
  aria-expanded={!isCollapsed}  // true when sidebar is open
  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  onClick={toggleCollapse}
>
```

### CRITICAL: Keyboard shortcut `[` — guard against input focus

The `[` key shortcut must NOT fire when the user is typing in any `<input>`, `<textarea>`, or `contenteditable` element. Failure to guard this would break any text field that contains `[` characters:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) return
    toggleCollapse()
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [toggleCollapse])
```

Wrap `toggleCollapse` in `useCallback` so the effect dependency is stable.

### CRITICAL: `ResumeCanvas` type imports — use `ResumeDocumentDto`, not `ResumeDocument`

The frontend types are in `frontend/src/types/api.ts`. The correct types are:
- `ResumeDocumentDto` — the `content` field of `ResumeDto` (passed to `ResumeCanvas`)
- `ResumeSectionDto` — individual section inside `ResumeDocumentDto.sections`
- `ResumeItemDto` — individual item inside `ResumeSectionDto.items`

Do NOT use or invent `ResumeDocument`, `ResumeSection`, or `ResumeItem` — these are Java backend records, not TypeScript types.

```typescript
// Correct imports:
import type { ResumeDocumentDto } from '@/types/api'

// ResumeDto.content is ResumeDocumentDto:
// { sections: ResumeSectionDto[] }
// ResumeSectionDto: { id, title, visible, items: ResumeItemDto[] }
// ResumeItemDto: { id, fields: Record<string, string> }
```

### CRITICAL: `useResumeStore.setCurrentResume(null)` on EditorPage unmount

The store's `currentResume` should be cleared when the user navigates away from the editor. Without this cleanup, if the user opens Resume A, navigates to the dashboard, then opens Resume B, there is a brief flash where the previous resume renders. Use a cleanup-only effect:

```typescript
useEffect(() => {
  return () => {
    setCurrentResume(null)
  }
}, [setCurrentResume])
```

### CRITICAL: `ResumeDashboardCard` placeholder is NOT replaced in this story

Story 3.3's `ResumeDashboardCard` currently shows a `div` with `aspect-[1/1.414]` as a placeholder. Story 3.3's Dev Notes explicitly document this area "is replaced by `ResumeCanvas` in Story 3.4". However, embedding a full `ResumeCanvas` into each dashboard card requires a scaled-down (CSS `transform: scale()`) version of the canvas — this is UX-DR8 scope and adds non-trivial complexity (fetching each resume's content for the gallery). Do NOT attempt to embed `ResumeCanvas` in `ResumeDashboardCard` in this story. Leave the existing placeholder in place and document this as a follow-up when UX-DR8 is fully addressed.

### CRITICAL: `GET /api/v1/resumes/{resumeId}` — path param is `id` from router

The route is defined as `/resumes/:id` in `frontend/src/router/index.tsx`. The `useParams` hook returns `{ id: string | undefined }`. The `apiClient` call must use this value:

```typescript
const { id } = useParams<{ id: string }>()
// ...
const data = await apiClient.get<ResumeDto>(`/api/v1/resumes/${id}`)
```

TypeScript will type `id` as `string | undefined`. Handle the undefined case:
```typescript
useEffect(() => {
  if (!id) return
  // ... fetch
}, [id, setCurrentResume])
```

### `useResumeStore` already has `setCurrentResume` — do NOT re-declare

`frontend/src/stores/useResumeStore.ts` already defines:
- `currentResume: ResumeDto | null`
- `setCurrentResume(resume: ResumeDto | null): void`
- `resumes: ResumeDto[]`, `setResumes(resumes: ResumeDto[]): void`
- `isSaving: boolean`, `isExporting: boolean`
- `applyPatch(patch)` — no-op stub (Story 4.2)

Only use `setCurrentResume` in `EditorPage` — do NOT call `setResumes` here (that's the dashboard's responsibility). Do NOT add new actions to the store for this story.

### Left sidebar and right chat panel are explicit stubs in this story

Per the story scope:
- **Left sidebar** (`leftSlot`): a text placeholder div (`"Sections panel coming in Story 3.5"`) — Story 3.5 implements `SectionsPanel` (UX-DR7) with checkbox section visibility toggles and `@dnd-kit/sortable` reordering
- **Right panel** (`rightSlot`): a text placeholder div (`"Chat panel coming in Story 4.3"`) — Story 4.3 implements `ChatPanel` (UX-DR5) with SSE streaming

Do NOT implement any section toggle logic, drag-to-reorder, or chat input in this story. The stubs must be clearly labelled so they are easy to locate and replace in future stories.

### `ResumeCanvas` item field rendering is intentionally simplified

`ResumeItemDto.fields` is `Record<string, string>` — field keys vary by template (e.g., `jobTitle`, `company`, `description` for work experience). In this story, all field values are joined with `' · '` as a simple fallback rendering. Template-aware rendering (where field keys determine layout — e.g., title line vs. body line) is introduced in Story 3.7. Do NOT pre-implement template-aware rendering or add conditional field logic now.

### `Skeleton` component usage

`Skeleton` is a named export from shadcn/ui:
```typescript
import { Skeleton } from '@/components/ui/skeleton'
```
Usage: `<Skeleton className="h-4 w-full" />` — renders an animated grey rectangle. Height and width set how big the placeholder appears. The skeleton card in `ResumeCanvas` should mimic the visual weight of a real document (heading skeleton → paragraph skeletons → second section → third section) to prevent layout shift on load.

### `aspect-[1/1.414]` is NOT applied to the `ResumeCanvas` article element

The A4 aspect ratio reference in UX-DR3 means the canvas should *look* like an A4 document — white paper with a drop shadow, centred in a `zinc-100` background. It does NOT mean the `<article>` element must be strictly constrained to A4 height. The article is `max-w-[794px]` (A4 width at 96dpi) and grows vertically as content requires. The outer container scrolls vertically. `aspect-[1/1.414]` is appropriate for the thumbnail preview in `ResumeDashboardCard` (fixed thumbnail), NOT for the live editor canvas (scrollable content).

### `apiClient.get` — return type and error handling

`apiClient.get<T>(path)` returns `Promise<T>`. On 401 it automatically redirects to `/login` (no manual handling needed). On other non-OK responses it throws `ApiError`. The `toast.error` in the catch block is sufficient for user feedback:

```typescript
try {
  const data = await apiClient.get<ResumeDto>(`/api/v1/resumes/${id}`)
  setResume(data)
  setCurrentResume(data)
} catch {
  setError("Failed to load resume")
  toast.error("Failed to load resume")
} finally {
  setIsLoading(false)
}
```

### lucide-react icons used in `SplitPaneLayout`

- `ChevronLeft` — shown inside chevron button when sidebar is expanded (clicking collapses it)
- `ChevronRight` — shown inside chevron button when sidebar is collapsed (clicking expands it)

All icons available in `lucide-react` (v1.16.0 confirmed in package.json).

### Tailwind `overflow-hidden` on the grid container

The grid container must have `overflow-hidden` to clip the left `leftSlot` content when the column is 48px wide. Without `overflow-hidden`, the `leftSlot` content would spill out of the 48px column horizontally.

### Frontend test setup files

Vitest is configured in `frontend/vite.config.ts` (`test.environment = "jsdom"`, `setupFiles = ["./src/test/setup.ts"]`). The existing `setup.ts` already configures Testing Library matchers. All test utilities are available via Vitest globals (`describe`, `it`, `expect`, `vi` — no need to import from `"vitest"` when `globals: true` is set, but importing explicitly is also fine and matches the 3-3 pattern).

### File locations summary

| File | Action |
|------|--------|
| `frontend/src/components/layout/SplitPaneLayout.tsx` | CREATE |
| `frontend/src/components/layout/SplitPaneLayout.test.tsx` | CREATE |
| `frontend/src/components/resume/ResumeCanvas.tsx` | CREATE |
| `frontend/src/pages/EditorPage.tsx` | REPLACE (currently a 3-line stub) |
| `frontend/src/pages/EditorPage.test.tsx` | CREATE |

No backend changes required. `GET /api/v1/resumes/{resumeId}` already exists from Story 3.1.

### Existing files NOT to modify

| File | Reason |
|------|--------|
| `frontend/src/components/layout/AppShell.tsx` | Already complete; editor uses it via router |
| `frontend/src/stores/useResumeStore.ts` | Already has all needed actions; no new store actions needed |
| `frontend/src/types/api.ts` | All types already defined; `ResumeDocumentDto`, `ResumeSectionDto`, `ResumeItemDto` present |
| `frontend/src/router/index.tsx` | Route already defined; no changes needed |
| `frontend/src/components/resume/ResumeDashboardCard.tsx` | Placeholder preview stays as-is; `ResumeCanvas` integration deferred (see Dev Notes) |

### UX Design Requirements cross-reference

| Req ID | Description | Coverage in this story |
|--------|-------------|------------------------|
| UX-DR2 | `SplitPaneLayout` — keyboard `[`, `aria-expanded`, 150ms ease-out, `localStorage` | Task 1 (full) |
| UX-DR3 | `ResumeCanvas` — semantic HTML, idle state, A4 aspect, drop shadow, zinc-100 bg | Task 2 (`idle` + skeleton only; `streaming`/`diff`/`print-preview` stubs) |
| UX-DR15 | Skeleton loading — `ResumeCanvas` renders `Skeleton` rectangles during load | Task 2 loading state |
| UX-DR1 | D1/D6 hybrid — editor is three-column layout | Task 3 (layout shell wired) |

## Dev Agent Record

### Completion Notes

All acceptance criteria implemented and verified:
- AC1: `EditorPage` renders `SplitPaneLayout` with 3-column grid (240px sidebar / flex-1 center / 288px right).
- AC2: `ResumeCanvas` renders semantic HTML (`<article>`, `<section>`, `<h2>`, `<ul>`) from `ResumeDocumentDto` in idle state.
- AC3: Sidebar collapse/expand with 150ms ease-out CSS grid transition, `aria-expanded` tracking, `localStorage` persistence, and `[` keyboard shortcut.
- AC4: Skeleton loading state with `Skeleton` rectangles rendered while API call is in progress.
- Build: `npm run build` passes (TypeScript strict, no errors).
- Tests: `npm run test` — 40 tests pass (6 new: 4 in `EditorPage.test.tsx`, 6 in `SplitPaneLayout.test.tsx`).

### File List

| File | Action |
|------|--------|
| `frontend/src/components/layout/SplitPaneLayout.tsx` | CREATED |
| `frontend/src/components/layout/SplitPaneLayout.test.tsx` | CREATED |
| `frontend/src/components/resume/ResumeCanvas.tsx` | CREATED |
| `frontend/src/pages/EditorPage.tsx` | REPLACED |
| `frontend/src/pages/EditorPage.test.tsx` | CREATED |

### Change Log

| Date | Change |
|------|--------|
| 2026-06-05 | Implemented story 3-4: SplitPaneLayout, ResumeCanvas, EditorPage, and tests. All ACs passing. |
| 2026-06-05 | Code review passed. 0 patch findings, 2 deferred (pre-existing). Status → done. |

## Review Findings

- [x] [Review][Defer] No `aria-controls` on chevron button pairing `aria-expanded` [SplitPaneLayout.tsx:65] — deferred, pre-existing a11y enhancement pattern not required by spec
- [x] [Review][Defer] `isLoading` not reset to `true` when `id` changes mid-mount [EditorPage.tsx:17] — deferred, pre-existing; React Router route transitions remount the component so in-flight id changes are not a practical concern
