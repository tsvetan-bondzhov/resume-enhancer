# Story 9.5: Eliminate Duplicate & Redundant Code — Nested Ternaries & Dead Assignments

**Status:** done
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-5-duplicate-and-redundant-code
**Dependencies:** None (9.4 done; 9.5 touches frontend-only files — no shared files with Java stories)

---

## Story

As a developer,
I want nested ternary expressions extracted into readable conditional logic and redundant variable assignments removed,
So that the code is immediately comprehensible and the duplication/redundancy violations are resolved.

---

## Acceptance Criteria

**AC1 — Nested ternary in `ResumeCanvas.tsx` extracted to `if/else` (S3358)**
**Given** `ResumeCanvas.tsx` lines 172–269 contain a JSX ternary-in-ternary of the form:
```tsx
isLoading ? <skeleton/> : document === null ? <empty article/> : <full render/>
```
**When** the fix is applied
**Then** the three-way conditional is rewritten as an explicit `if` guard that returns the skeleton early, a second `if` guard that returns the empty article early, and the remaining JSX is the happy-path return; no nested ternary `a ? b : c ? d : e` remains in the file; the rendered output for all three states (loading, null document, populated document) is identical to the current output

**AC2 — Redundant `className` assignment removed in `ProfilePage.tsx` (S4165)**
**Given** `ProfilePage.tsx` line 242 initialises `let className = "text-zinc-400 font-normal"` and line 244 immediately overwrites it with the same string `"text-zinc-400 font-normal"` in the `index < currentStep` branch, making the initial assignment dead on that code path
**When** the fix is applied
**Then** the dead first assignment is removed; `className` is declared with `let` but without an initialiser, or is initialised to the value used only on the `else` fall-through path; all three visual states (unvisited, completed, current) continue to produce the correct CSS class string; no `S4165` violation remains at line 242/251

**AC3 — Duplicate imports merged (S3863)**
**Given** the epic identifies 2 duplicate import violations (S3863) in files under `frontend/src/`
**When** the developer scans for duplicate import statements (same module path imported twice in the same file)
**Then** if any S3863 violations exist, the two import statements for the same module path are merged into one; if SonarQube shows 0 open S3863 violations (as confirmed in the current live scan), the developer documents this in the change log as "no S3863 violations found in current codebase — already resolved" and takes no file action

**AC4 — No regressions**
**Given** the story is implemented
**When** `cd frontend && npm run lint` is executed
**Then** ESLint exits with 0 errors

**When** `cd frontend && npm run test` (Vitest) is executed
**Then** all existing tests pass; `ResumeCanvas.test.tsx` tests for loading state, null document, and populated document all pass; `ProfilePage.test.tsx` step navigation tests all pass; no new test failures introduced

---

## Tasks / Subtasks

### Task 1: Extract nested ternary in `ResumeCanvas.tsx` (AC1 — S3358)

**File:** `frontend/src/components/resume/ResumeCanvas.tsx`

**Current violation (lines 172–269) — nested ternary spanning the entire JSX return:**

```tsx
return (
  <div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">
    {isLoading ? (
      <div id="resume-canvas" ...>  {/* skeleton */}
        ...
      </div>
    ) : document === null ? (
      <article id="resume-canvas" .../>  {/* empty */}
    ) : (
      <>
        {/* hidden measurement container + page stack */}
      </>
    )}
  </div>
)
```

**Required change — extract into early-return helper or split into named variables:**

The cleanest approach that keeps a single `return` statement (required for hooks rules) is to assign each branch to a named variable:

```tsx
let canvasContent: React.ReactNode

if (isLoading) {
  canvasContent = (
    <div
      id="resume-canvas"
      aria-label="Resume preview loading"
      className="bg-white shadow-lg w-full max-w-[794px] p-8 space-y-6"
    >
      <Skeleton className="h-6 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
} else if (document === null) {
  canvasContent = (
    <article
      id="resume-canvas"
      aria-label="Resume preview"
      style={rootStyle}
      className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]"
    />
  )
} else {
  canvasContent = (
    <>
      {/* Hidden measurement container — off-screen, aria-hidden, full A4 width */}
      <div
        ref={contentRef}
        style={{ position: "absolute", left: "-9999px", visibility: "hidden", width: "794px", ...rootStyle }}
        aria-hidden="true"
        className="p-8"
      >
        ...
      </div>
      {/* Visible page stack */}
      <div id="resume-canvas" className="flex flex-col items-center gap-4 w-full">
        ...
      </div>
    </>
  )
}

return (
  <div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">
    {canvasContent}
  </div>
)
```

