# Story 4.3: Dashboard Resume Card Live Preview

**Status:** done
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-3-dashboard-resume-card-live-preview
**Dependencies:** Story 3.15 (done), Story 3.10 (done)

---

## Story

As a user on the dashboard,
I want each resume card to show a scaled-down visual preview of the actual resume content,
So that I can identify my resumes at a glance without needing to open them.

---

## Acceptance Criteria

**AC1 — ResumeDashboardCard renders a scaled-down read-only ResumeCanvas**
**Given** `ResumeDashboardCard` renders a `ResumeDto`
**When** the card mounts
**Then** the existing gray placeholder `<div className="aspect-[1/1.414] w-full bg-zinc-100 ...">` is replaced with a preview wrapper that contains a `<ResumeCanvas>` component; no `onTitleChange` or `onFieldChange` props are passed (read-only mode); the `ResumeCanvas` renders its content inside the card's preview area

**AC2 — Preview uses actual resume content**
**Given** `ResumeDashboardCard` receives a `ResumeDto` with `content` and `templateId`
**When** `ResumeCanvas` renders
**Then** `ResumeCanvas` is passed `document={resume.content}` and `templateId={resume.templateId}`; no new API calls are made from `ResumeDashboardCard` — the `ResumeDto` already contains `content` (verified: `GET /api/v1/resumes` returns full `ResumeDto` with `content` field typed in `types/api.ts`)

**AC3 — Preview scales to fit card**
**Given** the `ResumeCanvas` renders at its natural A4 width
**When** it is placed inside the card's preview area
**Then** the preview wrapper has a fixed clipping height and clips overflow; the inner div containing `ResumeCanvas` is transformed with `transform: scale(...)` and `transform-origin: top left` so the full-size A4 render is visually scaled down to fill the card width; the preview is not distorted (aspect ratio is preserved by the scale transform); exact scale factor: `ResumeCanvas` renders at `max-w-[794px]` but the outer wrapper has `w-full` on the card; the scale factor should be approximately `cardWidth / 794` — implement using a `ref` to measure the wrapper width, or use a fixed scale of `0.3` as an initial reasonable approximation (see implementation note below)

**AC4 — Preview is non-interactive**
**Given** the preview area renders
**When** a user hovers or clicks within the preview area
**Then** `pointer-events-none` is applied to the preview wrapper div; clicking on the card still triggers `onOpen` via the parent card's `onClick`; the `ResumeCanvas` never receives focus or interactive events through the preview

**AC5 — Existing card layout preserved**
**Given** the preview is integrated
**When** the card renders
**Then** the info bar below the preview (resume name, "Tailored"/"Base" badge, date, hover action buttons) is unchanged; the card's `rounded-xl border` and hover shadow are unchanged; the overall card height increases only because the preview replaces the same `aspect-[1/1.414]` placeholder area

**AC6 — `ResumeCanvas` internal loading state handled gracefully**
**Given** `ResumeCanvas` fetches the template via `GET /api/v1/resume-templates/{templateId}`
**When** that fetch is in progress
**Then** `ResumeCanvas` renders its skeleton state (already handled internally); no external loading guard is needed in `ResumeDashboardCard`; pass `isLoading={false}` explicitly to prevent the canvas skeleton from showing when `resume.content` is already present

---

## Tasks / Subtasks

### Task 1: Update `ResumeDashboardCard.tsx` — replace placeholder with scaled ResumeCanvas (AC: 1, 2, 3, 4, 5, 6)

- [x] Open `frontend/src/components/resume/ResumeDashboardCard.tsx`
- [x] Add import:
  ```tsx
  import ResumeCanvas from "@/components/resume/ResumeCanvas"
  ```
- [x] Replace the existing placeholder block:
  ```tsx
  {/* Mini preview area — A4 aspect ratio placeholder */}
  <div className="aspect-[1/1.414] w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center rounded-t-xl overflow-hidden">
    <span className="text-xs text-zinc-400 select-none px-4 text-center line-clamp-2">
      {resume.name}
    </span>
  </div>
  ```
  With the scaled preview:
  ```tsx
  {/* Mini preview area — scaled-down live ResumeCanvas */}
  <div className="relative w-full overflow-hidden rounded-t-xl bg-white" style={{ height: "200px" }}>
    <div
      className="pointer-events-none absolute top-0 left-0 origin-top-left"
      style={{ transform: "scale(0.3)", width: `${100 / 0.3}%` }}
    >
      <ResumeCanvas
        document={resume.content}
        templateId={resume.templateId}
        isLoading={false}
      />
    </div>
  </div>
  ```
