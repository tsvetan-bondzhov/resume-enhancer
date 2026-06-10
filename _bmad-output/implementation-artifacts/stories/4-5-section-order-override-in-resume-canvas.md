# Story 4.5: Section Order Override in Resume Canvas

**Status:** backlog
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-5-section-order-override-in-resume-canvas
**Dependencies:** Story 3.5 (done), Story 3.10 (done), Story 3.11 (done)

---

## Story

As a user,
I want the section order I set in the Sections sidebar to be reflected in the resume canvas,
So that I can control the relative position of sections within each column without the template overriding my preference.

---

## Acceptance Criteria

**AC1 — Single-column / modern-accent: user order wins**
**Given** a single-column or modern-accent template is active
**When** `getOrderedSections` is called with a user-reordered sections array
**Then** it returns visible sections in the same relative order as `currentResume.content.sections` (the user's stored array); the template `sectionOrder` array is no longer used as a sort key; sections absent from the template's `sectionOrder` are still returned (no drops); hidden sections are filtered out

**AC2 — Two-column: column assignment from template, ordering from user**
**Given** a two-column template is active
**When** `getOrderedSections` is called
**Then** sections are split into left and right groups based on template `columns.left` / `columns.right` membership; the ordering within each group follows the user's section array order (relative order from `currentResume.content.sections`); template column arrays are only used for left/right assignment, not for ordering

**AC3 — Unassigned two-column sections append to right**
**Given** a two-column template is active and a section's `sectionType` is not listed in either `columns.left` or `columns.right`
**When** `getOrderedSections` is called
**Then** unassigned visible sections are appended to the right column (after all assigned right-column sections); this matches pre-existing fallback behaviour

**AC4 — No template: user array order returned**
**Given** no template is provided (`template` is `null`) or the template has no `layout`
**When** `getOrderedSections` is called
**Then** it returns all visible sections in the exact order of the input `sections` array (no column splitting, no sorting)

**AC5 — Tests**
**Given** `templateUtils.test.ts` exists (create if not present)
**When** tests are run
**Then**:
- (a) Single-column: when the user has reordered two sections (e.g. swapped SKILLS and EDUCATION), `getOrderedSections` returns them in the swapped user order, not the template `sectionOrder` order
- (b) Two-column: sections are assigned to left/right columns per template, but within each column the user's relative ordering is preserved regardless of template column array ordering

---

## Tasks / Subtasks

### Task 1: Fix `getOrderedSections` for single-column / modern-accent (AC: 1, 4)

- [ ] Open `frontend/src/lib/templateUtils.ts`
- [ ] In the `single-column` / `modern-accent` branch (currently lines 38–43), replace the `sectionOrder`-driven sort with a filter of the already-ordered `visibleSections` array:
  ```typescript
  // BEFORE (template order drives output):
  const sectionOrder = layout.sectionOrder ?? []
  const inOrder = sectionOrder
    .map((id) => visibleSections.find((s) => s.sectionType === id))
    .filter((s): s is ResumeSectionDto => s !== undefined)
  const remaining = visibleSections.filter((s) => !sectionOrder.includes(s.sectionType))
  return [...inOrder, ...remaining]

  // AFTER (user order drives output — template sectionOrder no longer sorts):
  return visibleSections
  ```
- [ ] The `no layout` early-return path (`if (!layout) return visibleSections`) already returns in user array order — no change needed there (AC4)

### Task 2: Fix `getOrderedSections` for two-column (AC: 2, 3)

- [ ] In the `two-column` branch (currently lines 27–35), replace the template-array-ordered `inOrder` map with user-array-ordered filtering by column membership:
  ```typescript
  // BEFORE (template column array order drives output within each column):
  const left = layout.columns?.left ?? []
  const right = layout.columns?.right ?? []
  const orderedIds = [...left, ...right]
  const inOrder = orderedIds
    .map((id) => visibleSections.find((s) => s.sectionType === id))
    .filter((s): s is ResumeSectionDto => s !== undefined)
  const remaining = visibleSections.filter((s) => !orderedIds.includes(s.sectionType))
  return [...inOrder, ...remaining]

  // AFTER (user order drives output within each column):
  const leftIds = new Set(layout.columns?.left ?? [])
  const rightIds = new Set(layout.columns?.right ?? [])
  const leftSections = visibleSections.filter((s) => leftIds.has(s.sectionType))
  const rightSections = visibleSections.filter((s) => rightIds.has(s.sectionType))
  const unassigned = visibleSections.filter(
    (s) => !leftIds.has(s.sectionType) && !rightIds.has(s.sectionType)
  )
  return [...leftSections, ...rightSections, ...unassigned]
  ```
- [ ] Note: `ResumeCanvas.tsx` interprets the return array by splitting on `columns.left` membership for grid column assignment — the split logic in `ResumeCanvas` is unaffected; only the sort order changes

### Task 3: Create / update `templateUtils.test.ts` (AC: 5)

- [ ] Check if `frontend/src/lib/templateUtils.test.ts` exists; create it if not
- [ ] Write test: **single-column respects user order**
  ```typescript
  it("single-column: returns sections in user document order, not template order", () => {
    const sections: ResumeSectionDto[] = [
      { sectionType: "SKILLS", title: "Skills", visible: true, items: [] },
      { sectionType: "EDUCATION", title: "Education", visible: true, items: [] },
      { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items: [] },
    ]
    const template = {
      templateDefinition: {
        layoutType: "single-column",
        layout: { sectionOrder: ["WORK_EXPERIENCE", "EDUCATION", "SKILLS"], columns: null, headerStyle: "name-contact" },
        accentColor: null,
        textColor: null,
      },
    } as unknown as TemplateDto
    const result = getOrderedSections(sections, template)
    expect(result.map((s) => s.sectionType)).toEqual(["SKILLS", "EDUCATION", "WORK_EXPERIENCE"])
  })
  ```
- [ ] Write test: **two-column preserves user ordering within columns**
  ```typescript
  it("two-column: assigns columns per template but preserves user order within each column", () => {
    // User has reordered: SKILLS before EDUCATION (both are left-column sections in template)
    const sections: ResumeSectionDto[] = [
      { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items: [] },
      { sectionType: "SKILLS", title: "Skills", visible: true, items: [] },
      { sectionType: "EDUCATION", title: "Education", visible: true, items: [] },
    ]
    const template = {
      templateDefinition: {
        layoutType: "two-column",
        layout: {
          sectionOrder: null,
          columns: { left: ["EDUCATION", "SKILLS"], right: ["WORK_EXPERIENCE"] },
          headerStyle: "name-contact",
        },
        accentColor: null,
        textColor: null,
      },
    } as unknown as TemplateDto
    const result = getOrderedSections(sections, template)
    // Left column sections come first, in user order (SKILLS before EDUCATION)
    // Right column sections follow (WORK_EXPERIENCE)
    expect(result.map((s) => s.sectionType)).toEqual(["SKILLS", "EDUCATION", "WORK_EXPERIENCE"])
  })
  ```
- [ ] Write test: **hidden sections excluded regardless of layout**
- [ ] Write test: **null template returns user order unchanged**

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/lib/templateUtils.ts` | Replace sort logic in both single-column and two-column branches |

### Files to Create (NEW)

| File | Notes |
|------|-------|
| `frontend/src/lib/templateUtils.test.ts` | Vitest unit tests for all `getOrderedSections` branches |

### No Backend Changes

This story is **frontend-only**. No Java files, no Flyway migrations, no API changes.

### No Zustand Store Changes

`reorderSections` in `useResumeStore` already updates `currentResume.content.sections` in the correct user-specified order. The bug is purely in `getOrderedSections` re-sorting that array away. No store changes needed.

---

## Critical Implementation Details

### Current `templateUtils.ts` — Full File State

The complete current implementation (as of Story 3.11) is at `frontend/src/lib/templateUtils.ts`:

```typescript
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType

  if (layoutType === "two-column") {
    const left = layout.columns?.left ?? []
    const right = layout.columns?.right ?? []
    const orderedIds = [...left, ...right]
    const inOrder = orderedIds
      .map((id) => visibleSections.find((s) => s.sectionType === id))
      .filter((s): s is ResumeSectionDto => s !== undefined)
    const remaining = visibleSections.filter((s) => !orderedIds.includes(s.sectionType))
    return [...inOrder, ...remaining]
  }

  // single-column and modern-accent
  const sectionOrder = layout.sectionOrder ?? []
  const inOrder = sectionOrder
    .map((id) => visibleSections.find((s) => s.sectionType === id))
    .filter((s): s is ResumeSectionDto => s !== undefined)
  const remaining = visibleSections.filter((s) => !sectionOrder.includes(s.sectionType))
  return [...inOrder, ...remaining]
}
```

After the fix, the `single-column/modern-accent` branch collapses to a single-line return, and the `two-column` branch uses `Set`-based membership filtering instead of template-array mapping.

### Final Implementation — Full Replacement

The complete fixed `getOrderedSections`:

```typescript
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType

  if (layoutType === "two-column") {
    const leftIds = new Set(layout.columns?.left ?? [])
    const rightIds = new Set(layout.columns?.right ?? [])
    const leftSections = visibleSections.filter((s) => leftIds.has(s.sectionType))
    const rightSections = visibleSections.filter((s) => rightIds.has(s.sectionType))
    const unassigned = visibleSections.filter(
      (s) => !leftIds.has(s.sectionType) && !rightIds.has(s.sectionType)
    )
    return [...leftSections, ...rightSections, ...unassigned]
  }

  // single-column and modern-accent: user array order wins
  return visibleSections
}
```

The doc comment at the top of the file should be updated to reflect the new behaviour (remove the reference to `layout.sectionOrder` as a sort key for single-column).

### `ResumeCanvas.tsx` — No Change Required

`ResumeCanvas.tsx` determines left vs right column assignment for the two-column grid by checking `template?.templateDefinition?.layout?.columns?.left?.includes(section.sectionType)` directly on each section — it does NOT rely on the position in the `getOrderedSections` result for column assignment. Therefore, changing the order returned by `getOrderedSections` only changes render order within each column, not which column a section belongs to.

### Why the Bug Exists

`getOrderedSections` was written before `SectionsPanel` drag-to-reorder existed. The template `sectionOrder` was used as a definitive ordering source. Once users could reorder via drag-and-drop (Story 3.5 / 3.10), the store's `reorderSections` correctly updated `currentResume.content.sections`, but `getOrderedSections` then re-sorted that array using the template arrays — silently discarding the user's order.

### Test Import Pattern

```typescript
import { describe, it, expect } from "vitest"
import { getOrderedSections } from "./templateUtils"
import type { ResumeSectionDto, TemplateDto } from "@/types/api"
```

No mocking needed — `getOrderedSections` is a pure function.

---

## Dev Notes

The fix is intentionally minimal: delete 6 lines, replace 7 lines. The `sectionOrder` field in template definitions is not removed from the data model — it is simply no longer used by `getOrderedSections` as a sort key. It may still serve as a reference for what sections a template "expects", and future features (e.g., "reset to template default order") could use it.

The two-column fix uses `Set` for O(1) membership lookups instead of `Array.includes`. The `unassigned` sections append to the right column because `getOrderedSections` returns a flat array and `ResumeCanvas` splits by left-column membership — anything not in `columns.left` renders in the right column. Appending unassigned at the end means they appear at the bottom of the right column.

---

## File List

### To Create
- `frontend/src/lib/templateUtils.test.ts`

### To Modify
- `frontend/src/lib/templateUtils.ts`

---

## Change Log
- 2026-06-10: Story created
