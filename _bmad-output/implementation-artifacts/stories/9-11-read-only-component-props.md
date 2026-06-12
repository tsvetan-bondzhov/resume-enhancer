# Story 9.11: Enforce Read-Only Component Props Across All React Components

**Status:** done
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-11-read-only-component-props
**Dependencies:** None (9.10 done; all affected files are frontend TypeScript)

---

## Story

As a developer,
I want all React component prop interfaces to declare their properties as `readonly`,
So that props are protected from accidental mutation inside components, TypeScript strict mode is fully leveraged, and all 72 S6759 violations are cleared.

---

## Acceptance Criteria

**AC1 — All public props interfaces get `readonly` modifiers (S6759 × 72)**
**Given** a React component defines a props interface (e.g., `interface Props { ... }` or `type Props = { ... }`) without `readonly` modifiers on its properties (S6759)
**When** the fix is applied
**Then** every property in the interface is prefixed with `readonly`, or the interface is replaced with `Readonly<{ ... }>`; components that already use `React.FC<Props>` are unchanged beyond the interface update

**AC2 — Array-typed props use `readonly T[]` or `ReadonlyArray<T>`**
**Given** a component's props include array-typed fields (e.g., `items: WorkExperienceItemDto[]`)
**When** `readonly` is added
**Then** array fields are typed as `readonly T[]` or `ReadonlyArray<T>` and object fields use `Readonly<T>` recursively where the component does not mutate them; no `as Mutable<T>` escape hatches are introduced

**AC3 — Shared interfaces consumed by multiple components compile cleanly**
**Given** the props change touches shared interfaces imported by multiple components
**When** the fix propagates
**Then** all consuming components compile without type errors; no runtime behaviour changes

**AC4 — All tests pass and lint is clean**
**Given** the story is implemented
**When** TypeScript strict-mode compilation and all tests run
**Then** 0 type errors are introduced; `npm run lint` passes with 0 errors; all 189 tests in 22 test files pass; SonarQube re-scan shows 0 remaining S6759 violations across the entire frontend

---

## Tasks / Subtasks

### Task 1: Section renderer components — `readonly` on all props interfaces (AC1, AC2)

These 9 files follow an identical pattern: a public renderer interface with an `items` array plus optional callback props, and an internal `SortableItemWrapperProps`. Both interfaces need `readonly`.

**File:** `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx`
```typescript
// BEFORE
interface WorkExperienceSectionRendererProps {
  items: WorkExperienceItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
  onAddItem?: (position: number) => void
  onDeleteItem?: (itemId: string) => void
  onReorderItems?: (newItems: ResumeItemDto[]) => void
}
interface SortableItemWrapperProps {
  id: string
  children: React.ReactNode
  onDeleteItem?: (itemId: string) => void
}

// AFTER
interface WorkExperienceSectionRendererProps {
  readonly items: readonly WorkExperienceItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}
interface SortableItemWrapperProps {
  readonly id: string
  readonly children: React.ReactNode
  readonly onDeleteItem?: (itemId: string) => void
}
```

Apply the same `readonly` + `readonly T[]` pattern to all 8 remaining section renderer files:

| File | Renderer interface items type | SortableItemWrapperProps |
|------|-------------------------------|--------------------------|
| `CertificationsSectionRenderer.tsx` | `items: CertificationItemDto[]` → `readonly items: readonly CertificationItemDto[]` | same as above |
| `EducationSectionRenderer.tsx` | `items: EducationItemDto[]` → `readonly items: readonly EducationItemDto[]` | same |
| `LanguagesSectionRenderer.tsx` | `items: LanguageItemDto[]` → `readonly items: readonly LanguageItemDto[]` | same |
| `ProjectsSectionRenderer.tsx` | `items: ProjectItemDto[]` → `readonly items: readonly ProjectItemDto[]` | same |
| `SkillsSectionRenderer.tsx` | `items: SkillItemDto[]` → `readonly items: readonly SkillItemDto[]` | same |
| `SummarySectionRenderer.tsx` | `items: SummaryItemDto[]` (or object field) → `readonly` | same |
| `VolunteeringSectionRenderer.tsx` | `items: VolunteeringItemDto[]` → `readonly items: readonly VolunteeringItemDto[]` | same |
| `GenericSectionRenderer.tsx` | check actual field names; apply `readonly` to all | same |

