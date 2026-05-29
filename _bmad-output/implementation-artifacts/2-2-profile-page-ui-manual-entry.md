# Story 2.2: Profile Page UI — Manual Entry

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to build my experience profile by manually entering my work experience, education, and skills,
So that I have a complete career profile to generate resumes from.

## Acceptance Criteria

1. **Given** an authenticated user navigates to `/profile` **When** the page renders **Then** `ProfilePage.tsx` is displayed within the `AppShell` layout (already provided by the router's `ProtectedRoute`); the multi-step UX (UX-DR20) is shown: one section at a time with a progress indicator (Experience → Education → Skills → Summary).

2. **Given** the user is on the Experience step **When** they click "Add another" **Then** a new empty work experience entry is appended to the list; each entry has fields for job title, company, start date, end date (or "current" toggle checkbox), and description.

3. **Given** the user clicks out of a required field (blur event) leaving it empty **When** the field loses focus **Then** an inline validation error appears below the field in `text-red-600`; the step's "Save & Continue" button remains disabled (or the submit call is blocked) until the error is resolved.

4. **Given** the user completes a step and clicks "Save & Continue" **When** the `PUT /api/v1/profile` request succeeds **Then** the current step's data is persisted; the UI advances to the next step; a success Toast "Profile saved" appears (bottom-right, 4s, using `sonner`'s `toast.success()`).

5. **Given** the user is on first load with no existing profile **When** the profile page renders **Then** an empty-state message "Your profile is empty — start building below" (UX-DR15 CTA) is shown before any step content loads; once the user begins entering data, the step UI is shown.

6. **Given** all steps are complete and saved **When** the profile is viewed on subsequent visits **Then** `GET /api/v1/profile` is called on mount; the existing data is pre-populated in each step's form fields; `useProfileStore` holds the loaded profile state; **no direct `useState` is used for cross-step shared data**.

7. **Given** the profile form components are implemented **When** frontend tests are run **Then** `ProfileForm.test.tsx` verifies: blur validation fires on empty required fields, "Add another" appends an entry, and saving calls `apiClient.put` with the correct payload shape matching `ProfileUpdateRequest`.

## Tasks / Subtasks

- [x] Task 1: Update `types/api.ts` with accurate Profile DTO and request types (AC: 4, 6, 7)
  - [x] Replace the placeholder `ProfileDto` in `frontend/src/types/api.ts` with the real shape matching the backend record:
    ```typescript
    export interface WorkExperienceDto {
      jobTitle: string
      company: string
      startDate: string | null   // ISO date "YYYY-MM-DD" — use string, parse only at display
      endDate: string | null
      isCurrent: boolean
      description: string | null
    }
    export interface EducationDto {
      institution: string
      degree: string | null
      fieldOfStudy: string | null
      startDate: string | null
      endDate: string | null
    }
    export interface SkillDto {
      name: string
    }
    export interface ProfileDto {
      summary: string | null
      workExperiences: WorkExperienceDto[]
      education: EducationDto[]
      skills: SkillDto[]
    }
    export interface WorkExperienceRequest {
      jobTitle: string
      company: string
      startDate: string | null
      endDate: string | null
      isCurrent: boolean
      description: string | null
    }
    export interface EducationRequest {
      institution: string
      degree: string | null
      fieldOfStudy: string | null
      startDate: string | null
      endDate: string | null
    }
    export interface SkillRequest {
      name: string
    }
    export interface ProfileUpdateRequest {
      summary: string | null
      workExperiences: WorkExperienceRequest[]
      education: EducationRequest[]
      skills: SkillRequest[]
    }
    ```
  - [x] The old `ProfileDto` in `types/api.ts` (lines 44–51) has wrong fields (`id`, `userId`, `fullName`, `email`, `updatedAt`) — replace it entirely. The backend `ProfileDto` record is `(String summary, List<WorkExperienceDto>, List<EducationDto>, List<SkillDto>)` — no id or userId.

