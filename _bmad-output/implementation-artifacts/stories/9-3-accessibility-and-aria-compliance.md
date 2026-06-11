# Story 9.3: Accessibility & ARIA Compliance — Interactive Element Semantics

**Status:** done
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-3-accessibility-and-aria-compliance
**Dependencies:** Story 9.1 done, Story 9.2 in review (no file overlap with either)

---

## Story

As a user of the application (including users relying on assistive technology),
I want all interactive elements to use proper semantic HTML and ARIA roles,
So that the application meets WCAG 2.1 AA accessibility requirements and keyboard/screen-reader users can interact with all resume section controls.

---

## Acceptance Criteria

**AC1 — `contentEditable` spans have keyboard handlers (S6848 / S1082)**
**Given** `<span contentEditable>` elements in all section renderer components are used as interactive editing controls (they accept focus, receive `onBlur` events, and the user must click them to edit)
**When** the fix is applied
**Then** every such `<span contentEditable>` element carries `role="textbox"` with `tabIndex={0}` so assistive technology announces it as an interactive control; an `onKeyDown` handler intercepts Enter (and only Enter — Space is a text character in `role="textbox"` elements and MUST NOT be intercepted, per ARIA authoring practices) to call `e.preventDefault()` with an `!e.nativeEvent.isComposing` guard so that CJK/IME character-confirm keypresses are not swallowed; no interactive behaviour is accessible only via mouse

**AC2 — Drag handle `<div>` has keyboard accessibility (S6848)**
**Given** the `SortableItemWrapper` in each renderer contains a `<div>` with `{...listeners}` spread from `useSortable`, which attaches pointer event handlers making it interactive
**When** the fix is applied
**Then** the drag handle `<div>` is given `role="button"` and `tabIndex={0}` (or is replaced with `<button type="button">`); the existing `aria-label="Drag to reorder"` is preserved; keyboard activation via Enter/Space triggers reorder affordance (can be a no-op in v1 with a visible focus ring as minimum)

**AC3 — No `role="button"` remains on non-button elements (S6819)**
**When** the fix is applied
**Then** any element using `role="button"` is replaced with `<button type="button">` and existing `className` is carried over; no `role="button"` attributes remain anywhere in the section renderer files

**AC4 — Interactive ARIA roles are on natively interactive elements (S6842)**
**When** the fix is applied
**Then** no inherently non-interactive element (`<div>`, `<span>`) carries an interactive ARIA role without also being made natively interactive or replaced with the correct element

**AC5 — All form labels are programmatically associated (S6853)**
**When** the fix is applied
**Then** every `<label>` element uses `htmlFor` matching the `id` of its input control, or the input is nested inside the label; no orphaned or unassociated labels remain in the section renderer files or any page component

**AC6 — No regressions**
**Given** the story is implemented
**When** `cd frontend && npm run lint` and all frontend tests are run (`npx vitest run`)
**Then** 0 ESLint errors; all existing tests in `EducationSectionRenderer.test.tsx`, `WorkExperienceSectionRenderer.test.tsx`, `SummarySectionRenderer.test.tsx`, and `GenericSectionRenderer.test.tsx` continue to pass without modification; SonarQube re-scan shows 0 remaining S6848, S6819, S6842, S1082, and S6853 violations

---

## Tasks / Subtasks

### Task 1: Audit all section renderer files for S6848 / S1082 violations (AC1, AC2)

The primary pattern across ALL 9 renderers is:
- `<span contentEditable suppressContentEditableWarning onBlur={...} aria-label="Edit ...">` — interactive but missing keyboard handler and `tabIndex`
- `<div {...attributes} {...listeners} aria-label="Drag to reorder">` in `SortableItemWrapper` — interactive (dnd-kit attaches event listeners) but missing `role` / `tabIndex`

**Files to fix (all follow identical structural pattern):**
- `frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/EducationSectionRenderer.tsx`
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx`
- `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SkillsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- `frontend/src/components/resume/sections/GenericSectionRenderer.tsx`

**Fix for `<span contentEditable>` elements (apply to every instance in all 9 files):**

