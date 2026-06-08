# Story 3.8: Resume Deletion with Undo & Confirm Dialogs

Status: done

## Story

As an authenticated user,
I want safe deletion patterns with undo and confirmation dialogs,
So that I never accidentally lose work without the ability to recover.

## Acceptance Criteria

**AC1 — Dashboard delete: soft-remove + undo toast (no dialog)**
**Given** the user clicks the delete button on a `ResumeDashboardCard`
**When** the delete action is triggered
**Then** the card is removed from the UI immediately (optimistic); a shadcn/ui Toast "Deleted. Undo?" appears for 5 seconds; NO confirmation dialog is shown (UX-DR17)

**AC2 — Undo restores card before API call**
**Given** the 5-second undo window is active
**When** the user clicks "Undo" in the Toast
**Then** the card is restored in the UI and no `DELETE /api/v1/resumes/{id}` API call is made

**AC3 — Timeout triggers permanent API delete with failure recovery**
**Given** the 5-second undo window expires without an undo action
**When** the timeout fires
**Then** `DELETE /api/v1/resumes/{id}` is called; on success the item is permanently removed; on API failure a Toast "Delete failed — resume restored" appears and the card is restored in the UI

**AC4 — Irreversible-action confirm dialog (resume revert)**
**Given** the user triggers a destructive action that is irreversible (e.g. resume revert to original — stub for this story)
**When** the action is initiated
**Then** a shadcn/ui `Dialog` confirmation appears with a description of the destructive action and a Cancel button; the Cancel button is default-focused; pressing Enter must NOT trigger the destructive action (UX-DR18)

**AC5 — `ResumeSidebarItem` component with hover actions and active state**
**Given** the `ResumeSidebarItem` component is rendered in the editor left sidebar
**When** the user hovers over a sidebar item
**Then** action icons for duplicate, delete, and export (stub) appear; the active resume (matching current `id` param) has a blue background highlight (UX-DR9)

---

## Tasks / Subtasks

### Task 1: Verify existing dashboard delete flow matches AC1-AC3 (AC: 1, 2, 3)

- [x] Read `frontend/src/pages/DashboardPage.tsx` — the `handleDelete` callback already implements the 5-second undo pattern using `pendingDeletes` ref + `setTimeout` + sonner `toast()`
- [x] Verify AC1: card removed from `displayedResumes` immediately via `setDisplayedResumes(prev => prev.filter(r => r.id !== resume.id))`
- [x] Verify AC2: undo clears the timeout via `clearTimeout` and restores via `setDisplayedResumes(prev => [...prev, resume])`
- [x] Verify AC3: timeout callback calls `apiClient.delete('/api/v1/resumes/${resume.id}')`, on catch restores card and shows `toast.error("Delete failed — resume restored")`
- [x] **If all verified, this task is DONE — do NOT rewrite the existing working implementation.** The existing implementation in `DashboardPage.tsx` lines 79-116 already satisfies AC1-AC3. Only fix if a gap is found.
- [x] Verify `DashboardPage.test.tsx` tests cover: soft-remove, undo toast call, API delete called on timeout, undo prevents API call — these tests already exist (lines 105-178). No new backend work needed.

---

### Task 2: Create `ConfirmDialog` component (AC: 4)

- [x] Create `frontend/src/components/resume/ConfirmDialog.tsx`

**Purpose:** Reusable destructive-action confirmation dialog. Cancel is default-focused. Enter does NOT trigger the destructive action (UX-DR18).

**Props interface:**
```typescript
interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string   // defaults to "Confirm"
  cancelLabel?: string    // defaults to "Cancel"
  isDestructive?: boolean // renders confirm button with destructive variant
  onConfirm: () => void
  onCancel: () => void
}
```

