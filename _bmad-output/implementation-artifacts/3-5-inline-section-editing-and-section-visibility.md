# Story 3.5: Inline Section Editing & Section Visibility

Status: done

## Story

As an authenticated user,
I want to edit the text content of resume sections directly in the editor and show or hide individual sections,
So that I can refine my resume content and control what appears in the final output.

## Acceptance Criteria

**AC1 â Inline field editing**
**Given** the user clicks on any text field within the editable canvas in `EditorPage`
**When** the field enters edit mode
**Then** the field becomes an editable `contenteditable` element; changes are dispatched to `useResumeStore` immediately (optimistic update); a debounced `PUT /api/v1/resumes/{id}` is triggered 500ms after the last keystroke (UX-DR3 inline editing)

**AC2 â Autosave success**
**Given** a debounced save request is in flight
**When** the autosave succeeds
**Then** the autosave status transitions to `saved`; no explicit user action is needed; the `lastSavedDocument` in the store is updated to the current document state

**AC3 â Autosave failure**
**Given** a debounced save request fails
**When** the API returns an error
**Then** the Zustand state is reverted to the last successfully persisted state (`lastSavedDocument`); a Toast "Save failed â changes reverted" is shown; the state update uses the immutable pattern `set(state => ({ ...state, ... }))`

**AC4 â Section visibility toggle**
**Given** the `SectionsPanel` in the left sidebar is visible
**When** the user toggles a section checkbox off
**Then** the section is marked hidden in `useResumeStore` (optimistic update); `ResumeCanvas` removes that section from the rendered view immediately; the change is persisted via the debounced save

**AC5 â Drag-to-reorder sections**
**Given** the `SectionsPanel` section list is displayed
**When** the user drags a section to reorder it using `@dnd-kit/sortable`
**Then** the section order is updated in `useResumeStore` and reflected in the editable canvas immediately; the new order is persisted

**AC6 â Keyboard reorder**
**Given** a section row in `SectionsPanel` has keyboard focus
**When** the user presses ArrowUp or ArrowDown
**Then** the section moves up or down one position (keyboard alternative per UX-DR7)

**AC7 â Frontend test coverage**
**Given** inline editing is implemented
**When** frontend tests are run
**Then** `ResumeSection.test.tsx` verifies that: editing a field updates `useResumeStore`, the debounced save is scheduled (mocked timer), and a failed save reverts state

## Tasks / Subtasks

---

### Task 0: Install `@dnd-kit` packages (AC: 5)

- [x] From `frontend/` directory, run: `npm install @dnd-kit/core @dnd-kit/sortable`
- [x] These packages are NOT yet in `package.json` â they must be installed before any dnd-kit import
- [x] Verify packages appear in `frontend/package.json` `dependencies` after install

---

### Task 1: Backend â Add `PUT /api/v1/resumes/{resumeId}` endpoint (AC: 1, 2, 3, 4, 5)

