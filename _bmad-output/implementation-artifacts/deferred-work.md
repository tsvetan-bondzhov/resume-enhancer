# Deferred Work

## Deferred from: code review of 1-2-frontend-scaffold-and-design-token-foundation (2026-05-19)

- **F4** `sseClient.ts` — `EventSource` cannot send JWT auth header; token must be passed as query param if SSE endpoint requires auth. Architectural constraint known — address when SSE auth is required in Story 4.x.
- **F10** No 404/catch-all route in router (`frontend/src/router/index.tsx`) — unmatched paths show blank screen. Story 1.5 application shell scope.
- **F11** `apiClient.ts` missing `patch` HTTP method — add when first PATCH endpoint is consumed in Story 4.2.

## Deferred from: code review of 1-3-user-registration (2026-05-19)

- **F1** `apiClient.ts` missing `window.location.href = '/login'` redirect on 401 — project-context rule requires redirect on unauthorized. Pre-existing from Story 1.2; `clearAuth()` is called but redirect is absent. Address in Story 1.5 (protected routes / auth shell).



## Deferred from: code review of 1-5-protected-routes-and-application-shell (2026-05-20)

- **T1** `AppShell.test.tsx` — `mockUseAuthStore.mockReturnValue(userObject)` ignores the selector callback passed by the component; tests pass coincidentally because the returned object has `.role`. A selector-aware `mockImplementation` would be more correct. Low priority; address in a future test quality pass.

## Deferred from: code review of 2-3-file-upload-infrastructure-and-resume-parsing (2026-05-29)

- Broad `catch (Exception e)` after `catch (IOException e)` in `PdfParser` and `DocxParser` — swallows runtime exceptions with a "corrupted file" message. AC-4 is satisfied; tighten to specific PDFBox/POI exception types in a future refactor.
- `MIME_PDF`/`MIME_DOCX` constants duplicated in `FileValidator` and `ParsingService` — two sources of truth; consolidate to a shared constants class when more MIME-aware logic is added.

## Deferred from: code review of 2-4-resume-upload-to-seed-profile (2026-05-29)

- No request abort controller in `useResumeUpload.ts` — inflight `uploadFile` request is not cancelled if user navigates away mid-upload. Pre-existing pattern across the codebase; acceptable v1 limitation. Address when adding a global request cancellation strategy.

## Deferred from: code review of 3-3-dashboard-resume-gallery (2026-06-05)

- **D1** `DashboardPage.test.tsx` — No test for `apiClient.get` error path (`toast.error("Failed to load resumes")`). Pre-existing coverage gap not required by Task 4's specified test cases. Add in a future test quality pass.
- **D2** `DashboardPage.test.tsx` — No test for DELETE API failure + restore + `toast.error("Delete failed — resume restored")`. Same as D1.
- **D3** `DashboardPage.tsx:84` — Double-delete Map key collision: calling `handleDelete` on the same resume ID twice (e.g., duplicate browser tab) silently overwrites the first pending timeout without clearing it, leaking a stale setTimeout. Low-probability in practice; address if undo patterns are revisited in Story 3.8.

## Deferred from: code review of 3-7-template-gallery-and-template-switching (2026-06-05)

- Stale closure in `handleApplyTemplate` revert path (`EditorPage.tsx:131`) — under rapid successive template clicks, a failed API call reverts to the `templateId` captured in the callback's closure at creation time, which may not be the original template if the user clicked multiple templates quickly. Pre-existing React closure pattern; no user-visible impact under normal usage.
- No EditorPage-level integration test for `handleApplyTemplate` / "Template applied" toast — `TemplateGallery.test.tsx` covers the `onApply` callback invocation path; EditorPage-level integration test for this flow is not required by the story spec.

## Deferred from: code review of 3-9-llm-based-resume-parsing-pipeline (2026-06-08)

- `HttpClient` created on every `OllamaHealthGuard.isAvailable()` call — no connection pooling; acceptable for single call per upload request per story design intent. Refactor to a shared `HttpClient` field in a future performance pass.
- Empty sections (no content lines) still trigger a LLM call with empty `sectionText` — wasted API call; graceful fallback handles it; add guard `if (sectionText.isBlank()) return heuristicItems(rawSection)` in a future quality pass.
- `CompletableFuture.get()` blocks calling servlet thread for up to 30s — thread starvation risk under concurrent load; accepted trade-off in story dev notes; address with virtual threads or async servlet in a future scalability story.
- `ExecutionException.getCause()` not unwrapped in `catch (Exception e)` fallback log message in `ParsingService` — diagnostic quality only; unwrap cause for better log readability in a future refactor pass.

## Deferred from: code review of 3-10-template-definition-backfill-and-resumecanvas-template-application (2026-06-08)

