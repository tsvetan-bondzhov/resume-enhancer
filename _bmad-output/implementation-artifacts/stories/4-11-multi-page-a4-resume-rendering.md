# Story 4.11: Multi-Page A4 Resume Rendering

**Status:** backlog
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-11-multi-page-a4-resume-rendering
**Dependencies:** Story 3.4 (done), Story 3.10 (done), Story 4.2 (backlog — classic template two-column layout must be settled first)

---

## Story

As a user previewing or editing a resume,
I want the resume canvas to display content across multiple A4-sized pages instead of stretching indefinitely,
So that I can accurately see how my resume will look when exported or printed.

---

## Acceptance Criteria

**AC1 — Multiple A4 page containers when content overflows**
**Given** `ResumeCanvas` renders a resume whose content exceeds one A4 page height
**When** the component mounts and content height is measured
**Then** multiple `<article>` elements are rendered, each with the same white background and shadow as the current single-page article; each has `aria-label="Resume page N"` where N is the 1-based page number; the outermost wrapper `id="resume-canvas"` is preserved on a wrapping `<div>` (not on any individual page article)

---

**AC2 — Page height is 297mm at the current scale factor**
**Given** the canvas renders at a given `scaleRatio`
**When** page containers are sized
**Then** each page has an explicit height in CSS pixels equal to `297 * scaleRatio` mm converted to pixels. The current canvas uses `max-w-[794px]` for A4 width (210mm at 96dpi ≈ 794px). The equivalent height is `297 / 210 * 794 ≈ 1123px`. Each page container has `height: 1123px` (or computed from the current `max-w` value if dynamic). Width remains `max-w-[794px]`.

---

**AC3 — Visible gap between pages**
**Given** multiple pages are rendered
**When** displayed in the scrollable canvas container
**Then** pages are separated by a `gap-4` (16px) space showing the `bg-zinc-200` outer container background, so the user can visually distinguish page boundaries.

---

**AC4 — `break-inside: avoid` on section item wrappers**
**Given** section renderer item wrappers are updated
**When** content flows across pages
**Then** each individual item wrapper in every section renderer has `break-inside: avoid` applied (via `className="break-inside-avoid"` Tailwind utility). Items taller than a full page still render in full — no truncation.

---

**AC5 — Single page for short content**
**Given** the full resume content fits within one A4 page height
**When** the component mounts
**Then** exactly one page container is rendered. No empty second page appears.

---

**AC6 — Both single-column and two-column layouts paginate correctly**
**Given** the resume uses any of the three template layout types (`single-column`, `two-column`, `modern-accent`)
**When** the multi-page logic runs
**Then** pagination works for all layouts. The CSS grid for two-column layout is applied per-page (each page `<article>` gets the grid class and style, not just the first).

---

**AC7 — Tests**
**Given** the story is implemented
**When** `ResumeCanvas.test.tsx` runs
**Then**:
- Test: fixture with mock content where the injected content height measurement resolves to more than one page worth → asserts more than one `article` element rendered in the DOM
- Test: fixture with short content → asserts exactly one `article[aria-label="Resume page 1"]` rendered
- Existing tests for CSS variable injection, section order, hidden sections, and two-column layout continue to pass

---

## Tasks / Subtasks

### Task 1: Implement page measurement and multi-page rendering in `ResumeCanvas.tsx` (AC: 1, 2, 3, 5, 6)

- [ ] Open `frontend/src/components/resume/ResumeCanvas.tsx`

- [ ] **Chosen approach:** Use a `ResizeObserver`-based measurement on a hidden off-screen render. The implementation proceeds in two phases:
  1. Render all resume content into a single hidden `<div>` (positioned off-screen via `position: absolute; left: -9999px; visibility: hidden`) to measure total rendered height.
  2. Based on measured height vs. page height, compute `pageCount = Math.ceil(measuredHeight / pageHeightPx)`.
  3. Re-render as N page `<article>` elements, each with `height: pageHeightPx` and `overflow: hidden`, containing an inner div that is absolutely positioned at `top: -(pageIndex * pageHeightPx)` to show each page's slice of the content.

- [ ] Add a `pageHeightPx` constant or compute it from A4 aspect ratio:
  ```tsx
  // A4: 210mm × 297mm. max-w-[794px] ≈ 210mm at 96dpi.
  // Page height in px = 794 * (297 / 210) ≈ 1123
  const PAGE_HEIGHT_PX = Math.round(794 * (297 / 210)) // 1123
  ```

- [ ] Add state: `const [pageCount, setPageCount] = useState(1)` and a `contentRef = useRef<HTMLDivElement>(null)`.

- [ ] Add a `useEffect` that observes the hidden content container height with `ResizeObserver`:
  ```tsx
  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0
      setPageCount(Math.max(1, Math.ceil(height / PAGE_HEIGHT_PX)))
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [document, template])
  ```