#### 1a â Create `UpdateResumeRequest` DTO

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java`
- [x] Record fields:
  ```java
  public record UpdateResumeRequest(
      @NotBlank String name,
      @NotNull ResumeDocument content
  ) {}
  ```
- [x] Import `jakarta.validation.constraints.NotBlank`, `jakarta.validation.constraints.NotNull`, and `com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument`
- [x] Both fields are required: `name` (non-blank String) and `content` (non-null `ResumeDocument`)
- [x] This DTO is used by Story 3.5 (content autosave) and Story 3.6 (name update); Story 3.6 will use the same endpoint

#### 1b â Add `updateResume` method to `ResumeService`

- [x] Add method to `ResumeService.java`:
  ```java
  @Transactional
  public ResumeDto updateResume(String email, UUID resumeId, UpdateResumeRequest request) {
      User user = resolveUser(email);
      Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
              .orElseThrow(() -> new ResumeAccessDeniedException("Access denied or resume not found"));
      resume.setName(request.name());
      resume.setResumeContent(request.content());
      return toDto(resumeRepository.save(resume));
  }
  ```
- [x] Import `UpdateResumeRequest` at the top
- [x] The `Resume` JPA entity already has `setName()` and `setResumeContent()` setters (confirmed in `ResumeService` clone logic); no entity changes needed

#### 1c â Add PUT handler to `ResumeController`

- [x] Add to `ResumeController.java`:
  ```java
  @PutMapping("/{resumeId}")
  public ResumeDto updateResume(Authentication authentication,
                                @PathVariable UUID resumeId,
                                @Valid @RequestBody UpdateResumeRequest request) {
      return resumeService.updateResume(authentication.getName(), resumeId, request);
  }
  ```
- [x] Add `PutMapping` import: `org.springframework.web.bind.annotation.PutMapping`
- [x] Response status is HTTP 200 (default â do NOT add `@ResponseStatus(HttpStatus.CREATED)`)

#### 1d â Add integration test for PUT endpoint

- [x] Add test to `ResumeControllerIntegrationTest.java`:
  - Test: `PUT /api/v1/resumes/{resumeId} returns 200 with updated content` â create a resume, PUT with updated content + name, assert 200 + updated `name` in response body + `updatedAt` is refreshed
  - Test: `PUT /api/v1/resumes/{resumeId} returns 403 when resume belongs to another user` â attempt PUT with a different user's JWT; assert 403 / resource-not-found behavior (matches `getResume` pattern)
  - Test: `PUT /api/v1/resumes/{resumeId} returns 400 when request body is invalid` â send blank `name`; assert 400

---

### Task 2: Update `useResumeStore` (AC: 1, 2, 3, 4, 5)

- [x] Edit `frontend/src/stores/useResumeStore.ts`
- [x] Add new state fields to `ResumeState` interface:
  ```typescript
  lastSavedDocument: ResumeDocumentDto | null
  ```
- [x] Add new action signatures to `ResumeState` interface:
  ```typescript
  setLastSavedDocument: (doc: ResumeDocumentDto | null) => void
  updateSectionTitle: (sectionId: string, title: string) => void
  updateItemField: (sectionId: string, itemId: string, field: string, value: string) => void
  toggleSectionVisibility: (sectionId: string) => void
  reorderSections: (newSections: ResumeSectionDto[]) => void
  ```
- [x] Add `import type { ResumeDocumentDto, ResumeSectionDto } from "@/types/api"` (already has `ResumeDto` â add the two new imports)
- [x] Initialize new state: `lastSavedDocument: null`
- [x] Implement `setLastSavedDocument`:
  ```typescript
  setLastSavedDocument: (doc) => set((state) => ({ ...state, lastSavedDocument: doc })),
  ```
- [x] Implement `updateSectionTitle` â immutable update on `currentResume.content.sections`:
  ```typescript
  updateSectionTitle: (sectionId, title) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.id === sectionId ? { ...s, title } : s
            ),
          },
        },
      }
    }),
  ```
- [x] Implement `updateItemField` â immutable nested update (section â item â field):
  ```typescript
  updateItemField: (sectionId, itemId, field, value) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.id !== sectionId
                ? s
                : {
                    ...s,
                    items: s.items.map((item) =>
                      item.id !== itemId
                        ? item
                        : { ...item, fields: { ...item.fields, [field]: value } }
                    ),
                  }
            ),
          },
        },
      }
    }),
  ```
- [x] Implement `toggleSectionVisibility`:
  ```typescript
  toggleSectionVisibility: (sectionId) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.id === sectionId ? { ...s, visible: !s.visible } : s
            ),
          },
        },
      }
    }),
  ```
- [x] Implement `reorderSections`:
  ```typescript
  reorderSections: (newSections) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: { ...state.currentResume.content, sections: newSections },
        },
      }
    }),
  ```
- [x] **Do NOT remove or modify** existing `applyPatch` stub â Story 4.2 implements it; removing it breaks compilation

---

### Task 3: Create `useAutosave` custom hook (AC: 1, 2, 3)

- [x] Create `frontend/src/hooks/useAutosave.ts`
- [x] Exported function signature:
  ```typescript
  export function useAutosave(
    resumeId: string | undefined
  ): { status: 'idle' | 'saving' | 'saved' | 'error' }
  ```
- [x] Imports:
  ```typescript
  import { useEffect, useRef, useState } from "react"
  import { toast } from "sonner"
  import { apiClient } from "@/lib/apiClient"
  import { useResumeStore } from "@/stores/useResumeStore"
  import type { ResumeDto } from "@/types/api"
  ```
- [x] Inside the hook:
  - Read from Zustand: `const currentResume = useResumeStore((state) => state.currentResume)` and `const setCurrentResume = useResumeStore((state) => state.setCurrentResume)` and `const setLastSavedDocument = useResumeStore((state) => state.setLastSavedDocument)` and `const lastSavedDocument = useResumeStore((state) => state.lastSavedDocument)`
  - Local state: `const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')`
  - Timer ref: `const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
  - Save ref (to avoid stale closures): `const saveRef = useRef({ currentResume, lastSavedDocument })`
  - Keep `saveRef.current` in sync with latest values: `useEffect(() => { saveRef.current = { currentResume, lastSavedDocument } }, [currentResume, lastSavedDocument])`
- [x] Main debounce `useEffect` â depends on `[currentResume, resumeId]`:
  ```typescript
  useEffect(() => {
    if (!resumeId || !currentResume) return

    // Don't trigger on the initial load (when lastSavedDocument is null)
    if (saveRef.current.lastSavedDocument === null) return

    // Clear previous timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(async () => {
      const { currentResume: doc, lastSavedDocument: lastSaved } = saveRef.current
      if (!doc) return

      setStatus('saving')
      try {
        const updated = await apiClient.put<ResumeDto>(
          `/api/v1/resumes/${resumeId}`,
          { name: doc.name, content: doc.content }
        )
        setLastSavedDocument(updated.content)
        setStatus('saved')
      } catch {
        // Revert to last successfully saved state
        if (lastSaved !== null) {
          setCurrentResume({ ...doc, content: lastSaved })
        }
        setStatus('error')
        toast.error('Save failed â changes reverted')
      }
    }, 500)
  }, [currentResume, resumeId, setCurrentResume, setLastSavedDocument])
  ```
- [x] Cleanup on unmount â cancel any pending timer:
  ```typescript
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])
  ```
- [x] Return: `return { status }`
- [x] **Critical**: The `lastSavedDocument === null` guard prevents autosave from firing on the initial page load. `EditorPage` must call `setLastSavedDocument(resume.content)` after the initial fetch succeeds (before any user edits happen), so subsequent changes trigger the debounce correctly

---

### Task 4: Create `ResumeSection.tsx` editable component (AC: 1)

**Design decision (approach b â separate editable component):**
`ResumeCanvas.tsx` remains a pure read-only presenter (used by `ResumeDashboardCard` in future and as the base component). A new `ResumeSection.tsx` is created for the editor's editable rendering. `EditorPage` will use `ResumeSection` components rendered inside the same canvas shell instead of the full `ResumeCanvas`.

- [x] Create `frontend/src/components/resume/ResumeSection.tsx`
- [x] Props interface:
  ```typescript
  interface ResumeSectionProps {
    section: ResumeSectionDto
    onTitleChange: (title: string) => void
    onFieldChange: (itemId: string, field: string, value: string) => void
  }
  ```
- [x] Imports:
  ```typescript
  import type { ResumeSectionDto } from "@/types/api"
  ```
- [x] Component structure mirrors `ResumeCanvas`'s section rendering but with `contenteditable`:
  ```tsx
  export default function ResumeSection({ section, onTitleChange, onFieldChange }: ResumeSectionProps) {
    return (
      <section aria-labelledby={`section-title-${section.id}`} className="mb-6">
        <h2
          id={`section-title-${section.id}`}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onTitleChange(e.currentTarget.textContent ?? '')}
          className="text-base font-semibold border-b border-zinc-200 pb-1 mb-2 uppercase tracking-wide outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text"
          aria-label={`Edit section title: ${section.title}`}
        >
          {section.title}
        </h2>
        <ul className="space-y-1 text-sm list-none p-0">
          {section.items.map((item) =>
            Object.entries(item.fields)
              .filter(([, v]) => Boolean(v))
              .map(([field, value]) => (
                <li key={`${item.id}-${field}`}>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onFieldChange(item.id, field, e.currentTarget.textContent ?? '')}
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label={`Edit ${field}`}
                  >
                    {value}
                  </span>
                </li>
              ))
          )}
        </ul>
      </section>
    )
  }
  ```
- [x] **`contenteditable` approach chosen** (not `<textarea>`) because it preserves the document's natural inline flow and visual appearance; no height-resizing logic needed
- [x] **`suppressContentEditableWarning`** silences React's warning about `contentEditable` on components with children â this is intentional and correct here
- [x] **`onBlur` (not `onInput`)** is used for dispatching to the store â fires once when the user leaves the field, preventing a store update on every keystroke; the debounce in `useAutosave` handles the 500ms save timing
- [x] The field separator `Â·` rendering from `ResumeCanvas` (all fields joined) is NOT used here â each `field` is rendered as a separate editable `<span>` so individual fields are editable
- [x] `ResumeCanvas.tsx` is **NOT modified** â it stays as the pure read-only presenter

---

### Task 5: Create `SectionsPanel.tsx` (AC: 4, 5, 6)

- [x] Create `frontend/src/components/resume/SectionsPanel.tsx`
- [x] Install `@dnd-kit/core` and `@dnd-kit/sortable` first (Task 0)
- [x] Imports:
  ```typescript
  import { useState, useCallback } from "react"
  import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
  import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
  } from "@dnd-kit/sortable"
  import { CSS } from "@dnd-kit/utilities"
  import { ChevronDown, GripVertical } from "lucide-react"
  import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
  } from "@/components/ui/collapsible"
  import { Checkbox } from "@/components/ui/checkbox"
  import { useResumeStore } from "@/stores/useResumeStore"
  import type { ResumeSectionDto } from "@/types/api"
  ```
- [x] Props interface:
  ```typescript
  interface SectionsPanelProps {
    sections: ResumeSectionDto[]
  }
  ```
- [x] Panel state: `const [isOpen, setIsOpen] = useState(false)` â collapsed by default per UX-DR7
- [x] Read store actions: `const toggleSectionVisibility = useResumeStore((s) => s.toggleSectionVisibility)` and `const reorderSections = useResumeStore((s) => s.reorderSections)`

**Collapsible shell (uses `@base-ui/react/collapsible` via `@/components/ui/collapsible`):**
```tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger
    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
    aria-label="Toggle sections panel"
  >
    <span>Sections</span>
    <ChevronDown
      className={`size-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
    />
  </CollapsibleTrigger>
  <CollapsibleContent className="px-2 py-1">
    {/* DnD sortable list */}
  </CollapsibleContent>
</Collapsible>
```

**DnD sortable list inside `CollapsibleContent`:**
- [x] `handleDragEnd` callback using `useCallback`:
  ```typescript
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderSections(arrayMove(sections, oldIndex, newIndex))
  }, [sections, reorderSections])
  ```
- [x] Wrap list in `<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>`
- [x] Wrap items in `<SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>`

**Sortable section row sub-component (inline within the same file):**
- [x] Create a `SortableSectionRow` component (not exported):
  ```tsx
  interface SortableSectionRowProps {
    section: ResumeSectionDto
    onToggle: (id: string) => void
    onMoveUp: (id: string) => void
    onMoveDown: (id: string) => void
  }

  function SortableSectionRow({ section, onToggle, onMoveUp, onMoveDown }: SortableSectionRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: section.id,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-muted/50 group"
      >
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity touch-none"
          aria-label={`Drag to reorder ${section.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* Visibility checkbox */}
        <Checkbox
          checked={section.visible}
          onCheckedChange={() => onToggle(section.id)}
          aria-label={`Show ${section.title} section`}
          id={`section-visible-${section.id}`}
        />

        {/* Section name label */}
        <label
          htmlFor={`section-visible-${section.id}`}
          className="flex-1 text-sm truncate cursor-pointer select-none"
        >
          {section.title}
        </label>

        {/* Keyboard reorder buttons â always in DOM but visually hidden; revealed on focus */}
        <div className="flex flex-col opacity-0 group-focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-0.5"
            aria-label={`Move ${section.title} up`}
            onClick={() => onMoveUp(section.id)}
            onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); onMoveUp(section.id) } }}
          >
            â²
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-0.5"
            aria-label={`Move ${section.title} down`}
            onClick={() => onMoveDown(section.id)}
            onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); onMoveDown(section.id) } }}
          >
            â¼
          </button>
        </div>
      </div>
    )
  }
  ```

**Keyboard reorder callbacks in `SectionsPanel` main component:**
- [x] `handleMoveUp` using `useCallback`:
  ```typescript
  const handleMoveUp = useCallback((id: string) => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx <= 0) return
    reorderSections(arrayMove(sections, idx, idx - 1))
  }, [sections, reorderSections])
  ```
- [x] `handleMoveDown` using `useCallback`:
  ```typescript
  const handleMoveDown = useCallback((id: string) => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx === -1 || idx >= sections.length - 1) return
    reorderSections(arrayMove(sections, idx, idx + 1))
  }, [sections, reorderSections])
  ```

**Important: `Checkbox` API from `@base-ui/react`:**
- The installed `Checkbox` at `@/components/ui/checkbox.tsx` wraps `@base-ui/react/checkbox`, NOT Radix UI
- For controlled usage: use `checked` and `onCheckedChange` â but note `@base-ui` uses `onCheckedChange?: (checked: boolean | 'mixed', event: Event) => void`
- In practice: `<Checkbox checked={section.visible} onCheckedChange={() => onToggle(section.id)} />`
- The `@base-ui` checkbox uses `data-checked` attribute for styling (not `:checked` pseudo-class), but the component handles this internally â just pass `checked` prop

**Full `SectionsPanel` return:**
```tsx
export default function SectionsPanel({ sections }: SectionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const toggleSectionVisibility = useResumeStore((s) => s.toggleSectionVisibility)
  const reorderSections = useResumeStore((s) => s.reorderSections)

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderSections(arrayMove(sections, oldIndex, newIndex))
  }, [sections, reorderSections])

  const handleMoveUp = useCallback((id: string) => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx <= 0) return
    reorderSections(arrayMove(sections, idx, idx - 1))
  }, [sections, reorderSections])

  const handleMoveDown = useCallback((id: string) => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx === -1 || idx >= sections.length - 1) return
    reorderSections(arrayMove(sections, idx, idx + 1))
  }, [sections, reorderSections])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        aria-label="Toggle sections panel"
      >
        <span>Sections</span>
        <ChevronDown
          className={`size-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 py-1">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSectionRow
                key={section.id}
                section={section}
                onToggle={toggleSectionVisibility}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

---

### Task 6: Update `EditorPage.tsx` (AC: 1, 2, 3, 4, 5)

- [x] Edit `frontend/src/pages/EditorPage.tsx`
- [x] Add new imports:
  ```typescript
  import { useCallback } from "react"
  import SectionsPanel from "@/components/resume/SectionsPanel"
  import ResumeSection from "@/components/resume/ResumeSection"
  import { useAutosave } from "@/hooks/useAutosave"
  ```
- [x] Update `useResumeStore` reads â add the new actions and `lastSavedDocument`:
  ```typescript
  const setCurrentResume = useResumeStore((state) => state.setCurrentResume)
  const currentResume = useResumeStore((state) => state.currentResume)
  const setLastSavedDocument = useResumeStore((state) => state.setLastSavedDocument)
  const updateSectionTitle = useResumeStore((state) => state.updateSectionTitle)
  const updateItemField = useResumeStore((state) => state.updateItemField)
  ```
- [x] After the successful fetch in the `useEffect`, add:
  ```typescript
  setCurrentResume(data)
  setLastSavedDocument(data.content)  // <-- bootstrap rollback baseline AFTER setCurrentResume
  ```
  This initializes `lastSavedDocument` so `useAutosave` knows the initial saved state and doesn't fire on page load
- [x] Add autosave hook call after the state declarations:
  ```typescript
  const { status: autosaveStatus } = useAutosave(id)
  ```
- [x] **Autosave status indicator** â add a minimal save status display in the center slot header area (above `ResumeCanvas`):
  - Render a small indicator showing the current `autosaveStatus`:
    - `'saving'` â `"Savingâ¦"` (muted text, small)
    - `'saved'` â `"Saved"` (muted text, small)
    - `'error'` â `"Save failed"` (destructive text, small) â the toast already shows the full message
    - `'idle'` â render nothing (or `null`)
  - Use `role="status"` and `aria-live="polite"` on the status container (UX requirement)
  - Example markup:
    ```tsx
    <div role="status" aria-live="polite" className="text-xs text-muted-foreground text-right px-4 py-1 h-6">
      {autosaveStatus === 'saving' && 'Savingâ¦'}
      {autosaveStatus === 'saved' && 'Saved'}
      {autosaveStatus === 'error' && <span className="text-destructive">Save failed</span>}
    </div>
    ```
- [x] **Replace `ResumeCanvas` in `EditorPage`** with an editable canvas shell containing `ResumeSection` components:
  - Instead of `<ResumeCanvas document={resume?.content ?? null} ...>`, render:
    ```tsx
    <div className="h-full overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">
      {isLoading ? (
        /* keep existing skeleton markup from ResumeCanvas â copy it here */
        <div
          id="resume-canvas"
          aria-label="Resume preview loading"
          className="bg-white shadow-lg w-full max-w-[794px] p-8 space-y-6"
        >
          <Skeleton className="h-6 w-48" />
          ... {/* exact same skeleton content as before */}
        </div>
      ) : currentResume === null ? (
        <article id="resume-canvas" aria-label="Resume preview" className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]" />
      ) : (
        <article id="resume-canvas" aria-label="Resume preview" className="bg-white shadow-lg w-full max-w-[794px] p-8">
          <div role="status" aria-live="polite" aria-label="AI is updating your resume" className="sr-only">
            {/* SSE streaming stub â Story 4.3 */}
          </div>
          {currentResume.content.sections
            .filter((s) => s.visible)
            .map((section) => (
              <ResumeSection
                key={section.id}
                section={section}
                onTitleChange={(title) => updateSectionTitle(section.id, title)}
                onFieldChange={(itemId, field, value) =>
                  updateItemField(section.id, itemId, field, value)
                }
              />
            ))}
        </article>
      )}
    </div>
    ```
  - Import `Skeleton` from `@/components/ui/skeleton` (already available)
- [x] **`ResumeCanvas` import** â KEEP the `ResumeCanvas` import if needed by the EditorPage's loading/error states, OR reproduce the skeleton inline (recommended above to avoid prop confusion). Either approach is acceptable; the recommended approach is to reproduce the loading skeleton inline since `EditorPage` is now the editable context
- [x] **Replace left sidebar stub** â replace the placeholder `"Sections panel coming in Story 3.5"` with:
  ```tsx
  leftSlot={
    <SectionsPanel sections={currentResume?.content.sections ?? []} />
  }
  ```
- [x] Keep the existing `rightSlot` stub unchanged: `<div className="p-4 text-sm text-muted-foreground">Chat panel coming in Story 4.3</div>`
- [x] Center slot should wrap the editable canvas + status indicator in a fragment:
  ```tsx
  centerSlot={
    error !== null && !isLoading ? (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    ) : (
      <>
        <div role="status" aria-live="polite" className="text-xs text-muted-foreground text-right px-4 py-1 h-6">
          {autosaveStatus === 'saving' && 'Savingâ¦'}
          {autosaveStatus === 'saved' && 'Saved'}
          {autosaveStatus === 'error' && <span className="text-destructive">Save failed</span>}
        </div>
        {/* editable canvas described above */}
      </>
    )
  }
  ```

---

### Task 7: Frontend tests â `ResumeSection.test.tsx` (AC: 7)

- [x] Create `frontend/src/components/resume/ResumeSection.test.tsx`
- [x] Test framework: Vitest + React Testing Library
- [x] Imports:
  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
  import { render, screen, fireEvent, waitFor } from "@testing-library/react"
  import { act } from "react"
  import { useResumeStore } from "@/stores/useResumeStore"
  import ResumeSection from "./ResumeSection"
  import type { ResumeSectionDto } from "@/types/api"
  ```
