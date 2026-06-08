# Story 3.6: Resume Save, Save-As & Name Management

Status: done

## Story

As an authenticated user,
I want to explicitly save my resume with a name and create independent copies,
So that I can manage multiple versions of my resume without overwriting my work.

## Acceptance Criteria

**AC1 — Resume name inline editing**
**Given** a resume is open in the editor at `/resumes/:id`
**When** the user edits the resume name in the editor toolbar
**Then** a `PUT /api/v1/resumes/{id}` request is triggered to update the name; the new name appears in the browser tab title and reflects in the sidebar item

**AC2 — Save As flow**
**Given** the user clicks "Save As" in the editor toolbar
**When** a name dialog appears and the user confirms a non-blank name
**Then** `POST /api/v1/resumes/{resumeId}/clone` is called with the new name; the user is navigated to the new resume's editor URL `/resumes/{newId}`; a Toast "Resume saved as '{name}'" is shown

**AC3 — Blank name validation**
**Given** the user tries to save with a blank name
**When** the save or save-as action is triggered (inline name field blur or dialog submit)
**Then** a validation error "Name is required" appears inline; the save does not proceed; focus stays on the name input

**AC4 — PUT endpoint correctness**
**Given** `PUT /api/v1/resumes/{id}` is called to update resume content or name
**When** the update is processed
**Then** HTTP 200 is returned with the updated `ResumeDto`; the resume's `updatedAt` timestamp is refreshed

**AC5 — Autosave dot indicator**
**Given** the editor toolbar has a Save button visible
**When** there are unsaved changes (autosave is debouncing or `autosaveStatus === 'saving'`)
**Then** a small dot appears on the Save button label; when autosave succeeds (`autosaveStatus === 'saved'`) the dot disappears; the `role="status"` area already in `EditorPage` is reused

**AC6 — Back navigation**
**Given** the user is in the editor
**When** they click "← Resumes" in the editor toolbar
**Then** they are navigated to `/` (the dashboard); no confirmation is required (autosave handles persistence)

## Tasks / Subtasks

---

### Task 1: Backend — Verify `PUT /api/v1/resumes/{resumeId}` is complete (AC: 4)

- [x] **Story 3.5 already implemented the full PUT endpoint.** Confirm these files exist and are correct:
  - `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java` — record with `@NotBlank String name` and `@NotNull ResumeDocument content`
  - `ResumeController.java` — `@PutMapping("/{resumeId}")` handler calling `resumeService.updateResume(...)`
  - `ResumeService.java` — `updateResume(email, resumeId, request)` method
- [x] **No backend changes are required for Story 3.6.** The PUT endpoint and clone endpoint already exist. This task is a verification checkpoint only.
- [x] If any of the above files are missing or incomplete, refer to Story 3.5 Task 1 for the exact implementation.

---

### Task 2: Create `EditorToolbar.tsx` component (AC: 1, 2, 3, 5, 6)

- [x] Create `frontend/src/components/resume/EditorToolbar.tsx`
- [x] Props interface:
  ```typescript
  interface EditorToolbarProps {
    resumeName: string
    autosaveStatus: 'idle' | 'saving' | 'saved' | 'error'
    isSavingAs: boolean
    onNameChange: (name: string) => void
    onSaveAs: () => void
    onBack: () => void
  }
  ```
- [x] Imports:
  ```typescript
  import { useState, useRef } from "react"
  import { ChevronLeft, Save } from "lucide-react"
  import { Button } from "@/components/ui/button"
  ```
