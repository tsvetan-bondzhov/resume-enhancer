# Story 4.4: Section Item Add, Delete, and Drag-to-Reorder

**Status:** backlog
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-4-section-item-add-delete-and-drag-to-reorder
**Dependencies:** Story 3.15 (done), Story 3.5 (done)

---

## Story

As a user editing a resume,
I want to add new items, delete existing items, and reorder items within any section by dragging,
So that I have full control over every entry in my resume without leaving the editor.

---

## Acceptance Criteria

**AC1 — Delete button on item hover**
**Given** a section renderer renders items and `onDeleteItem` prop is defined
**When** the user hovers over an item
**Then** a `Trash2` icon button (from `lucide-react`) appears on the right side of the item; clicking it calls `onDeleteItem(item.id)`; the button is absolutely positioned (or appears via group-hover opacity); it is not rendered (or is hidden) when `onDeleteItem` is undefined (read-only mode)

**AC2 — Add affordances between items**
**Given** a section renderer renders and `onAddItem` prop is defined
**When** the user hovers over the section container
**Then** `+` icon buttons appear: one before the first item (insert at position 0), one between each pair of adjacent items (insert at position N), and one after the last item (insert at position items.length); clicking calls `onAddItem(position)` with the 0-based insertion index; these add buttons are not rendered when `onAddItem` is undefined (read-only mode)

**AC3 — New empty item inserted at position**
**Given** `useResumeStore.addItem(sectionType, position)` is called
**When** the action executes
**Then** a typed empty item (all string fields `""`, nullable fields `null`, booleans `false`, `id: crypto.randomUUID()`) is inserted at `position` in the matching section's `items` array; items at positions >= `position` are shifted right; autosave is triggered (store mutation causes `useAutosave` to debounce a PUT)

**AC4 — Drag-to-reorder within section**
**Given** a section renderer is in edit mode (`onReorderItems` prop is defined)
**When** the user drags an item using its `GripVertical` drag handle
**Then** the item is reordered within the section; `onReorderItems(newItems)` is called with the reordered array from `arrayMove`; `@dnd-kit/sortable`'s `DndContext` with `closestCenter` collision detection and `SortableContext` with `verticalListSortingStrategy` wraps the item list; each item uses `useSortable({ id: item.id })`

**AC5 — Three new Zustand store actions**
**Given** `useResumeStore` is updated
**When** actions are called
**Then**:
- `addItem(sectionType: ResumeSectionType, position: number): void` — calls `createEmptyItem(sectionType)` to build the new item, inserts it at `position` in the target section's `items` array using immutable spread; no-ops if `currentResume` is null or section not found
- `deleteItem(sectionType: ResumeSectionType, itemId: string): void` — filters out the item with matching `id` from the target section; no-ops if section not found
- `reorderItems(sectionType: ResumeSectionType, newItems: ResumeItem[]): void` — replaces the target section's `items` with `newItems`; all updates follow the immutable Zustand pattern `set(state => ({ ...state, currentResume: { ...state.currentResume, content: { ...state.currentResume.content, sections: ... } } }))`

**AC6 — `ResumeSection.tsx` gains optional item management props**
**Given** `ResumeSection` is updated
**When** it renders a section in edit mode
**Then** `ResumeSectionProps` gains three optional props: `onAddItem?: (position: number) => void`, `onDeleteItem?: (itemId: string) => void`, `onReorderItems?: (newItems: ResumeItemDto[]) => void`; these are passed down to the renderer component matched by `sectionType` in the `renderSectionContent` switch; the `renderSectionContent` function signature is updated to accept and thread these props through

**AC7 — EditorPage/ResumeCanvas passes item management callbacks**
**Given** `EditorPage` and `ResumeCanvas` are updated
**When** the editor is in edit mode (onTitleChange/onFieldChange are present)
**Then** `ResumeCanvas` receives `onAddItem`, `onDeleteItem`, `onReorderItems` optional props (typed as `(sectionType: string, position: number) => void` etc.) and threads them through to `ResumeSection`; `EditorPage` wires these to store actions:
  ```ts
  onAddItem={(sectionType, position) => addItem(sectionType, position)}
  onDeleteItem={(sectionType, itemId) => deleteItem(sectionType, itemId)}
  onReorderItems={(sectionType, newItems) => reorderItems(sectionType, newItems)}
  ```