**Implementation checklist:**
- [x] Place the `if/else if/else` block immediately before the `return` statement (after all hooks and computed values — hooks must not be called inside conditionals)
- [x] Copy the skeleton JSX verbatim into the `isLoading` branch — do NOT simplify it
- [x] Copy the empty article JSX verbatim into the `document === null` branch
- [x] Copy the full `<>...</>` fragment (hidden measurement container + page stack) verbatim into the `else` branch
- [x] Replace the single `return (...)` body to `return (<div ...>{canvasContent}</div>)` 
- [x] Verify: the outer wrapper `<div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">` is preserved unchanged
- [x] Verify: no hook calls (`useState`, `useEffect`, `useCallback`, `useRef`) are inside the `if/else` block — all hooks remain at the top of the function

---

### Task 2: Remove redundant `className` assignment in `ProfilePage.tsx` (AC2 — S4165)

**File:** `frontend/src/pages/ProfilePage.tsx`

**Current violation (lines 241–247):**

```tsx
{STEPS.map((label, index) => {
  let className = "text-zinc-400 font-normal" // unvisited  ← DEAD: overwritten on all paths that read it
  if (index < currentStep) {
    className = "text-zinc-400 font-normal" // completed — muted, no strikethrough  ← SAME VALUE
  } else if (index === currentStep) {
    className = "font-semibold text-zinc-900" // current — highlighted
  }
  return (
    <li
      key={label}
      className={`${className} cursor-pointer select-none`}
```

SonarQube S4165 flags line 251 (in the current file): the initial assignment `"text-zinc-400 font-normal"` is redundant because the `index < currentStep` branch immediately overwrites it with the **same** string value.

**Required change — remove the initialiser OR restructure to use a ternary/const:**

Option A (remove redundant initialiser, keep `let`):
```tsx
{STEPS.map((label, index) => {
  let className: string
  if (index === currentStep) {
    className = "font-semibold text-zinc-900" // current — highlighted
  } else {
    className = "text-zinc-400 font-normal" // unvisited or completed — muted
  }
  return (
    <li
      key={label}
      className={`${className} cursor-pointer select-none`}
```

Note: The original `index < currentStep` branch and the `unvisited` fall-through used the same string. Merging them into one `else` is functionally identical and removes the dead initial assignment.

Option B (const with ternary — acceptable since the logic is simple):
```tsx
{STEPS.map((label, index) => {
  const className = index === currentStep
    ? "font-semibold text-zinc-900"
    : "text-zinc-400 font-normal"
  return (
    <li
      key={label}
      className={`${className} cursor-pointer select-none`}
```

**Preferred: Option B** — clearer, removes the `let` mutation entirely, no S4165 risk. The unvisited and completed step share the same visual style (`text-zinc-400 font-normal`), so the only distinction is "current" vs "everything else".

**Implementation checklist:**
- [x] Replace the `let className = ...` block with the const ternary (Option B preferred)
- [x] Verify: step at `index < currentStep` (completed) renders `text-zinc-400 font-normal` — unchanged
- [x] Verify: step at `index > currentStep` (unvisited) renders `text-zinc-400 font-normal` — unchanged
- [x] Verify: step at `index === currentStep` renders `font-semibold text-zinc-900` — unchanged
- [x] Do NOT change any other part of the `<li>` element (role, tabIndex, onKeyDown, aria attributes)

---

### Task 3: Scan and document S3863 (duplicate imports) status (AC3)

**Current live SonarQube state:** The full open-issues scan (run 2026-06-11) returns 0 open S3863 violations. The epic's 2 S3863 issues from the original analysis were likely resolved incidentally by earlier stories.

**Required action:**
- [x] Run `grep -rn "^import.*from" frontend/src/ | sort | awk -F: '{print $1, $3}' | sort | uniq -d` (or equivalent) to confirm no duplicate imports exist
- [x] If 0 duplicates found: add a note to the change log — "S3863: 0 violations confirmed in codebase scan; no file changes required"
- [x] If any duplicates found: merge the two import statements for the same module path into one combined import

---

### Task 4: Run lint and tests (AC4)

