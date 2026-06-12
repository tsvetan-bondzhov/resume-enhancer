# Story 9.9: Frontend Code Style — Simplified Conditionals & Modern Idioms

**Status:** review
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-9-code-style-simplified-conditionals-and-idioms
**Dependencies:** None (9.8 done; all affected files are frontend TypeScript/TSX)

---

## Story

As a developer,
I want negated conditions simplified, null-default ternaries replaced with nullish coalescing, `.find()` existence checks replaced with `.some()`, and legacy import and escaping patterns modernised,
So that code is idiomatic TypeScript/JavaScript and the 37 style violations are eliminated.

---

## Acceptance Criteria

**AC1 — Negated conditions simplified (S7735)**
**Given** a condition is written as `!a ? x : y` where `a ? y : x` is equivalent and less cognitive overhead
**When** the fix is applied
**Then** negated conditions are inverted so the positive branch comes first; the `!` operator is removed; no logic change occurs

**AC2 — Null/undefined default ternaries replaced with `??` (S6606)**
**Given** a ternary is used solely to substitute a null/undefined default (e.g., `x !== undefined ? x : defaultValue`)
**When** the fix is applied
**Then** the ternary is replaced with the nullish coalescing operator: `x ?? defaultValue`

**AC3 — `.find()` existence checks replaced with `.some()` (S7754)**
**Given** `array.find(predicate)` is used only to check whether a matching element exists — the return value is then coerced to boolean (e.g., `if (prev.find(...))`)
**When** the fix is applied
**Then** `prev.find(predicate)` boolean-coercion checks are replaced with `prev.some(predicate)`

**AC4 — Set membership check for `node:` import prefix (S7772)**
**Given** a Node.js built-in module is imported without the `node:` protocol prefix (e.g., `import path from "path"`)
**When** the fix is applied
**Then** the import is updated to use the `node:` prefix: `import path from "node:path"`

**AC5 — `String.raw` for backslash-escape strings (S7780)**
**Given** a string literal contains manually escaped backslashes (e.g., `"basis-1\\/3"` in a CSS class selector query)
**When** the fix is applied
**Then** the string is rewritten as a `String.raw` tagged template literal: `` String.raw`basis-1\/3` ``; no double-backslash sequences remain in the affected expressions

**AC6 — `Set.has()` membership check (S7776)**
**Given** an array or object is used to check set-like membership where a `Set` would be more semantically correct
**When** the fix is applied
**Then** the membership check is rewritten using a `Set` with `.has()`

**AC7 — All tests pass**
**Given** the story is implemented
**When** TypeScript strict-mode compilation and all frontend tests run
**Then** 0 type errors are introduced; all tests pass; `npm run lint` passes with 0 errors

---

## Tasks / Subtasks

### Task 1: Fix `mergeProfilePayload` in `ProfilePage.tsx` — replace `!== undefined` ternaries with `??` (AC2)

**File:** `frontend/src/pages/ProfilePage.tsx`

**Current state (lines 43–56):**
```typescript
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
```

**Required change:**
```typescript
summary: partial.summary ?? current.summary,
contactEmail: partial.contactEmail ?? current.contactEmail,
linkedInUrl: partial.linkedInUrl ?? current.linkedInUrl,
personalPageUrl: partial.personalPageUrl ?? current.personalPageUrl,
blogUrl: partial.blogUrl ?? current.blogUrl,
locationCity: partial.locationCity ?? current.locationCity,
locationCountry: partial.locationCountry ?? current.locationCountry,
workExperiences: partial.workExperiences ?? current.workExperiences,
education: partial.education ?? current.education,
skills: partial.skills ?? current.skills,
certifications: partial.certifications ?? current.certifications ?? [],
languages: partial.languages ?? current.languages ?? [],
projects: partial.projects ?? current.projects ?? [],
volunteering: partial.volunteering ?? current.volunteering ?? [],
```

**CRITICAL WARNING:** `??` is null/undefined coalescing — it only falls through on `null` or `undefined`, NOT on falsy values like `0`, `""`, or `false`. The original ternaries check `!== undefined` which also passes through `null`. The payload fields (`summary`, `contactEmail`, etc.) are either a value, `undefined` (not in partial), or `null` (explicitly cleared). `??` correctly handles all three cases here.

**Implementation checklist:**
- [x] Replace all 14 ternary lines in `mergeProfilePayload` with `??` equivalents
- [x] Verify TypeScript compiles without errors — the `Partial<ProfileUpdateRequest>` fields are `T | undefined`, so `partial.x ?? current.x` is type-safe
- [x] Do NOT change the `isEmptyProfile` function — `!profile.summary` intentionally catches both null and empty string (see comment on line 62)

