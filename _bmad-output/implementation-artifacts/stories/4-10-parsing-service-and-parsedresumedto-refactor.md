# Story 4.10: ParsingService and ParsedResumeDto Refactor

**Status:** done
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-10-parsing-service-and-parsedresumedto-refactor
**Dependencies:** Story 3.9 (done), Story 3.13 (done), Story 4.8 (backlog — SkillItem simplified before this runs)

---

## Story

As a user uploading a resume,
I want the LLM extraction result to be returned when Ollama is available,
So that my profile is seeded with structured, typed data rather than flat lines of text.

---

## Acceptance Criteria

**AC1 — `ParsedResumeDto` refactored to typed section lists**
**Given** `upload/dto/ParsedResumeDto.java` is rewritten
**When** parsing completes
**Then** the record has the following structure:
```java
public record ParsedResumeDto(
    String rawText,
    List<WorkExperienceItem> workExperiences,
    List<EducationItem> education,
    List<SkillItem> skills,
    List<CertificationItem> certifications,
    List<LanguageItem> languages,
    List<ProjectItem> projects,
    List<VolunteeringItem> volunteering,
    SummaryItem summary  // nullable — null when no summary section found
) {}
```
The old flat-line fields `workExperienceLines`, `educationLines`, `skillLines` are removed entirely.

---

**AC2 — `LlmSectionExtractor.extract()` returns `ParsedResumeDto`**
**Given** `LlmSectionExtractor.java` is updated
**When** `extract(rawSections, fullRawText)` is called
**Then** the return type changes from `ResumeDocument` to `ParsedResumeDto`. The method iterates extracted sections, maps each `ResumeSectionType` to the corresponding list field in `ParsedResumeDto`, and excludes `UNKNOWN` sections from the DTO (they still affect nothing — their raw text is captured in `rawText`). The `SUMMARY` section maps to the single `summary` field (first item only; if none found, `summary` is null). Lists for sections absent from the extracted document default to `List.of()`.

---

**AC3 — `ParsingService.parse()` returns LLM result when available**
**Given** `ParsingService.java` is updated
**When** Ollama is available and `LlmSectionExtractor.extract()` completes without timeout or exception
**Then** the `ParsedResumeDto` returned by `extract()` is returned directly from `parse()`. The comment `// Return heuristic DTO (backward compat) — ResumeDocument is assembled for future use` and the line `return heuristicResult` after the LLM call are replaced with `return llmDto`. The heuristic result is still produced (for its `rawText`) but only returned when Ollama is unavailable, extraction times out, or extraction throws.

---

**AC4 — Heuristic fallback constructs `ParsedResumeDto` in new shape**
**Given** `PdfParser.java` and `DocxParser.java` are updated
**When** Ollama is unavailable and the heuristic path runs
**Then** parsers produce a valid `ParsedResumeDto` in the new format. Since heuristic parsers produce flat text lines, they map lines to typed items with minimal fields:
- Work experience lines → `WorkExperienceItem(id=UUID, jobTitle=line, company=null, startDate=null, endDate=null, isCurrent=false, description=null)`
- Education lines → `EducationItem(id=UUID, institution=line, degree=null, fieldOfStudy=null, startDate=null, endDate=null)`
- Skill lines → `SkillItem(id=UUID, name=line, category=null, proficiency=null)`
- `certifications`, `languages`, `projects`, `volunteering` = `List.of()`
- `summary` = `null`

The `rawText` field is still populated. No behavioral regressions on the heuristic path.

---

**AC5 — Frontend `useResumeUpload.ts` mapper updated**
**Given** `useResumeUpload.ts` and the `ParsedResumeDtoResponse` type in `api.ts` are updated
**When** the upload API returns the new `ParsedResumeDto` shape
**Then**:
- `ParsedResumeDtoResponse` in `api.ts` is replaced with a typed interface matching the new Java record (typed section arrays instead of flat string lists)
- `mapParsedToProfile()` maps item fields directly:
  ```ts
  workExperiences: dto.workExperiences?.map(item => ({
    jobTitle: item.jobTitle ?? "",
    company: item.company ?? "",
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    isCurrent: item.isCurrent ?? false,
    description: item.description ?? null,
  })) ?? []
  ```
  Similar mapping for `education` and `skills`. The function signature changes from `mapParsedToProfile(parsed: ParsedResumeDtoResponse)` to `mapParsedToProfile(parsed: ParsedResumeDtoResponse)` with the updated type.