- [x] Component structure — toolbar is `h-12` sticky at top of center column (per UX-DR):
  ```tsx
  export default function EditorToolbar({
    resumeName,
    autosaveStatus,
    isSavingAs,
    onNameChange,
    onSaveAs,
    onBack,
  }: EditorToolbarProps) {
    const [localName, setLocalName] = useState(resumeName)
    const [nameError, setNameError] = useState<string | null>(null)
    const nameInputRef = useRef<HTMLInputElement>(null)

    // Keep local name in sync if parent changes it (e.g. after Save As navigation)
    // Note: useEffect with resumeName dep keeps localName aligned on prop changes
    // Only sync if not actively editing (rely on blur to commit)

    const handleNameBlur = () => {
      if (localName.trim() === '') {
        setNameError('Name is required')
        nameInputRef.current?.focus()
        return
      }
      setNameError(null)
      if (localName !== resumeName) {
        onNameChange(localName)
      }
    }

    const handleSaveAs = () => {
      onSaveAs()
    }

    const hasUnsavedChanges = autosaveStatus === 'saving' || autosaveStatus === 'idle'

    return (
      <div className="h-12 border-b border-border bg-card flex items-center gap-2 px-4 shrink-0">
        {/* Back navigation */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 text-muted-foreground"
          aria-label="Back to resumes"
        >
          <ChevronLeft className="size-4" />
          Resumes
        </Button>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Inline name editor */}
          <input
            ref={nameInputRef}
            type="text"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value)
              if (nameError) setNameError(null)
            }}
            onBlur={handleNameBlur}
            placeholder="Resume name"
            aria-label="Resume name"
            aria-describedby={nameError ? 'name-error' : undefined}
            className="text-sm font-medium bg-transparent border-0 outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded px-1 w-full min-w-0 truncate"
          />
          {nameError && (
            <p id="name-error" role="alert" className="text-xs text-destructive px-1">
              {nameError}
            </p>
          )}
        </div>

        {/* Save As button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSaveAs}
          disabled={isSavingAs}
          aria-label="Save as new resume"
        >
          {isSavingAs ? 'Saving…' : 'Save As'}
        </Button>

        {/* Save button with autosave dot indicator */}
        <Button
          type="button"
          variant="default"
          size="sm"
          className="gap-1.5 relative"
          aria-label={hasUnsavedChanges ? 'Unsaved changes — autosaving' : 'Resume saved'}
          disabled
        >
          <Save className="size-4" />
          Save
          {hasUnsavedChanges && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-500"
              aria-hidden="true"
            />
          )}
        </Button>
      </div>
    )
  }
  ```
- [x] **Save button is non-interactive (disabled)** — autosave handles all persistence; the button is a visual indicator of save state only, not a clickable action. This matches the UX spec: "Autosave throughout; only naming/versioning decisions require user action."
- [x] **"Save As" opens a dialog** — implement in Task 3 below
- [x] The `role="status"` save indicator div already in `EditorPage`'s `centerSlot` can be removed or hidden once the toolbar provides the dot indicator — leave it in place (it is harmless and used by screen readers)

---

### Task 3: Create `SaveAsDialog.tsx` component (AC: 2, 3)

- [x] Create `frontend/src/components/resume/SaveAsDialog.tsx`
- [x] Imports:
  ```typescript
  import { useState, useRef, useEffect } from "react"
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from "@/components/ui/dialog"
  import { Button } from "@/components/ui/button"
  import { Input } from "@/components/ui/input"
  import { Label } from "@/components/ui/label"
  ```
- [x] Props interface:
  ```typescript
  interface SaveAsDialogProps {
    open: boolean
    defaultName: string
    isSaving: boolean
    onConfirm: (name: string) => void
    onClose: () => void
  }
  ```
- [x] Component:
  ```tsx
  export default function SaveAsDialog({
    open,
    defaultName,
    isSaving,
    onConfirm,
    onClose,
  }: SaveAsDialogProps) {
    const [name, setName] = useState(defaultName)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset name when dialog opens with a new defaultName
    useEffect(() => {
      if (open) {
        setName(defaultName)
        setError(null)
        // Focus the input after dialog opens
        setTimeout(() => inputRef.current?.select(), 0)
      }
    }, [open, defaultName])

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (name.trim() === '') {
        setError('Name is required')
        inputRef.current?.focus()
        return
      }
      setError(null)
      onConfirm(name.trim())
    }

    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o && !isSaving) onClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save As</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="py-4 space-y-2">
              <Label htmlFor="save-as-name">Resume name</Label>
              <Input
                id="save-as-name"
                ref={inputRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                aria-describedby={error ? 'save-as-error' : undefined}
                autoComplete="off"
              />
              {error && (
                <p id="save-as-error" role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save As'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
  ```
- [x] **Dialog closes on backdrop click only when not in the middle of saving** (`onOpenChange` guard)
- [x] **Focus management**: Input is auto-selected when dialog opens (all text selected for quick rename); focus returns to the "Save As" button after dialog closes — shadcn/ui `Dialog` handles return-focus automatically
- [x] **Escape key** dismisses dialog (shadcn/ui `Dialog` built-in)

