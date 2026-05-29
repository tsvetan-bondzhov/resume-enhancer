# Story 2.4: Resume Upload to Seed Profile

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to upload my existing PDF or DOCX resume to auto-populate my profile,
so that I don't have to re-enter my career history manually if I already have a resume.

## Acceptance Criteria

1. **Given** an authenticated user is on `/profile` **When** they click "Upload existing resume" **Then** a file picker limited to `.pdf` and `.docx` files is shown; the user can select a file to upload.

2. **Given** a valid PDF or DOCX is selected and submitted **When** the upload request to `POST /api/v1/upload` completes **Then** the extracted `ParsedResumeDto` is used to pre-populate the profile form fields (work experience, education, skills sections); the user sees the auto-filled data in the profile editor immediately.

3. **Given** the file exceeds 10MB or has an invalid MIME type **When** the upload is rejected by the server (HTTP 422) **Then** a `Toast` error appears: "File rejected — must be a PDF or DOCX under 10MB"; the form is unchanged.

4. **Given** the file is valid but the parser extracts no recognizable content **When** the parsed result has empty sections **Then** the empty profile form is shown with a Toast warning "We couldn't extract profile data — please enter your details manually"; the empty state does not break the form.

5. **Given** the user reviews the auto-extracted data **When** they edit any field **Then** inline editing works identically to manual entry (Story 2.2); they can correct or add to any auto-filled field before saving.

6. **Given** the user saves the pre-populated profile **When** `PUT /api/v1/profile` is called **Then** the reviewed data is persisted; the user proceeds through the multi-step form to confirm each section (UX-DR20).

## Tasks / Subtasks

- [x] Task 1: Add `ParsedResumeDtoResponse` TypeScript interface to `types/api.ts` (AC: 2)
  - [x] Open `frontend/src/types/api.ts` and add the interface — do NOT create a new file.
  - [x] Interface shape maps exactly to `ParsedResumeDto` Java record:
    ```typescript
    export interface ParsedResumeDtoResponse {
      rawText: string
      workExperienceLines: string[]
      educationLines: string[]
      skillLines: string[]
    }
    ```
  - [x] Place it after the existing profile interfaces, before any future resume interfaces.

- [x] Task 2: Add `uploadResume` method to `apiClient` (AC: 1, 2, 3)
  - [x] Open `frontend/src/lib/apiClient.ts` — MODIFY, do NOT replace.
  - [x] `apiClient` currently has `get`, `post`, `put`, `delete` which all use `JSON.stringify` on the body and set `Content-Type: application/json`. File upload uses `multipart/form-data` — do NOT set `Content-Type` manually; let the browser set it with the boundary automatically.
  - [x] Add the following method to the `apiClient` export object:
    ```typescript
    uploadFile: <T>(path: string, formData: FormData) =>
      request<T>(path, { method: "POST", body: formData }),
    ```
  - [x] CRITICAL: The `request()` function has `...(hasBody ? { "Content-Type": "application/json" } : {})`. Since `formData` IS a body (`init?.body !== undefined`), this would incorrectly set `Content-Type: application/json` and break multipart. You MUST modify the `hasBody` logic to exclude `FormData`:
    ```typescript
    const hasBody = init?.body !== undefined && !(init.body instanceof FormData)
    ```
  - [x] This single-line change to `hasBody` is the key to not breaking the existing JSON methods while enabling multipart upload.