- [x] Mock setup: mock `@/lib/apiClient` with `put: vi.fn()` and `sonner` with `toast: { error: vi.fn() }`
- [x] Helper factory:
  ```typescript
  function buildSection(overrides?: Partial<ResumeSectionDto>): ResumeSectionDto {
    return {
      id: 'test-section',
      title: 'Work Experience',
      visible: true,
      items: [
        {
          id: 'item-1',
          fields: { jobTitle: 'Engineer', company: 'Acme Corp' },
        },
      ],
      ...overrides,
    }
  }
  ```
- [x] `beforeEach`: `vi.clearAllMocks()`; `vi.useFakeTimers()`
- [x] `afterEach`: `vi.useRealTimers()`; reset store: `useResumeStore.setState({ currentResume: null, lastSavedDocument: null })`

**Test case 1 â Editing a field updates `useResumeStore`:**
```typescript
it('editing a field dispatches updateItemField to useResumeStore', async () => {
  const section = buildSection()
  const onFieldChange = vi.fn()
  const onTitleChange = vi.fn()

  render(<ResumeSection section={section} onTitleChange={onTitleChange} onFieldChange={onFieldChange} />)

  const field = screen.getByText('Engineer')
  fireEvent.blur(field, { target: { textContent: 'Senior Engineer' } })

  expect(onFieldChange).toHaveBeenCalledWith('item-1', 'jobTitle', 'Senior Engineer')
})
```