---

### Task 4: Update `useResumeStore` — add `updateResumeName` action (AC: 1)

- [x] Edit `frontend/src/stores/useResumeStore.ts`
- [x] Add `updateResumeName` to the `ResumeState` interface:
  ```typescript
  updateResumeName: (name: string) => void
  ```
- [x] Implement `updateResumeName`:
  ```typescript
  updateResumeName: (name) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: { ...state.currentResume, name },
      }
    }),
  ```
- [x] **Do NOT remove or modify** any existing actions — this is an additive change only
- [x] The `name` update via `updateResumeName` will trigger `useAutosave` because `currentResume` changes. The `useAutosave` hook already sends `{ name: doc.name, content: doc.content }` in the PUT body — name changes are automatically persisted via the existing debounce.

---

### Task 5: Update `EditorPage.tsx` — wire toolbar and Save As (AC: 1, 2, 3, 5, 6)

- [x] Edit `frontend/src/pages/EditorPage.tsx`
- [x] Add new imports:
  ```typescript
  import { useNavigate } from "react-router-dom"
  import EditorToolbar from "@/components/resume/EditorToolbar"
  import SaveAsDialog from "@/components/resume/SaveAsDialog"
  ```
- [x] Add `useNavigate` hook:
  ```typescript
  const navigate = useNavigate()
  ```
- [x] Add `updateResumeName` from store:
  ```typescript
  const updateResumeName = useResumeStore((state) => state.updateResumeName)
  ```
- [x] Add local state for Save As dialog:
  ```typescript
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false)
  const [isSavingAs, setIsSavingAs] = useState(false)
  ```
- [x] Add `handleNameChange` callback:
  ```typescript
  const handleNameChange = useCallback(
    (name: string) => {
      updateResumeName(name)
      // useAutosave will pick up the currentResume change and debounce the PUT
    },
    [updateResumeName]
  )
  ```
- [x] Add `handleSaveAs` callback:
  ```typescript
  const handleSaveAs = useCallback(async (name: string) => {
    if (!id) return
    setIsSavingAs(true)
    try {
      const newResume = await apiClient.post<ResumeDto>(
        `/api/v1/resumes/${id}/clone`,
        { name }
      )
      setIsSaveAsOpen(false)
      toast.success(`Resume saved as '${name}'`)
      navigate(`/resumes/${newResume.id}`)
    } catch {
      toast.error('Failed to save as — please try again')
    } finally {
      setIsSavingAs(false)
    }
  }, [id, navigate])
  ```
- [x] Add `handleBack` callback:
  ```typescript
  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])
  ```
- [x] **Restructure `centerSlot`** — wrap with a fragment that adds `EditorToolbar` above the existing content:
  ```tsx
  centerSlot={
    error !== null && !isLoading ? (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    ) : (
      <div className="flex flex-col h-full overflow-hidden">
        <EditorToolbar
          resumeName={currentResume?.name ?? ''}
          autosaveStatus={autosaveStatus}
          isSavingAs={isSavingAs}
          onNameChange={handleNameChange}
          onSaveAs={() => setIsSaveAsOpen(true)}
          onBack={handleBack}
        />
        {/* Existing autosave status div — keep it for screen readers */}
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {autosaveStatus === 'saving' && 'Saving…'}
          {autosaveStatus === 'saved' && 'Saved'}
          {autosaveStatus === 'error' && 'Save failed'}
        </div>
        {/* Existing canvas area — unchanged */}
        <div className="flex-1 overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">
          {/* ... existing skeleton / canvas / ResumeSection rendering — keep verbatim ... */}
        </div>
      </div>
    )
  }
  ```
- [x] **Add `SaveAsDialog`** after `<SplitPaneLayout>` closing tag (or as a sibling before it):
  ```tsx
  <>
    <SplitPaneLayout ... />
    <SaveAsDialog
      open={isSaveAsOpen}
      defaultName={currentResume ? `${currentResume.name} (copy)` : ''}
      isSaving={isSavingAs}
      onConfirm={handleSaveAs}
      onClose={() => setIsSaveAsOpen(false)}
    />
  </>
  ```