- [x] Task 3: Create `useResumeUpload` hook (AC: 1, 2, 3, 4)
  - [x] Create `frontend/src/hooks/useResumeUpload.ts` — new file in `frontend/src/hooks/` per architecture.
  - [x] This hook owns all upload state and logic; `ProfilePage` delegates to it.
  - [x] Hook signature:
    ```typescript
    export function useResumeUpload(): {
      isUploading: boolean
      triggerUpload: () => void
    }
    ```
  - [x] Internally:
    - Maintains `isUploading: boolean` state via `useState`.
    - Creates a hidden `<input type="file" accept=".pdf,.docx">` ref via `useRef<HTMLInputElement>(null)`.
    - `triggerUpload()` programmatically clicks the hidden input (`.current?.click()`).
    - On `onChange` of the input: reads `event.target.files?.[0]`, if present builds `FormData` with `formData.append("file", selectedFile)`, calls `apiClient.uploadFile<ParsedResumeDtoResponse>("/api/v1/upload", formData)`.
    - On success: converts `ParsedResumeDtoResponse` → `Partial<ProfileUpdateRequest>` via `mapParsedToProfile()` (see Task 4), then calls `setProfile` and `setHasStarted(true)` from `useProfileStore` to make the multi-step form appear with pre-filled data.
    - On empty parse (all three line lists empty): show `toast.warning("We couldn't extract profile data — please enter your details manually")`, call `setHasStarted(true)` to show the blank form.
    - On 422 error (caught as `ApiError` with `status === 422`): show `toast.error("File rejected — must be a PDF or DOCX under 10MB")`.
    - On any other error: show `toast.error("Upload failed — please try again")`.
    - Always clear `isUploading` in `finally`.
  - [x] The hidden file `<input>` must be returned from the hook as a JSX element (or a ref the caller renders). Simplest approach: return a `fileInputRef` + a `renderFileInput()` function that returns `<input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />`.
  - [x] Reset `input.value = ""` after processing so the same file can be re-selected.

- [x] Task 4: Implement `mapParsedToProfile` conversion utility (AC: 2, 4, 5)
  - [x] Add as a non-exported helper inside `useResumeUpload.ts` (or a named export if it simplifies testing).
  - [x] Signature: `function mapParsedToProfile(parsed: ParsedResumeDtoResponse): Partial<ProfileUpdateRequest>`
  - [x] Logic:
    - `workExperienceLines` → each non-blank line becomes a `WorkExperienceRequest` with `jobTitle: line`, `company: ""`, `startDate: null`, `endDate: null`, `isCurrent: false`, `description: null`. Blank company is intentional — user reviews and fills in.
    - `educationLines` → each non-blank line becomes an `EducationRequest` with `institution: line`, `degree: null`, `fieldOfStudy: null`, `startDate: null`, `endDate: null`.
    - `skillLines` → each non-blank line becomes a `SkillRequest` with `name: line`.
    - Filter out blank/whitespace-only lines before mapping.
    - If all three lists are empty → return `{}` (empty partial — caller detects this as "empty parse" case).
  - [x] This function converts the raw heuristic line extraction from Story 2.3's `ParsedResumeDto` into the typed profile structure the form uses. Since the parser returns plain lines (not structured objects), the mapping is intentionally lossy — the user reviews and corrects.

- [x] Task 5: Add "Upload existing resume" button to `ProfilePage.tsx` (AC: 1, 2, 3, 4, 6)
  - [x] MODIFY `frontend/src/pages/ProfilePage.tsx` — this is an UPDATE, not a replacement.
  - [x] Render the "Upload existing resume" button in BOTH states:
    - In the empty-state panel (alongside or below the "Get Started" button) so first-time users can choose upload as an alternative to manual entry.
    - In the multi-step form header area so users who have already started can also trigger an upload to overwrite/seed from a file.
  - [x] Use `useResumeUpload` hook; call `triggerUpload()` on button click; show `isUploading` state on the button (e.g., "Uploading..." text + `disabled`).
  - [x] Render the hidden file input (returned from the hook) anywhere in the component tree — it is invisible.
  - [x] Button label: "Upload existing resume". Use `variant="outline"` (matches UX tone — secondary action).
  - [x] PRESERVE all existing `ProfilePage` behavior: `handleSaveAndContinue`, progress indicator, error/retry state, step rendering, `isSavingRef` double-click guard. Do NOT restructure the component.
  - [x] When `mapParsedToProfile` returns data, the hook calls `setProfile(...)` with the pre-populated `ProfileDto` equivalent. Since `ProfileDto` shape and `ProfileUpdateRequest` shape are compatible (same structure), construct a `ProfileDto`-shaped object from the mapped partial to call `setProfile`.
    - Specifically: `setProfile({ summary: null, workExperiences: mappedPartial.workExperiences ?? [], education: mappedPartial.education ?? [], skills: mappedPartial.skills ?? [] })` then `setHasStarted(true)` so the multi-step form renders pre-filled.