- The "empty" check changes from checking `workExperienceLines.length === 0 && ...` to checking all typed section arrays are empty.
- The seeded `ProfileDto` object is constructed from the full typed arrays (all 8 section types), with `summary` mapped from `dto.summary?.text ?? null`.
- Null/empty lists are handled gracefully (no runtime errors on undefined arrays).

---

**AC6 — `UploadController` and API response unchanged**
**Given** `UploadController.java` is not modified
**When** `POST /api/v1/upload` is called
**Then** the endpoint still returns `ResponseEntity<ParsedResumeDto>` serialized as JSON. The JSON shape changes (new fields replace old flat lists) but no controller code changes.

---

**AC7 — Tests updated**
**Given** the story is implemented
**When** tests run
**Then**:
- `ParsingServiceTest.java`:
  - `parse_ollamaUnavailable_returnsHeuristicDtoWithoutCallingLlm` — updated to construct the new `ParsedResumeDto` shape for the heuristic mock
  - New test: `parse_ollamaAvailable_returnsLlmDto` — mocks `llmSectionExtractor.extract()` to return a known `ParsedResumeDto` with one `WorkExperienceItem`; asserts the returned DTO is the LLM dto (not the heuristic one)
  - New test: `parse_ollamaAvailable_llmThrows_returnsHeuristicDto` — mocks `extract()` to throw; asserts heuristic DTO is returned
- `LlmSectionExtractorTest.java`:
  - All existing tests updated to assert on `ParsedResumeDto` return type instead of `ResumeDocument`
  - New test: `extract_workExperienceSection_returnsTypedWorkExperiences` — asserts `result.workExperiences()` contains the expected item with correct fields
  - New test: `extract_summarySection_mapsSummaryField` — asserts `result.summary()` is non-null and `result.summary().text()` has expected value
- `useResumeUpload.test.ts`:
  - All mock responses updated to the new `ParsedResumeDtoResponse` shape (typed arrays)
  - Assertions updated to check typed field access (e.g., `profile?.workExperiences[0].jobTitle` rather than relying on the line being the jobTitle)

---

## Tasks / Subtasks

### Task 1: Rewrite `ParsedResumeDto.java` (AC: 1)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ParsedResumeDto.java`
- [x] Replace the entire record body with the new structure from AC1.
- [x] Add imports for all 8 item types from `com.tsvetanbondzhov.resumeenhancer.resume.domain.*`.
- [x] Note the architectural decision: `ParsedResumeDto` in `upload.dto` now imports types from `resume.domain.items`. This is acceptable because `ParsedResumeDto` is purely a data transfer object used to shuttle structured parsing results to the frontend — it does not embed domain logic. The `upload` package already imports from `resume.domain` (e.g., `LlmSectionExtractor` imports all item types). Keeping `ParsedResumeDto` in `upload.dto` avoids a more disruptive package reorganization. If the architecture is ever hardened to forbid cross-package imports, `ParsedResumeDto` could be moved to `resume.dto` alongside `ResumeDto`. **Document this decision in a comment in the file.**

### Task 2: Update `LlmSectionExtractor.extract()` return type (AC: 2)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`
- [x] Change the return type of `extract()` from `ResumeDocument` to `ParsedResumeDto`.
- [x] Replace the method body: instead of building `List<ResumeSection>`, build typed lists per section type. Use a `Map<ResumeSectionType, List<ResumeItem>>` internally during iteration, then extract per list at the end:
  ```java
  List<WorkExperienceItem> workExperiences = new ArrayList<>();
  List<EducationItem> education = new ArrayList<>();
  List<SkillItem> skills = new ArrayList<>();
  List<CertificationItem> certifications = new ArrayList<>();
  List<LanguageItem> languages = new ArrayList<>();
  List<ProjectItem> projects = new ArrayList<>();
  List<VolunteeringItem> volunteering = new ArrayList<>();
  SummaryItem summary = null;

  for (RawSection rawSection : rawSections) {
      // ... existing type detection + item extraction logic ...
      // dispatch to the correct list by sectionType
      // UNKNOWN items are skipped
  }

  return new ParsedResumeDto(
      fullRawText, workExperiences, education, skills,
      certifications, languages, projects, volunteering, summary
  );
  ```