- [x] Task 2: Update `useProfileStore` to expose step state and loading flag (AC: 6)
  - [x] File: `frontend/src/stores/useProfileStore.ts`
  - [x] Add `currentStep: number` (0-indexed: 0=Experience, 1=Education, 2=Skills, 3=Summary) and `setStep: (step: number) => void` — immutable update pattern `set(state => ({ ...state, currentStep: step }))`.
  - [x] Add `isLoading: boolean` and `setLoading: (v: boolean) => void` per-operation flag (never a global `isLoading`).
  - [x] Keep existing `profile`, `isSaving`, `setProfile`, `setSaving`.

- [x] Task 3: Implement `ProfilePage.tsx` — multi-step shell (AC: 1, 5, 6)
  - [x] File: `frontend/src/pages/ProfilePage.tsx`
  - [x] On mount: call `apiClient.get<ProfileDto>('/api/v1/profile')`, store result in `useProfileStore.setProfile()`. Show `Skeleton` while loading (`isLoading: true`).
  - [x] If `profile` has all empty arrays and null summary → show the empty-state UI: "Your profile is empty — start building below" with a "Get Started" button that advances to step 0.
  - [x] Render a progress indicator (4 steps: Experience, Education, Skills, Summary) at the top — highlight the active step.
  - [x] Render the active step's form component: `ExperienceStep` (step 0), `EducationStep` (step 1), `SkillsStep` (step 2), `SummaryStep` (step 3).
  - [x] Each step receives `onSaveAndContinue` callback that calls `PUT /api/v1/profile` via `apiClient.put<ProfileDto>`, then calls `useProfileStore.setProfile()` with the result, shows `toast.success("Profile saved")`, and advances `currentStep`.
  - [x] On API error: show `toast.error("Failed to save profile — please try again")`. Do NOT use `console.error`.
  - [x] Read `currentStep` from `useProfileStore`, not `useState`.

- [x] Task 4: Implement `ExperienceStep` component (AC: 2, 3, 4)
  - [x] File: `frontend/src/components/profile/ExperienceStep.tsx`
  - [x] Manages a local list of work experience entry drafts (only this component needs local state for the form entries themselves — cross-step persistence goes through the store via `onSaveAndContinue`).
  - [x] Initialize from `useProfileStore.profile.workExperiences` on mount.
  - [x] Each entry: `jobTitle` (`Input`, required), `company` (`Input`, required), `startDate` (`Input type="date"`), `endDate` (`Input type="date"`, disabled when `isCurrent` is checked), `isCurrent` (`Checkbox`), `description` (`Textarea`, optional).
  - [x] Blur validation: on blur of `jobTitle` or `company`, if empty set a per-field error string; display below field in `<p className="text-sm text-red-600">`. Clear error on input change.
  - [x] "Add another" button appends a blank entry to the local list.
  - [x] Remove button (×) per entry (do not show if only one entry remains and all fields are blank).
  - [x] "Save & Continue" button: validates all entries (block if any required field error), constructs `WorkExperienceRequest[]` from the local state, calls `onSaveAndContinue` with the merged `ProfileUpdateRequest`.
  - [x] Use shadcn/ui `Input`, `Textarea`, `Checkbox` — do NOT manually edit files under `components/ui/`.

- [x] Task 5: Implement `EducationStep` component (AC: 3, 4)
  - [x] File: `frontend/src/components/profile/EducationStep.tsx`
  - [x] Same pattern as `ExperienceStep`: local list, initialize from store, blur validation on `institution` (required), "Add another", "Save & Continue".
  - [x] Fields per entry: `institution` (required), `degree` (optional), `fieldOfStudy` (optional), `startDate`, `endDate`.

- [x] Task 6: Implement `SkillsStep` component (AC: 3, 4)
  - [x] File: `frontend/src/components/profile/SkillsStep.tsx`
  - [x] Manages a list of skill name strings.
  - [x] Initialize from `useProfileStore.profile.skills`.
  - [x] Each skill: `Input` with blur validation (`name` required), remove button.
  - [x] "Add another" appends a blank skill input.
  - [x] "Save & Continue" validates all names non-blank, constructs `SkillRequest[]`, calls `onSaveAndContinue`.