- **F1** `Promise.resolve().then()` pattern in useEffect null-reset path — intentional ESLint `react-hooks/set-state-in-effect` workaround; synchronous `setState` in effect body is forbidden by project config; revisit if ESLint rule is relaxed or React changes its guidance on this pattern.
- **F4** `TemplateDefinition.DEFAULT` missing `--item-spacing` — `Map.of()` is at 10-entry capacity; `--item-spacing` not consumed by current frontend rendering; add when DEFAULT map is restructured or `--item-spacing` is used in export rendering (Epic 5).
- **F5** `TemplateService` CSS unit validation uses a denylist (rem/em) rather than an allowlist (px/in) — denylist is spec-mandated; unitless values like `"1.5"` for `line-height` must pass validation; tighten to an allowlist in a future template management story when all valid value formats are enumerated.
- **F7** `getOrderedSections` in `templateUtils.ts` has no dedicated unit tests — function is covered indirectly by `ResumeCanvas.test.tsx`; add `templateUtils.test.ts` in a future test quality pass.
- **F8** No test for `modern-accent` layout rendering in `ResumeCanvas.test.tsx` — not required by AC12; add in a future test quality pass.
- **F10** `TemplateLayout.resolvedSectionOrder()` is spec-mandated infrastructure for Epic 5 but never called and untested — add usage and tests when `DocumentRenderer` / `PdfRenderer` are implemented in Story 5.1.

## Deferred from: code review of 3-13-typed-section-specific-resumeitem-records (2026-06-09)

- AC7 incomplete: `LlmSectionExtractorTest` has no typed-item test cases for `CertificationItem`, `LanguageItem`, `ProjectItem`, `VolunteeringItem`, or `EducationItem` — only `WORK_EXPERIENCE`, `SKILLS`, and `UNKNOWN` are tested. Story 3-15 adds typed section renderers; cover remaining types in that story's test expansion or a dedicated test quality pass.
- `parseDate` silently converts year-only strings (e.g., `"2020"`) to January 1 without logging a WARN — current behavior acceptable for MVP; add a WARN log level when year-only dates are inferred to improve diagnostic traceability.
- `GenericItem` compact constructor would NPE on maps with null values (`Map.copyOf` rejects null values) — mitigated by `toStringMap` filtering nulls before construction; risk exists if `GenericItem` is constructed directly with a user-supplied map containing null values. Add a null-value guard in the compact constructor if direct construction becomes common.

## Deferred from: code review of 3-13-typed-section-specific-resumeitem-records round 2 (2026-06-10)

- `isCurrent: false` and other boolean fields render as editable "false" text via `getItemFields`/`getItemDisplayValues` — the bridge approach exposes boolean record fields as contenteditable spans, which is wrong UX and allows type corruption. Deferred to Story 3.15 typed renderers which will remove contenteditable from boolean/date fields entirely.
- Editing a boolean field (e.g. `isCurrent`) via contenteditable writes a string `"true"`/`"false"` back to the typed record via `updateItemField` — type invariant corrupted at the Zustand level; Jackson coerces string-to-boolean on next deserialization so no data loss at rest, but Zustand in-memory type is wrong. Deferred to Story 3.15.

## Deferred from: code review of 3-15-section-specific-frontend-resume-renderers (2026-06-10)

- `renderSectionContent` filter+map+throw pattern has dead-code `throw` branch — the `.filter(i => i.type === X)` already guarantees type; the `throw` is unreachable. Style/efficiency issue, not a bug. Address in a future refactor pass.
- `WorkExperienceSectionRenderer.test` blur assertion may not accurately exercise `e.currentTarget.textContent` — `fireEvent.blur(field, { target: { textContent: 'Senior Engineer' } })` does not set `currentTarget.textContent` in jsdom; test passes but for reasons tied to jsdom's event model. Investigate with `userEvent.type` in a future test quality pass.

## Deferred from: code review of 4-1-rendering-polish-sidebar-collapse-template-title-date-formatting-certification-display (2026-06-10)

- Stale comment `"// In read-only mode, formatDateRange is used"` in `WorkExperienceSectionRenderer.test.tsx` line 77 — references removed `formatDateRange`; cosmetic stale comment; address in a future test quality pass.
- `formatMonthYear`/`formatYear` return `"NaN/NaN"`/`"NaN"` for invalid date strings — `new Date("invalid")` produces `Invalid Date`; UTC accessors return `NaN`; same flaw exists in `formatDateRange`; upstream API validation is the correct guard; address if invalid-date values reach the frontend in practice.
- Null `startDate` + non-null `endDate` in WorkExperience/Projects renders end date alone without separator — unspecified edge case not covered by AC4/5; not a regression vs previous `formatDateRange` behaviour; address when date display edge cases are formally specified.

## Deferred from: code review of 4-2-classic-template-two-column-layout-fix (2026-06-10)

