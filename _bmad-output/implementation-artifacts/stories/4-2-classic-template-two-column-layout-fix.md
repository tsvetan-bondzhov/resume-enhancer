# Story 4.2: Classic Template Two-Column Layout Fix

**Status:** backlog
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-2-classic-template-two-column-layout-fix
**Dependencies:** Story 3.10 (done), Story 3.15 (done)

---

## Story

As a user with the Classic template selected,
I want the two resume columns to flow independently,
So that items in the right column are not forced to align row-by-row with items in the left column.

---

## Acceptance Criteria

**AC1 — Two-column layout uses two sibling flex containers**
**Given** `ResumeCanvas` renders with a `two-column` template
**When** sections are mapped to left and right columns
**Then** the `<article id="resume-canvas">` contains exactly two child `<div>` elements: one for the left column and one for the right column; each div has `className` including `flex flex-col gap-4`; they are siblings wrapped in a `<div className="flex gap-6">` outer container

**AC2 — Independent column flow**
**Given** the two sibling flex containers render
**When** the left column has many sections and the right column has few (or vice versa)
**Then** sections in the right column start at the top of their container regardless of left column height; there is no CSS Grid `gridColumn` assignment forcing row alignment

**AC3 — Summary moved to first position in Classic template right column**
**Given** migration `V13__classic_template_summary_in_right_column.sql` is applied
**When** the Classic template (id `11111111-0000-0000-0000-000000000002`) is fetched
**Then** `template_definition->'layout'->'columns'->'right'` equals `["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]`; left column `["SKILLS", "LANGUAGES", "CERTIFICATIONS"]` is unchanged

**AC4 — Column width ratio preserved**
**Given** the two sibling divs render
**When** the template is `two-column`
**Then** the left column div has `className` including `basis-1/3` (or equivalent `flex-none w-1/3`) and the right column div has `className` including `flex-1`; this preserves the approximate 1:2 ratio of the previous grid approach

**AC5 — Single-column and modern-accent layouts unaffected**
**Given** `ResumeCanvas` renders with a `single-column` or `modern-accent` template
**When** sections are mapped
**Then** sections still render as a flat sequence of `<ResumeSection>` components with no flex-container wrapping; the existing behavior is identical to before this story

---

## Tasks / Subtasks

### Task 1: Update `ResumeCanvas.tsx` — replace grid two-column path with two flex containers (AC: 1, 2, 4, 5)

- [ ] Open `frontend/src/components/resume/ResumeCanvas.tsx`
- [ ] Locate the `<article>` className ternary (line 108):
  ```tsx
  className={
    layoutType === "two-column"
      ? "bg-white shadow-lg w-full max-w-[794px] grid gap-4 p-8"
      : "bg-white shadow-lg w-full max-w-[794px] p-8"
  }
  ```
  Change to a single class (remove `grid gap-4` from the two-column branch):
  ```tsx
  className="bg-white shadow-lg w-full max-w-[794px] p-8"
  ```
- [ ] Locate the `rootStyle` two-column branch (line 61–63) that injects `gridTemplateColumns: "1fr 2fr"`:
  ```tsx
  const rootStyle: React.CSSProperties =
    layoutType === "two-column"
      ? { ...baseStyle, color: "var(--text-color, #111827)", gridTemplateColumns: "1fr 2fr" }
      : { ...baseStyle, color: "var(--text-color, #111827)" }
  ```
  Simplify to always use the base style (remove the `gridTemplateColumns` injection):
  ```tsx
  const rootStyle: React.CSSProperties = {
    ...baseStyle,
    color: "var(--text-color, #111827)",
  }
  ```