**Implementation checklist:**
- [x] Add `readonly` prefix to every property in both interfaces in each file
- [x] Change `items: T[]` → `readonly items: readonly T[]` in each renderer interface
- [x] `onReorderItems?: (newItems: ResumeItemDto[])` — the *parameter* of the callback stays mutable (it's an argument passed IN to the callback, not a prop being mutated); only the prop declaration itself gets `readonly`
- [x] Do NOT change function destructuring — `function Foo({ items, onAddItem }: Props)` stays unchanged

---

### Task 2: `ResumeSection.tsx` (AC1, AC2)

**File:** `frontend/src/components/resume/ResumeSection.tsx`

```typescript
// BEFORE
interface ResumeSectionProps {
  section: ResumeSectionDto
  onTitleChange: (title: string) => void
  onFieldChange?: (itemId: string, field: string, value: string) => void
  onAddItem?: (position: number) => void
  onDeleteItem?: (itemId: string) => void
  onReorderItems?: (newItems: ResumeItemDto[]) => void
}

// AFTER
interface ResumeSectionProps {
  readonly section: ResumeSectionDto
  readonly onTitleChange: (title: string) => void
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}
```

- [x] Add `readonly` prefix to all 6 properties
- [x] `section: ResumeSectionDto` → `readonly section: ResumeSectionDto` (object prop — no `Readonly<>` wrapper needed on the DTO itself since we're not deeply mutating; the prop pointer is made readonly)

---

### Task 3: `ResumeCanvas.tsx` (AC1, AC2)

**File:** `frontend/src/components/resume/ResumeCanvas.tsx`

```typescript
// BEFORE
interface ResumeCanvasProps {
  document: ResumeDocumentDto | null
  templateId: string | null
  isLoading?: boolean
  state?: "idle" | "streaming" | "diff" | "print-preview"
  onTitleChange?: (sectionId: string, title: string) => void
  onFieldChange?: (sectionId: string, itemId: string, field: string, value: string) => void
  onAddItem?: (sectionType: ResumeSectionType, position: number) => void
  onDeleteItem?: (sectionType: ResumeSectionType, itemId: string) => void
  onReorderItems?: (sectionType: ResumeSectionType, newItems: ResumeItemDto[]) => void
}

// AFTER
interface ResumeCanvasProps {
  readonly document: ResumeDocumentDto | null
  readonly templateId: string | null
  readonly isLoading?: boolean
  readonly state?: "idle" | "streaming" | "diff" | "print-preview"
  readonly onTitleChange?: (sectionId: string, title: string) => void
  readonly onFieldChange?: (sectionId: string, itemId: string, field: string, value: string) => void
  readonly onAddItem?: (sectionType: ResumeSectionType, position: number) => void
  readonly onDeleteItem?: (sectionType: ResumeSectionType, itemId: string) => void
  readonly onReorderItems?: (sectionType: ResumeSectionType, newItems: ResumeItemDto[]) => void
}
```

- [x] Add `readonly` prefix to all 9 properties

---

### Task 4: `SectionsPanel.tsx` (AC1, AC2)

**File:** `frontend/src/components/resume/SectionsPanel.tsx`

```typescript
// BEFORE
interface SectionsPanelProps {
  sections: ResumeSectionDto[]
}
interface SortableSectionRowProps {
  section: ResumeSectionDto
  onToggle: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

// AFTER
interface SectionsPanelProps {
  readonly sections: readonly ResumeSectionDto[]
}
interface SortableSectionRowProps {
  readonly section: ResumeSectionDto
  readonly onToggle: (id: string) => void
  readonly onMoveUp: (id: string) => void
  readonly onMoveDown: (id: string) => void
}
```

- [x] `sections: ResumeSectionDto[]` → `readonly sections: readonly ResumeSectionDto[]`
- [x] Add `readonly` to all `SortableSectionRowProps` properties

---

### Task 5: `ConfirmDialog.tsx` and `SaveAsDialog.tsx` (AC1)

**File:** `frontend/src/components/resume/ConfirmDialog.tsx`
```typescript
// AFTER
interface ConfirmDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly isDestructive?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}
```

**File:** `frontend/src/components/resume/SaveAsDialog.tsx` — two interfaces:
```typescript
// AFTER
interface SaveAsDialogProps {
  readonly open: boolean
  readonly defaultName: string
  readonly isSaving: boolean
  readonly onConfirm: (name: string) => void
  readonly onClose: () => void
}
interface SaveAsFormProps {
  readonly defaultName: string
  readonly isSaving: boolean
  readonly onConfirm: (name: string) => void
  readonly onClose: () => void
}
```

- [x] Add `readonly` to all properties in both files

---

### Task 6: `EditorToolbar.tsx`, `ResumeSidebarItem.tsx`, `ResumeDashboardCard.tsx`, `TemplateGallery.tsx` (AC1)

**`EditorToolbar.tsx`:**
```typescript
// AFTER
interface EditorToolbarProps {
  readonly resumeName: string
  readonly autosaveStatus: "idle" | "saving" | "saved" | "error"
  readonly isDirty: boolean
  readonly lastSavedAt: Date | null
  readonly isSavingAs: boolean
  readonly onNameChange: (name: string) => void
  readonly onSave: () => void
  readonly onSaveAs: () => void
  readonly onBack: () => void
}
```

**`ResumeSidebarItem.tsx`:**
```typescript
// AFTER
interface ResumeSidebarItemProps {
  readonly resume: ResumeDto
  readonly isActive: boolean
  readonly onOpen: () => void
  readonly onDuplicate: () => void
  readonly onDelete: () => void
  readonly isDuplicating?: boolean
}
```

**`ResumeDashboardCard.tsx`:**
```typescript
// AFTER
interface ResumeDashboardCardProps {
  readonly resume: ResumeDto
  readonly onOpen: () => void
  readonly onDuplicate: () => void
  readonly onDelete: () => void
  readonly isDuplicating?: boolean
}
```

**`TemplateGallery.tsx`:**
```typescript
// AFTER
interface TemplateGalleryProps {
  readonly activeTemplateId: string | null
  readonly onApply: (templateId: string) => void
}
```

Also: `TemplateThumbnail` has an inline `{ template: TemplateDto }` prop — make it `{ readonly template: TemplateDto }`.

- [x] Add `readonly` to all properties in all 4 files

---

### Task 7: Layout components — `AppShell.tsx` and `SplitPaneLayout.tsx` (AC1)

**`AppShell.tsx`:**
```typescript
// AFTER
interface AppShellProps {
  readonly children: React.ReactNode
}
```

**`SplitPaneLayout.tsx`:**
```typescript
// AFTER
interface SplitPaneLayoutProps {
  readonly leftSlot: React.ReactNode
  readonly centerSlot: React.ReactNode
  readonly rightSlot: React.ReactNode
}
```

- [x] Add `readonly` to all properties in both files

---

### Task 8: Profile step components (AC1)

All profile step components have a single-prop interface `onSaveAndContinue`. Apply `readonly`:

| File | Interface | Change |
|------|-----------|--------|
| `CertificationsStep.tsx` | `CertificationsStepProps` | `readonly onSaveAndContinue: (partial: Partial<ProfileUpdateRequest>) => Promise<void>` |
| `EducationStep.tsx` | `EducationStepProps` | same pattern |
| `ExperienceStep.tsx` | `ExperienceStepProps` | same pattern |
| `LanguagesStep.tsx` | `LanguagesStepProps` | same pattern |
| `ProjectsStep.tsx` | `ProjectsStepProps` | same pattern |
| `SkillsStep.tsx` | `SkillsStepProps` | same pattern |
| `SummaryStep.tsx` | `SummaryStepProps` | same pattern |
| `VolunteeringStep.tsx` | `VolunteeringStepProps` | same pattern |

- [x] Add `readonly` to the single prop in each of the 8 profile step component interfaces

---

### Task 9: `theme-provider.tsx` — `ThemeProviderProps` type (AC1)

**File:** `frontend/src/components/theme-provider.tsx`

```typescript
// BEFORE
type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

// AFTER
type ThemeProviderProps = {
  readonly children: React.ReactNode
  readonly defaultTheme?: Theme
  readonly storageKey?: string
  readonly disableTransitionOnChange?: boolean
}
```

- [x] Add `readonly` to all 4 properties
- [x] Do NOT touch `ThemeProviderState` — that is not a props interface, it's a context state shape

---

### Task 10: Run TypeScript compilation, lint, and tests (AC3, AC4)

- [x] `cd frontend && npx tsc --noEmit` — must produce 0 type errors
  - Most likely zero errors since `readonly` on a prop interface only prevents *mutation inside the component*; React's JSX usage (passing values as props) is unaffected
  - If a component internally tries to assign to a prop (e.g., `props.items = []`), TypeScript will now error — but this should not exist given our code
- [x] `cd frontend && npm run lint` — must pass with 0 errors (pre-existing warnings are acceptable)
- [x] `cd frontend && npx vitest run` — all **22 test files, 189 tests** must pass (baseline from Story 9.10)

---

## Dev Notes & Guardrails

### Understanding SonarQube Rule S6759

**S6759 — React component props should be read-only**

React components must never mutate their own props. TypeScript's `readonly` modifier enforces this at compile time. SonarQube flags every props interface property that lacks `readonly`. The fix is purely additive — `readonly` only restricts assignment *from within the component body*, not from the caller.

**Key guarantee:** Adding `readonly` to prop interface properties is a type-only change — zero runtime impact. JSX callers (`<Foo bar={value} />`) are unaffected.

### Array Props Require `readonly T[]`

When `readonly` is added to an array prop (`items: SomeDto[]`), TypeScript still allows the array *contents* to be mutated (push/pop/splice) unless the element type is also marked `readonly`. The correct fix for array props:

```typescript
// WRONG — readonly prop but mutable array
readonly items: SomeDto[]

// CORRECT — readonly prop and readonly array reference
readonly items: readonly SomeDto[]
// Or equivalently:
readonly items: ReadonlyArray<SomeDto>
```

**Important:** The `onReorderItems` callback signature `(newItems: ResumeItemDto[]) => void` — the *parameter* `newItems` is a new array passed into the callback, not the prop itself. Do NOT change callback parameter types. Only the prop declaration in the interface gets `readonly`.

### `readonly T[]` vs Function Parameters

```typescript
// Interface (prop declaration) — CHANGE this:
readonly items: readonly WorkExperienceItemDto[]

// Callback parameter inside the interface — do NOT change the parameter:
readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
//                         ^^^^^^^ This stays as-is
```

### Internal Non-Props Interfaces — Skip Them

The profile step files (`ExperienceStep.tsx`, `CertificationsStep.tsx`, etc.) contain internal interfaces like `ExperienceDraft`, `FieldErrors`, `EntryState`. These are NOT component props interfaces — they are internal state shapes. Do NOT add `readonly` to these. Only the `*StepProps` interface (the one used as the component's prop type) gets `readonly`.

Similarly, `theme-provider.tsx` has `ThemeProviderState` — this is context state, not props. Skip it.

### File Location Map

```
frontend/src/components/resume/sections/
  CertificationsSectionRenderer.tsx   — Task 1
  EducationSectionRenderer.tsx        — Task 1
  GenericSectionRenderer.tsx          — Task 1
  LanguagesSectionRenderer.tsx        — Task 1
  ProjectsSectionRenderer.tsx         — Task 1
  SkillsSectionRenderer.tsx           — Task 1
  SummarySectionRenderer.tsx          — Task 1
  VolunteeringSectionRenderer.tsx     — Task 1
  WorkExperienceSectionRenderer.tsx   — Task 1

frontend/src/components/resume/
  ResumeSection.tsx                   — Task 2
  ResumeCanvas.tsx                    — Task 3
  SectionsPanel.tsx                   — Task 4
  ConfirmDialog.tsx                   — Task 5
  SaveAsDialog.tsx                    — Task 5 (2 interfaces)
  EditorToolbar.tsx                   — Task 6
  ResumeSidebarItem.tsx               — Task 6
  ResumeDashboardCard.tsx             — Task 6
  TemplateGallery.tsx                 — Task 6

frontend/src/components/layout/
  AppShell.tsx                        — Task 7
  SplitPaneLayout.tsx                 — Task 7

frontend/src/components/profile/
  CertificationsStep.tsx              — Task 8
  EducationStep.tsx                   — Task 8
  ExperienceStep.tsx                  — Task 8
  LanguagesStep.tsx                   — Task 8
  ProjectsStep.tsx                    — Task 8
  SkillsStep.tsx                      — Task 8
  SummaryStep.tsx                     — Task 8
  VolunteeringStep.tsx                — Task 8

frontend/src/components/
  theme-provider.tsx                  — Task 9
```

**Total: 28 files touched** (29 interfaces modified — SaveAsDialog has 2).

### Critical Preservation Rules

- **Do NOT edit** any file under `frontend/src/components/ui/` — shadcn-managed
- **Do NOT change** destructuring patterns in function signatures — `function Foo({ items }: Props)` stays unchanged
- **Do NOT change** callback parameter types — only the prop declaration in the interface gets `readonly`
- **Do NOT add** `Readonly<>` wrapper around entire interfaces — prefer per-property `readonly` which is more readable and consistent with existing Epic 9 patterns
- **Do NOT touch** internal state interfaces (e.g., `ExperienceDraft`, `FieldErrors`, `EntryState`, `ThemeProviderState`)
- **Do NOT run** `./mvnw test` — this story is frontend-only

### TypeScript Strict Mode — Expected Behaviour

With TypeScript strict mode already enforced:
- `readonly items: readonly T[]` compiles cleanly when `items` is passed from a parent as a regular mutable array — TypeScript coerces `T[]` to `readonly T[]` at call sites automatically
- If any component body tries to re-assign a prop (`props.items = []` or destructured `items = []`), TypeScript will now flag it as an error — fix by removing the mutation (props should never be mutated)

### Commit Pattern

Follow the established Epic 9 convention:
```
feat(9-11-read-only-component-props): add readonly modifiers to all React component prop interfaces
```

### Previous Story Intelligence (from Story 9.10 — done)

- Only frontend changes in this story — run `cd frontend && npm run lint` and `npx vitest run`, NOT `./mvnw test`
- Commit convention: `feat(9-X-story-key): <description>`
- `eslint.config.js` governs linting; `frontend/src/components/ui/` is excluded from ESLint (shadcn-managed, never edit)
- TypeScript strict mode enforced — `any` is forbidden
- **Baseline test count from Story 9.10: 22 test files, 189 tests** — all must still pass
- `theme-provider.tsx` already had its `THEME_VALUES` array converted to `new Set<Theme>(...)` in Story 9.9 and its `window.` refs replaced with `globalThis.` in Story 9.10 — do NOT revert

### SonarQube Rule Summary

| Rule | Name | Severity | Instances | Scope |
|------|------|----------|-----------|-------|
| `typescript:S6759` | React component props should be read-only | MINOR | 72 | All `frontend/src/components/**/*.tsx` props interfaces |

---

## Story Completion Status

**Analysis completed:** 2026-06-12
**Files analyzed:**
- All 28 `frontend/src/components/**/*.tsx` files with props interfaces (non-shadcn)
- Story 9.10 (done) — confirmed frontend-only pattern, baseline 22 test files / 189 tests
- Recent git commits confirm `feat(9-X-story-key): <description>` convention
- `frontend/src/types/api.ts` — DTO types are imported (not redeclared) in component files; no changes needed there

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_none_

### Completion Notes List

Added `readonly` modifiers to all 29 props interfaces across 28 files (AC1, AC2). Array-typed props use `readonly T[]` (AC2). Internal state interfaces (`ExperienceDraft`, `ThemeProviderState`, etc.) untouched. Callback parameter types unchanged per story spec. Validated: `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors (2 pre-existing warnings); `npx vitest run` → 22 test files, 189 tests passed (AC3, AC4).

Resolved review finding F1: Spread `[...items]` / `[...sections]` before passing to `arrayMove()` in all 9 section renderers and `SectionsPanel.tsx` (3 call sites). `tsc --build --force` confirms 0 TS2345 errors; 14 pre-existing test-file errors remain unchanged. 189 tests pass.

### File List

frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx
frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx
frontend/src/components/resume/sections/EducationSectionRenderer.tsx
frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx
frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx
frontend/src/components/resume/sections/SkillsSectionRenderer.tsx
frontend/src/components/resume/sections/SummarySectionRenderer.tsx
frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx
frontend/src/components/resume/sections/GenericSectionRenderer.tsx
frontend/src/components/resume/ResumeSection.tsx
frontend/src/components/resume/ResumeCanvas.tsx
frontend/src/components/resume/SectionsPanel.tsx
frontend/src/components/resume/ConfirmDialog.tsx
frontend/src/components/resume/SaveAsDialog.tsx
frontend/src/components/resume/EditorToolbar.tsx
frontend/src/components/resume/ResumeSidebarItem.tsx
frontend/src/components/resume/ResumeDashboardCard.tsx
frontend/src/components/resume/TemplateGallery.tsx
frontend/src/components/layout/AppShell.tsx
frontend/src/components/layout/SplitPaneLayout.tsx
frontend/src/components/profile/CertificationsStep.tsx
frontend/src/components/profile/EducationStep.tsx
frontend/src/components/profile/ExperienceStep.tsx
frontend/src/components/profile/LanguagesStep.tsx
frontend/src/components/profile/ProjectsStep.tsx
frontend/src/components/profile/SkillsStep.tsx
frontend/src/components/profile/SummaryStep.tsx
frontend/src/components/profile/VolunteeringStep.tsx
frontend/src/components/theme-provider.tsx
_bmad-output/implementation-artifacts/stories/9-11-read-only-component-props.md
_bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-06-12: Implemented story 9-11 — added `readonly` modifiers to all 29 props interfaces (28 files, 72 S6759 violations cleared). 0 type errors, 0 lint errors, 22 test files / 189 tests passing. Status → review.
- 2026-06-12: Code review found 1 patch finding (F1 below). Status → in-progress.
- 2026-06-12: Addressed review finding F1 — spread `[...items]`/`[...sections]` before `arrayMove()` in 9 section renderers + SectionsPanel.tsx (12 call sites total). 0 TS2345 errors, 189 tests pass. Status → review.

### Review Findings

- [x] [Review][Patch] `readonly T[]` passed to `arrayMove(T[], ...)` causes 13 TS2345 compile errors [`SectionsPanel.tsx:134,143,152` and all 9 section renderers `sections/*SectionRenderer.tsx:92-93`] — `@dnd-kit/sortable`'s `arrayMove` is typed as `arrayMove<T>(array: T[], ...)`, which does not accept `readonly T[]`. The `tsc --build --force` command reveals 13 new TS2345 errors introduced by this story (baseline has 14 pre-existing errors, none TS2345). Fix: spread the array before passing — e.g. `arrayMove([...items], oldIndex, newIndex)` and `arrayMove([...sections], oldIndex, newIndex)` — this satisfies the mutable parameter while preserving readonly semantics on the prop itself.