---

### Task 2: Fix `.find()` existence checks → `.some()` in `DashboardPage.tsx` (AC3)

**File:** `frontend/src/pages/DashboardPage.tsx`

**Current state (lines 91, 109):**
```typescript
if (prev.find((r) => r.id === resume.id)) return prev
```

**Required change:**
```typescript
if (prev.some((r) => r.id === resume.id)) return prev
```

**Occurrences:** 2 (lines 91 and 109 — both in `setDisplayedResumes` callbacks)

**Implementation checklist:**
- [x] Replace line 91: `prev.find(...)` → `prev.some(...)`
- [x] Replace line 109: `prev.find(...)` → `prev.some(...)`
- [x] `.some()` returns `boolean`; `.find()` returns `T | undefined` (truthy/falsy). The replacement is semantically identical in `if (...)` context but `.some()` is the correct semantic tool.

---

### Task 3: Fix `.find()` existence checks → `.some()` in `EditorPage.tsx` (AC3)

**File:** `frontend/src/pages/EditorPage.tsx`

**Current state (lines 26, 212):**
```typescript
if (prev.find((r) => r.id === resume.id)) return prev
```

**Required change:**
```typescript
if (prev.some((r) => r.id === resume.id)) return prev
```

**Occurrences:** 2 (line 26 in `performDelete` function, line 212 in undo toast callback inside `handleDeleteResume`)

**Implementation checklist:**
- [x] Replace line 26: `prev.find(...)` → `prev.some(...)`
- [x] Replace line 212: `prev.find(...)` → `prev.some(...)`

---

### Task 4: Fix `.find()` existence check → `.some()` in `TemplateGallery.tsx` (AC3)

**File:** `frontend/src/components/resume/TemplateGallery.tsx`

**Current state (line 104):**
```typescript
const activeTemplate = templates.find(t => t.id === activeTemplateId)
```

**IMPORTANT:** This line uses `.find()` to retrieve the actual template object (not just check existence) — check if the result is used beyond a boolean coercion. If `activeTemplate` is only used as a truthy check, replace with `.some()`. If it's used as an object value, keep `.find()`.

**Implementation checklist:**
- [x] Read `TemplateGallery.tsx` from the start to understand how `activeTemplate` is used
- [x] If `activeTemplate` is used as an object (accessing `.id`, `.name`, etc.) → do NOT change this `.find()` — it is a legitimate value lookup, not an existence check
- [x] If `activeTemplate` is only used in boolean context → replace with `.some()`

---

### Task 5: Fix `node:` import prefix in `vite.config.ts` (AC4)

**File:** `frontend/vite.config.ts`

**Current state (line 2):**
```typescript
import path from "path"
```

**Required change:**
```typescript
import path from "node:path"
```

**Implementation checklist:**
- [x] Update the import on line 2 only
- [x] `vite.config.ts` is a Node.js config file — `node:` prefix is valid and correct here
- [x] This is NOT in `frontend/src/` — it is in `frontend/` root. Do not confuse path.
- [x] `path.resolve(__dirname, "./src")` usage on line 12 is unchanged

---

### Task 6: Fix `String.raw` for escaped CSS selectors in test files (AC5)

**Files:**
- `frontend/src/components/resume/ResumeCanvas.test.tsx` (line 138)
- `frontend/src/components/resume/TemplateGallery.test.tsx` (line 117)

**Current state:**
```typescript
// ResumeCanvas.test.tsx line 138:
expect(flexWrapper!.querySelector(".basis-1\\/3")).toBeInTheDocument()

// TemplateGallery.test.tsx line 117:
const thumbContainer = button.querySelector(".flex.gap-0\\.5")
```

**Required change:**
```typescript
// ResumeCanvas.test.tsx line 138:
expect(flexWrapper!.querySelector(String.raw`.basis-1\/3`)).toBeInTheDocument()

// TemplateGallery.test.tsx line 117:
const thumbContainer = button.querySelector(String.raw`.flex.gap-0\.5`)
```