**AC8 — Autosave triggered after all three mutations**
**Given** `addItem`, `deleteItem`, or `reorderItems` is called
**When** the Zustand state is mutated
**Then** `useAutosave` detects the `currentResume` change (the hook subscribes to `currentResume` in its dependency array) and debounces a PUT; no explicit autosave call is needed — the store mutation alone triggers the existing debounce mechanism

---

## Tasks / Subtasks

### Task 1: Create `frontend/src/lib/resumeItemFactory.ts` (AC: 3, 5)

- [ ] Create `frontend/src/lib/resumeItemFactory.ts`:
  ```ts
  import type {
    ResumeItemDto,
    ResumeSectionType,
    WorkExperienceItemDto,
    EducationItemDto,
    SkillItemDto,
    CertificationItemDto,
    LanguageItemDto,
    ProjectItemDto,
    VolunteeringItemDto,
    SummaryItemDto,
    GenericItemDto,
  } from "@/types/api"

  export function createEmptyItem(sectionType: ResumeSectionType): ResumeItemDto {
    const id = crypto.randomUUID()
    switch (sectionType) {
      case "WORK_EXPERIENCE":
        return { type: "WORK_EXPERIENCE", id, jobTitle: "", company: "", startDate: null, endDate: null, isCurrent: false, description: "" } satisfies WorkExperienceItemDto
      case "EDUCATION":
        return { type: "EDUCATION", id, institution: "", degree: "", fieldOfStudy: "", startDate: null, endDate: null } satisfies EducationItemDto
      case "SKILLS":
        return { type: "SKILLS", id, name: "", category: null, proficiency: null } satisfies SkillItemDto
      case "CERTIFICATIONS":
        return { type: "CERTIFICATIONS", id, name: "", issuer: "", issueDate: null, expirationDate: null } satisfies CertificationItemDto
      case "LANGUAGES":
        return { type: "LANGUAGES", id, language: "", proficiency: "" } satisfies LanguageItemDto
      case "PROJECTS":
        return { type: "PROJECTS", id, name: "", description: "", technologies: "", link: null, startDate: null, endDate: null, isCurrent: false } satisfies ProjectItemDto
      case "VOLUNTEERING":
        return { type: "VOLUNTEERING", id, role: "", organization: "", description: "", startDate: null, endDate: null, isCurrent: false } satisfies VolunteeringItemDto
      case "SUMMARY":
        return { type: "SUMMARY", id, text: "" } satisfies SummaryItemDto
      case "UNKNOWN":
        return { type: "UNKNOWN", id, fields: {} } satisfies GenericItemDto
      default: {
        const _exhaustive: never = sectionType
        void _exhaustive
        throw new Error(`Unknown section type: ${String(sectionType)}`)
      }
    }
  }
  ```
- [ ] Note: `satisfies` keyword (TypeScript 4.9+) is used for type-checking without widening — verify tsconfig targets at least TS 4.9; if not available, use explicit type annotation `const item: WorkExperienceItemDto = { ... }; return item` instead

### Task 2: Update `useResumeStore.ts` — add three new actions (AC: 5, 8)

- [ ] Open `frontend/src/stores/useResumeStore.ts`
- [ ] Add imports for `createEmptyItem` and `ResumeSectionType`:
  ```ts
  import type { ResumeDocumentDto, ResumeDto, ResumeSectionDto, ResumeSectionType, ResumeItemDto } from "@/types/api"
  import { createEmptyItem } from "@/lib/resumeItemFactory"
  ```
- [ ] Add three new action type signatures to the `ResumeState` interface:
  ```ts
  addItem: (sectionType: ResumeSectionType, position: number) => void
  deleteItem: (sectionType: ResumeSectionType, itemId: string) => void
  reorderItems: (sectionType: ResumeSectionType, newItems: ResumeItemDto[]) => void
  ```