**Test case 2 â Section title editing dispatches `onTitleChange`:**
```typescript
it('editing the section title dispatches onTitleChange', () => {
  const section = buildSection()
  const onFieldChange = vi.fn()
  const onTitleChange = vi.fn()

  render(<ResumeSection section={section} onTitleChange={onTitleChange} onFieldChange={onFieldChange} />)

  const title = screen.getByRole('heading', { name: /work experience/i })
  fireEvent.blur(title, { target: { textContent: 'Professional Experience' } })

  expect(onTitleChange).toHaveBeenCalledWith('Professional Experience')
})
```

**Test case 3 â Debounced save is scheduled (mocked timer):**
This test operates via `useAutosave` â test it at the `EditorPage` integration level or via a dedicated `useAutosave.test.ts`:
- [x] Create `frontend/src/hooks/useAutosave.test.ts`
- [x] Mock `@/lib/apiClient` with `put: vi.fn()`
- [x] Use `vi.useFakeTimers()` in `beforeEach`
- [x] Test: after a store update to `currentResume` (with `lastSavedDocument` already set), advance timers by 500ms and assert `apiClient.put` was called with the correct body
- [x] Example:
  ```typescript
  it('schedules PUT request 500ms after currentResume changes', async () => {
    const mockPut = vi.fn().mockResolvedValue({ content: {} })
    // ... setup store with currentResume + lastSavedDocument
    // ... render a component that calls useAutosave
    // ... modify currentResume in store
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(mockPut).toHaveBeenCalledTimes(1)
  })
  ```

