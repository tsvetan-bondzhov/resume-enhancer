# Story 9.1: Reduce Critical TypeScript Cognitive Complexity & Remove Void Operator

**Status:** done
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-1-typescript-cognitive-complexity-and-void-operator
**Dependencies:** All Epic 4 stories (done) — source files are stable; no concurrent story modifies these files

---

## Story

As a developer,
I want complex TypeScript functions to be broken into smaller, focused units and void-operator misuse to be removed,
So that the codebase is easier to read, maintain, and reason about, and the 11 CRITICAL SonarQube violations are resolved.

---

## Acceptance Criteria

**AC1 — Cognitive complexity ≤ 15 per function (S3776)**
**Given** `ProfilePage.tsx`, `LoginPage.tsx`, `SignupPage.tsx`, and `EditorPage.tsx` contain functions with a cognitive complexity score above 15
**When** refactoring is complete
**Then** every function in those files has a cognitive complexity score ≤ 15; complex conditional blocks are extracted into named helper functions or custom hooks with descriptive names; no logic changes are made — only structural extraction

---

**AC2 — Function nesting depth ≤ 4 (S2004)**
**Given** `ProfilePage.tsx` and `useResumeStore.ts` contain functions nested more than 4 levels deep
**When** refactoring is complete
**Then** no function is nested more than 4 levels deep; inner functions are extracted to module-level helpers or custom hooks where appropriate

---

**AC3 — Void operator removed (S3735)**
**Given** the void operator is used in two locations (confirmed: `void load()` in `EditorPage.tsx` line 64)
**When** refactoring is complete
**Then** all `void expression` patterns are replaced with proper `return;` statements or the fire-and-forget async call is wrapped so the promise is handled; any genuinely intentional fire-and-forget uses `// eslint-disable-next-line @typescript-eslint/no-floating-promises` with a comment documenting intent — do NOT use `void` as the suppression mechanism

---

**AC4 — No regressions**
**Given** the story is implemented
**When** all frontend tests are run (`cd frontend && npm run lint && npx vitest run`)
**Then** all existing tests continue to pass without modification; no regressions are introduced in ProfilePage, LoginPage, SignupPage, EditorPage, or useResumeStore behaviour; ESLint passes with 0 errors

---

## Tasks / Subtasks

### Task 1: Fix `ProfilePage.tsx` — cognitive complexity & nesting depth (AC: 1, 2)

**File:** `frontend/src/pages/ProfilePage.tsx`

The primary violations are in `handleSaveAndContinue` (complexity from the large payload merge object with 14 conditional branches) and possible nesting in the `loadProfile` callback.

- [x] Extract the payload merge logic from `handleSaveAndContinue` into a module-level helper:
  ```tsx
  function mergeProfilePayload(
    partial: Partial<ProfileUpdateRequest>,
    current: ProfileDto
  ): ProfileUpdateRequest {
    return {
      summary: partial.summary !== undefined ? partial.summary : current.summary,
      contactEmail: partial.contactEmail !== undefined ? partial.contactEmail : current.contactEmail,
      linkedInUrl: partial.linkedInUrl !== undefined ? partial.linkedInUrl : current.linkedInUrl,
      personalPageUrl: partial.personalPageUrl !== undefined ? partial.personalPageUrl : current.personalPageUrl,
      blogUrl: partial.blogUrl !== undefined ? partial.blogUrl : current.blogUrl,
      locationCity: partial.locationCity !== undefined ? partial.locationCity : current.locationCity,
      locationCountry: partial.locationCountry !== undefined ? partial.locationCountry : current.locationCountry,
      workExperiences: partial.workExperiences !== undefined ? partial.workExperiences : current.workExperiences,
      education: partial.education !== undefined ? partial.education : current.education,
      skills: partial.skills !== undefined ? partial.skills : current.skills,
      certifications: partial.certifications !== undefined ? partial.certifications : (current.certifications ?? []),
      languages: partial.languages !== undefined ? partial.languages : (current.languages ?? []),
      projects: partial.projects !== undefined ? partial.projects : (current.projects ?? []),
      volunteering: partial.volunteering !== undefined ? partial.volunteering : (current.volunteering ?? []),
    }
  }

  const EMPTY_PROFILE: ProfileDto = {
    summary: null,
    contactEmail: null,
    linkedInUrl: null,
    personalPageUrl: null,
    blogUrl: null,
    locationCity: null,
    locationCountry: null,
    workExperiences: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    projects: [],
    volunteering: [],
  }
  ```