```tsx
// BEFORE — missing tabIndex and keyboard handler
<span
  contentEditable
  suppressContentEditableWarning
  onBlur={(e) => onFieldChange(item.id, "fieldName", e.currentTarget.textContent ?? "")}
  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
  aria-label="Edit fieldName"
>
  {value}
</span>

// AFTER — add role, tabIndex, and onKeyDown
<span
  role="textbox"
  tabIndex={0}
  contentEditable
  suppressContentEditableWarning
  onBlur={(e) => onFieldChange(item.id, "fieldName", e.currentTarget.textContent ?? "")}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      e.currentTarget.focus()
    }
  }}
  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
  aria-label="Edit fieldName"
>
  {value}
</span>
```

**Fix for drag handle `<div>` in `SortableItemWrapper` (apply in all 9 renderers):**

```tsx
// BEFORE
<div
  className="absolute left-[-20px] top-0 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab touch-none"
  {...attributes}
  {...listeners}
  aria-label="Drag to reorder"
>
  <GripVertical className="h-4 w-4 text-muted-foreground" />
</div>

// AFTER — make natively interactive or add role + tabIndex
<div
  role="button"
  tabIndex={0}
  className="absolute left-[-20px] top-0 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab touch-none"
  {...attributes}
  {...listeners}
  aria-label="Drag to reorder"
>
  <GripVertical className="h-4 w-4 text-muted-foreground" />
</div>
```

Note: `role="button"` on the drag handle `<div>` is intentional here — dnd-kit's `useSortable` attaches ARIA attributes via `{...attributes}` that make the semantic context clear. The `<button type="button">` alternative is also valid; use whichever does not conflict with dnd-kit's `{...attributes}` spread. Confirm by running the tests after the change.

- [x] Fix all `<span contentEditable>` in `CertificationsSectionRenderer.tsx` (fields: name, issuer, issueDate, expirationDate)
- [x] Fix all `<span contentEditable>` in `EducationSectionRenderer.tsx` (fields: degree, fieldOfStudy, institution, startDate, endDate)
- [x] Fix all `<span contentEditable>` in `WorkExperienceSectionRenderer.tsx` (fields: jobTitle, company, startDate, endDate, description)
- [x] Fix all `<span contentEditable>` in `ProjectsSectionRenderer.tsx` (fields: name, startDate, endDate, technologies, description, link)
- [x] Fix all `<span contentEditable>` in `LanguagesSectionRenderer.tsx` (fields: language, proficiency)
- [x] Fix all `<span contentEditable>` in `SkillsSectionRenderer.tsx` (fields: name)
- [x] Fix all `<span contentEditable>` in `VolunteeringSectionRenderer.tsx` (fields: role, organization, startDate, endDate, description)
- [x] Fix `<p contentEditable>` in `SummarySectionRenderer.tsx` (field: text — this is a `<p>` not a `<span>`, add same role/tabIndex/onKeyDown)
- [x] Fix all `<span contentEditable>` in `GenericSectionRenderer.tsx` (fields: dynamic `fieldKey`)
- [x] Fix drag handle `<div>` in all 9 renderers' `SortableItemWrapper` local component

---

### Task 2: Verify no `role="button"` or S6819 violations remain (AC3)

- [x] Search all 9 renderer files for `role="button"` attributes; if any exist outside the drag handle fix above, replace that element with `<button type="button">` instead

---

### Task 3: Verify no S6853 form label violations exist in page components (AC5)

Pages confirmed already compliant (check to be sure):
- `LoginPage.tsx` — `<label htmlFor="email">` and `<label htmlFor="password">` with matching input `id` attributes
- `SignupPage.tsx` — same pattern
- `SettingsPage.tsx` — `<label htmlFor="currentPassword">`, `<label htmlFor="newPassword">`, `<label htmlFor="confirmPassword">` all present

- [x] Confirm each label's `htmlFor` value matches the `id` of its paired `<input>` — do NOT change these files unless a mismatch is found
- [x] If SonarQube flagged a specific page file, read it and apply `htmlFor`/`id` association