**Test case 4 â Failed save reverts state:**
```typescript
it('reverts currentResume to lastSavedDocument on PUT failure', async () => {
  const mockPut = vi.fn().mockRejectedValue(new Error('Network error'))
  // ... set up store: currentResume with modified content, lastSavedDocument with original content
  // ... render component using useAutosave
  // ... trigger change that makes autosave fire
  await act(async () => { vi.advanceTimersByTime(500) })
  await waitFor(() => {
    expect(useResumeStore.getState().currentResume?.content).toEqual(/* originalContent */)
  })
  expect(toast.error).toHaveBeenCalledWith('Save failed â changes reverted')
})
```

**Additional test for `ResumeSection.test.tsx` â AC7 requirement from epics:**
The AC7 specifically names `ResumeSection.test.tsx` as the verification file. The `useAutosave` timer and rollback tests should also be added to `ResumeSection.test.tsx` using an integration-style setup (render `EditorPage` or a test wrapper that combines `ResumeSection` + `useAutosave`). Alternatively, keep them in `useAutosave.test.ts` and add a note that `ResumeSection.test.tsx` covers the component-level assertions. Either approach satisfies AC7 â use whichever is cleaner.

---

### Task 8: Update `EditorPage.test.tsx` to account for new behaviour

- [x] Edit `frontend/src/pages/EditorPage.test.tsx`
- [x] Add `apiClient.put: vi.fn()` to the existing `vi.mock("@/lib/apiClient", ...)` mock object (the test was mocking only `get` â autosave will now also call `put`; without this mock, the test will throw on the PUT call if timers advance)
- [x] Add `vi.useFakeTimers()` / `vi.useRealTimers()` to prevent autosave from firing in existing tests (or mock `put` to return a never-resolving promise)
- [x] Verify existing 4 test cases still pass; do not delete them