- [x] `buildTypedItem()` and all private helpers remain unchanged — they still return `ResumeItem`.
- [x] For `SUMMARY` type: cast the first item to `SummaryItem` and assign to `summary` variable.
- [x] For `UNKNOWN` type: skip (do not add to any list).
- [x] Remove the `ResumeDocument` import if no longer used.

### Task 3: Fix `ParsingService.parse()` to return LLM result (AC: 3)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java`
- [x] Update the `CompletableFuture` variable type from `CompletableFuture<ResumeDocument>` to `CompletableFuture<ParsedResumeDto>`.
- [x] Change `llmSectionExtractor.extract(rawSections, rawText)` — it now returns `ParsedResumeDto` directly.
- [x] Replace:
  ```java
  ResumeDocument resumeDocument = future.get(LLM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
  log.info("LLM parsing complete: {} sections extracted", resumeDocument.sections().size());
  // Return heuristic DTO (backward compat) — ResumeDocument is assembled for future use
  return heuristicResult;
  ```
  with:
  ```java
  ParsedResumeDto llmDto = future.get(LLM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
  log.info("LLM parsing complete — returning LLM ParsedResumeDto");
  return llmDto;
  ```
- [x] Remove the `ResumeDocument` import from this file.

### Task 4: Update heuristic parsers (AC: 4)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/PdfParser.java`
- [x] Locate where `ParsedResumeDto` is constructed. Replace flat-list construction with typed item lists:
  - Work experience lines → `WorkExperienceItem` with `jobTitle = line`, all other fields null/false
  - Education lines → `EducationItem` with `institution = line`, all other fields null
  - Skill lines → `SkillItem` with `name = line`, `category = null`, `proficiency = null`
  - All other section lists = `List.of()`; `summary = null`
- [x] Apply the same changes to `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/DocxParser.java`.
- [x] Use `UUID.randomUUID().toString()` for the `id` field of each item.

### Task 5: Update `ParsedResumeDtoResponse` in `api.ts` and `useResumeUpload.ts` (AC: 5)

- [x] Open `frontend/src/types/api.ts`
- [x] Replace `ParsedResumeDtoResponse` with a typed interface:
  ```ts
  export interface ParsedResumeDtoWorkExperience {
    jobTitle: string | null
    company: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
    description: string | null
  }

  export interface ParsedResumeDtoEducation {
    institution: string | null
    degree: string | null
    fieldOfStudy: string | null
    startDate: string | null
    endDate: string | null
  }

  export interface ParsedResumeDtoSkill {
    name: string | null
    category: string | null
    proficiency: string | null
  }

  export interface ParsedResumeDtoCertification {
    name: string | null
    issuer: string | null
    issueDate: string | null
    expirationDate: string | null
  }

  export interface ParsedResumeDtoLanguage {
    language: string | null
    proficiency: string | null
  }

  export interface ParsedResumeDtoProject {
    name: string | null
    description: string | null
    technologies: string | null
    link: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
  }

  export interface ParsedResumeDtoVolunteering {
    role: string | null
    organization: string | null
    description: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
  }

  export interface ParsedResumeDtoSummary {
    text: string | null
  }

  export interface ParsedResumeDtoResponse {
    rawText: string
    workExperiences: ParsedResumeDtoWorkExperience[]
    education: ParsedResumeDtoEducation[]
    skills: ParsedResumeDtoSkill[]
    certifications: ParsedResumeDtoCertification[]
    languages: ParsedResumeDtoLanguage[]
    projects: ParsedResumeDtoProject[]
    volunteering: ParsedResumeDtoVolunteering[]
    summary: ParsedResumeDtoSummary | null
  }
  ```