- V13 migration `DO` block raises `RAISE EXCEPTION` when the Classic template row is absent — makes the migration fail-fast on a missing seed row rather than silently no-op. Pre-existing fail-fast pattern; acceptable for seeded environments; if a zero-row-count scenario is ever possible in CI, convert to a plain `UPDATE` (no DO block) or add a conditional guard.

## Deferred from: code review of 4-4-section-item-add-delete-and-drag-to-reorder (2026-06-11)

- `SortableItemWrapper` and `AddItemButton` duplicated verbatim across all 9 renderer files — architectural decision documented in Dev Notes (inline approach reduces import overhead); extract to a shared `SortableItemWrapper.tsx` component in a future cleanup story.

## Deferred from: code review of 4-7-settings-page-with-password-change (2026-06-11)

- Generic toast on API error — backend 400 detail (e.g. "Current password is incorrect") not surfaced to user on failed password change; `SettingsPage` shows only "Failed to change password — please try again"; AC8 only specifies the 204 success path; address when richer error detail display is specified.
- `UserRepository` injected directly into `UserController` to reload full user from DB — bypasses service-layer encapsulation; explicitly documented in dev notes as the correct pattern given JWT principal only contains email/role; consolidate DB access into `UserService` in a future service-layer cleanup pass.
- `@NotBlank` vs `@Size(min=8)` validation ordering on `ChangePasswordRequest.newPassword` — Spring fires `@NotBlank` before `@Size` for blank input, showing "must not be blank" instead of the length message; no AC coverage for this edge; address when validation message UX is formally reviewed.

## Deferred from: code review of 9-1-typescript-cognitive-complexity-and-void-operator (2026-06-11)

- `applyLoginError`/`applySignupError` — `toast.error(err.detail)` has no fallback when `err.detail` is null/undefined on 400 with no matching field errors. Pre-existing behavior from original inline code; address in a future error-handling hardening pass.
- `executeDeleteResume` — `setSidebarResumes` may be called after `EditorPage` unmount if API call is in-flight at unmount time. Pre-existing race in the original `setTimeout` async callback; address when a global request cancellation strategy is introduced.
- `updateSectionItems` parameter named `sectionId` compared against `section.sectionType` — naming mismatch carries forward from original action signature; address in a future naming/refactor pass.
- `workExperiences` and `education` in `mergeProfilePayload` lack `?? []` fallback guard, unlike the four optional array fields — pre-existing asymmetry; `ProfileDto` declares both as non-nullable so risk is low; normalise in a future ProfileDto guard pass.
- `applyLoginError`/`applySignupError` implicit caller contract (caller must clear field errors first) is undocumented; safe in current module-private usage; document or enforce if these patterns are extracted to shared utilities in future.

## Deferred from: code review of 9-7-type-safety-and-deprecated-apis (2026-06-12)

- Two-column `ResumeCanvas` sections not assigned to either column definition (`leftColumnIds` / `rightColumnIds`) are silently dropped — no fallback rendering, no warning. Pre-existing gap; address when two-column layout edge cases are formally specified.
- `null` `issueDate`/`expirationDate` in `CertificationsSectionRenderer` rendered as empty editable span; blur event writes empty string to store, converting `null → ""` silently and triggering autosave diff. Pre-existing pattern; address when null/optional date field UX is formally specified.

## Work planned for Phase 2
- A toast is displayed when a user tries to sign up with an email that is already in use. This is not the best user experience as the error might be missed by the user. TODO: Brainstorm a better way to handle this. 

## Deferred from: code review of 3-5-inline-section-editing-and-section-visibility (2026-06-05)

- `act()` warnings in `useAutosave.test.ts` and `EditorPage.test.tsx` -- `useResumeStore.setState()` called outside `act()` in `beforeEach`/`afterEach`; all tests pass; address in a future test quality pass.
- In-flight PUT request not cancelled on component unmount in `useAutosave.ts` -- timer is cleared on unmount but an already-dispatched PUT can still resolve and write to the global Zustand store; no data loss; address when adding a global request cancellation strategy.
- Redundant double dirty-check in `useAutosave.ts` (lines 67 and 70-77) -- two overlapping `JSON.stringify` guards both prevent spurious PUTs; logic is correct and safe; the first guard (line 67) is subsumed by the snapshot guard (lines 70-77); defer cleanup to a future refactor pass.

## Deferred from: code review of 3-6-resume-save-save-as-and-name-management (2026-06-05)

- JSX indentation misalignment in `EditorPage.tsx` centerSlot close tags (lines 206-209) — cosmetic; close tags for the inner canvas `div` and fragment are slightly misaligned relative to their open tags. Address in a future formatting/refactor pass.

## Deferred from: code review of 4-6-profile-page-navigation-and-first-entry-deletion (2026-06-11)