- [ ] Implement `addItem` in the store:
  ```ts
  addItem: (sectionType, position) =>
    set((state) => {
      if (!state.currentResume) return state
      const newItem = createEmptyItem(sectionType)
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.sectionType !== sectionType
                ? s
                : {
                    ...s,
                    items: [
                      ...s.items.slice(0, position),
                      newItem,
                      ...s.items.slice(position),
                    ],
                  }
            ),
          },
        },
      }
    }),
  ```
- [ ] Implement `deleteItem` in the store:
  ```ts
  deleteItem: (sectionType, itemId) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.sectionType !== sectionType
                ? s
                : { ...s, items: s.items.filter((item) => item.id !== itemId) }
            ),
          },
        },
      }
    }),
  ```
- [ ] Implement `reorderItems` in the store:
  ```ts
  reorderItems: (sectionType, newItems) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: {
          ...state.currentResume,
          content: {
            ...state.currentResume.content,
            sections: state.currentResume.content.sections.map((s) =>
              s.sectionType !== sectionType ? s : { ...s, items: newItems }
            ),
          },
        },
      }
    }),
  ```

### Task 3: Update `ResumeSection.tsx` — add optional item management props (AC: 6)

- [ ] Open `frontend/src/components/resume/ResumeSection.tsx`
- [ ] Update `ResumeSectionProps`:
  ```ts
  interface ResumeSectionProps {
    section: ResumeSectionDto
    onTitleChange: (title: string) => void
    onFieldChange?: (itemId: string, field: string, value: string) => void
    onAddItem?: (position: number) => void
    onDeleteItem?: (itemId: string) => void
    onReorderItems?: (newItems: ResumeItemDto[]) => void
  }
  ```
- [ ] Update `renderSectionContent` signature to accept the three new callbacks:
  ```ts
  function renderSectionContent(
    section: ResumeSectionDto,
    onFieldChange: ((itemId: string, field: string, value: string) => void) | undefined,
    onAddItem: ((position: number) => void) | undefined,
    onDeleteItem: ((itemId: string) => void) | undefined,
    onReorderItems: ((newItems: ResumeItemDto[]) => void) | undefined,
  )
  ```
- [ ] Pass all three new props to each renderer in the switch (all nine cases):
  ```tsx
  case "WORK_EXPERIENCE":
    return (
      <WorkExperienceSectionRenderer
        items={...}
        onFieldChange={onFieldChange}
        onAddItem={onAddItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
      />
    )
  ```
- [ ] Update the `renderSectionContent(section, onFieldChange)` call site in the component body to include the new args:
  ```tsx
  {renderSectionContent(section, onFieldChange, onAddItem, onDeleteItem, onReorderItems)}
  ```
- [ ] Import `ResumeItemDto` at the top of the file (needed for `onReorderItems` type)

### Task 4: Update `ResumeCanvas.tsx` — pass item management callbacks in edit mode (AC: 7)

- [ ] Open `frontend/src/components/resume/ResumeCanvas.tsx`
- [ ] Add three optional props to `ResumeCanvasProps`:
  ```ts
  onAddItem?: (sectionType: string, position: number) => void
  onDeleteItem?: (sectionType: string, itemId: string) => void
  onReorderItems?: (sectionType: string, newItems: ResumeItemDto[]) => void
  ```
- [ ] Import `ResumeItemDto` from `@/types/api` (needed for the `onReorderItems` type)
- [ ] In the `<ResumeSection>` render (both the single-column path and, after Story 4.2, the two-column path), add the three item management props:
  ```tsx
  <ResumeSection
    key={section.sectionType}
    section={section}
    onTitleChange={(title) => onTitleChange?.(section.sectionType, title)}
    onFieldChange={
      onFieldChange
        ? (itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)
        : undefined
    }
    onAddItem={onAddItem ? (position) => onAddItem(section.sectionType, position) : undefined}
    onDeleteItem={onDeleteItem ? (itemId) => onDeleteItem(section.sectionType, itemId) : undefined}
    onReorderItems={onReorderItems ? (newItems) => onReorderItems(section.sectionType, newItems) : undefined}
  />
  ```