---

## Dev Notes

### CRITICAL: No `PUT /api/v1/resumes/{resumeId}` endpoint exists yet

The backend `ResumeController` currently only has: `POST /`, `GET /`, `GET /{resumeId}`, `DELETE /{resumeId}`, `POST /{resumeId}/clone`. There is **no PUT endpoint**. Task 1 must be completed before any frontend autosave can reach the server. Story 3.6 will reuse the same PUT endpoint for name updates â design the `UpdateResumeRequest` with both `name` and `content` fields now.

### CRITICAL: `@dnd-kit/core` and `@dnd-kit/sortable` are NOT installed

Run `npm install @dnd-kit/core @dnd-kit/sortable` from the `frontend/` directory before implementing `SectionsPanel`. Do NOT import from these packages before they are installed â TypeScript will error. These packages are peer-dependent: both must be installed together. Also need `@dnd-kit/utilities` for `CSS.Transform.toString` â install with: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

### CRITICAL: shadcn/ui components use `@base-ui/react`, NOT `@radix-ui`

The installed `Collapsible` at `@/components/ui/collapsible.tsx` wraps `@base-ui/react/collapsible`, not `@radix-ui/react-collapsible`. The API is similar but not identical:
- Import from `@/components/ui/collapsible` (the shadcn wrapper) â **not** from `@radix-ui` or `@base-ui` directly
- Use the wrapper's exported `{ Collapsible, CollapsibleTrigger, CollapsibleContent }`
- `CollapsibleContent` maps to `CollapsiblePrimitive.Panel` internally â this is the animated panel
- For controlled usage: `<Collapsible open={isOpen} onOpenChange={setIsOpen}>`

Similarly, `Checkbox` at `@/components/ui/checkbox.tsx` wraps `@base-ui/react/checkbox`:
- Import from `@/components/ui/checkbox` â the `CheckboxPrimitive.Root.Props` includes `checked` and `onCheckedChange`
- Styling uses `data-checked` attribute (not `:checked` pseudo-class)

### CRITICAL: `useAutosave` initial load guard â `lastSavedDocument === null`

The `useAutosave` hook uses `lastSavedDocument === null` as a signal that the document has never been persisted in this session. `EditorPage` MUST call `setLastSavedDocument(data.content)` after the initial fetch â **after** `setCurrentResume(data)`. If this is not done, `useAutosave` will never fire the save debounce, and if it IS accidentally omitted, the rollback on failure will revert to `null` (catastrophically). The guard `if (saveRef.current.lastSavedDocument === null) return` prevents the autosave from firing before the page has loaded the resume.

### CRITICAL: Debounce timer cleanup on unmount

The `useAutosave` hook stores the timer in `timerRef` and clears it in a cleanup `useEffect` that runs on unmount. This prevents a stale save from firing after the user navigates away from the editor. Missing this cleanup would cause a PUT request to fire against a `resumeId` that is no longer the active resume â a subtle but serious bug.

### CRITICAL: `contenteditable` with React â `onBlur` not `onChange`

`contenteditable` elements do not use `value`/`onChange` like controlled `<input>` elements. Use `onBlur` to read the final text after editing. The `suppressContentEditableWarning` prop is **required** when a `contenteditable` element has React children â without it, React logs a warning. Do NOT use `dangerouslySetInnerHTML` â React children are safe and correct here.

### CRITICAL: `ResumeCanvas.tsx` stays unchanged â do NOT modify it

`ResumeCanvas` is the pure read-only presenter and will be reused by `ResumeDashboardCard` in Story 3.7 (mini preview thumbnail). Modifying it to add `onFieldChange` callbacks would break that read-only contract. `EditorPage` replaces `<ResumeCanvas>` with the inline editable canvas + `<ResumeSection>` components directly.

### CRITICAL: `useResumeStore` must use immutable `set(state => ({ ...state, ... }))` pattern

All new actions in `useResumeStore` must use the `set(state => ({ ...state }))` immutable spread pattern. This is already established by existing actions (`setResumes`, `setCurrentResume`) and is required by AC3. Never call `set({ field: value })` directly â always spread the full state.

### Architecture note: `visible` field is already in the DTO

`ResumeSectionDto` in `frontend/src/types/api.ts` already has `visible: boolean`. `ResumeSection` (backend Java record) already has `boolean visible`. `ResumeCanvas.tsx` already filters by `section.visible`. No DTO or backend domain model changes are needed for visibility toggling.

### `SectionsPanel` receives sections from `EditorPage` via props â not direct store subscription

`SectionsPanel` receives `sections: ResumeSectionDto[]` as a prop (derived from `currentResume.content.sections`). This keeps it pure and testable. The panel reads store actions (`toggleSectionVisibility`, `reorderSections`) directly via `useResumeStore` hooks. This is a deliberate hybrid: data flows down as props, mutations flow to the store directly.

### Backend: `ResumeDocument` is stored as JSONB in PostgreSQL