- [x] **Remove the old autosave status `div` from the visible area** (the one with `text-xs text-muted-foreground text-right px-4 py-1 h-6`) — replace it with the `sr-only` version shown above. The `EditorToolbar` now provides the visible dot indicator.
- [x] **`useNavigate`** — `react-router-dom` is already installed; just add the import and hook call. `useNavigate` is already used in `DashboardPage.tsx`.
- [x] **Browser tab title**: Update via `document.title` in a `useEffect` that depends on `currentResume?.name`:
  ```typescript
  useEffect(() => {
    if (currentResume?.name) {
      document.title = `${currentResume.name} — Resume Enhancer`
    }
    return () => {
      document.title = 'Resume Enhancer'
    }
  }, [currentResume?.name])
  ```

---

### Task 6: Update `EditorPage.test.tsx` (AC: 1, 2, 3, 5, 6)

- [x] Edit `frontend/src/pages/EditorPage.test.tsx`
- [x] Add `post: vi.fn()` to the `apiClient` mock object (Save As calls `apiClient.post`):
  ```typescript
  vi.mock("@/lib/apiClient", () => ({
    apiClient: {
      get: vi.fn(),
      put: vi.fn(() => new Promise(() => {})),
      post: vi.fn(),
    },
  }))
  ```
- [x] Add mock for `react-router-dom`'s `useNavigate` (already mocked via the existing `useParams` mock — extend it):
  ```typescript
  const mockNavigate = vi.fn()
  vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router-dom")>()
    return {
      ...actual,
      useParams: () => ({ id: "test-resume-id" }),
      useNavigate: () => mockNavigate,
    }
  })
  ```
- [x] Add `beforeEach` reset: `mockNavigate.mockReset()`
- [x] **Existing 4 tests must continue to pass** — verify they do not break

**New test cases to add:**

```typescript
it("renders editor toolbar with resume name after fetch", async () => {
  mockGet.mockResolvedValue(buildResume())
  render(<EditorPage />)
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /resume name/i })).toHaveValue("Test Resume")
  )
})

it("navigates to dashboard on back button click", async () => {
  mockGet.mockResolvedValue(buildResume())
  render(<EditorPage />)
  await waitFor(() => screen.getByLabelText(/back to resumes/i))
  fireEvent.click(screen.getByLabelText(/back to resumes/i))
  expect(mockNavigate).toHaveBeenCalledWith('/')
})

it("opens Save As dialog when Save As button is clicked", async () => {
  mockGet.mockResolvedValue(buildResume())
  render(<EditorPage />)
  await waitFor(() => screen.getByRole("button", { name: /save as/i }))
  fireEvent.click(screen.getByRole("button", { name: /save as new resume/i }))
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  )
})

it("calls clone endpoint and navigates on Save As confirm", async () => {
  const newResume = buildResume({ id: "new-resume-id", name: "My Copy" })
  mockGet.mockResolvedValue(buildResume())
  vi.mocked(apiClient.post).mockResolvedValue(newResume)
  render(<EditorPage />)
  await waitFor(() => screen.getByRole("button", { name: /save as new resume/i }))
  fireEvent.click(screen.getByRole("button", { name: /save as new resume/i }))
  await waitFor(() => screen.getByRole("dialog"))
  // Clear default name and type new one
  const nameInput = screen.getByLabelText(/resume name/i)
  fireEvent.change(nameInput, { target: { value: "My Copy" } })
  fireEvent.click(screen.getByRole("button", { name: /^save as$/i }))
  await waitFor(() =>
    expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith(
      "/api/v1/resumes/test-resume-id/clone",
      { name: "My Copy" }
    )
  )
  expect(mockNavigate).toHaveBeenCalledWith("/resumes/new-resume-id")
})
```

- [x] Import `fireEvent` from `@testing-library/react` (already available, likely imported)
- [x] Use `userEvent` if already in scope; otherwise `fireEvent` is fine for these tests

---

### Task 7: Lint pass

- [x] From `frontend/` directory, run: `npm run lint`
- [x] Fix any ESLint errors (0 errors required before marking story done)
- [x] Common pitfalls: unused imports, missing `useEffect` dependencies, `any` type

---

## Dev Notes

### CRITICAL: PUT endpoint already exists — do NOT reimplement it