- [ ] Update `EditorPage.tsx` — add store action subscriptions and pass to `ResumeCanvas`:
  ```ts
  const addItem = useResumeStore((state) => state.addItem)
  const deleteItem = useResumeStore((state) => state.deleteItem)
  const reorderItems = useResumeStore((state) => state.reorderItems)
  ```
  Pass to `<ResumeCanvas>`:
  ```tsx
  onAddItem={(sectionType, position) => addItem(sectionType as ResumeSectionType, position)}
  onDeleteItem={(sectionType, itemId) => deleteItem(sectionType as ResumeSectionType, itemId)}
  onReorderItems={(sectionType, newItems) => reorderItems(sectionType as ResumeSectionType, newItems)}
  ```
  Import `ResumeSectionType` from `@/types/api` in `EditorPage.tsx` if not already imported.

### Task 5: Update all 9 section renderers — delete button, add affordances, dnd-kit sortable (AC: 1, 2, 4)

All nine renderers follow the same structural pattern. Use `WorkExperienceSectionRenderer.tsx` as the reference implementation:

**Prop interface update (all 9 renderers):**
```ts
interface WorkExperienceSectionRendererProps {
  items: WorkExperienceItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
  onAddItem?: (position: number) => void
  onDeleteItem?: (itemId: string) => void
  onReorderItems?: (newItems: WorkExperienceItemDto[]) => void
}
```
Note: `onReorderItems` is typed with the specific item type (e.g. `WorkExperienceItemDto[]`), not the union `ResumeItemDto[]`. The renderer knows its own item type. The `ResumeSection` wrapper will handle the type mismatch at the boundary (safe cast or type assertion when calling the store action).

**Imports to add (all 9 renderers):**
```tsx
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus } from "lucide-react"
```

**SortableItem wrapper component (define inside each renderer file):**
```tsx
interface SortableItemWrapperProps {
  id: string
  children: React.ReactNode
  onDeleteItem?: (itemId: string) => void
}

function SortableItemWrapper({ id, children, onDeleteItem }: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/item">
      {/* Drag handle — visible on item hover, only when reorder is available */}
      {/* (presence of listeners signals reorder mode) */}
      <div
        className="absolute left-[-20px] top-0 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Delete button — visible on item hover */}
      {onDeleteItem && (
        <button
          type="button"
          className="absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500"
          aria-label="Delete item"
          onClick={() => onDeleteItem(id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {children}
    </div>
  )
}
```

**Add affordance component (define once, shared across renderers or inline):**
```tsx
function AddItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center w-full h-4 opacity-0 group-hover/section:opacity-100 transition-opacity hover:opacity-100"
      aria-label="Add item here"
      onClick={onClick}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="h-3 w-3" />
      </div>
    </button>
  )
}
```

**Renderer body structure (using WorkExperience as template):**
```tsx
export default function WorkExperienceSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: WorkExperienceSectionRendererProps) {

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderItems) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderItems(arrayMove(items, oldIndex, newIndex))
  }

  const content = (
    <div className="space-y-3 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper
            id={item.id}
            onDeleteItem={onDeleteItem}
          >
            {/* ... existing item rendering (jobTitle, company, dates, description) ... */}
          </SortableItemWrapper>
          {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} />}
        </React.Fragment>
      ))}
    </div>
  )

  if (onReorderItems) {
    return (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {content}
        </SortableContext>
      </DndContext>
    )
  }

  return content
}
```

- [ ] Apply the above structure to all 9 renderers: `WorkExperienceSectionRenderer`, `EducationSectionRenderer`, `SkillsSectionRenderer`, `CertificationsSectionRenderer`, `LanguagesSectionRenderer`, `ProjectsSectionRenderer`, `VolunteeringSectionRenderer`, `SummarySectionRenderer`, `GenericSectionRenderer`
- [ ] For `SummarySectionRenderer` and `SkillsSectionRenderer`, the item-level delete and add patterns still apply — a summary section can have multiple summary items (though typically one), and skills can be individually deleted
- [ ] `React.Fragment` must be imported or use the shorthand `<>` — but shorthand cannot have a `key` prop, so use `<React.Fragment key={item.id}>` or restructure

### Task 6: Create `useResumeStore.test.ts` — test three new actions (AC: 5)

- [ ] Create `frontend/src/stores/useResumeStore.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach } from "vitest"
  import { useResumeStore } from "./useResumeStore"
  import type { ResumeDto, ResumeSectionDto, WorkExperienceItemDto } from "@/types/api"
  ```