- [x] Open `frontend/src/hooks/useResumeUpload.ts`
- [x] Update `mapParsedToProfile()` function: replace all flat-line array access with typed item array access (see AC5). The function return type should be updated to include all 8 profile section types.
- [x] Update the `seeded` `ProfileDto` construction to include all 8 section types (using empty arrays where items are empty, mapping `dto.summary?.text ?? null` for the summary field).
- [x] Update the "empty" check: `if (Object.keys(mapped).length === 0)` — simplest approach is to check all arrays are empty: `dto.workExperiences.length === 0 && dto.education.length === 0 && dto.skills.length === 0 && ...`.

### Task 6: Update tests (AC: 7)

- [x] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingServiceTest.java`
- [x] Update `parse_ollamaUnavailable_returnsHeuristicDtoWithoutCallingLlm` — change the `ParsedResumeDto` construction to use the new record shape (typed lists; use `List.of()` for all except work experience which has one item; `summary = null`).
- [x] Update `parse_ollamaAvailable_callsLlmSectionExtractor` — `llmSectionExtractor.extract()` now returns `ParsedResumeDto`; update mock return to a `ParsedResumeDto` with one `WorkExperienceItem`; assert `result` equals the LLM dto (not the heuristic dto).
- [x] Add `parse_ollamaAvailable_llmThrows_returnsHeuristicDto` test.
- [x] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java`
- [x] Update all tests: `llmSectionExtractor.extract(...)` returns `ParsedResumeDto` now. Change `ResumeDocument result = llmSectionExtractor.extract(...)` to `ParsedResumeDto result = llmSectionExtractor.extract(...)`. Access sections via the typed lists (`result.workExperiences()`, `result.skills()`, etc.) instead of `result.sections()`.
- [x] Open `frontend/src/hooks/useResumeUpload.test.ts`
- [x] Update all mock responses to the new shape. Update assertions (e.g. `profile?.workExperiences[0].jobTitle` may now differ from the line string if the heuristic mock is updated; keep assertions consistent with the new typed mapping).

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)
| File | Change |
|------|--------|
| `src/main/java/.../upload/dto/ParsedResumeDto.java` | Replace with typed section lists record |
| `src/main/java/.../upload/parsers/LlmSectionExtractor.java` | Change return type to `ParsedResumeDto` |
| `src/main/java/.../upload/ParsingService.java` | Return LLM result; remove `ResumeDocument` variable |
| `src/main/java/.../upload/parsers/PdfParser.java` | Construct new `ParsedResumeDto` shape |
| `src/main/java/.../upload/parsers/DocxParser.java` | Construct new `ParsedResumeDto` shape |
| `frontend/src/types/api.ts` | Replace `ParsedResumeDtoResponse` |
| `frontend/src/hooks/useResumeUpload.ts` | Update `mapParsedToProfile()` |
| `src/test/java/.../upload/ParsingServiceTest.java` | Update mock shapes; add LLM-returned test |
| `src/test/java/.../upload/LlmSectionExtractorTest.java` | Assert `ParsedResumeDto` return type |
| `frontend/src/hooks/useResumeUpload.test.ts` | Update mock responses and assertions |

### Files to Create (NEW)
None.

### Critical Implementation Details

**`LlmSectionExtractor.extract()` signature change is a breaking change** for `ParsingService` (its only caller). Both files must be updated atomically. `LlmSectionExtractorTest` mocks `AiService` not `LlmSectionExtractor`, so the test compiles against the real updated extractor — the test method bodies need to change their assertions to use the typed lists.

**`heuristicItems()` in `LlmSectionExtractor`** currently returns `List<ResumeItem>` (a list of `GenericItem`). This method is only used internally for section-level fallbacks within `extract()`. After the refactor, the typed lists in `ParsedResumeDto` won't include `GenericItem` entries from heuristic fallback — sections where LLM fails fall back to empty lists for that section type (the items are simply excluded). This is acceptable since the heuristic parsers produce the fallback `ParsedResumeDto` at the `ParsingService` level.

**`useResumeUpload.ts` — `seeded` ProfileDto must type-check:** The inline object literal `const seeded: ProfileDto = { ... }` currently omits many fields (certifications, languages, etc.). After this story, `ProfileDto` includes all 8 sections. The seeded object must include all 8. Use `dto.certifications?.map(...) ?? []` etc. for sections the heuristic parser may not populate.

