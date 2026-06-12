# Story 9.10: Replace window/global References with globalThis

**Status:** review
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-10-replace-window-global-with-globalthis
**Dependencies:** None (9.9 done; all affected files are frontend TypeScript)

---

## Story

As a developer,
I want all direct `window` (browser) and `global` (Node.js) global object references replaced with the environment-agnostic `globalThis`,
So that shared code running in both the Vite browser environment and the Vitest Node.js test runner does not break and SonarQube rule S7764 is cleared.

---

## Acceptance Criteria

**AC1 — `theme-provider.tsx` window references replaced (S7764 × 7)**
**Given** `theme-provider.tsx` references `window` to call `matchMedia`, `addEventListener`, and `removeEventListener`
**When** the fix is applied
**Then** all `window.xxx` references are replaced with `globalThis.xxx`; the component's theme persistence behaviour (media query detection, keyboard shortcut, storage event) is unchanged in the browser

**AC2 — `apiClient.ts` window references replaced (S7764 × 3)**
**Given** `apiClient.ts` references `window.location.pathname` and `window.location.href` in the 401 redirect guard
**When** the fix is applied
**Then** `window.location.pathname` → `globalThis.location.pathname` and `window.location.href` → assignment to `globalThis.location.href`; API redirect behaviour is unchanged

**AC3 — `test/setup.ts` global reference replaced (S7764 × 1)**
**Given** `test/setup.ts` uses `global.ResizeObserver = ResizeObserverStub` to install a test stub
**When** the fix is applied
**Then** `global.ResizeObserver` is replaced with `globalThis.ResizeObserver`; the Vitest test setup continues to initialise the mock correctly for all tests

**AC4 — All tests pass**
**Given** the story is implemented
**When** all frontend tests run
**Then** all tests pass in both browser (Vite) and Node (Vitest) environments; `npm run lint` passes with 0 errors; SonarQube re-scan shows 0 remaining S7764 violations

---

## Tasks / Subtasks

### Task 1: Replace `window` in `theme-provider.tsx` (AC1)

**File:** `frontend/src/components/theme-provider.tsx`

**Current state — 7 occurrences of `window`:**

| Line | Current | Required change |
|------|---------|-----------------|
| 35 | `window.matchMedia(COLOR_SCHEME_QUERY).matches` | `globalThis.matchMedia(COLOR_SCHEME_QUERY).matches` |
| 52 | `window.getComputedStyle(document.body)` | `globalThis.getComputedStyle(document.body)` |
| 130 | `const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)` | `const mediaQuery = globalThis.matchMedia(COLOR_SCHEME_QUERY)` |
| 175 | `window.addEventListener("keydown", handleKeyDown)` | `globalThis.addEventListener("keydown", handleKeyDown)` |
| 178 | `window.removeEventListener("keydown", handleKeyDown)` | `globalThis.removeEventListener("keydown", handleKeyDown)` |
| 200 | `window.addEventListener("storage", handleStorageChange)` | `globalThis.addEventListener("storage", handleStorageChange)` |
| 203 | `window.removeEventListener("storage", handleStorageChange)` | `globalThis.removeEventListener("storage", handleStorageChange)` |

**Implementation checklist:**
- [x] Replace all 7 `window.` occurrences in `theme-provider.tsx` with `globalThis.`
- [x] Do NOT change `localStorage`, `document`, or `requestAnimationFrame` — these are not flagged by S7764
- [x] Do NOT change the `THEME_VALUES` Set or `isTheme` guard — these were updated in Story 9.9 and are correct
- [x] Do NOT add any imports — `globalThis` is a built-in, no import needed

---

### Task 2: Replace `window` in `apiClient.ts` (AC2)

**File:** `frontend/src/lib/apiClient.ts`

**Current state — 3 occurrences of `window` (lines 32–34):**

```typescript
if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
  window.location.href = '/login'
}
```

**Required change:**

```typescript
if (!globalThis.location.pathname.startsWith('/login') && !globalThis.location.pathname.startsWith('/signup')) {
  globalThis.location.href = '/login'
}
```

**Implementation checklist:**
- [x] Replace `window.location.pathname` (×2) with `globalThis.location.pathname`
- [x] Replace `window.location.href` (×1) with `globalThis.location.href`
- [x] Preserve the full 401-redirect guard logic unchanged — only the `window.` prefix changes
- [x] Do NOT change `import.meta.env`, `fetch`, or any other line in `apiClient.ts`

---

### Task 3: Replace `global` in `test/setup.ts` (AC3)

**File:** `frontend/src/test/setup.ts`

**Current state — 1 occurrence of `global` (line 31):**

```typescript
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
```

**Required change:**

```typescript
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
```

**Implementation checklist:**
- [x] Replace `global.ResizeObserver` with `globalThis.ResizeObserver`
- [x] Do NOT change the `ResizeObserverStub` class definition, the `resizeObserverTracker` export, or any other line in `setup.ts`
- [x] `globalThis` in a Vitest Node.js test runner refers to the Node.js global — this assignment is functionally equivalent to `global.ResizeObserver`

---

### Task 4: Run lint and tests (AC4)

- [x] `cd frontend && npm run lint` — must pass with 0 errors
- [x] `cd frontend && npx vitest run` — all tests must pass (baseline: 22 test files, 189 tests from Story 9.9)
- [x] Specifically verify:
  - All `theme-provider` tests pass if any exist
  - `ResizeObserver` mock still works — any test that depends on `resizeObserverTracker` must pass
  - `apiClient` tests pass if any exist
  - TypeScript compilation: 0 type errors (`globalThis` is `typeof globalThis` — it has `matchMedia`, `location`, `addEventListener` etc. in the browser lib types)