- [x] Replace the inline `const current = profile ?? { ... }` and inline `payload` construction in `handleSaveAndContinue` with:
  ```tsx
  const current = profile ?? EMPTY_PROFILE
  const payload = mergeProfilePayload(partial, current)
  ```

- [x] Verify `handleSaveAndContinue` body now reads as: lock check → setSaving → build payload → API call → update store → conditional toast+step → catch → finally. Complexity should drop well below 15.

- [x] Check `loadProfile` useCallback — it is already simple (set loading → API get → setProfile → resetStep / catch / finally). No extraction needed unless SonarQube flags it. Confirm nesting depth is ≤ 4.

- [x] Do NOT change any behaviour: the `isSavingRef` double-click guard, the `LAST_STEP` check, the step advancement logic, and the toast messages must remain identical.

---

### Task 2: Fix `LoginPage.tsx` — cognitive complexity (AC: 1)

**File:** `frontend/src/pages/LoginPage.tsx`

The violation is in `handleSubmit`: the nested `if (err instanceof ApiError)` block with three branches (`401`, `400+errors`, else), plus inner `if (!errors.email && !errors.password)` adds up quickly.

- [x] Extract error handling into a module-level helper:
  ```tsx
  function applyLoginError(err: unknown, setFieldErrors: (e: FieldErrors) => void): void {
    if (!(err instanceof ApiError)) {
      toast.error("Sign in failed. Please try again.")
      return
    }
    if (err.status === 401) {
      toast.error("Invalid email or password")
      return
    }
    if (err.status === 400 && err.errors) {
      const errors: FieldErrors = {}
      if (err.errors["email"]?.[0]) errors.email = err.errors["email"][0]
      if (err.errors["password"]?.[0]) errors.password = err.errors["password"][0]
      setFieldErrors(errors)
      if (!errors.email && !errors.password) {
        toast.error(err.detail)
      }
      return
    }
    toast.error(err.detail || "Sign in failed. Please try again.")
  }
  ```

- [x] Replace the `catch (err)` body in `handleSubmit` with a single call: `applyLoginError(err, setFieldErrors)`

- [x] `handleSubmit` body becomes: `e.preventDefault()` → clear errors → setSubmitting → build request → try API call → setAuth → navigate → catch → finally. This is well under complexity 15.

- [x] The `ApiError` import in `@/lib/apiClient` must be kept — still used in `applyLoginError`.

- [x] No behaviour changes: same toast messages, same field error assignment, same navigation target.

---

### Task 3: Fix `SignupPage.tsx` — cognitive complexity (AC: 1)

**File:** `frontend/src/pages/SignupPage.tsx`

Same pattern as LoginPage — the `handleSubmit` error handling branch is the source of complexity.

- [x] Extract error handling into a module-level helper (same approach as LoginPage):
  ```tsx
  function applySignupError(err: unknown, setFieldErrors: (e: FieldErrors) => void): void {
    if (!(err instanceof ApiError)) {
      toast.error("Registration failed. Please try again.")
      return
    }
    if (err.status === 409) {
      toast.error("An account with this email already exists")
      return
    }
    if (err.status === 400 && err.errors) {
      const errors: FieldErrors = {}
      if (err.errors["email"]?.[0]) errors.email = err.errors["email"][0]
      if (err.errors["password"]?.[0]) errors.password = err.errors["password"][0]
      setFieldErrors(errors)
      if (!errors.email && !errors.password) {
        toast.error(err.detail)
      }
      return
    }
    toast.error(err.detail || "Registration failed. Please try again.")
  }
  ```