The `Resume` JPA entity stores `resumeContent` as a `ResumeDocument` using `ResumeDocumentConverter` (attribute converter). The `ResumeDocument` record and its nested `ResumeSection`/`ResumeItem` records are immutable (compact constructors with `List.copyOf()`). When `resume.setResumeContent(request.content())` is called, the converter serializes the new `ResumeDocument` to JSONB on the next Hibernate flush. No migration is needed â the JSONB column already exists.

### `PUT /api/v1/resumes/{resumeId}` full request body from frontend

The autosave sends both `name` and `content` because the `UpdateResumeRequest` DTO requires both fields:
```typescript
await apiClient.put<ResumeDto>(`/api/v1/resumes/${resumeId}`, {
  name: currentResume.name,    // the current resume name (unchanged by autosave)
  content: currentResume.content  // the full updated ResumeDocumentDto
})
```
The response is the updated `ResumeDto` â use `updated.content` (not `updated`) to update `lastSavedDocument`.

### `@dnd-kit` utilities package

The `CSS.Transform.toString(transform)` utility comes from `@dnd-kit/utilities`. Make sure to install this package as well: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`. Alternatively, implement the transform manually: `transform ? \`translate3d(${transform.x}px, ${transform.y}px, 0)\` : undefined`. The utilities package is cleaner.

### UX save status indicator scope

AC2 mentions "autosave dot indicator on the Save button disappears". **There is no Save button in Story 3.5.** Story 3.6 adds the Save/Save-As toolbar. For Story 3.5, implement a minimal text-based autosave status indicator (`Savingâ¦` / `Saved` / `Save failed`) above the canvas, using `role="status"` and `aria-live="polite"` as required by UX-DR (per ux-design-specification.md: `role="status"` on autosave timestamp). Story 3.6 will wire this `autosaveStatus` value to a Save button's visual indicator (dot).

### Test utilities â `vi.useFakeTimers()` for debounce testing

When testing the 500ms debounce, use Vitest's fake timer API:
```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

// In test:
await act(async () => { vi.advanceTimersByTime(500) })
expect(apiClient.put).toHaveBeenCalledTimes(1)
```
`act()` from React is required to flush any React state updates triggered by the timer callback.

### Story 3.6 dependency note

Story 3.6 ("Resume Save, Save-As & Name Management") will add a Save toolbar button and wire it to the `autosaveStatus` from `useAutosave`. Story 3.5 creates the hook and exposes `status` â Story 3.6 consumes it. No changes to `useAutosave` are expected in Story 3.6; only `EditorPage` gains a toolbar UI.

### Existing `EditorPage.test.tsx` â must update mock

The existing `EditorPage.test.tsx` only mocks `apiClient.get`. After Story 3.5, `EditorPage` also calls `apiClient.put` (via `useAutosave`). The test mock must be updated to include `put: vi.fn()` to avoid unhandled promise rejections in test runs. Use `vi.useFakeTimers()` to prevent the 500ms timer from firing during tests that don't test autosave behavior.

## File Changes Summary

### New Files (frontend)
| File | Purpose |
|------|---------|
| `frontend/src/hooks/useAutosave.ts` | Debounced autosave hook (500ms, rollback on error) |
| `frontend/src/components/resume/ResumeSection.tsx` | Editable section component with `contenteditable` fields |
| `frontend/src/components/resume/SectionsPanel.tsx` | Left sidebar section list with Collapsible, Checkbox, dnd-kit sortable |
| `frontend/src/components/resume/ResumeSection.test.tsx` | Tests for inline editing, store dispatch, debounce, rollback |
| `frontend/src/hooks/useAutosave.test.ts` | Tests for autosave hook (timer, PUT call, error rollback) |

### Modified Files (frontend)
| File | Changes |
|------|---------|
| `frontend/src/stores/useResumeStore.ts` | Add `lastSavedDocument`, `setLastSavedDocument`, `updateSectionTitle`, `updateItemField`, `toggleSectionVisibility`, `reorderSections` |
| `frontend/src/pages/EditorPage.tsx` | Wire `SectionsPanel`, replace `ResumeCanvas` with editable inline canvas + `ResumeSection` components, call `useAutosave`, add `setLastSavedDocument` after initial fetch |
| `frontend/src/pages/EditorPage.test.tsx` | Add `put: vi.fn()` to apiClient mock, add fake timers |

### New Files (backend)
| File | Purpose |
|------|---------|
| `src/main/java/.../resume/dto/UpdateResumeRequest.java` | Request DTO for PUT /api/v1/resumes/{resumeId} |

### Modified Files (backend)
| File | Changes |
|------|---------|
| `src/main/java/.../resume/ResumeController.java` | Add `PUT /{resumeId}` handler |
| `src/main/java/.../resume/ResumeService.java` | Add `updateResume` method |
| `src/test/java/.../resume/ResumeControllerIntegrationTest.java` | Add PUT endpoint integration tests |

### No Changes
| File | Reason |
|------|--------|
| `frontend/src/components/resume/ResumeCanvas.tsx` | Stays as read-only presenter; not modified |
| `frontend/src/types/api.ts` | `ResumeSectionDto.visible` already exists; no changes needed |
| `frontend/src/components/layout/SplitPaneLayout.tsx` | No changes needed |
| Backend domain models (`ResumeDocument`, `ResumeSection`) | Already have `visible` field; no changes needed |

## References