**`ProfileDto` TypeScript interface already has all 8 sections** (verified in `api.ts` line 231). The only change to `api.ts` for `ProfileDto` itself is in Story 4.9 (adding contact fields). This story only changes `ParsedResumeDtoResponse`.

**Architecture note on cross-package imports:** `ParsedResumeDto` in `upload.dto` importing from `resume.domain` is consistent with the existing pattern — `LlmSectionExtractor` in `upload.parsers` already imports all 8 item types from `resume.domain`. The `upload` package is a consumer of `resume.domain` types, not a sibling package with equal standing. This direction of dependency (upload → resume.domain) is fine. The reverse would be problematic.

---

## Dev Notes

**Architectural decision on package placement of `ParsedResumeDto`:** Leaving it in `upload.dto` is the path of least resistance. All callers (`ParsingService`, `UploadController`, `PdfParser`, `DocxParser`) are in the `upload` package. Moving it to `resume.dto` would require updating all those callers and could create confusion about whether it's a resume domain object (it isn't — it's a parsing output DTO). Staying in `upload.dto` with cross-package imports from `resume.domain` is acceptable and consistent with how `LlmSectionExtractor` already works.

**`SummaryItem` with new fields from Story 4.9:** If Story 4.9 runs before 4.10, `SummaryItem` will have 8 fields. The `case SUMMARY` branch in `LlmSectionExtractor.buildTypedItem()` must be updated to pass null for the 6 new contact fields:
```java
case SUMMARY -> new SummaryItem(id, str(raw, "text"), null, null, null, null, null, null);
```
If 4.10 runs before 4.9, the current 2-field constructor applies. The tasks should be ordered: complete 4.9 first.

---

## File List

### To Create
None.

### To Modify
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ParsedResumeDto.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/SectionExtractor.java` (heuristic typed-item construction; PdfParser/DocxParser delegate to this)
- `frontend/src/types/api.ts`
- `frontend/src/hooks/useResumeUpload.ts`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java`
- `frontend/src/hooks/useResumeUpload.test.ts`

---

## Dev Agent Record

### Implementation Notes

- Task 4 (heuristic parsers): `PdfParser` and `DocxParser` both delegate construction of `ParsedResumeDto` to `SectionExtractor.extract()`. The typed-item mapping was applied to `SectionExtractor.extract()` rather than duplicating it in both parsers — this is the correct locus for the change. Neither `PdfParser.java` nor `DocxParser.java` required modification.
- `LlmSectionExtractor`: used `switch` statement with `instanceof` filter on the existing `extractSectionItems()` result to dispatch into typed lists. The private helpers (`buildTypedItem`, `str`, `bool`, `parseDate`, `toStringMap`, `heuristicItems`) are unchanged.
- `LlmSectionExtractorTest`: the malformed-JSON and OllamaUnavailable tests now assert that heuristic fallback via `heuristicItems()` produces `GenericItem` instances, which are NOT dispatched into typed lists (they fail the `instanceof` filter) — so those typed lists end up empty. This is the correct documented behavior per the story's Dev Notes.
- Frontend: `mapParsedToProfile()` return type changed to `Partial<ProfileDto>` for all 8 sections. `LanguageRequest` requires a `proficiencyLevel`; mapped to `"INTERMEDIATE"` as default since parsed languages only carry raw proficiency strings.
- A new Test 5 was added to `useResumeUpload.test.ts` covering all 8 section types and summary mapping.

### Completion Notes

All 6 tasks complete. 11 backend tests pass (8 `LlmSectionExtractorTest` + 3 `ParsingServiceTest`). 186 frontend tests pass. 0 lint errors. The `ResumeControllerIntegrationTest` flaky failure (line 334) is pre-existing and reproduced on the baseline commit before any changes were applied.

### Review Findings

- [x] [Review][Defer] Switch exhaustiveness — `LlmSectionExtractor` `switch` on `ResumeSectionType` has no `default` clause; new enum values added in future stories would silently produce no items [LlmSectionExtractor.java:73] — deferred, pre-existing design choice; not a current bug

---

## Change Log
- 2026-06-10: Story created
- 2026-06-11: Implemented all ACs; all tasks checked; status → review
- 2026-06-11: Code review passed — 0 patches, 0 decisions, 1 defer, 2 dismissed; status → done