**Implementation:**
```tsx
import { useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus Cancel button when dialog opens (UX-DR18: Cancel is default-focused)
  useEffect(() => {
    if (open) {
      // Use a microtask delay so the dialog has rendered before focusing
      const id = setTimeout(() => cancelRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [open])

  // UX-DR18: pressing Enter must NOT trigger the destructive action
  // Because Cancel is focused by default, Enter naturally triggers Cancel
  // (the button's default form submit behavior). No extra keydown handler needed.

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**CRITICAL — `Button` variant check:** Inspect `frontend/src/components/ui/button.tsx` to confirm a `"destructive"` variant exists. If it does not exist under that exact name, use `variant="outline"` with `className="text-destructive border-destructive hover:bg-destructive/10"` instead. Do NOT edit `button.tsx` (shadcn-managed).

**CRITICAL — `showCloseButton={false}`:** The `DialogContent` component in `frontend/src/components/ui/dialog.tsx` accepts `showCloseButton?: boolean` (defaults to `true`). Set it to `false` in `ConfirmDialog` so only Cancel + Confirm buttons appear. Verified in `dialog.tsx` lines 42-68.

**CRITICAL — Dialog uses `@base-ui/react/dialog`:** The `dialog.tsx` uses `@base-ui/react`, not Radix. The `open/onOpenChange` prop is passed to `Dialog` (which wraps `DialogPrimitive.Root`). Verified correct API.

---

### Task 3: Create `ConfirmDialog.test.tsx` (AC: 4)

- [x] Create `frontend/src/components/resume/ConfirmDialog.test.tsx`

```typescript
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ConfirmDialog from "./ConfirmDialog"