`PUT /api/v1/resumes/{resumeId}` was fully implemented in Story 3.5 (Task 1). The `UpdateResumeRequest` DTO requires both `name` AND `content`. The `useAutosave` hook already sends both fields. Name changes via `updateResumeName` trigger a store update → `useAutosave` debounces → PUT fires with the new name and current content. **There is no separate "save name only" endpoint needed.**

### CRITICAL: `useAutosave` handles name persistence automatically

When `updateResumeName(name)` is called, it updates `currentResume.name` in Zustand. `useAutosave` watches `currentResume` and will fire a PUT with `{ name: newName, content: currentContent }` after 500ms. The snapshot-based dirty check in `useAutosave` compares `doc.name === snapshot.name && JSON.stringify(doc.content) === snapshot.contentJson` — a name-only change will NOT be skipped because `doc.name !== snapshot.name`. This was validated as part of the Story 3.5 review cycle.

### CRITICAL: `SaveAsRequest` DTO already exists in `types/api.ts`

`frontend/src/types/api.ts` already has:
```typescript
export interface SaveAsRequest {
  name: string
}
```
The `apiClient.post<ResumeDto>('/api/v1/resumes/{id}/clone', { name })` call matches this DTO exactly. Do NOT create a new type.

### CRITICAL: `EditorToolbar` height must be `h-12` and shrink-0

The `SplitPaneLayout` center column is `div.overflow-hidden` with the center slot as a direct child. The current `EditorPage` `centerSlot` content uses `h-full overflow-y-auto` for the canvas area. When adding the toolbar above the canvas, the container **must** be a flex column with `h-full overflow-hidden`, the toolbar gets `h-12 shrink-0`, and the canvas area gets `flex-1 overflow-y-auto`. Without `shrink-0` on the toolbar, it will collapse when the canvas is tall.

Expected layout:
```
centerSlot wrapper: div.flex.flex-col.h-full.overflow-hidden
├── EditorToolbar: div.h-12.border-b.shrink-0
├── sr-only status div (autosave for screen readers)
└── canvas area: div.flex-1.overflow-y-auto.bg-zinc-100...
    └── article#resume-canvas
```

### CRITICAL: `SplitPaneLayout` uses `calc(100vh - 56px)` for height

`SplitPaneLayout` sets `height: calc(100vh - 56px)` on the grid container (the `56px` is the `AppShell` nav height). The center column is `overflow: hidden`. This means the toolbar + canvas layout described above must fit within that height. The `flex flex-col h-full` on the wrapper ensures it uses all available space without overflow.

### CRITICAL: `useNavigate` must be inside `Router` context

`useNavigate` requires being inside a `Router` context. The test mock already stubs `useParams` from `react-router-dom`; extend it to also stub `useNavigate`. See Task 6 for the exact mock shape. Without this mock, the test will throw "useNavigate() may be used only in the context of a Router component."

### CRITICAL: `Dialog` from shadcn/ui uses `@base-ui/react/dialog`