---

## Dev Notes & Guardrails

### Understanding the SonarQube Rule

**S7764 — Use `globalThis` instead of `window` or `global`**

`window` is browser-only; `global` is Node.js-only. `globalThis` is the ECMAScript 2020 standard that works in both environments. Replacing `window`/`global` with `globalThis` makes code environment-agnostic without any behaviour change in production (browser always has `globalThis === window`) or in tests (Node.js always has `globalThis === global`).

**Key guarantee:** `globalThis === window` in browsers and `globalThis === global` in Node.js/Vitest. No behaviour changes — pure spelling fix.

### TypeScript Typing Note

`globalThis` in the browser TypeScript lib (`lib.dom.d.ts`) declares `matchMedia`, `addEventListener`, `removeEventListener`, `getComputedStyle`, and `location` — no type errors expected. If TypeScript complains (strict mode), use `(globalThis as Window).xxx` only as a last resort, but this should NOT be needed with standard `lib.dom.d.ts`.

### File Location Map

```
frontend/src/components/theme-provider.tsx   — Task 1 (S7764 × 7)
frontend/src/lib/apiClient.ts                — Task 2 (S7764 × 3)
frontend/src/test/setup.ts                   — Task 3 (S7764 × 1)
```

**Total:** 11 violations across 3 files — matches the epic count exactly.

### Critical Preservation Rules

**`theme-provider.tsx`:**
- `localStorage` references stay as-is — not flagged by S7764
- `document.createElement`, `document.head`, `document.documentElement` stay as-is
- `requestAnimationFrame` stays as-is
- `THEME_VALUES` Set and `isTheme()` guard from Story 9.9 — do NOT touch

**`apiClient.ts`:**
- `import.meta.env.VITE_API_BASE_URL` stays as-is — Vite env, not a global
- `fetch()` stays as-is — not flagged, and it is already `globalThis.fetch` implicitly
- The 401-guard logic (path checks before redirect) must be fully preserved

**`test/setup.ts`:**
- `ResizeObserverStub` class body stays as-is
- `resizeObserverTracker` export stays as-is
- Only line 31 changes: `global.` → `globalThis.`

### Commit Pattern

Follow the established Epic 9 convention:
```
feat(9-10-replace-window-global-with-globalthis): replace window/global references with globalThis
```

### Previous Story Intelligence (from Story 9.9 — done)

- Only frontend changes in this story — run `cd frontend && npm run lint` and `npx vitest run`, NOT `./mvnw test`
- Commit convention: `feat(9-X-story-key): <description>`
- `eslint.config.js` governs linting; `frontend/src/components/ui/` is excluded from ESLint (shadcn-managed, never edit)
- TypeScript strict mode enforced — `any` is forbidden
- Baseline test count from Story 9.9: 22 test files, 189 tests — all must still pass
- `theme-provider.tsx` already had its `THEME_VALUES` array converted to `new Set<Theme>(...)` in Story 9.9 — this is correct; do NOT revert it

### SonarQube Rule Summary

| Rule | Name | Severity | Instances | Files |
|------|------|----------|-----------|-------|
| `typescript:S7764` | Use `globalThis` not `window`/`global` | MINOR | 11 | `theme-provider.tsx` (7), `apiClient.ts` (3), `test/setup.ts` (1) |

---

## Story Completion Status

**Analysis completed:** 2026-06-12
**Files analyzed:**
- `frontend/src/components/theme-provider.tsx` — 7× `window.` (matchMedia ×2, getComputedStyle ×1, addEventListener ×2, removeEventListener ×2)
- `frontend/src/lib/apiClient.ts` — 3× `window.location` (pathname ×2, href ×1) in the 401 redirect guard
- `frontend/src/test/setup.ts` — 1× `global.ResizeObserver` stub assignment
- Story 9.9 (done) — frontend-only pattern confirmed; `theme-provider.tsx` S7776 already fixed (THEME_VALUES Set)
- Recent commits confirm `feat(9-X-story-key): <description>` convention

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_none_

### Completion Notes List

- AC1: Replaced 7 `window.` references in `theme-provider.tsx` with `globalThis.` — matchMedia ×2, getComputedStyle ×1, addEventListener ×2, removeEventListener ×2. `localStorage`, `document`, `requestAnimationFrame`, `THEME_VALUES`, `isTheme` untouched.
- AC2: Replaced 3 `window.location` references in `apiClient.ts` with `globalThis.location` — pathname ×2, href ×1. 401-redirect guard logic fully preserved.
- AC3: Replaced `global.ResizeObserver` with `globalThis.ResizeObserver` in `test/setup.ts`. `ResizeObserverStub` class and `resizeObserverTracker` export untouched.
- AC4: `npm run lint` → 0 errors (2 pre-existing warnings, not introduced by this story). `npx vitest run` → 22 test files, 189 tests, all pass.

### File List

- frontend/src/components/theme-provider.tsx
- frontend/src/lib/apiClient.ts
- frontend/src/test/setup.ts

### Change Log

- 2026-06-12: Replaced all `window`/`global` references with `globalThis` across 3 files (11 violations total). All tests pass (22 files, 189 tests). Lint clean (0 errors).