- [ ] Build fixture helpers:
  ```ts
  function buildItem(id: string): WorkExperienceItemDto {
    return { type: "WORK_EXPERIENCE", id, jobTitle: "Dev", company: "Acme", startDate: null, endDate: null, isCurrent: false, description: null }
  }
  function buildSection(items = [buildItem("i1"), buildItem("i2")]): ResumeSectionDto {
    return { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items }
  }
  function buildResume(section = buildSection()): ResumeDto {
    return { id: "r1", name: "Resume", templateId: null, content: { sections: [section] }, isTailored: false, createdAt: "", updatedAt: "" }
  }
  ```
- [ ] Write tests:
  - `addItem` at position 0 inserts new item at index 0, existing items shift to index 1, 2
  - `addItem` at position 1 inserts between existing items
  - `addItem` at position items.length appends
  - `addItem` returns a new item with a unique `id` (crypto.randomUUID — test that id is a non-empty string)
  - `deleteItem` removes item by id; remaining items order preserved
  - `deleteItem` with unknown id is a no-op (items array unchanged)
  - `reorderItems` replaces items array with new order
  - All three actions are no-ops when `currentResume` is null

### Task 7: Update at least 2 renderer tests — verify delete and add rendering (AC: 1, 2)

- [ ] Update `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.test.tsx`:
  - Add test: when `onDeleteItem` is provided, hovering an item shows a delete button (test for aria-label `"Delete item"` in DOM)
  - Add test: when `onDeleteItem` is defined and delete button is clicked, `onDeleteItem` is called with `item.id`
  - Add test: when `onAddItem` is provided, add buttons with aria-label `"Add item here"` appear in the DOM (at least 2 for a 1-item section: one before, one after)
  - Add test: when `onAddItem` is not provided, no `"Add item here"` buttons render