- `SkillsStep.tsx` uses `aria-label="Remove skill X"` while all other step components (Experience, Education, Certifications, Languages, Projects, Volunteering) use `aria-label="Remove entry X"`. Inconsistent screen-reader labelling for the delete button. Pre-existing — not introduced by story 4-6. Normalise to a consistent pattern in a future accessibility pass.

## Deferred from: code review of 4-10-parsing-service-and-parsedresumedto-refactor (2026-06-11)

- `LlmSectionExtractor.java` switch on `ResumeSectionType` has no `default` clause — new enum values added in future stories would silently produce no typed items in `ParsedResumeDto`. Not a current bug; address if new section types are added.

## Deferred from: code review of 9-3-accessibility-and-aria-compliance (2026-06-11)

- `aria-multiline="true"` missing on multiline description/summary fields (`SummarySectionRenderer.tsx:141`, `WorkExperienceSectionRenderer.tsx` description span) — screen readers announce as single-line textbox; pre-existing omission from original contentEditable implementation.
- camelCase `aria-label` values (`"Edit jobTitle"`, `"Edit fieldOfStudy"`, `"Edit startDate"`, etc.) are read verbatim by screen readers as single words — pre-existing label naming from original implementation; address in a future accessibility polish pass with human-readable labels.
- `aria-label="Edit issueDate"` copy-paste bug on `expirationDate` span in `CertificationsSectionRenderer.tsx` — both issueDate and expirationDate spans carry the same label; pre-existing error not introduced by this story.
- Non-unique `aria-label` values across multiple items of the same type (e.g., 3× "Edit company") — pre-existing pattern; requires item-identity context in labels (e.g., "Edit company for Senior Engineer at Acme").
- `ProfilePage.tsx:253` `<li role="button">` — pre-existing S6819 violation; fully keyboard-accessible (has `onKeyDown`); out of story 9-3 scope; address in story 9-x or a dedicated accessibility pass.
- `ResumeSidebarItem.tsx:32` `<div role="button">` — pre-existing S6819 violation; fully keyboard-accessible (has `onKeyDown`); out of story 9-3 scope; address in story 9-x or a dedicated accessibility pass.
- `role="textbox"` on `<span contentEditable>` is redundant — browser already maps `contenteditable` to implicit textbox role; explicit `role="textbox"` may cause NVDA+Firefox to double-announce; cannot remove without re-introducing S6848; defer to a future ARIA audit when screen-reader compatibility can be tested end-to-end.
- No `KeyboardSensor` registered in any `DndContext` — drag handle `<button>` is Tab-reachable but keyboard drag activation is silently non-functional; `{...listeners}` has no sensor to dispatch to; address when keyboard drag is formally specified.
- `onBlur` uses `textContent` which concatenates descendant markup on paste of formatted content — `onPaste` sanitisation out of scope; address in a future content-editing quality pass.
- Enter-blocking `onKeyDown` in single-line contentEditable fields does not prevent pasted newlines — `onPaste` sanitisation out of scope for this story.
- `SummarySectionRenderer` edit-mode `<div>` tag change from `<p>` has no dedicated test asserting element type — address in a future test quality pass.

## Deferred from: code review of 9-4-java-backend-code-quality-llmsectionextractor (2026-06-11)

- `catch (Exception e)` in `parseJsonItems` is over-broad (catches `Error` subclasses). Pre-existing pattern throughout `LlmSectionExtractor.java` — identical to the `catch (Exception e)` in `toStringMap` and item-level catch in `extractSectionItems`. Narrow to `catch (JsonProcessingException e)` in a future catch-narrowing quality pass.

## Deferred from: code review of 9-6-configuration-content-length-and-profileservice (2026-06-12)

- `application.yml` `max-request-size` equals `max-file-size` (both 8MB) — leaves no headroom for multipart framing overhead. Pre-existing pattern (was 10MB/10MB). Consider setting `max-request-size: 10MB` in a future hardening pass.
- `FileValidator.java` `>` (strict) vs Spring's `>=` (inclusive) on the 8MB boundary — a file of exactly 8MB passes `FileValidator` but Spring rejects it before the validator is reached. Pre-existing operator; unchanged from 10MB behavior. Add exact-boundary test in a future validator hardening pass.
- `FileValidatorTest.java` — no test for exactly-8MB boundary case. Pre-existing gap; AC3 only specified 9MB test.
- `ProfileMapper.toDto(Profile)` — no null-guard on collection getters. Pre-existing pattern; `Profile` initializes all collections as `ArrayList`. Add null guard if `Profile` is ever constructed without initialization.
- `ProfileMapper` helper methods — no null-guard on method arguments. Pre-existing pattern. Null elements in input collections would NPE without context. Add null checks if input validation is ever relaxed.
- `FileValidator.validate()` — does not reject zero-byte files. Pre-existing gap. A 0-byte file with valid MIME passes both checks. Add empty-file guard in a future validator hardening pass.