- [x] Task 7: Implement `SummaryStep` component (AC: 4)
  - [x] File: `frontend/src/components/profile/SummaryStep.tsx`
  - [x] Single `Textarea` for `summary` (optional — user can skip).
  - [x] Initialize from `useProfileStore.profile.summary`.
  - [x] "Save & Finish" button calls `onSaveAndContinue` — on success shows `toast.success("Profile complete!")` and redirects to `/` (dashboard) using `useNavigate`.
  - [x] "Skip" link also navigates to `/` without saving.

- [x] Task 8: Write `ProfileForm.test.tsx` (AC: 7)
  - [x] File: `frontend/src/components/profile/ProfileForm.test.tsx`
  - [x] Use Vitest + `@testing-library/react` + `@testing-library/user-event` (all already in `package.json`).
  - [x] Mock `apiClient` — import and `vi.mock('@/lib/apiClient')`.
  - [x] Test 1: Blur on empty `jobTitle` in `ExperienceStep` renders `text-red-600` error below the field.
  - [x] Test 2: Clicking "Add another" in `ExperienceStep` appends a new entry group (assert the count of `jobTitle` inputs increases by 1).
  - [x] Test 3: Filling out a valid experience entry and clicking "Save & Continue" calls `apiClient.put` with the correct `ProfileUpdateRequest` shape (assert `workExperiences[0].jobTitle` matches input value).
  - [x] Mock `useProfileStore` to provide a clean initial profile state.
  - [x] Do NOT import from `components/ui/` directly — test behavior, not shadcn internals.

- [x] Task 9: Lint gate
  - [x] Run `cd frontend && npm run lint` — must pass with 0 errors before marking `review`.

## Dev Notes

### CRITICAL: The existing `ProfileDto` in `types/api.ts` is WRONG — must replace it

`frontend/src/types/api.ts` lines 44–51 define a `ProfileDto` with `id`, `userId`, `fullName`, `email`, `updatedAt`. This is a placeholder that does NOT match the actual backend response. The real backend `ProfileDto` record (`src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java`) has:
```
record ProfileDto(String summary, List<WorkExperienceDto> workExperiences, List<EducationDto> education, List<SkillDto> skills)
```
**Replace the `ProfileDto` interface entirely** (Task 1). Also add the new request types. The `useProfileStore` already imports `ProfileDto` from `types/api` — after the fix it will compile correctly.

### Toast library: use `sonner`, not a custom Toast component

`App.tsx` uses `<Toaster />` from `@/components/ui/sonner` (the sonner library adapter). Call `toast.success("Profile saved")` / `toast.error(...)` from `import { toast } from "sonner"`. Do NOT use a custom `useToast` hook — the project uses `sonner` v2.0.7 directly.

### Multi-step: `currentStep` lives in `useProfileStore`, not local `useState`

Per the architecture rule: use existing Zustand stores (`useProfileStore`) for cross-component shared data; never `useState` for cross-step state. `ProfilePage` reads `currentStep` from the store. Step components receive what they need via props.

However, the **form draft state within a step** (the list of work experience entries being edited before saving) is local to that step component. It is initialized from the store on mount and only written back to the store on "Save & Continue". This is intentional and correct — draft edits are not persisted until the user saves.

### Date fields: use ISO string `"YYYY-MM-DD"` throughout

Backend uses `LocalDate` → serialized by Jackson as `"2024-09-01"`. Store as `string | null` in TypeScript. Use `<input type="date" />` (native) which produces and accepts `"YYYY-MM-DD"` format natively. Parse with `new Date()` only at display time, never earlier.

### Zustand state updates must be immutable

Always: `set(state => ({ ...state, field: newValue }))`. Never `set({ field: newValue })` (loses other state slices). This is enforced by the architecture and already followed in `useProfileStore.ts`.