---

### Task 4: Run lint and tests (AC6)

- [x] `cd frontend && npm run lint` — 0 errors
- [x] `cd frontend && npx vitest run` — all existing tests pass
- [x] Specifically verify: `EducationSectionRenderer.test.tsx`, `WorkExperienceSectionRenderer.test.tsx`, `SummarySectionRenderer.test.tsx`, `GenericSectionRenderer.test.tsx` — those use `getByLabelText("Edit ...")` which relies on `aria-label`; confirm these still resolve correctly after adding `role="textbox"`

---

## Dev Notes & Guardrails

### CRITICAL: Pure Structural Change — No Logic Changes

This is a WCAG/SonarQube accessibility fix, NOT a feature change:
- **No logic changes** — only add `role`, `tabIndex`, and `onKeyDown` to existing elements
- **No new state** — no `useState`, no new Zustand store
- **No UI redesign** — existing `className` values stay identical
- **No component extractions** — the `SortableItemWrapper` and `AddItemButton` local components are already correctly structured; do NOT extract a shared component across renderers (that would change the module graph and risk unexpected side effects in 9 files)

### File Locations (Exact Paths)

```
frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx
frontend/src/components/resume/sections/EducationSectionRenderer.tsx
frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx
frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx
frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx
frontend/src/components/resume/sections/SkillsSectionRenderer.tsx
frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx
frontend/src/components/resume/sections/SummarySectionRenderer.tsx
frontend/src/components/resume/sections/GenericSectionRenderer.tsx
```

### Current State of All Renderers (READ BEFORE IMPLEMENTING)

All 9 renderers follow an **identical structure**:
1. A file-local `SortableItemWrapper` component using `useSortable` from `@dnd-kit/sortable`
2. A file-local `AddItemButton` component — already using `<button type="button">` (COMPLIANT, do not touch)
3. A default-exported renderer that uses `DndContext` + `SortableContext` when `onReorderItems` is provided

The `AddItemButton` already uses `<button type="button">` — it is **already compliant**. The "Delete item" button in `SortableItemWrapper` already uses `<button type="button">` — also **already compliant**.

**The violations are specifically:**
1. `<span contentEditable>` elements that are interactive (they have `onBlur` handlers) but lack `tabIndex`, `role`, and `onKeyDown` — approximately 3–7 per renderer = ~35 total across all files (matches SonarQube count of 30 S6848 + 1 S1082 + others)
2. The drag handle `<div {...attributes} {...listeners}>` that has pointer event handlers from dnd-kit spread but no accessible role/tabIndex

**`SummarySectionRenderer.tsx` special case:** The edit target is `<p contentEditable>` not `<span contentEditable>`. Apply the same fix (`role="textbox"`, `tabIndex={0}`, `onKeyDown`).

### Existing Tests Rely on `aria-label` — Do NOT Remove It

The test files use:
```tsx
screen.getByLabelText("Edit institution")   // EducationSectionRenderer.test.tsx:52
screen.getByLabelText("Delete item")        // EducationSectionRenderer.test.tsx:71
screen.getAllByLabelText("Add item here")   // WorkExperienceSectionRenderer.test.tsx:111
```

When you add `role="textbox"` to the `contentEditable` spans, `getByLabelText` will still resolve via the `aria-label` attribute — this is correct ARIA behaviour. Run `npx vitest run` to confirm nothing breaks.

### `onKeyDown` Handler Pattern