- [ ] Render structure (non-loading, non-null document path):
  ```tsx
  <>
    {/* Hidden measurement container */}
    <div
      ref={contentRef}
      style={{ position: "absolute", left: "-9999px", visibility: "hidden", width: "794px" }}
      aria-hidden="true"
    >
      {/* same section content as the current article body */}
      {renderSections()}
    </div>

    {/* Visible page containers */}
    <div id="resume-canvas" className="flex flex-col items-center gap-4">
      {Array.from({ length: pageCount }, (_, i) => (
        <article
          key={i}
          aria-label={`Resume page ${i + 1}`}
          style={{ ...rootStyle, height: PAGE_HEIGHT_PX, overflow: "hidden", position: "relative" }}
          className={layoutType === "two-column"
            ? "bg-white shadow-lg w-full max-w-[794px] grid gap-4 p-8"
            : "bg-white shadow-lg w-full max-w-[794px] p-8"}
        >
          <div style={{ position: "absolute", top: -(i * PAGE_HEIGHT_PX), left: 0, right: 0, padding: "inherit" }}>
            {renderSections()}
          </div>
        </article>
      ))}
    </div>
  </>
  ```

- [ ] Extract `renderSections()` as an inner function to avoid duplication between the hidden container and visible pages:
  ```tsx
  function renderSections() {
    return (
      <>
        {/* aria live region */}
        {/* modern-accent band */}
        {getOrderedSections(document.sections ?? [], template).map((section) => (
          <div key={section.sectionType} style={...}>
            <ResumeSection ... />
          </div>
        ))}
      </>
    )
  }
  ```

- [ ] The outer scrollable container `<div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">` is unchanged. The `id="resume-canvas"` moves from the single `<article>` to the wrapping `<div>` that holds the page stack.

- [ ] For the null-document case (empty preview): render a single `<article id="resume-canvas">` as before (no change).

- [ ] For the loading case: render the skeleton as before (no change).

### Task 2: Add `break-inside-avoid` to section item wrappers (AC: 4)

Apply `className="break-inside-avoid"` to the outermost wrapper element of each repeated item in all section renderers:

- [ ] `WorkExperienceSectionRenderer.tsx` — add `break-inside-avoid` to the per-item container `<div>`
- [ ] `EducationSectionRenderer.tsx` — add `break-inside-avoid` to the per-item container `<div>`
- [ ] `CertificationsSectionRenderer.tsx` — add `break-inside-avoid` to the per-item container
- [ ] `ProjectsSectionRenderer.tsx` — add `break-inside-avoid` to the per-item container
- [ ] `LanguagesSectionRenderer.tsx` — add `break-inside-avoid` to the per-item container
- [ ] `VolunteeringSectionRenderer.tsx` — add `break-inside-avoid` to the per-item container
- [ ] `SkillsSectionRenderer.tsx` — add `break-inside-avoid` to each skill chip/item wrapper
- [ ] `SummarySectionRenderer.tsx` — add `break-inside-avoid` to the contact row + text wrapper

### Task 3: Update tests (AC: 7)

- [ ] Open `frontend/src/components/resume/ResumeCanvas.test.tsx`
- [ ] Add a helper to simulate the `ResizeObserver` callback. Vitest/jsdom does not implement `ResizeObserver` — mock it:
  ```ts
  const mockObserve = vi.fn()
  const mockDisconnect = vi.fn()
  let capturedCallback: ResizeObserverCallback | null = null

  vi.stubGlobal("ResizeObserver", vi.fn((cb: ResizeObserverCallback) => {
    capturedCallback = cb
    return { observe: mockObserve, disconnect: mockDisconnect }
  }))
  ```
- [ ] For the multi-page test:
  - After render, fire the observer callback with `contentRect.height = PAGE_HEIGHT_PX * 2.5` to simulate 3 pages
  - Assert `container.querySelectorAll("article").length` equals 3
  - Assert `container.querySelector("[aria-label='Resume page 1']")` is in the DOM
- [ ] For the single-page test:
  - Fire the observer callback with `contentRect.height = PAGE_HEIGHT_PX * 0.8`
  - Assert exactly one `article` with `aria-label="Resume page 1"`
- [ ] Existing tests: the `id="resume-canvas"` is now on a `<div>`, not an `<article>`. Update any existing selectors that query `article#resume-canvas` to query `#resume-canvas` (the wrapper div). Verify that CSS variable injection tests still work by checking the style attribute of the first `article` element (or the wrapper, depending on where styles are applied).
- [ ] `beforeEach(() => vi.clearAllMocks())` — ensure `ResizeObserver` mock is cleared between tests.

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)
| File | Change |
|------|--------|
| `frontend/src/components/resume/ResumeCanvas.tsx` | Multi-page rendering with ResizeObserver measurement |
| `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/EducationSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/SkillsSectionRenderer.tsx` | `break-inside-avoid` on item wrapper |
| `frontend/src/components/resume/sections/SummarySectionRenderer.tsx` | `break-inside-avoid` on wrapper |
| `frontend/src/components/resume/ResumeCanvas.test.tsx` | Mock `ResizeObserver`; add multi-page and single-page tests |