- [x] Task 6: Frontend tests — `ResumeUpload.test.tsx` (AC: 1, 2, 3, 4)
  - [x] Create `frontend/src/hooks/useResumeUpload.test.ts` OR co-locate as `frontend/src/components/profile/ResumeUpload.test.tsx` — either location is acceptable per project co-location convention.
  - [x] Mock `apiClient.uploadFile` with `vi.fn()`.
  - [x] Mock `sonner` toast functions.
  - [x] Test 1: Successful upload with non-empty parse → `useProfileStore.profile` is updated with pre-populated data; `hasStarted` becomes `true`.
  - [x] Test 2: Server returns 422 → `toast.error` called with "File rejected — must be a PDF or DOCX under 10MB"; profile store unchanged.
  - [x] Test 3: Successful upload but all line lists empty → `toast.warning` called with "We couldn't extract profile data — please enter your details manually"; `hasStarted` becomes `true` (form is shown empty, not broken).
  - [x] Test 4: Network error (non-422) → `toast.error` called with "Upload failed — please try again".
  - [x] Use `renderHook` from `@testing-library/react` to test the hook directly.
  - [x] Follow the same mock/reset pattern from `ProfileForm.test.tsx` (see `resetProfileStore()` helper).

## Dev Notes

### CRITICAL: `apiClient` does NOT support multipart — must modify it

`frontend/src/lib/apiClient.ts` currently sets `Content-Type: application/json` for any request that has a body (`const hasBody = init?.body !== undefined`). Sending a `FormData` body through this logic would corrupt the multipart boundary header.

The fix is a one-line change to the `hasBody` check:
```typescript
// BEFORE (line 21):
const hasBody = init?.body !== undefined
// AFTER:
const hasBody = init?.body !== undefined && !(init.body instanceof FormData)
```

Then add `uploadFile` to the `apiClient` export. Do not use raw `fetch()` in components — all API calls go through `apiClient`.

### How the upload → profile seeding flow works

```
User clicks "Upload existing resume"
  → hidden <input type="file"> click triggered
  → user selects file
  → FormData built: formData.append("file", file)
  → apiClient.uploadFile<ParsedResumeDtoResponse>("/api/v1/upload", formData)
  → POST /api/v1/upload (existing UploadController, Story 2.3)
  → returns ParsedResumeDto { rawText, workExperienceLines, educationLines, skillLines }
  → mapParsedToProfile(parsed) → Partial<ProfileUpdateRequest>
  → useProfileStore.setProfile(seededProfileDto) + setHasStarted(true)
  → ProfilePage re-renders with pre-filled multi-step form at step 0
  → User reviews/edits and clicks "Save & Continue" as normal (AC 5, 6)
```

No new backend endpoint. `POST /api/v1/upload` from Story 2.3 is consumed as-is.

### Backend: no changes needed

`UploadController`, `ParsingService`, `FileValidator`, `PdfParser`, `DocxParser`, `SectionExtractor` — all implemented and tested in Story 2.3. Do NOT touch any backend files. The existing `POST /api/v1/upload` endpoint returns `ParsedResumeDto` which is exactly what this story consumes.

### `ParsedResumeDto` line format — set user expectations

`workExperienceLines`, `educationLines`, `skillLines` are heuristic raw-text lines from the resume, NOT structured objects. Each line might be a full sentence like "Software Engineer at Acme Corp, 2020–2023". The mapper converts each line to a draft entry with `jobTitle: line` and empty company, which the user must review. This is intentional — the story spec says "the user reviews the auto-extracted data" (AC 5).

### `useProfileStore` — existing actions to use

Do NOT add new store actions. Use the existing actions:
- `setProfile(profile: ProfileDto | null)` — call with seeded data
- `setHasStarted(v: boolean)` — call `setHasStarted(true)` to show the multi-step form
- `setStep(0)` — explicitly reset to step 0 so user starts from Experience step with seeded data