- [x] Rationale for `width: ${100 / 0.3}%` on the inner div: `ResumeCanvas` is designed for full-width rendering and uses `max-w-[794px]` internally. When the outer wrapper is narrow (card width ~220px), scaling down by 0.3 means the inner div must be `100% / 0.3 ≈ 333%` wide so that after `scale(0.3)` it occupies 100% of the outer div's width. This allows the canvas to render at its natural size, then scale down.
- [x] `pointer-events-none` is on the inner transformed div — the outer clipping wrapper does not need it (the parent card's `onClick` handles navigation)
- [x] Do NOT pass `onTitleChange` or `onFieldChange` — `ResumeCanvas` renders read-only when these are absent

### Task 2: Verify `DashboardPage.tsx` passes complete `ResumeDto` (AC: 2)

- [x] Open `frontend/src/pages/DashboardPage.tsx`
- [x] Confirm `ResumeDashboardCard` already receives the full `ResumeDto` object (line 159: `resume={resume}`) — **no changes required**; `resume` is typed as `ResumeDto` which includes the `content: ResumeDocumentDto` field; the `GET /api/v1/resumes` API response includes full content (confirmed by `ResumeDto` type in `types/api.ts`)
- [x] This task is a verification step only — no code changes

### Task 3: Add/update `ResumeDashboardCard.test.tsx` — verify ResumeCanvas rendered inside preview (AC: 1, 4)

- [x] Check if `frontend/src/pages/DashboardPage.test.tsx` already covers `ResumeDashboardCard` rendering, or create `frontend/src/components/resume/ResumeDashboardCard.test.tsx`
- [x] Mock `ResumeCanvas` to avoid API calls in the test:
  ```tsx
  vi.mock("@/components/resume/ResumeCanvas", () => ({
    default: vi.fn(() => <div data-testid="resume-canvas-mock" />),
  }))
  ```
- [x] Write test verifying `ResumeCanvas` is rendered inside the card:
  ```tsx
  it("renders ResumeCanvas inside the preview area", () => {
    const resume: ResumeDto = {
      id: "r1",
      name: "My Resume",
      templateId: "t1",
      content: { sections: [] },
      isTailored: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    render(
      <ResumeDashboardCard
        resume={resume}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByTestId("resume-canvas-mock")).toBeInTheDocument()
  })
  ```
- [x] Write test verifying the preview wrapper has `pointer-events-none` on the scaled inner div:
  ```tsx
  it("preview inner div has pointer-events-none", () => {
    // ...same resume setup...
    const { container } = render(<ResumeDashboardCard ... />)
    const pointerNoneDiv = container.querySelector(".pointer-events-none")
    expect(pointerNoneDiv).toBeInTheDocument()
  })
  ```
- [x] Write test verifying action buttons and info bar still render:
  ```tsx
  it("preserves resume name and action buttons", () => {
    // ...render same resume...
    expect(screen.getByText("My Resume")).toBeInTheDocument()
    expect(screen.getByLabelText("Open resume")).toBeInTheDocument()
    expect(screen.getByLabelText("Delete resume")).toBeInTheDocument()
  })
  ```

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/components/resume/ResumeDashboardCard.tsx` | Replace placeholder with scaled `ResumeCanvas` |

### Files to Create (NEW)

| File | Notes |
|------|-------|
| `frontend/src/components/resume/ResumeDashboardCard.test.tsx` | Tests for live preview rendering |

### No Backend Changes

This story is **frontend-only**. No Java files, no Flyway migrations, no API changes.

### Critical Implementation Details

**Scale factor and inner div width:**
The `transform: scale(0.3)` shrinks the canvas to 30% of its natural size. Because `transform` does not affect layout (the element still occupies its pre-transform size in the flow), the inner div must be given an explicit width to make the canvas render at a wide enough size before scaling. Setting `width: ${100 / 0.3}%` = `~333%` on the inner div means the canvas attempts to fill that div at full width, then scale(0.3) brings it to 100% of the outer clipping div.

The `origin-top-left` transform origin ensures the scaled canvas aligns to the top-left corner of the clipping wrapper, matching the expected "top of document" preview behavior.

**Fixed `height: 200px` on clipping wrapper:**
The clipping wrapper uses a fixed pixel height rather than `aspect-ratio` to avoid the preview area changing height based on viewport width. 200px provides enough vertical space to show the top portion of the resume (header, first 1–2 sections) at the 0.3 scale. This is sufficient to distinguish resumes visually.

**`ResumeCanvas` internal padding and centering:**
`ResumeCanvas` renders its content wrapped in `<div className="h-full overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">`. At 0.3 scale inside a 200px container, the gray `bg-zinc-100` background and the white A4 card will both be visible. The `overflow-y-auto` on `ResumeCanvas` will not scroll because the outer wrapper has `overflow-hidden`. This is intentional — the preview shows only the top of the resume.

**`isLoading={false}`:**
Passing `isLoading={false}` explicitly to `ResumeCanvas` prevents the skeleton render path (`isLoading ? <Skeleton>` block) from showing. The card already has `resume.content` (the full `ResumeDocumentDto`) and does not need to indicate a loading state for content that is already present.

**Template fetch inside ResumeCanvas:**
`ResumeCanvas` will make a `GET /api/v1/resume-templates/{templateId}` call internally when `templateId` is non-null. This means each card on the dashboard triggers a template fetch. If performance becomes a concern in a future story, consider lifting template data into a cache. For this story, the per-card fetch is acceptable — templates are small payloads and browser HTTP caching applies.

**`DashboardPage.tsx` — no changes needed:**
`DashboardPage.tsx` line 159 already passes `resume={resume}` where `resume: ResumeDto`. The `ResumeDto` type includes `content: ResumeDocumentDto`. No prop drilling changes are required.

**Mock in tests:**
`ResumeCanvas` must be mocked in `ResumeDashboardCard.test.tsx` to prevent the `apiClient.get` call for the template from running in the test environment and causing unresolved promises. Use `vi.mock("@/components/resume/ResumeCanvas", ...)`.

---

## Dev Notes

- The scale factor of 0.3 is a reasonable starting point. If the preview is too small or too large at common card widths (~220px in a 4-column grid), the value can be adjusted. A more accurate approach is to measure the container width with a `ResizeObserver` and compute `scale = containerWidth / 794` dynamically — but this adds complexity. The fixed 0.3 is simpler and sufficient for the current grid layout.
- `ResumeCanvas` already supports read-only rendering when `onTitleChange`/`onFieldChange` are absent (Story 3.15, AC6). No new read-only mode logic is required.
- The inner div's `width: ${100 / scale}%` pattern avoids hardcoding pixel widths that would break when the card is resized (e.g. responsive grid column changes). Expressing it as a percentage keeps it proportional.

---

## File List

### To Create
- `frontend/src/components/resume/ResumeDashboardCard.test.tsx`

### To Modify
- `frontend/src/components/resume/ResumeDashboardCard.tsx`

---

## Dev Agent Record

### Implementation Notes

- Task 1: Added `ResumeCanvas` import to `ResumeDashboardCard.tsx`; replaced the static `aspect-[1/1.414]` placeholder with a 200px clipping wrapper containing a `scale(0.3)` inner div with `pointer-events-none`. Inner div width set to `${100/0.3}%` so canvas renders at natural width before scaling. `isLoading={false}` passed explicitly. No `onTitleChange`/`onFieldChange` passed — read-only mode.
- Task 2: Verified `DashboardPage.tsx` already passes full `ResumeDto` (including `content`) to `ResumeDashboardCard`. No changes required.
- Task 3: Created `ResumeDashboardCard.test.tsx` with 5 tests covering AC1 (`ResumeCanvas` rendered), AC4 (`pointer-events-none` on inner div, outer wrapper unaffected), AC5 (info bar preserved). `ResumeCanvas` mocked via `vi.mock` to prevent `apiClient` calls. All 5 tests pass; full 147-test suite passes with 0 regressions; lint 0 errors.

### Completion Notes

AC1 ✅ — `ResumeCanvas` replaces the gray placeholder in `ResumeDashboardCard`
AC2 ✅ — `document={resume.content}` and `templateId={resume.templateId}` passed; no extra API calls from card
AC3 ✅ — `scale(0.3)` + `width: 333%` inner div + 200px clipping outer wrapper achieves visual scale-to-fit
AC4 ✅ — `pointer-events-none` on inner div; outer wrapper allows parent card `onClick` to fire
AC5 ✅ — Info bar (name, badge, date, action buttons) unchanged; card border/shadow unchanged
AC6 ✅ — `isLoading={false}` passed explicitly; no skeleton shown when content is already present

---

## Tasks / Subtasks (Review Findings)

### Review Findings

- [x] [Review][Patch] Extract `PREVIEW_SCALE` constant — magic number `0.3` duplicated in two style props; extracted to `const PREVIEW_SCALE = 0.3` [ResumeDashboardCard.tsx] — **applied**
- [x] [Review][Patch] Replace `bg-white` with `bg-card` design token — hardcoded white breaks dark-mode card consistency [ResumeDashboardCard.tsx:28] — **applied**
- [x] [Review][Patch] Add `aria-hidden="true"` to outer preview wrapper — decorative ResumeCanvas was traversable by screen readers [ResumeDashboardCard.tsx:28] — **applied**

---

## Change Log

- 2026-06-10: Story created
- 2026-06-10: Implemented — replaced placeholder with scaled `ResumeCanvas`, added `ResumeDashboardCard.test.tsx` (5 tests), all ACs satisfied
- 2026-06-10: Code review — 3 patches applied (PREVIEW_SCALE constant, bg-card token, aria-hidden); all 6 ACs verified ✅; 147 tests pass; lint 0 errors → status: done