- [x] Replace the `catch (err)` body in `handleSubmit` with: `applySignupError(err, setFieldErrors)`

- [x] No behaviour changes: same toast messages, same `setAuth` call, same `navigate("/")` target.

---

### Task 4: Fix `EditorPage.tsx` — cognitive complexity & void operator (AC: 1, 3)

**File:** `frontend/src/pages/EditorPage.tsx`

Two issues:
1. `void load()` on line 64 — SonarQube S3735 violation.
2. `handleDeleteFromSidebar` is complex — has an async inner `setTimeout` callback with its own try/catch, plus the `find()` guard, plus the undo toast action.

**Void operator fix:**

- [x] The `useEffect` on lines 48–65 uses `void load()` to suppress the no-floating-promises ESLint rule. Replace with an inline IIFE or restructure to not need it:
  ```tsx
  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const data = await apiClient.get<ResumeDto>(`/api/v1/resumes/${id}`)
        setCurrentResume(data)
        setLastSavedDocument(data.content)
      } catch {
        setError("Failed to load resume")
        toast.error("Failed to load resume")
      } finally {
        setIsLoading(false)
      }
    }

    // Fire-and-forget: effect does not need the promise result
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load()
  }, [id, setCurrentResume, setLastSavedDocument])
  ```
  The `void` keyword is removed; the ESLint disable comment documents intent explicitly.

**Cognitive complexity fix for `handleDeleteFromSidebar`:**

- [x] Extract the async delete API call with undo logic into a module-level async function:
  ```tsx
  async function executeDeleteResume(
    resume: ResumeDto,
    pendingDeletes: Map<string, ReturnType<typeof setTimeout>>,
    setSidebarResumes: React.Dispatch<React.SetStateAction<ResumeDto[]>>
  ): Promise<void> {
    pendingDeletes.delete(resume.id)
    try {
      await apiClient.delete(`/api/v1/resumes/${resume.id}`)
    } catch {
      setSidebarResumes((prev) => {
        if (prev.find((r) => r.id === resume.id)) return prev
        return [...prev, resume]
      })
      toast.error("Delete failed — resume restored")
    }
  }
  ```

- [x] In `handleDeleteFromSidebar`, replace the `setTimeout` async callback body with a call to `executeDeleteResume`.

- [x] The undo toast `onClick` and the `pendingSidebarDeletes` ref usage must be preserved exactly.

- [x] Verify `handleDeleteFromSidebar` still has `useCallback(... , [])` with empty deps — `executeDeleteResume` is module-level, not a dependency.

---

### Task 5: Fix `useResumeStore.ts` — nesting depth (AC: 2)

**File:** `frontend/src/stores/useResumeStore.ts`

The `updateItemField` action has a nested `set()` callback that maps over sections and then maps over items — potentially 4+ nesting levels.

- [x] Audit nesting depth of `updateItemField`:
  ```
  set((state) => {          // level 1
    return {
      currentResume: {
        content: {
          sections: state.currentResume.content.sections.map((s) =>  // level 2
            s.sectionType !== sectionId
              ? s
              : {
                  ...s,
                  items: s.items.map((item) =>   // level 3 (arrow function)
                    item.id !== itemId
                      ? item
                      : { ...item, [field]: value }   // level 4 ternary
                  ),
                }
          ),
        },
      },
    }
  })
  ```

- [x] If SonarQube flags the nesting, extract the inner item mapper to a module-level helper:
  ```tsx
  function updateItem(
    item: ResumeItemDto,
    itemId: string,
    field: string,
    value: string
  ): ResumeItemDto {
    return item.id !== itemId ? item : { ...item, [field]: value }
  }

  function updateSectionItems(
    section: ResumeSectionDto,
    sectionId: string,
    itemId: string,
    field: string,
    value: string
  ): ResumeSectionDto {
    if (section.sectionType !== sectionId) return section
    return {
      ...section,
      items: section.items.map((item) => updateItem(item, itemId, field, value)),
    }
  }
  ```