After `setProfile` + `setHasStarted(true)`, `ProfilePage` will render the multi-step form with the seeded data pre-loaded because `ExperienceStep`, `EducationStep`, and `SkillsStep` all read from `useProfileStore((s) => s.profile)` to initialize their `useState`.

### Empty-state vs. multi-step form placement of upload button

The upload button must appear in BOTH UI states:
1. **Empty state** (`showEmptyState === true`): add "Upload existing resume" as a secondary button below "Get Started".
2. **Multi-step form** (`showEmptyState === false`): add "Upload existing resume" as a small outline button in the header area (near the `<h1>`) so users who've already started can still trigger an upload.

This matches the UX design intent: "Upload path is fastest — one action converts existing work into profile. Priority path." [Source: _bmad-output/planning-artifacts/ux-design-specification.md line 444]

### Toast library: `sonner`

Project uses `sonner` (not shadcn toast directly). Import `{ toast }` from `"sonner"`. Call:
- `toast.error("...")` for hard failures
- `toast.warning("...")` for soft warnings (empty parse)
- `toast.success("...")` is NOT needed here (profile-filled success is shown visually by the pre-filled form appearing)

See `ProfilePage.tsx` and `ExperienceStep.tsx` for existing usage patterns.

### File input pattern for hidden file picker

```tsx
// Inside ProfilePage or delegated to useResumeUpload hook:
const fileInputRef = useRef<HTMLInputElement>(null)

function triggerUpload() {
  fileInputRef.current?.click()
}

// In JSX:
<input
  ref={fileInputRef}
  type="file"
  accept=".pdf,.docx"
  className="hidden"
  onChange={handleFileChange}
/>
<Button variant="outline" onClick={triggerUpload} disabled={isUploading}>
  {isUploading ? "Uploading..." : "Upload existing resume"}
</Button>
```

The `accept` attribute restricts the file picker UI (but is not a security control — the server validates MIME type).

### TypeScript: `ProfileUpdateRequest` vs `ProfileDto`

`ProfileUpdateRequest` and `ProfileDto` are structurally nearly identical — both have `summary`, `workExperiences`, `education`, `skills`. The store holds `ProfileDto | null`. When seeding from parsed data, build a `ProfileDto`-shaped object:
```typescript
const seeded: ProfileDto = {
  summary: null,
  workExperiences: mapped.workExperiences ?? [],
  education: mapped.education ?? [],
  skills: mapped.skills ?? [],
}
useProfileStore.getState().setProfile(seeded)
```
`WorkExperienceDto` ≅ `WorkExperienceRequest` (the codebase has `export type WorkExperienceRequest = WorkExperienceDto`). `EducationDto` ≅ `EducationRequest` (same fields). `SkillDto` ≅ `SkillRequest` (both `{ name: string }`). The mapping is type-safe.

### No integration test required for this story

Per the pattern established in Story 2.3 (which explicitly deferred `UploadControllerIntegrationTest.java`), an integration test is not required here. The backend endpoint is already tested. Frontend unit tests (Task 6) are the required artifact.

### ESLint compliance

Before marking story done: run `cd frontend && npm run lint` — must pass with 0 errors.
- `hidden` input without a visible label: add `aria-label="Upload resume file"` to the hidden input to avoid a11y linter warnings.
- Avoid `any` in `mapParsedToProfile` — use `ParsedResumeDtoResponse` types throughout.

### Project Structure Notes

Files being MODIFIED (must preserve existing behavior):
- `frontend/src/lib/apiClient.ts` — one-line change to `hasBody`, plus `uploadFile` added to export object
- `frontend/src/pages/ProfilePage.tsx` — add upload button in both states; preserve all existing logic
- `frontend/src/types/api.ts` — append `ParsedResumeDtoResponse` interface

Files being CREATED:
- `frontend/src/hooks/useResumeUpload.ts` — new hook
- `frontend/src/hooks/useResumeUpload.test.ts` (or `frontend/src/components/profile/ResumeUpload.test.tsx`)