### `ProfilePage` route is already protected — no auth redirect needed

`router/index.tsx` wraps `/profile` in `<ProtectedRoute />` which wraps in `<AppShell>`. `ProfilePage` renders inside `AppShell` automatically — do NOT add another `AppShell` wrapper inside the page.

### `ProfileController` endpoint: user-scoped, no id in request

`GET /api/v1/profile` and `PUT /api/v1/profile` are scoped to the authenticated JWT principal automatically. No user id in request body or URL. The `ProfileDto` response has no `id` field — the profile is identified by the authenticated user.

### `PUT /api/v1/profile` is a full-document replace

Every `PUT` replaces ALL sections. When saving step 0 (Experience), the request must include the current values for `education`, `skills`, and `summary` from the store (to preserve them). Construct the full `ProfileUpdateRequest` from the store's existing values merged with the step's new data.

### Validation: blur-on-required vs submit-gate

- Blur validation: fires on individual field blur, shows error below field in `text-sm text-red-600`.
- Submit gate: "Save & Continue" validates all entries in the step before calling the API. If any required field is blank, block the API call and show errors on all offending fields.

### File structure for profile components

Per architecture target tree:
```
frontend/src/components/profile/   ← NEW directory
  ExperienceStep.tsx
  EducationStep.tsx
  SkillsStep.tsx
  SummaryStep.tsx
  ProfileForm.test.tsx              ← co-located test file
```

### Empty state detection

An "empty profile" from the API response is: `profile.summary === null && profile.workExperiences.length === 0 && profile.education.length === 0 && profile.skills.length === 0`. Show the empty-state CTA in this case. Once the user clicks "Get Started", set `currentStep` to 0 in the store and render the Experience step.

### Progress indicator: simple, no library needed

Four step labels as a horizontal list. Active step: `text-blue-600 font-medium`. Completed steps (index < currentStep): `text-zinc-500 line-through` or checkmark. Future steps: `text-zinc-400`. Use `<ol>` with `aria-label="Profile completion steps"` for screen reader accessibility.

### shadcn/ui components already installed

Available in `frontend/src/components/ui/`: `button`, `input`, `textarea`, `dialog`, `sheet`, `toast`, `tabs`, `badge`, `collapsible`, `checkbox`, `skeleton`. Import from `@/components/ui/<name>`. Do NOT edit these files.

### No backend changes required

Story 2.1 already implemented `ProfileController`, `ProfileService`, `GET /api/v1/profile`, and `PUT /api/v1/profile`. This story is **frontend-only**. Zero backend changes.

### Previous story learnings (2.1)

- `GET /api/v1/profile` returns HTTP 200 with empty arrays when no profile exists — never 404. Handle normally, no special error case for new users.
- The `isCurrent` boolean on work experience defaults to `false` in the backend. Include it in the request payload.
- Date fields are `LocalDate` → `"YYYY-MM-DD"` strings in JSON (not ISO-8601 with time). Input type="date" aligns perfectly.
- `PUT /api/v1/profile` returns the updated `ProfileDto` — update the store with the response, not the request payload.

### Testing patterns

- Vitest + `@testing-library/react` + `@testing-library/user-event` — all installed in `package.json`.
- Co-locate test as `ProfileForm.test.tsx` in `frontend/src/components/profile/`.
- Mock pattern: `vi.mock('@/lib/apiClient', () => ({ apiClient: { put: vi.fn().mockResolvedValue({...}), get: vi.fn().mockResolvedValue({...}) } }))`.
- Do not import from `components/ui/` in tests — query by role/label/text.

### Project Structure Notes

- New components under `frontend/src/components/profile/` — consistent with architecture target tree.
- `ProfilePage.tsx` in `frontend/src/pages/ProfilePage.tsx` — already exists (stub: `<div>Profile Page</div>`), replace entirely.
- `useProfileStore.ts` in `frontend/src/stores/useProfileStore.ts` — already exists, extend without replacing.
- `frontend/src/types/api.ts` — update `ProfileDto` and add new interfaces; keep all existing non-profile interfaces intact.