- [ ] Replace the single `getOrderedSections(...).map(...)` block with a two-path render:
  ```tsx
  {layoutType === "two-column" ? (() => {
    const allSections = getOrderedSections(document.sections ?? [], template)
    const leftSections = allSections.filter(s => leftColumnIds.has(s.sectionType))
    const rightSections = allSections.filter(s => rightColumnIds.has(s.sectionType))
    return (
      <div className="flex gap-6">
        <div className="flex flex-col gap-4 basis-1/3">
          {leftSections.map((section) => (
            <ResumeSection
              key={section.sectionType}
              section={section}
              onTitleChange={(title) => onTitleChange?.(section.sectionType, title)}
              onFieldChange={
                onFieldChange
                  ? (itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)
                  : undefined
              }
            />
          ))}
        </div>
        <div className="flex flex-col gap-4 flex-1">
          {rightSections.map((section) => (
            <ResumeSection
              key={section.sectionType}
              section={section}
              onTitleChange={(title) => onTitleChange?.(section.sectionType, title)}
              onFieldChange={
                onFieldChange
                  ? (itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    )
  })() : (
    getOrderedSections(document.sections ?? [], template).map((section) => (
      <ResumeSection
        key={section.sectionType}
        section={section}
        onTitleChange={(title) => onTitleChange?.(section.sectionType, title)}
        onFieldChange={
          onFieldChange
            ? (itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)
            : undefined
        }
      />
    ))
  )}
  ```
- [ ] Remove the now-unused `style={{ gridColumn: ... }}` wrapper `<div>` from the old `.map()` — it no longer exists in the two-column path
- [ ] The `leftColumnIds` and `rightColumnIds` `Set` derivations (lines 66–67) are still used — keep them

### Task 2: Create Flyway migration `V13__classic_template_summary_in_right_column.sql` (AC: 3)

- [ ] Create `src/main/resources/db/migration/V13__classic_template_summary_in_right_column.sql`:
  ```sql
  -- V13: Move SUMMARY to first position in Classic template right column.
  -- DATA migration only — no DDL changes.
  -- Idempotent: jsonb_set overwrites the target key unconditionally.

  UPDATE resume_templates
  SET template_definition = jsonb_set(
      template_definition,
      '{layout,columns,right}',
      '["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]'::jsonb
  )
  WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;
  ```
- [ ] Verify: the left column array `["SKILLS", "LANGUAGES", "CERTIFICATIONS"]` is NOT touched by this migration (V12 already set it correctly)
- [ ] Naming: must follow Flyway convention `V<N>__<description>.sql` — V13 is the next available number (V1 through V12 are all applied per project context)

### Task 3: Update `ResumeCanvas.test.tsx` — verify two flex containers for two-column (AC: 1, 2, 5)

- [ ] Open `frontend/src/components/resume/ResumeCanvas.test.tsx`
- [ ] Update the existing `"applies grid layout for two-column template"` test (currently asserts `style contains grid-template-columns`) to instead verify the two sibling flex containers:
  ```tsx
  it("renders two sibling flex column containers for two-column template", async () => {
    const template = buildTemplate({
      templateDefinition: {
        layoutType: "two-column",
        cssVariables: { "--accent-color": "#1d4ed8" },
        layout: {
          columns: { left: ["SKILLS"], right: ["WORK_EXPERIENCE"] },
        },
      },
    })
    mockGet.mockResolvedValue(template)
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() => {
      // Outer flex wrapper containing both columns
      const flexWrapper = article.querySelector(".flex.gap-6")
      expect(flexWrapper).toBeInTheDocument()
      // Left column: basis-1/3
      expect(flexWrapper!.querySelector(".basis-1\\/3")).toBeInTheDocument()
      // Right column: flex-1
      expect(flexWrapper!.querySelector(".flex-1")).toBeInTheDocument()
    })
  })
  ```