- [x] `cd frontend && npm run lint` — must exit 0
- [x] `cd frontend && npm run test` (Vitest) — all tests must pass
- [x] Specifically verify `ResumeCanvas.test.tsx` — tests that render loading state, null document, and populated document must still pass after the JSX restructure in Task 1
- [x] Specifically verify `ProfilePage.test.tsx` — step navigation / className tests must pass after Task 2

---

## Dev Notes & Guardrails

### CRITICAL: Pure Structural Changes Only

This is SonarQube **style/readability** remediation. Zero behavior changes:
- `ResumeCanvas.tsx` renders identically in all three states (loading / null / populated) before and after the refactor — only the JSX structure changes from nested ternary to named variable
- `ProfilePage.tsx` step styling is identical — `"text-zinc-400 font-normal"` for all non-current steps, `"font-semibold text-zinc-900"` for the current step

### S3358 — What SonarQube Flags

SonarQube S3358 flags ternary expressions of the form `a ? b : c ? d : e` (ternary inside the else-branch of another ternary). In `ResumeCanvas.tsx`, the violation spans lines 198–269 — the entire JSX ternary block inside the `return`. The fix is explicitly stated in the rule: "Extract this nested ternary operation into an independent statement."

### S4165 — Why the Initial Assignment is Dead

In the current code:
```
let className = "text-zinc-400 font-normal"   // assignment #1
if (index < currentStep) {
  className = "text-zinc-400 font-normal"     // assignment #2 — same value as #1
}
```
Assignment #1 is "dead" on the `index < currentStep` code path because it is unconditionally overwritten by assignment #2 before being read. SonarQube S4165 detects this: the variable is assigned a value that is redundant because every execution path that matters overwrites it before first read (or overwrites with the same value).

### Hook Rules — Hooks Must Remain at Top Level

In `ResumeCanvas.tsx`, all hooks are called unconditionally at the top of the function body:
- `useState` (template, pageCount)
- `useRef` (contentRef)
- `useEffect` (two of them)
- `useCallback` (renderSections)

The new `if/else if/else` block for `canvasContent` must be placed **after** all of these — immediately before the final `return`. Do NOT move any hook call into or after the conditional.

### File Locations (Exact Paths)

```
frontend/src/components/resume/ResumeCanvas.tsx        — Task 1 (S3358)
frontend/src/pages/ProfilePage.tsx                     — Task 2 (S4165)
```

### Test Files to Verify

```
frontend/src/components/resume/ResumeCanvas.test.tsx   — Task 1 regression check
frontend/src/pages/ProfilePage.test.tsx                — Task 2 regression check
frontend/src/hooks/useResumeUpload.test.ts             — not modified; run as regression
```

### Previous Story Intelligence (from Story 9.4 — done)

- Frontend lint: `cd frontend && npm run lint` must pass with 0 errors — verified pattern from all prior stories
- Frontend tests: Vitest via `cd frontend && npm run test`
- Commit pattern: `feat(9-5-duplicate-and-redundant-code): <description>`
- This story is **TypeScript/frontend-only** — no Java files touched
- Story 9.3 (done) already fixed accessibility issues in section renderers; those files are not in scope here
- Story 9.1 (done) already fixed cognitive complexity — `useResumeStore.ts` and page files were touched; check current state before editing `ProfilePage.tsx` to avoid re-introducing complexity violations

### SonarQube Rules Being Fixed

| Rule | Name | Count | File(s) | Confirmed in Live Scan |
|------|------|-------|---------|----------------------|
| `typescript:S3358` | Nested ternary | 1 MAJOR | `ResumeCanvas.tsx:198` | Yes — 1 open issue |
| `typescript:S4165` | Redundant assignment | 1 MAJOR | `ProfilePage.tsx:251` | Yes — 1 open issue |
| `typescript:S3863` | Duplicate import | 0–2 MINOR | Unknown files | 0 open issues in live scan |

### What NOT to Change

- Any hook call order in `ResumeCanvas.tsx` — hooks are already at top, keep them there
- The outer wrapper `<div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">` in `ResumeCanvas.tsx` — preserve exactly
- The `renderSections()` `useCallback` body — do NOT move it or change it
- The `ResizeObserver` `useEffect` — untouched
- The template-fetch `useEffect` — untouched
- Any `aria-*` attributes on the `<li>` elements in `ProfilePage.tsx` — the S3863 story (9.3) already added proper ARIA to these; do NOT regress them
- The `onKeyDown` handler on step `<li>` elements — accessibility fix from 9.3; preserve exactly
- `useResumeUpload.ts` — NOT a target of S3358/S4165/S3863; do not modify unless S3863 scan finds a duplicate import there (unlikely)
- `frontend/src/components/ui/` — shadcn-managed; never edited
- All Java backend files — this story is frontend-only