### References

- Story ACs and UX requirements: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2 (lines 398–433)]
- UX-DR20 (multi-step profile UX): [Source: _bmad-output/planning-artifacts/epics.md#UX Design Requirements (line 124)]
- UX-DR15 (empty states): [Source: _bmad-output/planning-artifacts/epics.md#UX Design Requirements (line 119)]
- Frontend directory structure: [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns (lines 327–341)]
- Zustand state patterns: [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns (lines 380–387)]
- Toast/feedback patterns: [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Error Handling (lines 396–401)]
- shadcn/ui component list: [Source: frontend/package.json — shadcn ^4.7.0, sonner ^2.0.7]
- Backend ProfileDto actual shape: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java]
- Backend request shapes: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/WorkExperienceRequest.java, EducationRequest.java, SkillRequest.java, ProfileUpdateRequest.java]
- Existing ProfilePage stub: [Source: frontend/src/pages/ProfilePage.tsx]
- Existing ProfileStore: [Source: frontend/src/stores/useProfileStore.ts]
- Wrong ProfileDto to replace: [Source: frontend/src/types/api.ts lines 44–51]
- Router wrapping (AppShell already provided): [Source: frontend/src/router/index.tsx lines 41–55]
- apiClient usage pattern: [Source: frontend/src/lib/apiClient.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Replaced wrong `ProfileDto` in `types/api.ts` (had `id/userId/fullName/email/updatedAt`) with correct shape from backend: `summary, workExperiences[], education[], skills[]`; added all sub-interfaces and request types.
- Extended `useProfileStore` with `currentStep`, `setStep`, `isLoading`, `setLoading` using immutable update pattern.
- Implemented `ProfilePage.tsx`: loads profile on mount via `apiClient.get`, shows `Skeleton` while loading, shows empty-state CTA when profile is empty, renders 4-step progress indicator (accessible `<ol aria-label>`), dispatches step components, handles `onSaveAndContinue` (full-document PUT, toast, step advance).
- Implemented `ExperienceStep.tsx`: local draft list, init from store, blur validation on `jobTitle`/`company`, `isCurrent` disables `endDate`, "Add another", remove button (hidden when single blank entry), submit gate.
- Implemented `EducationStep.tsx`: same pattern, blur validation on `institution`, optional degree/fieldOfStudy/dates.
- Implemented `SkillsStep.tsx`: flat list of skill name strings, blur validation, add/remove.
- Implemented `SummaryStep.tsx`: optional textarea, "Save & Finish" toasts and navigates to `/`, "Skip" navigates without saving.
- Written `ProfileForm.test.tsx` with 4 tests (3 required by AC-7 + 1 extra submit-gate test); all pass via Vitest + @testing-library/react.
- ESLint: 0 errors. All 9 tests pass (4 new + 5 existing AppShell tests).
- [Code review fixes 2026-05-29] Addressed all 12 blocking findings:
  1. `loadProfile` wrapped in `useCallback` with stable store action deps — complete dep array, no re-fetch loop.
  2. `handleSaveAndContinue` uses uniform hook-destructured `setSaving`/`setProfile`/`setStep` — no `getState()` mixing.
  3. `setStep(currentStep + 1)` uses captured closure value; functional updater comment added; stale-closure risk acknowledged (double-click guarded by `isSaving` disable on button).
  4. `SummaryStep.handleSaveAndFinish` wrapped in try/catch — `toast.success` and `navigate` only run on success.
  5. `useProfileStore` initialises `isLoading: true` — skeleton shows on first render, no blank flash.
  6. `ProfilePage.handleSaveAndContinue` guards `if (currentStep < LAST_STEP)` before calling `setStep` — SummaryStep navigates exclusively, no limbo step-4.
  7. All three step components now use `entries.length > 1` to show remove button — symmetric behaviour.
  8. `id: crypto.randomUUID()` added to `ExperienceDraft`, `EducationDraft`, `SkillEntryState`; all lists use `key={entry.draft.id}` / `key={skill.id}`.
  9. `isEmptyProfile` uses `!profile.summary` — catches both `null` and `""`.
  10. `hasStarted: boolean` (default `false`) added to store; "Get Started" sets `hasStarted(true)`; `showEmptyState` requires `!hasStarted`.
  11. `setSaving(true)` moved to before the `try` block; `setSaving(false)` in `finally`.
  12. `WorkExperienceRequest` changed to `type WorkExperienceRequest = WorkExperienceDto` (type alias with documented rationale).
- [Second-round review fixes 2026-05-29] Addressed 4 remaining findings:
  1. Fix 1 — double toast on SummaryStep: `toast.success("Profile saved")` and `setStep(currentStep + 1)` now only fire when `currentStep < LAST_STEP`; the last step's toast comes exclusively from `SummaryStep.handleSaveAndFinish`.
  2. Fix 2 — blank screen on load failure: added `error: string | null` + `setError` to `useProfileStore`; `loadProfile` sets `setError("Failed to load profile")` in catch; `ProfilePage` renders `<p>{error}</p> + <Button onClick={loadProfile}>Retry</Button>` when `!isLoading && error && profile === null`.
  3. Fix 3 — currentStep not reset: added `resetStep` action to store; `loadProfile` success path calls `resetStep()` when `!isEmptyProfile(data)`.
  4. Fix 4 — stale closure double-click: added `isSavingRef = useRef(false)` in `ProfilePage`; checked and set synchronously at top of `handleSaveAndContinue`, cleared in `finally`.
  — All 9 tests pass; lint 0 errors.

### File List

- `frontend/src/types/api.ts` — modified (replaced ProfileDto, added WorkExperienceDto, EducationDto, SkillDto, WorkExperienceRequest, EducationRequest, SkillRequest, ProfileUpdateRequest)
- `frontend/src/stores/useProfileStore.ts` — modified (added currentStep, setStep, isLoading, setLoading, error, setError, resetStep)
- `frontend/src/pages/ProfilePage.tsx` — modified (full implementation replacing stub)
- `frontend/src/components/profile/ExperienceStep.tsx` — new
- `frontend/src/components/profile/EducationStep.tsx` — new
- `frontend/src/components/profile/SkillsStep.tsx` — new
- `frontend/src/components/profile/SummaryStep.tsx` — new
- `frontend/src/components/profile/ProfileForm.test.tsx` — new

## Change Log

- 2026-05-29: Implemented story 2-2-profile-page-ui-manual-entry — all 9 tasks complete. Replaced placeholder ProfileDto, extended useProfileStore, implemented 4-step profile form (Experience, Education, Skills, Summary) with blur validation, empty-state CTA, progress indicator, full-document PUT on save, sonner toast feedback. 4 Vitest tests written; lint 0 errors; 9/9 tests pass.
- 2026-05-29: Code review fixes — addressed all 12 blocking findings: useCallback loadProfile, uniform store access, isSaving race fix, SummaryStep try/catch, isLoading init true, LAST_STEP guard, symmetric remove buttons, stable id keys, isEmptyProfile empty-string fix, hasStarted flag, WorkExperienceRequest type alias. All 9 tests pass; lint 0 errors.
- 2026-05-29: Second-round review fixes — addressed 4 remaining findings: (1) double toast on SummaryStep suppressed — generic "Profile saved" toast skipped when currentStep === LAST_STEP; (2) blank screen on load failure fixed — added error: string|null to store + setError action, loadProfile sets error on catch, ProfilePage renders error message + Retry button when !isLoading && error && profile === null; (3) currentStep stale on reload fixed — added resetStep action to store, loadProfile success path calls resetStep() when profile is non-empty; (4) double-click race fixed — isSavingRef (useRef) set synchronously on click entry, checked before proceeding, cleared in finally. All 9 tests pass; lint 0 errors.