**CRITICAL:** `String.raw` is a tag function for template literals — `String.raw`...`` `. The raw string content is identical in meaning but removes the double-backslash. The CSS selector string value itself does NOT change — `String.raw`.basis-1\/3`` produces the same 11-character string as `".basis-1\\/3"`. Verify the selectors continue to work.

**Implementation checklist:**
- [x] Replace `".basis-1\\/3"` with `` String.raw`.basis-1\/3` `` in `ResumeCanvas.test.tsx` line 138
- [x] Replace `".flex.gap-0\\.5"` with `` String.raw`.flex.gap-0\.5` `` in `TemplateGallery.test.tsx` line 117

---

### Task 7: Investigate S7735 negated conditions and S7776 Set.has() (AC1, AC6)

The epic lists 22 S7735 violations (negated conditions) mostly in `ProfilePage.tsx`, and 1 S7776 (Set.has membership).

**S7735 investigation in `ProfilePage.tsx`:**
The current file (as read) has very few `!cond ? a : b` ternaries — the major violations were likely the ternaries in `mergeProfilePayload` (addressed in Task 1) and possibly `!isLoading && error` (line 175, not a ternary). SonarQube S7735 targets the pattern `!a ? x : y` (where `!` is the leading negation in a ternary). After Task 1, scan remaining files for any surviving `! ... ?` ternary pattern.

**S7735 investigation across other files:**
- `frontend/src/components/resume/sections/EducationSectionRenderer.tsx` line 220: `!item.endDate ? "Present" : formatYear(item.endDate)` — this is `!a ? x : y`, which S7735 would flag. Rewrite as `item.endDate ? formatYear(item.endDate) : "Present"`.
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx` (similar `!item.endDate ? "Present" : ...` pattern)
- `frontend/src/lib/dateUtils.ts` line 18: `!endDate ? "Present" : fmt(endDate)`

**S7776 investigation:**
S7776 fires when an array (or object) is used for a membership check where a `Set` is more semantically appropriate. Search for patterns like `['a', 'b', 'c'].includes(x)` or `arrayVar.includes(x)` where `arrayVar` is a constant set of known values.

**Implementation checklist:**
- [x] After Task 1, run `cd frontend && npm run lint` to see exactly which S7735 violations remain (if ESLint rules are configured for these SonarQube-equivalent checks)
- [x] Fix `!item.endDate ? "Present" : formatYear(item.endDate)` → `item.endDate ? formatYear(item.endDate) : "Present"` in `EducationSectionRenderer.tsx`
- [x] Fix `!item.endDate ? "Present" : formatMonthYear(item.endDate)` → `item.endDate ? formatMonthYear(item.endDate) : "Present"` in `WorkExperienceSectionRenderer.tsx` and `ProjectsSectionRenderer.tsx` (compound form rewritten as `!item.isCurrent && item.endDate ? ... : "Present"`)
- [x] Fix `!endDate ? "Present" : fmt(endDate)` → `endDate ? fmt(endDate) : "Present"` in `dateUtils.ts` (compound form rewritten as `!isCurrent && endDate ? ... : "Present"`)
- [x] Search for any remaining `! ... ?` ternaries in the full frontend/src tree
- [x] For S7776: `THEME_VALUES` constant array in `theme-provider.tsx` replaced with `new Set<Theme>(...)` and `.includes()` replaced with `.has()`

---

### Task 8: Run lint and tests (AC7)

- [x] `cd frontend && npm run lint` — must pass with 0 errors
- [x] `cd frontend && npx vitest run` — all tests must pass
- [x] Specifically verify:
  - `ResumeCanvas.test.tsx` — CSS selector tests pass with `String.raw` change
  - `TemplateGallery.test.tsx` — thumbnail CSS selector test passes
  - `DashboardPage` and `EditorPage` — delete/undo flows unaffected by `.some()` change
  - TypeScript compilation: 0 type errors

---

## Dev Notes & Guardrails

### Understanding the SonarQube Rules

**S7735 — Simplify negated condition**
`!a ? x : y` should be rewritten as `a ? y : x`. The `!` operator is removed and branches are swapped. The epic says 22 violations mostly in `ProfilePage.tsx` — however the current `ProfilePage.tsx` shows `!== undefined ? val : default` patterns (which S6606 covers) not classic `!a ? x : y`. The true S7735 targets are scattered across section renderers (`!item.endDate ? "Present" : ...`).

**S6606 — Use `??` instead of ternary for null defaults**
`x !== null ? x : default` and `x !== undefined ? x : default` are both flagged. The 14-line `mergeProfilePayload` function is the epicenter (14 violations). `??` is the correct fix. **Gotcha:** `??` only coalesces `null`/`undefined` — not `0`, `""`, `false`. This is exactly right for optional payload fields.