The installed `Dialog` at `@/components/ui/dialog.tsx` wraps `@base-ui/react/dialog`, NOT `@radix-ui/react-dialog`. Import from `@/components/ui/dialog` only (the shadcn wrapper). Available exports: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`. Do NOT import from `@base-ui` directly.

### CRITICAL: `Input` and `Label` components from shadcn/ui

`Input` is at `@/components/ui/input.tsx` and `Label` is at `@/components/ui/label.tsx`. Both are already installed (confirmed in Story 1.2 component list). Import from `@/components/ui/input` and `@/components/ui/label` respectively.

### Save button is a visual indicator, not a submit trigger

Per UX spec: "Autosave throughout; only naming/versioning decisions require user action." The Save button shows the autosave state (dot = pending changes, no dot = saved). It is `disabled` and non-interactive. This is intentional — do not add an `onClick` handler that triggers `apiClient.put` manually.

### `autosaveStatus` dot: 'idle' vs 'saving' behavior

The `useAutosave` hook returns `status: 'idle' | 'saving' | 'saved' | 'error'`. The dot should appear when `autosaveStatus === 'saving'`. When `autosaveStatus === 'idle'` (before any edit), there are no unsaved changes yet, so no dot. After a successful save, `autosaveStatus === 'saved'` — no dot. After an error, `autosaveStatus === 'error'` — consider showing the dot (or a red indicator). The formula `hasUnsavedChanges = autosaveStatus === 'saving'` covers the common case; extend to include `'idle'` only if UX feedback indicates it is confusing.

### Browser tab title cleanup on unmount

The `useEffect` for `document.title` must reset to `'Resume Enhancer'` in its cleanup function. Without the cleanup, navigating to the dashboard leaves the browser tab showing the resume name. The cleanup `return () => { document.title = 'Resume Enhancer' }` runs on unmount.

### `SaveAsDialog` default name pre-populated

When "Save As" is clicked, the dialog should pre-populate the name input with `${currentResume.name} (copy)` — the same convention used by the dashboard Duplicate action (`handleDuplicate` in `DashboardPage.tsx` uses `${resume.name} (copy)`). This gives users a sensible starting point for the new name.

### AC1 name update: `onBlur` not `onInput`

The inline name input in `EditorToolbar` commits on `onBlur` (when focus leaves the field). It does NOT fire `onNameChange` on every keystroke — `localName` state tracks the in-progress edit; `onNameChange` is called only after validation passes and the name has actually changed. This prevents the autosave debounce from firing on every character typed in the name field.

### EditorPage state flow for Save As

Save As (`handleSaveAs`) calls `POST /{id}/clone` which returns a new `ResumeDto`. After success:
1. Close dialog (`setIsSaveAsOpen(false)`)
2. Show success Toast
3. `navigate('/resumes/${newResume.id}')` — this triggers a full page re-load of `EditorPage` with the new `id` param
4. The new `EditorPage` instance runs its `useEffect` fetch with the new ID
5. `setCurrentResume` and `setLastSavedDocument` are reset for the new resume

This means `currentResume` in the store transitions cleanly — no manual cleanup needed. The cleanup `useEffect` in `EditorPage` (`return () => setCurrentResume(null)`) runs on unmount of the old instance and the new mount fetches fresh data.

### Not in scope for Story 3.6

- `ResumeSidebarItem` (referenced in Story 3.8 UX spec) — not built yet; no sidebar resume list in the editor
- Template switching (Story 3.7)
- Export button (stub only, Story 5.x)
- AI action buttons (`AIActionBar`) — Story 4.x
- "Save changes before switching?" unsaved-changes guard — this is a UX-DR navigation pattern but is deferred; autosave makes it largely unnecessary
- Chat panel (Story 4.3)

## File Changes Summary

### New Files (frontend)
| File | Purpose |
|------|---------|
| `frontend/src/components/resume/EditorToolbar.tsx` | Toolbar with name editor, Save As button, save dot indicator, back navigation |
| `frontend/src/components/resume/SaveAsDialog.tsx` | Modal dialog for Save As name input with validation |

### Modified Files (frontend)
| File | Changes |
|------|---------|
| `frontend/src/stores/useResumeStore.ts` | Add `updateResumeName` action |
| `frontend/src/pages/EditorPage.tsx` | Wire `EditorToolbar`, `SaveAsDialog`, `handleSaveAs`, `handleBack`, `handleNameChange`, `document.title` |
| `frontend/src/pages/EditorPage.test.tsx` | Add `post: vi.fn()` to mock, add `useNavigate` mock, add 4 new test cases |

### No Changes Needed
| File | Reason |
|------|---------|
| `frontend/src/types/api.ts` | `SaveAsRequest` already exists; `ResumeDto` shape unchanged |
| `frontend/src/hooks/useAutosave.ts` | No changes needed; name updates flow through existing debounce |
| Backend (`ResumeController`, `ResumeService`, `UpdateResumeRequest`) | Fully implemented in Story 3.5; no backend work in 3.6 |
| `frontend/src/components/layout/SplitPaneLayout.tsx` | No changes needed; toolbar is part of centerSlot content |
| `frontend/src/components/ui/*` | Never edited — shadcn-managed |

## References

- **FR11**: Authenticated users can save a resume with a user-provided name
- **FR12**: Authenticated users can save a modified resume as a new independent copy with a new name
- **UX-DR**: Editor toolbar `h-12` sticky at top of center column (ux-design-specification.md: "Editor toolbar: `h-12`, sticky at top of center column")
- **UX-DR**: Save state dot indicator (ux-design-specification.md: "Unsaved indicator: a small dot on the Save button label when unsaved changes exist")
- **UX-DR**: Back navigation (ux-design-specification.md: "`← Resumes` text link in the editor toolbar returns to dashboard")
- **UX-DR**: Save As dialog (ux-design-specification.md: "`Dialog` for: confirmation, export, save-as naming, JD input")
- **UX-DR**: Save As Toast (ux-design-specification.md: "Save confirmed, export ready — `Toast` bottom-right, 4s")
- **Story 3.5 dev notes**: `PUT /api/v1/resumes/{resumeId}` endpoint details; `useAutosave` hook; `UpdateResumeRequest` DTO shape; autosave handles name + content
- **Story 3.1**: `POST /api/v1/resumes/{resumeId}/clone` + `SaveAsRequest` implemented
- `frontend/src/pages/EditorPage.tsx` — current state (has `autosaveStatus` from `useAutosave`, `SectionsPanel`, `ResumeSection`)
- `frontend/src/stores/useResumeStore.ts` — current state (has `currentResume`, immutable set pattern)
- `frontend/src/hooks/useAutosave.ts` — snapshot-based dirty check; sends `{ name, content }` in PUT
- `frontend/src/types/api.ts` — `SaveAsRequest`, `ResumeDto`, `ResumeDocumentDto` types
- `frontend/src/components/layout/SplitPaneLayout.tsx` — `h-12` toolbar slot pattern, `calc(100vh - 56px)` height constraint

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation completed cleanly.

### Completion Notes List

- Task 1: Verified PUT `/api/v1/resumes/{resumeId}` and clone endpoint fully implemented in Story 3.5 — no backend changes needed.
- Task 2: Created `EditorToolbar.tsx` with `h-12 shrink-0` layout, inline name input with blur-commit and validation, Save As button, disabled Save button with autosave dot indicator, and Back navigation. Used `isEditingRef` to prevent prop sync from overwriting in-progress edits.
- Task 3: Created `SaveAsDialog.tsx` using `@base-ui/react` Dialog (via shadcn wrapper). Refactored to `SaveAsForm` sub-component to avoid `setState` in effect (ESLint `react-hooks/set-state-in-effect`). Dialog resets name state on open via `key` prop tied to `defaultName`.
- Task 4: Added `updateResumeName` action to `useResumeStore` — additive only, no existing actions modified.
- Task 5: Rewrote `EditorPage.tsx` to wire `EditorToolbar`, `SaveAsDialog`, `handleNameChange`, `handleSaveAs`, `handleBack`, and `document.title` effect. Replaced visible autosave status div with `sr-only` version; dot indicator in toolbar now provides visual feedback.
- Task 6: Extended `EditorPage.test.tsx` with `post: vi.fn()` on apiClient mock, `useNavigate` mock, `mockNavigate` reset in `beforeEach`, and 4 new test cases. Fixed ambiguous `getByLabelText` in clone test by scoping to dialog element via `querySelector('#save-as-name')`.
- Task 7: Lint passes with 0 errors. 2 pre-existing warnings in `useAutosave.ts` and `DashboardPage.tsx` unchanged.
- All 58 tests pass (8 file suite, no regressions).

### File List

- `frontend/src/components/resume/EditorToolbar.tsx` (new)
- `frontend/src/components/resume/SaveAsDialog.tsx` (new)
- `frontend/src/stores/useResumeStore.ts` (modified — added `updateResumeName`)
- `frontend/src/pages/EditorPage.tsx` (modified — toolbar, dialog, callbacks, document.title)
- `frontend/src/pages/EditorPage.test.tsx` (modified — post mock, useNavigate mock, 4 new tests)

## Change Log

- 2026-06-05: Implemented story 3.6 — EditorToolbar, SaveAsDialog, updateResumeName store action, EditorPage wiring. All 6 ACs satisfied. 58 tests pass, 0 lint errors.
- 2026-06-05: Code review pass — patched `toast` in `useCallback` dep array (`EditorPage.tsx:110`). All 61 tests pass, 0 lint errors/warnings. Status set to done.

### Review Findings

- [x] [Review][Patch] `toast` in `handleSaveAs` useCallback dep array [EditorPage.tsx:110] — applied: removed `toast` from `[id, navigate, toast]` → `[id, navigate]`
- [x] [Review][Defer] JSX indentation misalignment in centerSlot close tags [EditorPage.tsx:206-209] — deferred, cosmetic, pre-existing pattern