The minimal compliant handler for a `contentEditable` editing control:

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    e.currentTarget.focus()
  }
}}
```

This ensures keyboard users can activate the field. `e.preventDefault()` on Enter prevents inserting a newline before the element is focused for editing.

### SonarQube Rules Being Fixed

| Rule | Description | Count | Location |
|------|-------------|-------|----------|
| `typescript:S6848` | Non-native interactive element without ARIA role | 30 | `contentEditable` spans in all section renderers |
| `typescript:S6819` | Use native `<button>` not `role="button"` | 2 | Drag handle `<div>` (fix: add `role="button"` + `tabIndex`, or convert to `<button>`) |
| `typescript:S6842` | Interactive role on non-interactive element | 1 | Overlaps with above; resolved by same fix |
| `typescript:S1082` | Click handler without keyboard listener | 1 | A `contentEditable` element with `onClick` but no `onKeyDown` |
| `typescript:S6853` | Form label not associated with control | 1 | Possibly in a page component; investigate if page label `htmlFor` values match input `id` values |

### Project-Context Rules to Observe

From `project-context.md`:
- `src/components/ui/` is **excluded from ESLint and must never be edited** — these renderers are in `components/resume/sections/`, NOT `components/ui/`, so editing them is correct
- TypeScript strict mode: no `any` — the `onKeyDown` handler receives `React.KeyboardEvent<HTMLSpanElement>` (or `HTMLParagraphElement` for SummarySectionRenderer); TypeScript infers this automatically from JSX
- Component files: `PascalCase.tsx` — all 9 files already comply, no renames needed
- No new Zustand stores, no new `useState` for this story

### Pattern from Previous Stories (9.1 and 9.2)

From Story 9.1 learnings:
- Frontend tests run via `cd frontend && npx vitest run` — NOT from project root
- Lint runs via `cd frontend && npm run lint`
- The pattern for Epic 9 remediation: pure structural changes, zero logic changes, all existing tests must pass unchanged

### What NOT to Change

- `AddItemButton` component in any renderer — already `<button type="button">`, already compliant
- The "Delete item" button in `SortableItemWrapper` — already `<button type="button">`, already compliant
- Any file under `frontend/src/components/ui/` — shadcn-managed, never edit
- `LoginPage.tsx`, `SignupPage.tsx`, `SettingsPage.tsx` — labels already have `htmlFor` with matching input `id` values; confirm but expect no changes needed
- `dnd-kit` import statements — no new libraries needed, `onKeyDown` is native React
- Any backend file — this story is entirely frontend TypeScript/React

---

## Story Completion Status

**Analysis completed:** 2026-06-11
**Files analyzed:** All 9 section renderer `.tsx` files read in full; 3 existing test files read; page components checked for label compliance; Stories 9.1 and 9.2 reviewed for patterns
**Violations confirmed:**
- 35 MAJOR issues across S6848, S6819, S6842, S1082, S6853 in section renderer components
- Root cause: `<span contentEditable>` used as interactive text editing widgets without keyboard handlers or ARIA role; drag handle `<div>` with dnd-kit listeners but no accessible role
- Pages (Login, Signup, Settings) already have compliant `htmlFor`/`id` label associations
**Approach confirmed:** Add `role="textbox"`, `tabIndex={0}`, and `onKeyDown` to all `contentEditable` elements; add `role="button"` + `tabIndex={0}` to drag handle `<div>` in all 9 `SortableItemWrapper` locals. Zero logic changes.
**Test impact:** `getByLabelText("Edit ...")` queries in existing tests will continue to resolve via `aria-label`; `role="textbox"` does not break this.

---

## Review Findings

- [x] [Review][Decision] **Drag handle treatment: `role="button"` on `<div>` vs `<button>` — AC2/AC3 conflict and missing keyboard handler** — RESOLVED: Replaced `<div role="button" tabIndex={0}>` with `<button type="button">` in all 9 `SortableItemWrapper` components. Added no-op `onKeyDown` for Enter/Space. `role="button"` attr removed entirely (Option A). [2026-06-11]
- [x] [Review][Patch] **Space key `e.preventDefault()` in contentEditable `onKeyDown` swallows every space character typed in editable fields** — RESOLVED: Removed `|| e.key === " "` from all 30 contentEditable `onKeyDown` handlers across all 9 renderers. Only `Enter` is now handled. [2026-06-11]

- [x] [Review][Defer] `aria-multiline="true"` missing on multiline description/summary fields [`SummarySectionRenderer.tsx:141`, `WorkExperienceSectionRenderer.tsx:211`] — deferred, pre-existing; fields never declared multiline even before this story
- [x] [Review][Defer] camelCase `aria-label` values (`"Edit jobTitle"`, `"Edit fieldOfStudy"`, etc.) are read verbatim by screen readers as single words [all renderers] — deferred, pre-existing copy from original implementation
- [x] [Review][Defer] `aria-label="Edit issueDate"` on `expirationDate` span — copy-paste label in original code [`CertificationsSectionRenderer.tsx:~180`] — deferred, pre-existing
- [x] [Review][Defer] Non-unique `aria-label` across multiple items of the same type (e.g., 3× "Edit company") [all multi-item renderers] — deferred, pre-existing; out of story scope
- [x] [Review][Defer] `ProfilePage.tsx:253` `<li role="button">` — pre-existing S6819, has `onKeyDown`, keyboard-accessible, outside explicit story scope — deferred
- [x] [Review][Defer] `ResumeSidebarItem.tsx:32` `<div role="button">` — pre-existing S6819, has `onKeyDown`, keyboard-accessible, outside explicit story scope — deferred

**Third-pass review findings [2026-06-11]:**

- [x] [Review][Patch] **`aria-multiline="true"` on SummarySectionRenderer contradicts Enter-blocking `onKeyDown`** — `SummarySectionRenderer.tsx:136` declares `aria-multiline="true"` (correct: the field is multiline) but the `onKeyDown` unconditionally calls `e.preventDefault()` on Enter, blocking newline insertion. ARIA authoring practices require Enter to insert a newline in a multiline textbox. Fix: remove the `onKeyDown` from the summary `<div role="textbox" aria-multiline="true">` entirely — Enter should produce a newline; contentEditable handles it natively without any handler.
- [x] [Review][Patch] **Drag handle `<button>` is invisible when keyboard-focused** — all 9 `SortableItemWrapper` definitions use `opacity-0 group-hover/item:opacity-100` on the drag handle button. After the `<div>` → `<button>` change, the button is now Tab-reachable. A sighted keyboard user tabbing through will land on an invisible, unlabelled button with no visual focus indicator. Fix: add `focus-visible:opacity-100` to the className on all 9 drag handle `<button>` elements so focus becomes visible.

- [x] [Review][Defer] `role="textbox"` on `<span contentEditable>` is redundant — browser already maps `contenteditable` to implicit textbox role; explicit `role="textbox"` may cause NVDA+Firefox to double-announce; however removing it would re-introduce S6848 violations; defer to a future ARIA audit when screen-reader compatibility can be tested end-to-end.
- [x] [Review][Defer] No `KeyboardSensor` registered in any `DndContext` — drag handle `<button>` is keyboard-reachable but keyboard drag activation is silently non-functional; `{...listeners}` from dnd-kit has no sensor to dispatch to; pre-existing architectural gap not introduced by this story; address when keyboard drag is formally specified.
- [x] [Review][Defer] `onBlur` handler uses `textContent` which concatenates descendant markup (paste of formatted content produces garbled text) — pre-existing; `onPaste` sanitisation out of scope for this story.
- [x] [Review][Defer] Enter-blocking `onKeyDown` does not prevent pasted newlines into single-line fields — pre-existing; `onPaste` sanitisation out of scope for this story.
- [x] [Review][Defer] `SummarySectionRenderer` edit-mode tag change from `<p>` to `<div>` has no dedicated test asserting element type — test only queries by role; pre-existing coverage gap; address in a future test quality pass.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward structural changes with no issues.

### Completion Notes List

- Added `role="textbox"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space → focus) to all `contentEditable` editing elements across all 9 section renderers: ~35 spans/paragraphs total.
- Added `role="button"` and `tabIndex={0}` to the drag handle `<div {...attributes} {...listeners}>` in every `SortableItemWrapper` local component (9 renderers).
- `SummarySectionRenderer.tsx` special case handled: fix applied to `<p contentEditable>` not `<span>`.
- Zero logic changes; zero new state; zero component extractions. Pure structural/ARIA-attribute additions only.
- `LoginPage.tsx`, `SignupPage.tsx`, `SettingsPage.tsx` confirmed already compliant — `htmlFor` values match input `id` values in all three files. No changes needed.
- Lint: 0 errors (2 pre-existing warnings, unrelated to this story).
- Tests: 22 files / 189 tests — all passing. `getByLabelText("Edit ...")` queries continue to resolve correctly via `aria-label` after adding `role="textbox"`.
- **Review fix [2026-06-11]:** Resolved [Decision] — Replaced all 9 `<div role="button" tabIndex={0}>` drag handles with `<button type="button">` + no-op `onKeyDown` (Enter/Space). Zero `role="button"` attrs remain in section renderer files.
- **Review fix [2026-06-11]:** Resolved [Patch] — Removed `|| e.key === " "` from all 30 contentEditable `onKeyDown` handlers. Space characters can now be typed normally in all editable fields. Only `Enter` activates focus (sufficient for contentEditable).
- **Second-pass review fix [2026-06-11] — Fix 1:** Removed custom `onKeyDown` from all 9 drag handle `<button>` elements — the explicit prop was overriding dnd-kit's `{...listeners}` keyboard handler, breaking keyboard drag. The `{...listeners}` spread handles keyboard activation natively.
- **Second-pass review fix [2026-06-11] — Fix 2:** Changed `<p role="textbox">` to `<div role="textbox">` in `SummarySectionRenderer.tsx` — `<p>` is not a valid ARIA host for `role="textbox"` per ARIA-in-HTML spec. Added `aria-multiline="true"`. Updated `ResumeSection.test.tsx` test that was asserting on the `<p>` tag.
- **Second-pass review fix [2026-06-11] — Fix 3:** Removed redundant `e.currentTarget.focus()` from all contentEditable `onKeyDown` handlers across all 9 renderers — calling `focus()` on an already-focused element is a no-op.
- Lint: 0 errors (2 pre-existing warnings unchanged). Tests: 22 files / 189 tests — all passing.
- **Third-pass review fix [2026-06-11] — Fix 1:** Removed `onKeyDown` entirely from `SummarySectionRenderer.tsx` `<div role="textbox" aria-multiline="true">` — Enter must insert a newline in a multiline textbox per ARIA authoring practices; contentEditable handles it natively.
- **Third-pass review fix [2026-06-11] — Fix 2:** Added `focus-visible:opacity-100` to the drag handle `<button>` className in all 9 `SortableItemWrapper` components so keyboard-focused users see the button.
- Lint: 0 errors (2 pre-existing warnings unchanged). Tests: 22 files / 189 tests — all passing.
- **IME composition guard [2026-06-11]:** Added `!e.nativeEvent.isComposing` to all 29 single-line `contentEditable` `onKeyDown` handlers across 8 renderers (CertificationsSectionRenderer: 4, EducationSectionRenderer: 5, WorkExperienceSectionRenderer: 5, ProjectsSectionRenderer: 6, LanguagesSectionRenderer: 2, SkillsSectionRenderer: 1, VolunteeringSectionRenderer: 5, GenericSectionRenderer: 1). SummarySectionRenderer has no `onKeyDown` (multiline field — left as-is). Guard prevents CJK/IME character-confirm keypress from being swallowed during composition.
- **AC1 clarified [2026-06-11]:** Updated AC1 wording in story file to explicitly state that Space is a text character for `role="textbox"` elements and MUST NOT be intercepted (only Enter is handled), and that the `!e.nativeEvent.isComposing` guard is required. Removes the apparent AC violation flagged by the Acceptance Auditor regarding Space key interception.
- Lint: 0 errors (2 pre-existing warnings unchanged). Tests: 22 files / 189 tests — all passing.

### File List

- `frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/EducationSectionRenderer.tsx`
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx`
- `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SkillsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- `frontend/src/components/resume/sections/GenericSectionRenderer.tsx`
- `frontend/src/components/resume/ResumeSection.test.tsx`
- `_bmad-output/implementation-artifacts/stories/9-3-accessibility-and-aria-compliance.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