- **UX-DR3** (ux-design-specification.md): `ResumeCanvas` inline editing â `contenteditable` fields with 500ms debounced save
- **UX-DR7** (ux-design-specification.md): `SectionsPanel` â shadcn/ui `Collapsible`, `@dnd-kit/sortable` drag-to-reorder, ArrowKey keyboard alternative, `Checkbox` for visibility
- **AC7** from epics.md: `ResumeSection.test.tsx` must verify store dispatch, debounce scheduling, and rollback
- **FR17**: Authenticated users can show or hide individual sections within a resume
- **FR18**: Authenticated users can directly edit the text content of individual resume sections
- **Story 3.4** built: `SplitPaneLayout`, `ResumeCanvas` (read-only), `EditorPage` (fetch + stub slots)
- **Story 3.6** will reuse: `PUT /api/v1/resumes/{resumeId}` (same endpoint) for name updates; `useAutosave` `status` for Save button dot indicator

---

## Dev Agent Record

### Completion Notes

- Story 3.5 fully implemented. All 7 ACs satisfied.
- AC1: Inline contenteditable editing via ResumeSection.tsx, dispatching to useResumeStore on blur.
- AC2/AC3: useAutosave hook with 500ms debounce, rollback to lastSavedDocument on failure, toast notification.
- AC4: SectionsPanel.tsx with Checkbox toggling toggleSectionVisibility, immediately reflected in editable canvas (filtered by s.visible).
- AC5: @dnd-kit/sortable drag-to-reorder in SectionsPanel, reorderSections Zustand action.
- AC6: ArrowUp/ArrowDown keyboard reorder via onKeyDown handlers in SortableSectionRow.
- AC7: ResumeSection.test.tsx (6 tests) and useAutosave.test.ts (6 tests) all passing.
- Backend PUT /api/v1/resumes/{resumeId} implemented with UpdateResumeRequest DTO, ResumeService.updateResume, and 3 integration tests.
- EditorPage.test.tsx updated: put: vi.fn() added, fake timers removed (real timers used; autosave blocked via never-resolving mock).
- npm run build passes (0 TypeScript errors), npm run test passes (54/54 tests green).
- Fix pass (2026-06-05): Resolved all 3 patch findings from code review.
  - Finding 1: PUT integration test captures PUT response body and asserts updatedAt is strictly after originalUpdatedAt using java.time.Instant.parse().
  - Finding 2: Added content-equality dirty-check inside setTimeout callback in useAutosave.ts to prevent spurious identical PUTs on page load; updated useAutosave.test.ts transitions-to-saved test to mutate content (not just name) for a realistic dirty scenario.
  - Finding 3: Added two new tests to ResumeSection.test.tsx covering debounce scheduling (vi.advanceTimersByTime(500) confirms PUT fires after field edit) and PUT failure revert (store reverts to lastSavedDocument, toast.error called).

### File List

**New Files (frontend)**
- rontend/src/hooks/useAutosave.ts
- rontend/src/hooks/useAutosave.test.ts
- rontend/src/components/resume/ResumeSection.tsx
- rontend/src/components/resume/ResumeSection.test.tsx
- rontend/src/components/resume/SectionsPanel.tsx

**Modified Files (frontend)**
- rontend/src/stores/useResumeStore.ts
- rontend/src/pages/EditorPage.tsx
- rontend/src/pages/EditorPage.test.tsx

**New Files (backend)**
- src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java

**Modified Files (backend)**
- src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeController.java
- src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java
- src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java

### Change Log

| Date | Change |
|------|--------|
| 2026-05-13 | Implemented story 3-5  inline editing, autosave, SectionsPanel, backend PUT endpoint |
---

### Review Findings

- [x] [Review][Patch] Missing `updatedAt` refresh assertion in PUT happy-path test [`ResumeControllerIntegrationTest.java:308-331`] -- `originalUpdatedAt` is captured and a `Thread.sleep(10)` delay is included but the value is never compared against the PUT response; story spec requires asserting `updatedAt` is refreshed after the update.
- [x] [Review][Patch] Initial load guard ineffective in production [`useAutosave.ts:33`] -- when `EditorPage` sets `currentResume` AND `lastSavedDocument` together in the same React render batch (the normal load path), `saveRef.current.lastSavedDocument` is already non-null by the time the guard runs; a spurious identical PUT fires 500ms after every page load; fix: add a content-equality dirty-check inside the timer callback to skip the PUT when document content matches `lastSavedDocument`.
- [x] [Review][Patch] AC7 test coverage gap in `ResumeSection.test.tsx` [`ResumeSection.test.tsx`] -- AC7 explicitly requires this file to verify (a) editing a field updates `useResumeStore`, (b) the debounced save is scheduled via mocked timer, and (c) a failed save reverts state; current tests only verify the `onFieldChange` callback is called; `vi.useFakeTimers()` is set up in `beforeEach` but never exercised with `vi.advanceTimersByTime`.
- [x] [Review][Defer] `act()` warnings in autosave and EditorPage tests [`useAutosave.test.ts:53-56`, `EditorPage.test.tsx:63-64`] -- deferred, pre-existing pattern across test suite; all 50 tests pass
- [x] [Review][Defer] In-flight PUT request not cancelled on component unmount [`useAutosave.ts:47-63`] -- deferred, pre-existing pattern; timer IS cleared but an already-dispatched PUT can still resolve after unmount and write to the global Zustand store; no data loss, cosmetic side-effect only

**Pass 2 — 2026-06-05 (second review cycle)**
- [x] [Review][Patch] Unused `org.hamcrest.Matchers` import [`ResumeControllerIntegrationTest.java:19`] -- import added during patch cycle but never referenced in any test body; removed.
- [x] [Review][Patch] Missing EOF newline in integration test file [`ResumeControllerIntegrationTest.java` last line] -- `}` had no trailing newline; added.
- [x] [Review][Defer] Redundant double dirty-check in `useAutosave` [`useAutosave.ts:67,70-77`] -- two overlapping `JSON.stringify` guards both prevent spurious PUTs; logic is correct and safe; defer to a future cleanup pass.