No backend changes. No new Zustand stores. No new pages. No Flyway migrations.

### References

- Story ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4 (lines 462–494)]
- Upload endpoint (Story 2.3 built): [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/UploadController.java]
- ParsedResumeDto shape: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ParsedResumeDto.java]
- ProfileService PUT contract: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java]
- ProfilePage current state: [Source: frontend/src/pages/ProfilePage.tsx]
- useProfileStore actions: [Source: frontend/src/stores/useProfileStore.ts]
- apiClient architecture: [Source: frontend/src/lib/apiClient.ts]
- ProfileDto / request types: [Source: frontend/src/types/api.ts]
- ProfileForm.test.tsx pattern: [Source: frontend/src/components/profile/ProfileForm.test.tsx]
- Upload path UX: [Source: _bmad-output/planning-artifacts/ux-design-specification.md line 444]
- Toast sonner usage: [Source: frontend/src/pages/ProfilePage.tsx line 3, 66, 117]
- Previous story notes (2.3): [Source: _bmad-output/implementation-artifacts/2-3-file-upload-infrastructure-and-resume-parsing.md#Completion Notes]
- Architecture FR7/FR10 mapping: [Source: _bmad-output/planning-artifacts/architecture.md line 667]
- apiClient rules: [Source: _bmad-output/project-context.md#Framework-Specific Rules (React/Frontend)]
- File upload security (MIME + size): [Source: _bmad-output/planning-artifacts/architecture.md line 201]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No debug issues encountered. Implementation followed story spec exactly.

### Completion Notes List

- AC1: Hidden `<input type="file" accept=".pdf,.docx">` wired via `useResumeUpload` hook; `triggerUpload()` programmatically clicks it; "Upload existing resume" button appears in both empty-state and multi-step form header.
- AC2: `apiClient.uploadFile` posts `FormData` to `POST /api/v1/upload`; `mapParsedToProfile` converts `ParsedResumeDtoResponse` lines to typed profile entries; `setProfile` + `setHasStarted(true)` seeds the multi-step form.
- AC3: `ApiError` with `status === 422` caught and mapped to `toast.error("File rejected — must be a PDF or DOCX under 10MB")`.
- AC4: Empty parse (all three line lists empty) → `toast.warning("We couldn't extract profile data — please enter your details manually")` + `setHasStarted(true)` shows blank form.
- AC5: Pre-filled form uses existing `ExperienceStep`/`EducationStep`/`SkillsStep` inline editing — no new behavior needed.
- AC6: `handleSaveAndContinue` in `ProfilePage` unchanged; seeded data flows through normal PUT `/api/v1/profile` path.
- Key fix: `hasBody` in `apiClient.ts` now excludes `FormData` to prevent `Content-Type: application/json` being set on multipart requests.
- All 4 tests pass; 23/23 suite-wide; ESLint 0 errors.

### File List

- `frontend/src/types/api.ts` — added `ParsedResumeDtoResponse` interface
- `frontend/src/lib/apiClient.ts` — fixed `hasBody` for `FormData`; added `uploadFile` method
- `frontend/src/hooks/useResumeUpload.ts` — new hook with `mapParsedToProfile`, `triggerUpload`, `renderFileInput`, upload state machine
- `frontend/src/pages/ProfilePage.tsx` — integrated `useResumeUpload`; upload button in empty-state and multi-step form header
- `frontend/src/hooks/useResumeUpload.test.ts` — 4 tests covering all upload outcomes

### Change Log

- 2026-05-29: Implemented Story 2.4 — resume upload to seed profile. Added `ParsedResumeDtoResponse` type, `uploadFile` to `apiClient`, `useResumeUpload` hook with `mapParsedToProfile` conversion, upload button in `ProfilePage` (both states), and 4 unit tests. All ACs satisfied.
- 2026-05-29: Code review passed. Status set to `done`.

### Review Findings

- [x] [Review][Defer] No request abort controller when user navigates away mid-upload [frontend/src/hooks/useResumeUpload.ts] — deferred, pre-existing pattern across codebase; acceptable v1 limitation