### Files to Create (NEW)
None.

### Critical Implementation Details

**`id="resume-canvas"` relocation:** The existing test in `ResumeCanvas.test.tsx` queries `container.querySelector("#resume-canvas")` to assert style injection. After this story, `id="resume-canvas"` moves from the `<article>` to the wrapping `<div>`. Existing tests that check for `#resume-canvas` will still find the element but it will be a `<div>`, not an `<article>`. CSS variable inline styles from `rootStyle` should be applied to each page `<article>`, not the wrapper `<div>`. Existing tests that assert `article.getAttribute("style")` should be updated to `container.querySelector("article")?.getAttribute("style")`.

**`ResizeObserver` in jsdom:** jsdom (used by Vitest) does not implement `ResizeObserver`. The test must `vi.stubGlobal("ResizeObserver", ...)` before rendering. The mock must capture the callback passed to the constructor so tests can manually fire it with a fake `contentRect`. Reset with `vi.unstubAllGlobals()` or per-test `vi.clearAllMocks()` in `afterEach`.

**Content duplication between hidden container and pages:** The `renderSections()` helper creates React elements that are rendered twice — once in the hidden measurement div and once per visible page. This is intentional and harmless for a preview component. React reconciles them as separate subtrees. The hidden div is `aria-hidden="true"` so screen readers skip it.

**Two-column grid per page:** For `two-column` layout, the `gridTemplateColumns` inline style must be applied on each page `<article>`, not the outer wrapper. The `leftColumnIds` / `rightColumnIds` section dispatch logic inside `renderSections()` works per-section and is unaffected by the page split.

**Page height constant:** `Math.round(794 * (297 / 210))` = `Math.round(794 * 1.4142...)` = `Math.round(1122.9...)` = 1123px. This constant is correct for 96dpi screens. If the canvas ever becomes zoom-aware, this should be computed from actual rendered dimensions rather than a constant.

**Absolute positioning approach for page slicing:** The inner content div is positioned `top: -(pageIndex * PAGE_HEIGHT_PX)` relative to the clipping article. This is a common technique used by tools like Canva and Resume.io for live preview. It works because the full content is laid out at its natural height in the hidden container; each page article clips a `PAGE_HEIGHT_PX`-sized window into the content via `overflow: hidden`. The trade-off is that content must be re-rendered per page. For typical resume lengths (1-3 pages), this is not a performance concern.

**Why not CSS columns or `@media print`:** CSS `column-*` properties are for newspaper-style flowing text, not fixed-height pages. `@media print` page breaks only apply when printing to PDF — they have no effect on screen preview. The `overflow: hidden` + absolute positioning approach is the industry standard for web-based resume preview.

**Padding in page slice div:** The `p-8` padding on the article and the absolute inner div need care. The inner div's `top` offset must account for where the padded content starts. Two approaches: (a) put padding on the article only (not the inner div) and adjust the top offset by padding; (b) put no padding on the article, put padding on the inner div, and clip the article. Approach (b) is simpler:
```tsx
<article style={{ ..., overflow: "hidden", position: "relative" }} className="bg-white shadow-lg w-full max-w-[794px]">
  <div style={{ position: "absolute", top: -(i * PAGE_HEIGHT_PX), left: 0, right: 0 }} className="p-8">
    {renderSections()}
  </div>
</article>
```
The `p-8` moves to the inner div. The outer article has no padding. This is the recommended approach.

---

## Dev Notes

**Approach decision:** The ResizeObserver + absolute positioning approach was chosen over:
- Pure CSS page-break dividers (no actual clipping, content bleeds across borders)
- JS measurement with `getBoundingClientRect()` in a `useLayoutEffect` (requires DOM flush, less reactive to content changes)
- CSS columns (wrong use case)
- `@media print` (only affects print, not screen preview)

The ResizeObserver approach is reactive: if the user edits content inline and the height changes, the observer fires and `pageCount` updates automatically. This is the correct behavior for a live preview editor.

**Potential issue with the hidden container and Tailwind CSS:** The hidden container is rendered outside the normal DOM tree with `position: absolute; left: -9999px`. Tailwind's JIT scanner should still pick up class names since they appear in the same component file. However, if styles from `cssVars` are only applied to the visible articles (not the hidden container), the measured height may differ slightly from the rendered height. Consider applying `rootStyle` to the hidden container as well for accuracy.

---

## File List

### To Create
None.

### To Modify
- `frontend/src/components/resume/ResumeCanvas.tsx`
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx`
- `frontend/src/components/resume/sections/EducationSectionRenderer.tsx`
- `frontend/src/components/resume/sections/CertificationsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/LanguagesSectionRenderer.tsx`
- `frontend/src/components/resume/sections/VolunteeringSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SkillsSectionRenderer.tsx`
- `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- `frontend/src/components/resume/ResumeCanvas.test.tsx`

---

## Change Log
- 2026-06-10: Story created