- [x] Replace the nested `.map()` in `updateItemField` with:
  ```tsx
  sections: state.currentResume.content.sections.map((s) =>
    updateSectionItems(s, sectionId, itemId, field, value)
  ),
  ```

- [x] Guard: `if (field === "type" || field === "id") return state` must remain at the top of the action — do not move it into the helper.

- [x] Do NOT modify any other action in the store — only `updateItemField` if flagged.

---

### Task 6: Run lint and tests (AC: 4)

- [x] `cd frontend && npm run lint` — must pass with 0 errors
- [x] `cd frontend && npx vitest run` — all tests pass
- [x] Spot-check: open `ProfilePage.tsx` and confirm `handleSaveAndContinue` no longer has the 14-branch inline payload object
- [x] Spot-check: open `EditorPage.tsx` and confirm no `void ` keyword remains

---

## Dev Notes & Guardrails

### CRITICAL: Pure Structural Refactoring Only

These are SonarQube **complexity** fixes, NOT feature changes. The rule is absolute:
- **No logic changes** — every conditional, every toast message, every API endpoint, every navigation target must remain identical
- **No new dependencies** — do NOT introduce new imports, hooks, or utilities beyond what already exists
- **No test changes** — existing tests must pass without modification; do not "fix" tests to accommodate implementation changes

### File Locations (Exact Paths)

All files are in `frontend/src/`:
- `pages/ProfilePage.tsx` — primary target (nesting + complexity)
- `pages/LoginPage.tsx` — complexity in `handleSubmit`
- `pages/SignupPage.tsx` — complexity in `handleSubmit`
- `pages/EditorPage.tsx` — void operator + complexity in `handleDeleteFromSidebar`
- `stores/useResumeStore.ts` — nesting depth in `updateItemField`

### Extraction Pattern

Module-level helper functions (not hooks, not separate files) are the correct approach here. All helpers should be placed:
- **Before** the component/store export in the same file
- With **descriptive names** that convey intent (`mergeProfilePayload`, `applyLoginError`, `executeDeleteResume`)
- As **pure functions** where possible (no side effects in helpers)

### Void Operator Fix — Correct Pattern

The `void` operator at `EditorPage.tsx:64` is currently used to fire-and-forget the `load()` async function inside a `useEffect`. The correct replacement is:

```tsx
// eslint-disable-next-line @typescript-eslint/no-floating-promises
load()
```

Do NOT convert the effect to `async` — React cleanup functions cannot be async. Do NOT `.catch()` without handling — the `try/catch` inside `load()` already handles all errors.

### Zustand Immutability Rule

From `project-context.md`: Zustand state updates always immutable — `set(state => ({ ...state, field: newValue }))`. The extracted `updateItem` and `updateSectionItems` helpers MUST return new objects (spread), never mutate the `item` or `section` argument.

### ESLint Config

ESLint config is at `frontend/eslint.config.js`. The `src/components/ui/` directory is excluded (shadcn-managed). **Do not touch any file under `frontend/src/components/ui/`.**

### SonarQube Rules Being Fixed

| Rule | Name | Count |
|------|------|-------|
| `typescript:S3776` | Cognitive complexity > 15 | 9 CRITICAL |
| `typescript:S2004` | Function nesting depth > 4 | ~2 CRITICAL |
| `typescript:S3735` | Use of void operator | 2 CRITICAL (1 confirmed in EditorPage) |

### What NOT to Change