### Confirmed Violations Not in Scope for This Story

The live SonarQube scan shows many other open violations (S6759, S6848, S7735, S4325, S1612, etc.). These belong to other stories:
- S6759 (read-only props) → Story 9.11
- S6848 (non-native interactive elements) → Story 9.3 (partial — some remain; deferred)
- S7735 (negated conditions) → Story 9.9
- S4325 (unnecessary type assertion) → Story 9.7
- S1612 (lambda → method reference) → Story 9.4 (Java) — the SonarQube scan shows 8 open S1612 issues still in `LlmSectionExtractor.java`; these are a known SonarQube cache artifact from before commit `a9fee12`; they will clear on next SonarQube scan

Do NOT fix any violation outside S3358 and S4165 in this story.

---

## Story Completion Status

**Analysis completed:** 2026-06-11
**Files analyzed:** `ResumeCanvas.tsx` (current state), `ProfilePage.tsx` (current state), `useResumeUpload.ts` (current state), `ResumeCanvas.test.tsx`, `ProfilePage.test.tsx`, `useResumeUpload.test.ts`, Stories 9.3 and 9.4 (done), live SonarQube open-issues scan

**Violations confirmed:**
- `ResumeCanvas.tsx`: S3358 (1 nested ternary at lines 172–269) — confirmed in live scan
- `ProfilePage.tsx`: S4165 (1 redundant `className` assignment at lines 241–247) — confirmed in live scan (line 251 in SonarQube's offset)
- S3863: 0 open violations in live scan — scan only; document in change log

**Approach confirmed:** Structural only — assign nested ternary branches to a named variable; simplify className to const ternary. Zero behavior changes.

---

## Dev Agent Record

### Implementation Plan

- Task 1 (S3358): Extracted the nested ternary `isLoading ? ... : document === null ? ... : ...` from the JSX return in `ResumeCanvas.tsx` into a named `let canvasContent: React.ReactNode` variable using `if/else if/else`. All hook calls (`useState`, `useRef`, `useEffect`, `useCallback`) remain at the top of the function, above the new conditional block. The outer wrapper `<div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">` is preserved exactly. All JSX content copied verbatim.
- Task 2 (S4165): Replaced the dead `let className = "text-zinc-400 font-normal"` initialiser + `if/else if` block in `ProfilePage.tsx` with a single `const className = index === currentStep ? "font-semibold text-zinc-900" : "text-zinc-400 font-normal"` ternary (Option B). The `<li>` element's role, tabIndex, onKeyDown, and aria attributes are untouched.
- Task 3 (S3863): Ran grep scan on `frontend/src/` — 0 duplicate import statements found. No file changes required.
- Task 4: `npm run lint` — 0 errors (2 pre-existing warnings in unrelated files). `npm run test` — 189 tests pass across 22 test files, 0 failures.

### Completion Notes

- ✅ AC1: S3358 resolved — no nested ternary `a ? b : c ? d : e` remains in `ResumeCanvas.tsx`; three rendering states (loading skeleton, null document empty article, populated document pages) are functionally identical
- ✅ AC2: S4165 resolved — dead `className` initial assignment removed; all three step visual states (current, completed, unvisited) produce correct CSS class strings via const ternary
- ✅ AC3: S3863 scan completed — 0 violations found in current codebase; documented in change log
- ✅ AC4: ESLint 0 errors; Vitest 189/189 tests pass; no regressions

---

## File List

- `frontend/src/components/resume/ResumeCanvas.tsx` — modified (S3358)
- `frontend/src/pages/ProfilePage.tsx` — modified (S4165)

---

## Change Log

- 2026-06-11: Story 9.5 created — SonarQube remediation for S3358 (1 violation in ResumeCanvas.tsx), S4165 (1 violation in ProfilePage.tsx), S3863 (0 live violations — scan only). Live SonarQube scan performed and violation locations pinpointed.
- 2026-06-11: Story 9.5 implemented — S3358 fixed in ResumeCanvas.tsx (nested ternary extracted to `canvasContent` if/else if/else); S4165 fixed in ProfilePage.tsx (dead className initialiser replaced with const ternary); S3863: 0 violations confirmed in codebase scan, no file changes required. ESLint 0 errors, Vitest 189/189 passed.