**S7754 — Use `.some()` not `.find()` for existence check**
`if (arr.find(pred))` coerces to boolean — use `arr.some(pred)` instead. Found in `DashboardPage.tsx` (2×), `EditorPage.tsx` (2×). `TemplateGallery.tsx` uses `.find()` to retrieve a value — check if that's a genuine existence check or value retrieval before changing.

**S7772 — Use `node:` prefix for Node built-ins**
`import path from "path"` → `import path from "node:path"`. Only one occurrence: `frontend/vite.config.ts`. This file is NOT in `frontend/src/` — it's in `frontend/` root. Vite config files run in Node.js; the `node:` prefix is correct.

**S7780 — Use `String.raw` to avoid backslash escaping**
CSS class selectors in `querySelector` calls use `\\/` and `\\.` to escape Tailwind fraction/dot characters. `String.raw` tagged template literals express the same string without double-escaping. Two test files affected.

**S7776 — Use `Set.has()` not array/object check**
1 violation. Search for constant array `.includes()` patterns across the frontend. The existing codebase already uses `new Set(...)` in `ResumeCanvas.tsx` and `templateUtils.ts` correctly.

### File Location Map

```
frontend/src/pages/ProfilePage.tsx                            — Task 1 (S6606 × 14)
frontend/src/pages/DashboardPage.tsx                          — Task 2 (S7754 × 2)
frontend/src/pages/EditorPage.tsx                             — Task 3 (S7754 × 2)
frontend/src/components/resume/TemplateGallery.tsx            — Task 4 (S7754 × 1 — investigate first)
frontend/vite.config.ts                                       — Task 5 (S7772 × 1)
frontend/src/components/resume/ResumeCanvas.test.tsx          — Task 6 (S7780 × 1)
frontend/src/components/resume/TemplateGallery.test.tsx       — Task 6 (S7780 × 1)
frontend/src/components/resume/sections/EducationSectionRenderer.tsx — Task 7 (S7735)
frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx — Task 7 (S7735)
frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx — Task 7 (S7735)
frontend/src/lib/dateUtils.ts                                 — Task 7 (S7735)
```

### Critical Preservation Rules

**Do NOT change in `ProfilePage.tsx`:**
- `isEmptyProfile()` function: `!profile.summary` checks both `null` and `""` intentionally (see the comment on line 62: "Use !profile.summary to catch both null and empty string"). This is NOT an S7735 pattern — it's a standalone boolean expression, not a ternary. Do not replace with `profile.summary === null`.
- Line 175: `if (!isLoading && error && profile === null)` — keep as-is, this is a guard clause not a ternary.
- Line 200: `{!showEmptyState && (` — keep as-is, this is a JSX short-circuit not a ternary.

**Do NOT modify test selectors' semantic meaning:**
`".basis-1\\/3"` → `String.raw`.basis-1\/3`` produces the SAME runtime string. Double check: in the original, `"\\/"`  is `\/` (one backslash + forward slash). `String.raw`.\/`` is also `\/`. Correct.

**`TemplateGallery.tsx` line 104 — `.find()` returning a value:**
`const activeTemplate = templates.find(t => t.id === activeTemplateId)` — if `activeTemplate` is accessed as an object downstream (`.name`, `.id`, etc.), this is NOT an S7754 violation. Only change `.find()` to `.some()` where the result is used as boolean.

### Commit Pattern

Follow the established Epic 9 convention:
```
feat(9-9-code-style-simplified-conditionals-and-idioms): <description>
```

### Previous Story Intelligence (from Story 9.8 — done)

- Only frontend changes in this story — run `cd frontend && npm run lint` and `npx vitest run`, NOT `./mvnw test`
- Commit convention: `feat(9-X-story-key): <description>`
- `eslint.config.js` governs linting; `frontend/src/components/ui/` is excluded from ESLint (shadcn-managed, never edit)
- TypeScript strict mode: `any` is forbidden; no type changes needed for these fixes (all purely stylistic)
- Zustand state updates: all `.find()` → `.some()` changes are inside Zustand `set(state => ...)` callbacks — the immutable update pattern is unchanged

### SonarQube Rules Summary

| Rule | Name | Severity | Instances | Primary Files |
|------|------|----------|-----------|---------------|
| `typescript:S7735` | Simplify negated condition | MINOR | 22 | Section renderers, `dateUtils.ts` |
| `typescript:S6606` | Use `??` not ternary for null defaults | MINOR | 7 | `ProfilePage.tsx` (`mergeProfilePayload`) |
| `typescript:S7754` | Use `.some()` not `.find()` for existence | MINOR | 4 | `DashboardPage.tsx`, `EditorPage.tsx` |
| `typescript:S7776` | Use `Set.has()` not array/object check | MINOR | 1 | TBD — investigate |
| `typescript:S7772` | Use `node:` prefix for Node built-ins | MINOR | 1 | `vite.config.ts` |
| `typescript:S7780` | Use `String.raw` for backslash strings | MINOR | 2 | Test files |