- `STEPS` constant and `LAST_STEP` in `ProfilePage.tsx` — untouched
- `isSavingRef` double-click guard in `ProfilePage.tsx` — critical, do not remove
- `pendingSidebarDeletes` ref in `EditorPage.tsx` — the undo/cancel mechanism depends on it
- `applyPatch` no-op stub in `useResumeStore.ts` — intentional placeholder, do not implement
- The `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment on `applyPatch` — must remain

### Cognitive Complexity Heuristic

SonarQube S3776 counts: `if`, `else if`, `else`, `switch case`, `for`, `while`, `do-while`, `catch`, `&&`, `||`, `??`, ternary, nested function declarations. A single `handleSubmit` with one `if (err instanceof ApiError)` containing three branches already scores ~7+. Any additional nesting multiplies the score.

---

## Story Completion Status

**Analysis completed:** 2026-06-11
**Files analyzed:** `ProfilePage.tsx`, `LoginPage.tsx`, `SignupPage.tsx`, `EditorPage.tsx`, `useResumeStore.ts`
**Approach confirmed:** Pure structural extraction — module-level helpers, zero logic changes
**Void operator instance confirmed:** `EditorPage.tsx:64` (`void load()`)
**Test impact:** None — all existing tests must pass unchanged

---

## Dev Agent Record

### Implementation Plan

Pure structural extraction across 5 files. No logic changes. All helpers placed as module-level functions before their respective component/store export.

- **ProfilePage.tsx**: Extracted `EMPTY_PROFILE` constant and `mergeProfilePayload()` helper. `handleSaveAndContinue` now calls `mergeProfilePayload(partial, current)` — body reduced from 50+ lines to 3 lines.
- **LoginPage.tsx**: Extracted `applyLoginError()` helper. `handleSubmit` catch block reduced to single call.
- **SignupPage.tsx**: Extracted `applySignupError()` helper. Same pattern as LoginPage.
- **EditorPage.tsx**: Removed `void load()` (replaced with plain `load()` + intent comment). Extracted `executeDeleteResume()` module-level async function; `setTimeout` callback now delegates to it.
- **useResumeStore.ts**: Extracted `updateItem()` and `updateSectionItems()` module-level helpers. `updateItemField` nested map replaced with single `updateSectionItems()` call.

### Completion Notes

- All 5 tasks complete. 0 logic changes made.
- `void load()` removed from EditorPage; `load()` called directly (no-floating-promises rule not active in ESLint config, so no suppress directive needed).
- `isSavingRef`, `LAST_STEP`, `pendingSidebarDeletes`, `applyPatch` stub all preserved untouched.
- `npm run lint`: 0 errors (2 pre-existing warnings unrelated to this story).
- `npx vitest run`: 189/189 tests pass, 0 regressions.

---

## File List

- `frontend/src/pages/ProfilePage.tsx` — modified
- `frontend/src/pages/LoginPage.tsx` — modified
- `frontend/src/pages/SignupPage.tsx` — modified
- `frontend/src/pages/EditorPage.tsx` — modified
- `frontend/src/stores/useResumeStore.ts` — modified

---

## Change Log

- 2026-06-11: Story implemented — pure structural extraction of complexity helpers across 5 TypeScript files. Resolves SonarQube S3776 (cognitive complexity), S2004 (nesting depth), and S3735 (void operator) violations. 0 logic changes, 189 tests passing.
- 2026-06-11: Code review complete — 0 patch, 0 decision-needed. 5 pre-existing items deferred, 6 dismissed as noise. Story status → done.

---

## Review Findings

- [x] [Review][Defer] `applyLoginError`/`applySignupError` — `toast.error(err.detail)` has no fallback when `err.detail` is null/undefined on 400 with no field errors [LoginPage.tsx, SignupPage.tsx] — deferred, pre-existing behavior identical in original inline code
- [x] [Review][Defer] `executeDeleteResume` — `setSidebarResumes` may be called after component unmount if API is in-flight at unmount time [EditorPage.tsx] — deferred, pre-existing race condition identical in original setTimeout callback
- [x] [Review][Defer] `updateSectionItems` parameter named `sectionId` but compared against `section.sectionType` — naming mismatch [useResumeStore.ts] — deferred, pre-existing naming from original action signature
- [x] [Review][Defer] `workExperiences` and `education` lack `?? []` guard unlike `certifications`/`languages`/`projects`/`volunteering` in `mergeProfilePayload` [ProfilePage.tsx] — deferred, pre-existing asymmetry; `ProfileDto` declares both as non-nullable
- [x] [Review][Defer] `applyLoginError`/`applySignupError` implicit contract: caller must clear field errors before calling — not documented [LoginPage.tsx, SignupPage.tsx] — deferred, safe in current call sites; functions are module-private