describe("ConfirmDialog", () => {
  it("renders title and description when open (AC4)", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Resume"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText("Delete Resume")).toBeInTheDocument()
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument()
  })

  it("calls onConfirm when Confirm button clicked (AC4)", () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Are you sure?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("calls onCancel when Cancel button clicked (AC4)", () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete"
        description="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
  })

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Revert"
        description="Revert to original?"
        confirmLabel="Revert"
        cancelLabel="Keep Changes"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: /revert/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /keep changes/i })).toBeInTheDocument()
  })
})
```

---

### Task 4: Create `ResumeSidebarItem` component (AC: 5)

- [x] Create `frontend/src/components/resume/ResumeSidebarItem.tsx`

**Purpose:** Sidebar list item for the editor left panel showing all user resumes. Hover reveals action icons for duplicate, delete (undo toast pattern), and export (stub). Active resume has blue background (UX-DR9).

**Props interface:**
```typescript
interface ResumeSidebarItemProps {
  resume: ResumeDto
  isActive: boolean
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  isDuplicating?: boolean
}
```

**Full implementation:**
```tsx
import { ExternalLink, Download, Copy, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import type { ResumeDto } from "@/types/api"

export default function ResumeSidebarItem({
  resume,
  isActive,
  onOpen,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: ResumeSidebarItemProps) {
  return (
    <div
      className={[
        "group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isActive
          ? "bg-blue-50 text-blue-900"
          : "hover:bg-muted",
      ].join(" ")}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Open ${resume.name}${isActive ? " (active)" : ""}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen() }}
    >
      {/* Resume info */}
      <div className="flex-1 min-w-0">
        <p className={[
          "text-xs font-medium truncate",
          isActive ? "text-blue-900" : "",
        ].join(" ")}>
          {resume.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {resume.isTailored ? (
            <Badge className="text-[10px] px-1 py-0 h-4">Tailored</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Base</Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(resume.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Hover action icons — visible on hover/focus-within (UX-DR9) */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          aria-label={`Open ${resume.name}`}
          className="p-1 rounded hover:bg-muted"
        >
          <ExternalLink className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toast("Export coming soon")
          }}
          aria-label={`Export ${resume.name}`}
          className="p-1 rounded hover:bg-muted"
        >
          <Download className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          aria-label={`Duplicate ${resume.name}`}
          className="p-1 rounded hover:bg-muted"
          disabled={isDuplicating}
        >
          {isDuplicating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete ${resume.name}`}
          className="p-1 rounded hover:bg-muted hover:text-red-500"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
```

**CRITICAL — Delete behavior in sidebar:** The `onDelete` prop uses the same undo-toast pattern as `DashboardPage.handleDelete`. The parent (`EditorPage`) must implement `handleDeleteFromSidebar` that follows the same `pendingDeletes` ref + `setTimeout` + sonner undo toast pattern. See Task 5.

**CRITICAL — Sidebar integration context:** `ResumeSidebarItem` is rendered in `EditorPage`'s `leftSlot`, below `SectionsPanel` and `TemplateGallery`. The `EditorPage` currently shows only the current resume's sections in the sidebar — the ResumeSidebarItem list adds a "Resumes" section so the user can navigate between resumes from the editor.

---

### Task 5: Wire `ResumeSidebarItem` into `EditorPage` left sidebar (AC: 5)

- [x] Edit `frontend/src/pages/EditorPage.tsx`

**New state and refs to add:**
```typescript
const [sidebarResumes, setSidebarResumes] = useState<ResumeDto[]>([])
const [duplicatingSidebarId, setDuplicatingSidebarId] = useState<string | null>(null)
const pendingSidebarDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
```

**New store selector:**
```typescript
const resumes = useResumeStore((state) => state.resumes)
```

**Sync `sidebarResumes` from store on mount (resumes already loaded by DashboardPage into store):**
```typescript
useEffect(() => {
  setSidebarResumes(resumes)
}, [resumes])
```

**Cleanup pending deletes on unmount:**
```typescript
// Add to the existing cleanup useEffect or create a new one
useEffect(() => {
  const ref = pendingSidebarDeletes.current
  return () => { ref.forEach(clearTimeout) }
}, [])
```

**New `handleDuplicateFromSidebar` callback:**
```typescript
const handleDuplicateFromSidebar = useCallback(async (resume: ResumeDto) => {
  setDuplicatingSidebarId(resume.id)
  try {
    const newResume = await apiClient.post<ResumeDto>(
      `/api/v1/resumes/${resume.id}/clone`,
      { name: `${resume.name} (copy)` },
    )
    setSidebarResumes((prev) => [newResume, ...prev])
    toast.success("Resume duplicated")
  } catch {
    toast.error("Failed to duplicate resume")
  } finally {
    setDuplicatingSidebarId(null)
  }
}, [])
```

**New `handleDeleteFromSidebar` callback (mirrors DashboardPage.handleDelete exactly):**
```typescript
const handleDeleteFromSidebar = useCallback((resume: ResumeDto) => {
  // 1. Remove from sidebar list immediately (optimistic)
  setSidebarResumes((prev) => prev.filter((r) => r.id !== resume.id))

  // 2. Schedule actual API delete after 5s
  const timeoutId = setTimeout(async () => {
    pendingSidebarDeletes.current.delete(resume.id)
    try {
      await apiClient.delete(`/api/v1/resumes/${resume.id}`)
    } catch {
      setSidebarResumes((prev) => {
        if (prev.find((r) => r.id === resume.id)) return prev
        return [...prev, resume]
      })
      toast.error("Delete failed — resume restored")
    }
  }, 5000)

  pendingSidebarDeletes.current.set(resume.id, timeoutId)

  // 3. Show undo toast
  toast("Deleted. Undo?", {
    action: {
      label: "Undo",
      onClick: () => {
        const tid = pendingSidebarDeletes.current.get(resume.id)
        if (tid !== undefined) clearTimeout(tid)
        pendingSidebarDeletes.current.delete(resume.id)
        setSidebarResumes((prev) => {
          if (prev.find((r) => r.id === resume.id)) return prev
          return [...prev, resume]
        })
      },
    },
    duration: 5000,
  })
}, [])
```

**New imports to add at top of `EditorPage.tsx`:**
```typescript
import { useCallback, useEffect, useState, useRef } from "react"  // add useRef
import ResumeSidebarItem from "@/components/resume/ResumeSidebarItem"
import type { ResumeDto } from "@/types/api"  // already imported
```

**Extend `leftSlot`** — add a "Resumes" section above `SectionsPanel`:
```tsx
leftSlot={
  <div className="overflow-y-auto h-full">
    {/* Resume list for quick navigation (UX-DR9) */}
    {sidebarResumes.length > 0 && (
      <div className="px-2 py-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 px-1">
          Resumes
        </p>
        {sidebarResumes.map((r) => (
          <ResumeSidebarItem
            key={r.id}
            resume={r}
            isActive={r.id === id}
            onOpen={() => navigate(`/resumes/${r.id}`)}
            onDuplicate={() => handleDuplicateFromSidebar(r)}
            onDelete={() => handleDeleteFromSidebar(r)}
            isDuplicating={duplicatingSidebarId === r.id}
          />
        ))}
      </div>
    )}
    <SectionsPanel sections={currentResume?.content.sections ?? []} />
    <div className="border-t border-border mt-2 pt-2">
      <TemplateGallery
        activeTemplateId={currentResume?.templateId ?? null}
        onApply={handleApplyTemplate}
      />
    </div>
  </div>
}
```

**CRITICAL — `id` param is already available** from `const { id } = useParams<{ id: string }>()` (line 17 of current `EditorPage.tsx`). Use it directly for `isActive={r.id === id}`.

**CRITICAL — `resumes` from `useResumeStore`:** The `DashboardPage` loads all resumes on mount via `setResumes(data)` into the store. When the user navigates to the editor from the dashboard, the store's `resumes` array is already populated. If the user navigates directly to an editor URL (deep link), `resumes` may be empty — in that case `sidebarResumes` will be empty and the section simply won't render (acceptable for this story; full sidebar loading is an enhancement).

**CRITICAL — Do NOT use `useState` for `resumes` loaded from the API** — use the existing `useResumeStore((state) => state.resumes)` store. The local `sidebarResumes` state is separate to allow optimistic delete without mutating the global store (which would affect the dashboard on back-navigation).

**CRITICAL — `useRef` not currently imported in `EditorPage.tsx`** — the current imports are `useCallback, useEffect, useState` (line 1). Must add `useRef`.

---

### Task 6: Create `ResumeSidebarItem.test.tsx` (AC: 5)

- [x] Create `frontend/src/components/resume/ResumeSidebarItem.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ResumeDto } from "@/types/api"
import ResumeSidebarItem from "./ResumeSidebarItem"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

function buildResume(overrides?: Partial<ResumeDto>): ResumeDto {
  return {
    id: "r1",
    name: "My Resume",
    templateId: null,
    content: { sections: [] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("ResumeSidebarItem", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("renders resume name and date", () => {
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("My Resume")).toBeInTheDocument()
  })

  it("applies blue background when isActive (AC5)", () => {
    const { container } = render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={true}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const item = container.firstChild as HTMLElement
    expect(item.className).toMatch(/bg-blue-50/)
  })

  it("does NOT apply blue background when not active (AC5)", () => {
    const { container } = render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const item = container.firstChild as HTMLElement
    expect(item.className).not.toMatch(/bg-blue-50/)
  })

  it("calls onOpen when item clicked (AC5)", () => {
    const onOpen = vi.fn()
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={onOpen}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /open my resume/i }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it("calls onDelete when delete button clicked (AC5)", () => {
    const onDelete = vi.fn()
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /delete my resume/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("calls onDuplicate when duplicate button clicked (AC5)", () => {
    const onDuplicate = vi.fn()
    render(
      <ResumeSidebarItem
        resume={buildResume()}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={onDuplicate}
        onDelete={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /duplicate my resume/i }))
    expect(onDuplicate).toHaveBeenCalledOnce()
  })

  it("shows Tailored badge when isTailored=true", () => {
    render(
      <ResumeSidebarItem
        resume={buildResume({ isTailored: true })}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("Tailored")).toBeInTheDocument()
  })

  it("shows Base badge when isTailored=false", () => {
    render(
      <ResumeSidebarItem
        resume={buildResume({ isTailored: false })}
        isActive={false}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText("Base")).toBeInTheDocument()
  })
})
```

---

### Task 7: Lint pass

- [x] From `frontend/` directory, run: `npm run lint`
- [x] Fix any ESLint errors (0 errors required)
- [x] Common pitfalls: missing `useCallback` deps (`pendingSidebarDeletes` ref is stable, does NOT go in deps), unused imports, missing `type` imports

---

## Dev Notes

### CRITICAL: Dashboard delete (AC1-AC3) is ALREADY IMPLEMENTED — DO NOT REWRITE

`DashboardPage.tsx` lines 79-116 already implement the complete soft-delete + undo toast pattern:
- Optimistic removal from `displayedResumes`
- 5-second `setTimeout` with `pendingDeletes` ref
- Undo clears the timeout + restores the card
- Timeout fires `apiClient.delete('/api/v1/resumes/${resume.id}')`
- Catch block restores card + shows `toast.error("Delete failed — resume restored")`

`DashboardPage.test.tsx` already has 2 tests covering this (lines 105-178). The backend `DELETE /api/v1/resumes/{resumeId}` endpoint is in `ResumeController.java` (line 53-58) and `ResumeService.deleteResume` (line 79-84). **No backend changes needed for this story.**

### CRITICAL: AC4 confirm dialog is a NEW `ConfirmDialog` component — NOT applied to dashboard delete

Per the epic AC: dashboard delete uses the undo-toast pattern (no dialog). The confirm dialog (AC4) is for **irreversible** actions like "revert to original". For this story, the `ConfirmDialog` component must be built and a stub usage demonstrated (e.g., the export stub button or a "revert" placeholder). The actual wiring to a "revert" action is out of scope for this story — the component just needs to exist and be tested.

**Practical implementation for AC4:** Wire the `ConfirmDialog` to a "Revert to Original" button stub inside `EditorToolbar.tsx` or as a standalone demo in `EditorPage` — OR simply create the component and tests. The AC states "a Dialog confirmation appears" when "the user triggers a destructive action" — the component creation + test satisfies the AC; the exact trigger point is a stub.

### CRITICAL: `ConfirmDialog` must default-focus Cancel (UX-DR18)

UX-DR18: "Cancel button is default-focused (right-positioned) in destructive dialogs; Enter key must not trigger destructive action by default." The `useEffect` in Task 2 focuses `cancelRef.current` after dialog opens. Because Cancel is focused, pressing Enter submits Cancel naturally — no extra `keydown` prevention needed on the Confirm button.

### CRITICAL: `@base-ui/react/dialog` API differs from Radix

The `dialog.tsx` uses `@base-ui/react/dialog`, NOT `@radix-ui/react-dialog`. The open/close API is `open` + `onOpenChange` on `<Dialog>` (same as Radix surface), but the internals use `data-open`/`data-closed` attributes for animations, not `data-state`. Do NOT reference Radix-specific patterns.

### CRITICAL: `button.tsx` — check for `"destructive"` variant

The `Button` component is at `frontend/src/components/ui/button.tsx`. Before using `variant="destructive"`, confirm it is defined in the component. If not present, use `className` overrides on a `variant="outline"` button. Never edit `button.tsx`.

### CRITICAL: `ResumeSidebarItem` delete calls `onDelete` — the parent handles the undo logic

`ResumeSidebarItem` is a pure display component: clicking delete calls `onDelete(resume)`. The `handleDeleteFromSidebar` function in `EditorPage` implements the 5-second undo toast pattern. This keeps `ResumeSidebarItem` testable and stateless.

### CRITICAL: `pendingSidebarDeletes` ref pattern — same as `DashboardPage`

Use `useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())` in `EditorPage`. Clean up on unmount with `return () => { ref.forEach(clearTimeout) }`. This is the exact same pattern as `DashboardPage.tsx` lines 18, 37-41.

### CRITICAL: `sidebarResumes` is local state — does NOT write back to `useResumeStore.resumes`

The optimistic delete in `handleDeleteFromSidebar` removes from local `sidebarResumes` only. The global `useResumeStore.resumes` is NOT updated. This means if the user goes back to the dashboard, the dashboard will re-fetch from the API on mount and show the correct state. Do NOT call `setResumes` from `EditorPage` — it would corrupt the dashboard state.

### CRITICAL: `useRef` must be added to `EditorPage.tsx` imports

Current `EditorPage.tsx` line 1: `import { useCallback, useEffect, useState } from "react"`. Must become: `import { useCallback, useEffect, useRef, useState } from "react"`.

### CRITICAL: `ResumeSidebarItem` uses the same `Badge`, `ExternalLink`, `Copy`, `Trash2`, `Loader2` as `ResumeDashboardCard`

All icons are from `lucide-react`. `Badge` is from `@/components/ui/badge`. Both are already installed. Do NOT add new dependencies.

### Backend: `DELETE /api/v1/resumes/{resumeId}` is fully implemented

`ResumeController.java` line 53-58: `@DeleteMapping("/{resumeId}")` → `@ResponseStatus(HttpStatus.NO_CONTENT)`. `ResumeService.deleteResume` at line 79-84 uses `resumeRepository.delete(resume)`. `ResumeServiceTest.java` already has 2 delete tests (lines 191-211). `ResumeControllerIntegrationTest.java` has `delete_ownResume_returns204` test. **Zero backend changes required.**

### Not in scope for Story 3.8

- Actual "revert to original" feature — `ConfirmDialog` component is built but the trigger (revert functionality) is a stub
- Updating `useResumeStore.resumes` on sidebar delete — only local `sidebarResumes` state is updated
- Loading resumes from API inside `EditorPage` if the store is empty — handled by the condition `sidebarResumes.length > 0`
- Per-story sidebar loading spinner or empty sidebar state message
- `ResumeSidebarItem` keyboard reorder — that is `SectionsPanel`'s concern (Story 3.5)

### File locations (no deviations allowed)

| New File | Path |
|----------|------|
| `ConfirmDialog.tsx` | `frontend/src/components/resume/ConfirmDialog.tsx` |
| `ConfirmDialog.test.tsx` | `frontend/src/components/resume/ConfirmDialog.test.tsx` |
| `ResumeSidebarItem.tsx` | `frontend/src/components/resume/ResumeSidebarItem.tsx` |
| `ResumeSidebarItem.test.tsx` | `frontend/src/components/resume/ResumeSidebarItem.test.tsx` |

| Modified File | Changes |
|---------------|---------|
| `frontend/src/pages/EditorPage.tsx` | Add `useRef`, `sidebarResumes` state, `ResumeSidebarItem` list in leftSlot, `handleDeleteFromSidebar`, `handleDuplicateFromSidebar` |

### References

- `frontend/src/pages/DashboardPage.tsx` lines 79-116 — existing working delete/undo implementation to mirror in EditorPage
- `frontend/src/pages/DashboardPage.test.tsx` lines 105-178 — existing delete tests as reference for new tests
- `frontend/src/components/resume/ResumeDashboardCard.tsx` — existing card component as visual reference for ResumeSidebarItem
- `frontend/src/components/resume/SaveAsDialog.tsx` — existing dialog pattern using shadcn Dialog
- `frontend/src/components/ui/dialog.tsx` — Dialog API: `open`, `onOpenChange`, `showCloseButton` prop
- `frontend/src/components/ui/button.tsx` — verify `"destructive"` variant exists before using
- `frontend/src/stores/useResumeStore.ts` — `resumes: ResumeDto[]` field for sidebar list
- `frontend/src/pages/EditorPage.tsx` — current state of left sidebar and `leftSlot` structure
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeController.java` lines 53-58 — `DELETE /api/v1/resumes/{resumeId}` already implemented
- **UX-DR9**: `ResumeSidebarItem` with name, date, Tailored/Base badge, hover icons, blue active state
- **UX-DR17**: 5-second soft-delete undo toast pattern
- **UX-DR18**: Cancel-focused destructive confirm dialog, Enter must not trigger destructive action
- **FR15**: Users can delete resumes from their library
- **FR18**: Undo delete within a short window

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- AC1-AC3: Verified existing `DashboardPage.tsx` lines 79-116 fully implement soft-delete + undo toast + API delete + error recovery. No changes required. Existing `DashboardPage.test.tsx` tests (lines 105-178) cover all cases.
- AC4: Created `ConfirmDialog.tsx` — reusable destructive-action dialog with Cancel-default-focus (UX-DR18) using `useRef` + `setTimeout(..., 0)` focus pattern. `DialogContent showCloseButton={false}`, `variant="destructive"` confirmed present in `button.tsx`.
- AC5: Created `ResumeSidebarItem.tsx` — pure display component with hover action icons (open, export stub, duplicate, delete), active blue background (`bg-blue-50`), Tailored/Base badge. Outer `role="button"` aria-label set to `${resume.name}` (without "Open" prefix) to avoid duplicate role conflicts in tests. Wired into `EditorPage.tsx` leftSlot as "Resumes" section above `SectionsPanel`.
- `EditorPage.tsx` extended: added `useRef`, `sidebarResumes` state (initialized from store via lazy initializer), `handleDuplicateFromSidebar`, `handleDeleteFromSidebar` (mirrors DashboardPage pattern exactly), cleanup effect for `pendingSidebarDeletes`. Store selectors ordered correctly — `resumes` declared before its use in `useState(() => resumes)`.
- Lint: 0 errors (2 pre-existing warnings in `useAutosave.ts` and `DashboardPage.tsx` not introduced by this story).
- Tests: 80/80 passing across 11 test files. 13 new tests added (5 ConfirmDialog + 8 ResumeSidebarItem).

### File List

- `frontend/src/components/resume/ConfirmDialog.tsx` (new)
- `frontend/src/components/resume/ConfirmDialog.test.tsx` (new)
- `frontend/src/components/resume/ResumeSidebarItem.tsx` (new)
- `frontend/src/components/resume/ResumeSidebarItem.test.tsx` (new)
- `frontend/src/pages/EditorPage.tsx` (modified)

### Change Log

- 2026-06-05: Implemented story 3-8. Created ConfirmDialog + ResumeSidebarItem components with tests. Extended EditorPage with sidebar resume list and undo-delete pattern. All 80 tests pass, 0 lint errors.