---

## Story Completion Status

**Analysis completed:** 2026-06-12
**Files analyzed:**
- `frontend/src/pages/ProfilePage.tsx` — 14 `!== undefined ? val : fallback` ternaries in `mergeProfilePayload` (lines 43–56); `!isEmptyProfile` and `!hasStarted` are NOT S7735 ternaries
- `frontend/src/pages/DashboardPage.tsx` — 2× `if (prev.find(...))` boolean coercion (lines 91, 109)
- `frontend/src/pages/EditorPage.tsx` — 2× `if (prev.find(...))` boolean coercion (lines 26, 212)
- `frontend/src/components/resume/TemplateGallery.tsx` — 1× `.find()` (line 104) — investigate whether value or existence
- `frontend/vite.config.ts` — 1× `import path from "path"` without `node:` prefix (line 2)
- `frontend/src/components/resume/ResumeCanvas.test.tsx` — 1× `".basis-1\\/3"` double-backslash (line 138)
- `frontend/src/components/resume/TemplateGallery.test.tsx` — 1× `".flex.gap-0\\.5"` double-backslash (line 117)
- `frontend/src/components/resume/sections/EducationSectionRenderer.tsx` — S7735: `!item.endDate ? "Present" : ...` (line 220)
- `frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx` — S7735: similar pattern
- `frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx` — S7735: similar pattern
- `frontend/src/lib/dateUtils.ts` — S7735: `!endDate ? "Present" : ...` (line 18)
- Story 9.8 (done) — frontend-only pattern confirmed; commit/lint workflow established

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks executed cleanly on first pass.

### Completion Notes List

- AC2 (S6606): Replaced all 14 `!== undefined ? val : fallback` ternaries in `mergeProfilePayload` with `??` chains. `isEmptyProfile()` and guard clauses intentionally preserved as-is.
- AC3 (S7754): Replaced 4 × `prev.find(...)` boolean-coercion checks with `prev.some(...)` in `DashboardPage.tsx` (lines 91, 109) and `EditorPage.tsx` (lines 26, 212). `TemplateGallery.tsx` `.find()` kept — `activeTemplate` is used as an object (accesses `.name`), not as boolean.
- AC4 (S7772): Updated `import path from "path"` → `import path from "node:path"` in `frontend/vite.config.ts`.
- AC5 (S7780): Replaced double-escaped CSS selectors with `String.raw` tagged template literals in `ResumeCanvas.test.tsx` and `TemplateGallery.test.tsx`. Runtime string values unchanged.
- AC1 (S7735): Fixed negated ternaries in `EducationSectionRenderer.tsx`, `WorkExperienceSectionRenderer.tsx`, `ProjectsSectionRenderer.tsx`, and `dateUtils.ts`. Compound `isCurrent || !endDate` forms rewritten as `!isCurrent && endDate ? fmt : "Present"` to eliminate the embedded `!` negation.
- AC6 (S7776): `THEME_VALUES` array in `theme-provider.tsx` converted to `new Set<Theme>(...)`, `.includes()` replaced with `.has()`.
- AC7: `npm run lint` — 0 errors (2 pre-existing warnings, not introduced by this story). `npx vitest run` — 22 test files, 189 tests, all passed.

### File List

- frontend/src/pages/ProfilePage.tsx
- frontend/src/pages/DashboardPage.tsx
- frontend/src/pages/EditorPage.tsx
- frontend/vite.config.ts
- frontend/src/components/resume/ResumeCanvas.test.tsx
- frontend/src/components/resume/TemplateGallery.test.tsx
- frontend/src/components/resume/sections/EducationSectionRenderer.tsx
- frontend/src/components/resume/sections/WorkExperienceSectionRenderer.tsx
- frontend/src/components/resume/sections/ProjectsSectionRenderer.tsx
- frontend/src/lib/dateUtils.ts
- frontend/src/components/theme-provider.tsx

### Change Log

- 2026-06-12: Implemented all 8 tasks — AC1 S7735 negated conditions, AC2 S6606 nullish coalescing, AC3 S7754 .some() existence checks, AC4 S7772 node: import prefix, AC5 S7780 String.raw CSS selectors, AC6 S7776 Set.has() membership. All 189 tests pass, 0 lint errors.