- [ ] Add a test verifying `grid-template-columns` is NOT in the article style for two-column (style simplification):
  ```tsx
  it("does not inject gridTemplateColumns inline style for two-column template", async () => {
    // ... same setup as above ...
    await waitFor(() => {
      const article = container.querySelector("#resume-canvas")!
      expect(article.getAttribute("style") ?? "").not.toContain("grid-template-columns")
    })
  })
  ```

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/components/resume/ResumeCanvas.tsx` | Replace CSS Grid two-column path with two sibling flex containers; remove `gridTemplateColumns` from `rootStyle` |
| `frontend/src/components/resume/ResumeCanvas.test.tsx` | Update two-column layout test; add flex container assertions |

### Files to Create (NEW)

| File | Notes |
|------|-------|
| `src/main/resources/db/migration/V13__classic_template_summary_in_right_column.sql` | Moves SUMMARY to first in Classic right column |

### No Frontend-Only Constraint

This story has one backend migration (`V13`) and frontend changes to `ResumeCanvas`. No Java service/controller changes.

### Critical Implementation Details

**Why the IIFE pattern for two-column:**
The two-column path needs `leftSections` and `rightSections` derived from `allSections`. Rather than introducing module-level helper functions (which would live outside the component and require threading `template` as an argument), an IIFE inside JSX keeps the derivation local to the render. An alternative is to derive these before the `return` statement in the component body and conditionally render — either approach is acceptable.

**`getOrderedSections` already filters hidden sections:**
The `getOrderedSections(document.sections ?? [], template)` call in `lib/templateUtils.ts` already excludes sections where `visible === false`. The two-column filter/split simply further partitions the result — no additional visibility guard is needed.

**The `leftColumnIds` / `rightColumnIds` Sets:**
These are already derived at lines 66–67:
```ts
const leftColumnIds = new Set(template?.templateDefinition?.layout?.columns?.left ?? [])
const rightColumnIds = new Set(template?.templateDefinition?.layout?.columns?.right ?? [])
```
They use `ResumeSectionType` string values (e.g. `"SKILLS"`, `"WORK_EXPERIENCE"`) after V9 migration renamed all section ids to enum names. The `filter` predicates `s => leftColumnIds.has(s.sectionType)` and `s => rightColumnIds.has(s.sectionType)` are correct.

**Sections not in either column array (two-column mode):**
If a section's `sectionType` is not in `columns.left` or `columns.right` it will not appear in either flex container. This is the same behavior as the previous gridColumn approach (where `gridColumn: undefined` was assigned). The V13 migration adds SUMMARY to the right column, ensuring all active section types are accounted for in the Classic template.

**`rootStyle` simplification:**
After this change, `rootStyle` no longer has the `gridTemplateColumns` conditional. The `color` variable is still injected. The CSS variables from `baseStyle` (e.g. `--accent-color`, `--font-size-base`) continue to be injected on the root `<article>` element.

**Test file — Tailwind class selector escaping:**
The test selector `.basis-1\/3` requires the `/` to be escaped with `\\` in the `querySelector` string because `/` has meaning in CSS selectors. Use `".basis-1\\/3"` in the JS string literal (which produces the selector `.basis-1\/3`).

**V12 migration current Classic column state (for reference):**
After V12, Classic template columns are:
- `left`: `["SKILLS", "LANGUAGES", "CERTIFICATIONS"]`
- `right`: `["WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]`

V13 changes only `right` to prepend `"SUMMARY"`:
- `right`: `["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]`

---

## Dev Notes

- The CSS Grid approach (`gridTemplateColumns: "1fr 2fr"` with `gridColumn: 1` or `2` per section) caused all sections in the same row band to align vertically. Two sibling flex columns solve this by making each column an independent flow — sections stack top-to-bottom within their column with no cross-column row alignment.
- The `basis-1/3` / `flex-1` combination in a `flex gap-6` container approximates the 1:2 ratio. Exact rendered widths depend on the `gap-6` (1.5rem) gutter; `basis-1/3` shrinks by the gutter's share. This is visually close enough to the original 1:2 grid ratio.
- The migration number V13 was determined by inspecting `src/main/resources/db/migration/` — V1 through V12 are all present. Do not guess migration numbers; always verify by listing the directory.

---

## File List

### To Create
- `src/main/resources/db/migration/V13__classic_template_summary_in_right_column.sql`

### To Modify
- `frontend/src/components/resume/ResumeCanvas.tsx`
- `frontend/src/components/resume/ResumeCanvas.test.tsx`

---

## Change Log

- 2026-06-10: Story created