- [ ] Update `frontend/src/components/resume/sections/EducationSectionRenderer.test.tsx`:
  - Add test: `onDeleteItem` callback triggered with correct `item.id` on delete button click

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/stores/useResumeStore.ts` | Add `addItem`, `deleteItem`, `reorderItems` actions + `ResumeItemDto` import |
| `frontend/src/components/resume/ResumeSection.tsx` | Add 3 optional props; update `renderSectionContent` to thread them; import `ResumeItemDto` |
| `frontend/src/components/resume/ResumeCanvas.tsx` | Add 3 optional props; thread to `ResumeSection`; import `ResumeItemDto` |
| `frontend/src/pages/EditorPage.tsx` | Subscribe to 3 new store actions; pass to `ResumeCanvas` |
| `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx` | Add dnd-kit sortable, delete button, add affordances |
| `frontend/src/components/resume/sections/EducationSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/SkillsSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/SummarySectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/GenericSectionRenderer.tsx` | Same |
| `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.test.tsx` | Add delete/add tests |
| `frontend/src/components/resume/sections/EducationSectionRenderer.test.tsx` | Add delete test |

### Files to Create (NEW)

| File | Notes |
|------|-------|
| `frontend/src/lib/resumeItemFactory.ts` | `createEmptyItem(sectionType)` factory function |
| `frontend/src/stores/useResumeStore.test.ts` | Tests for `addItem`, `deleteItem`, `reorderItems` |

### No Backend Changes

This story is **frontend-only**. No Java files, no Flyway migrations, no API changes.

### Critical Implementation Details

**`@dnd-kit/core` and `@dnd-kit/sortable` are already installed:**
Confirmed in `package.json`: `"@dnd-kit/core": "^6.3.1"`, `"@dnd-kit/sortable": "^10.0.0"`, `"@dnd-kit/utilities": "^3.2.2"`. The `SectionsPanel.tsx` already uses `DndContext`, `SortableContext`, `useSortable`, `arrayMove`, and `CSS` from these packages — follow the same import and usage pattern.

**`group/item` and `group/section` Tailwind named group syntax:**
The `group/item` and `group-hover/item` class names use Tailwind's named group feature (v3.2+). The item wrapper `div` gets `group/item` and hover-triggered children get `group-hover/item:opacity-100`. The section wrapper `div` gets `group/section` for the add affordances `group-hover/section:opacity-100`. Verify Tailwind v3.2+ is in use — check `package.json`. Named groups allow nested hover states without conflicts.

**`onReorderItems` type at the boundary:**
Renderer-level `onReorderItems` is typed as `(newItems: WorkExperienceItemDto[]) => void` (specific type). `ResumeSection`'s `onReorderItems` is typed as `(newItems: ResumeItemDto[]) => void` (union type). When `ResumeSection` passes its prop to the renderer, a type assertion is needed:
```tsx
onReorderItems={onReorderItems as ((newItems: WorkExperienceItemDto[]) => void) | undefined}
```
This is safe because the renderer only ever passes `WorkExperienceItemDto[]` items from within the WORK_EXPERIENCE section.

**`createEmptyItem` and `crypto.randomUUID()`:**
`crypto.randomUUID()` is available in all modern browsers and Node.js 14.17+. It does not require polyfilling in this project. The factory is called inside the Zustand `set` callback — this is fine because `set` callbacks are synchronous and synchronous crypto calls are allowed.

**`satisfies` keyword:**
TypeScript's `satisfies` operator (4.9+) is used for type-safe empty item construction. If the project uses an older TS version, replace `satisfies WorkExperienceItemDto` with explicit type annotation:
```ts
const item: WorkExperienceItemDto = { type: "WORK_EXPERIENCE", id, ... }
return item
```

**Drag handle positioning:**
The `GripVertical` drag handle is positioned with `absolute left-[-20px]` which places it to the left of the item content. This requires the parent section container to have enough left margin to show the handle. The `ResumeSection` `<section>` wrapper has no padding restriction; if handles are visually clipped, add `pl-5` to the renderer's outer `<div className="space-y-3 group/section">` in edit mode.

**`DndContext` inside renderers vs a global context:**
Each renderer creates its own `DndContext` wrapping only its own item list. This is the same pattern used in `SectionsPanel.tsx` for section-level drag. This means drags are scoped to the section — items cannot be dragged across sections (which is the desired behavior).

**Autosave chain:**
`addItem`, `deleteItem`, and `reorderItems` all mutate `currentResume` in the Zustand store. `useAutosave` (in `EditorPage`) subscribes to `currentResume` via `useResumeStore((state) => state.currentResume)` and runs a `useEffect` that detects changes and debounces a PUT. No explicit `saveNow()` call or additional wiring is needed.

---

## Dev Notes

- The `SortableItemWrapper` helper component defined inside each renderer file avoids prop drilling while keeping the dnd-kit `useSortable` hook co-located with the drag handle rendering. An alternative is to extract `SortableItemWrapper` to a shared `frontend/src/components/resume/sections/SortableItemWrapper.tsx` file — this is acceptable but the inline approach reduces import overhead for 9 files.
- Named Tailwind groups (`group/item`, `group/section`) are required because multiple nested hover groups exist simultaneously (hovering an item inside a section). Without named groups, `group-hover:` would ambiguously match the outermost ancestor with `group`, producing incorrect behavior.
- `React.Fragment` with `key` cannot use the shorthand `<>` — use `<React.Fragment key={item.id}>` in the map when wrapping items + add buttons.
- The `AddItemButton` between-item affordances add visual noise. The `opacity-0 group-hover/section:opacity-100` pattern keeps them invisible until the section is hovered, minimizing distraction in normal view.

---

## File List

### To Create
- `frontend/src/lib/resumeItemFactory.ts`
- `frontend/src/stores/useResumeStore.test.ts`

### To Modify
- `frontend/src/stores/useResumeStore.ts`
- `frontend/src/components/resume/ResumeSection.tsx`
- `frontend/src/components/resume/ResumeCanvas.tsx`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx`
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.test.tsx`
- `frontend/src/components/resume/sections/EducationSectionRenderer.tsx`
- `frontend/src/components/resume/sections/EducationSectionRenderer.test.tsx`
- `frontend/src/components/resume/sections/SkillsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx`
- `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- `frontend/src/components/resume/sections/GenericSectionRenderer.tsx`

---

## Change Log

- 2026-06-10: Story created
