# Deferred Work

## Deferred from: code review of 1-2-frontend-scaffold-and-design-token-foundation (2026-05-19)

- **F4** `sseClient.ts` — `EventSource` cannot send JWT auth header; token must be passed as query param if SSE endpoint requires auth. Architectural constraint known — address when SSE auth is required in Story 4.x.
- **F10** No 404/catch-all route in router (`frontend/src/router/index.tsx`) — unmatched paths show blank screen. Story 1.5 application shell scope.
- **F11** `apiClient.ts` missing `patch` HTTP method — add when first PATCH endpoint is consumed in Story 4.2.

## Deferred from: code review of 1-3-user-registration (2026-05-19)

- **F1** `apiClient.ts` missing `window.location.href = '/login'` redirect on 401 — project-context rule requires redirect on unauthorized. Pre-existing from Story 1.2; `clearAuth()` is called but redirect is absent. Address in Story 1.5 (protected routes / auth shell).


## Deferred from: code review of 5-1-ai-streaming-spike-spring-ai-ollama-sse-end-to-end (2026-06-18)

- **F2** `AiController.java` — ExecutorService (virtual thread per task) field never shut down; no `@PreDestroy`. Low impact with virtual threads, but should be addressed before production. Add `@PreDestroy void shutdown() { executor.shutdown(); }`.
- **F8** `OllamaHealthGuard.java` — Creates a new `HttpClient` instance on every `isAvailable()` call. Leaks connections and blocks the Tomcat thread for up to 6 seconds per request. Pre-existing; refactor to a shared/cached `HttpClient` field.
- **F11** `frontend/src/router/index.tsx` — `/ai-test` route (AiTestPage) is included in the production bundle with no build-time or runtime exclusion. The page is designated dev-only but is accessible to any authenticated user. Add admin-role guard or environment flag before Epic 5 ships to production.


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

## Deferred from: code review of 9-8-java-test-quality-time-constants-and-clock (2026-06-12)

- `Clock` bean registered in `JacksonConfig` — semantically unrelated to Jackson serialization; if a `@WebMvcTest` slice loads `JacksonConfig` without `TokenService`, the bean is harmless, but the placement makes the dependency implicit. Move to a dedicated `ClockConfig.java` or `AppConfig.java` in a future infrastructure cleanup pass.
- `AuthControllerIntegrationTest` expired-token test uses `Clock.systemUTC()` — the token is forced-expired via `expirationMs=-1000L` (real-clock-independent), so this is not a flakiness risk in practice. Note for a future test cleanup pass: a `Clock.fixed(pastInstant)` would be cleaner and fully explicit.
- `TokenService` has no validation guard on `expirationMs ≤ 0` — a misconfigured zero or negative value silently produces immediately-expired tokens in production. Pre-existing; add a constructor `Preconditions.checkArgument(expirationMs > 0)` in a future hardening pass.
- `user.getEmail()` and `user.getRole()` passed to JWT builder without null checks — pre-existing; a null role produces `ROLE_null` authority silently denying all role-gated endpoints. Address in a future service-layer hardening pass.

## Deferred from: code review of 9-9-code-style-simplified-conditionals-and-idioms (2026-06-12)

- Latent dedup gap in restore guards (`DashboardPage.tsx`, `EditorPage.tsx`) — rapid delete-then-undo-then-delete cycle can reorder the resume list because the restore appends at the end rather than restoring original position. Not introduced by this story (pre-existing with `.find()`); the `.some()` refactor preserves identical behavior.

## Deferred from: code review of 5-2-documentpatchservice-and-useresumestore-applypatch (2026-06-18)

- **F6** `GlobalExceptionHandler.java` — Exception messages echo user-supplied `patch.field()`, `patch.sectionId()`, `patch.itemIndex()` directly into the 422 response body. Reflected content injection risk. Pre-existing pattern for other exceptions in the handler; address in a future API hardening pass.
- **F7** `DocumentPatchEvent.java` — No `@Size` constraint on `newValue`; arbitrarily large payloads can bloat persisted resumes. Pre-existing validation pattern in project; address in a future input validation hardening pass.
- **F8** `DocumentPatchService.java` — If `document.sections()` contains two sections with the same `sectionType`, the `stream().map()` will call `applyToSection` on both, potentially throwing `InvalidPatchException` mid-stream. Requires malformed `ResumeDocument`; domain invariant elsewhere prevents this; address if defensive dedup is ever needed.
- **F9** `useResumeStore.ts` — `applyPatch` uses `itemIndex` for addressing; if a concurrent `addItem`/`deleteItem` fires in the same render cycle, the index refers to the wrong item. SSE concurrent edit is out of scope for v1; address when real-time collaboration or concurrent AI edits are specified.
- **F10** `DocumentPatchService.java` — `UNKNOWN` section type is patchable via `GenericItem` branch. Intentional design; address with an explicit reject path if AI should not patch unrecognised sections.
- **F11** `DocumentPatchService.java` — `@NotBlank` / `@Min(0)` on `DocumentPatchEvent` are only enforced via `@Valid` at the controller level; service is not self-validating. Address when `DocumentPatchService.apply()` is first called from a non-web context (messaging consumer, scheduled task).

## Deferred from: code review of 5-7-accessibility-audit-and-focus-management-for-ai-features (2026-06-19)

- **D1** `TailorJobDialog.tsx:35-38` — Silent no-op when `resumeId` is undefined: `onClose()` fires unconditionally then stream is silently skipped; dialog closes with no feedback. Pre-existing from story 5-5; disable button or show error before closing when `resumeId` is falsy.
- **D2** `TailorJobDialog.tsx:37` — Return value of `startTailorStream` (a cleanup/cancel function) is discarded; no cancel handle for unmount or re-invocation. Pre-existing from story 5-5.
- **D3** `TailorJobDialog.tsx:41-47` — State reset only on close, not on re-open; Radix portal may stay alive between open/close cycles leaving stale state on reopen. Pre-existing from story 5-5.
- **D4** `TailorJobDialog.tsx:62` — `autoFocus` may not re-fire on rapid dialog re-open if Radix portal stays mounted. Requires real-browser testing; use `useEffect` + `ref.focus()` on `open` transition if this becomes observable. Pre-existing Radix behavior.
- **D5** `TailorJobDialog.tsx:83-86` — `isStreaming` disables submit button with no `aria-disabled` or status message; screen reader users cannot determine why the button is non-interactive. Pre-existing from story 5-5.
- **D6** `EditorPage.tsx:132` — Global `keydown` Escape listener (`fadeAll()`) and Radix Dialog's built-in Escape handler both fire when dialog is open; non-deterministic execution order. Pre-existing from story 5-6.

## Deferred from: code review of 5-3-ai-chat-panel-and-sse-streaming-integration (2026-06-18)

- **F7** `useStreamingChat.ts` `startStreamWithPost` — `applyPatch` errors not caught in the SSE parsing try/catch; an exception thrown by `applyPatch` would propagate out of the loop. Pre-existing `applyPatch` contract from Story 5.2 (lenient no-op on bad patch fields); address in a future streaming robustness pass.
- **F10** `ChatPanel.tsx` `MessageBubble` not memoized — every token event triggers a full re-render of the message list because `useChatStore` subscription fires for each `messages` array update. Performance optimization; not an AC violation; acceptable at 288px panel width for v1. Address with `React.memo` + content-address selector if token throughput causes visual jank.
- **F14** No EditorPage test for `clearMessages()` on unmount — the `useChatStore.clearMessages()` call in the EditorPage unmount cleanup is not test-covered. Low priority; `clearMessages` is covered by `useChatStore.test.ts`; add EditorPage unmount test in a future test quality pass.

## Deferred from: code review of 5-5-ai-job-description-tailoring (2026-06-18)

- `resumeId` UUID format not validated in `AiController.tailor` — `UUID.fromString` throws 500 on non-UUID string; `@NotBlank` only validates non-emptiness; pre-existing pattern documented in story dev notes; same deferred issue as `/enhance` and all `ResumeController` endpoints.
- `buildTailorPrompt` serializes null item fields as `"null"` literal string via `toString()` — LLM prompt mitigates with "skip empty non-empty fields" instruction; same gap exists in `buildEnhancePrompt`; acceptable for v1.
- Dispose race in `AiController.tailor`: `emitter.onCompletion(disposable::dispose)` registered after `buildEnhanceDisposable` starts subscription; pre-existing pattern identical to `enhance` endpoint; not introduced by story 5-5.
- `markResumeAsTailored` async PATCH fetch has no cancellation token — can write `setCurrentResumeTailored(true)` to store after user navigates away; cosmetic badge write; acceptable v1 limitation matching existing enhance behavior.

## Deferred from: code review of 5-6-ai-qa-chat-without-document-edits (2026-06-18)

- **F1** `AiConfig.java` / `MessageWindowChatMemory` — Unbounded `conversationId` map in singleton bean; no eviction, TTL, or maximum-conversations limit. Spring AI 2.0.0-M6 limitation; `maxMessages(20)` caps per-conversation depth only. Address when Spring AI provides eviction API or swap to a bounded cache (Caffeine) in a future memory management pass.
- **F2** `AiController.java` — Client-supplied `conversationId` not bound to authenticated principal; cross-user memory access possible if a UUID is guessed or leaked. Security hardening not in scope for this story (spec explicitly accepts in-memory ephemeral store); add principal-scoped key or ownership validation in a future AI security hardening pass.
- **F6** `AiControllerTest.java` — `Thread.sleep(100)` timing hack pre-existing from prior stories; replace with `CountDownLatch` or emitter completion callback in a future test quality pass.

## Deferred from: code review of 5-6-ai-qa-chat-without-document-edits round 2 (2026-06-18)

- **R2-D1** `AiController.java:46` — `ExecutorService executor` not shut down on app context close; pre-existing identical pattern in enhance/tailor endpoints. Add `@PreDestroy` shutdown in a future lifecycle hardening pass.
- **R2-D2** `AiController.java:78-83` — `onCompletion`/`onTimeout` registered after `buildChatDisposable().subscribe()` (race if Flux completes synchronously); pre-existing pattern in enhance/tailor. Address in a future SSE lifecycle hardening pass.
- **R2-D3** `ChatRequest.java` — `resumeId` accepted but silently dropped; no resume context enrichment in AI prompt. Intentional per spec for story 5-6; wire resume context into the system prompt in a future conversational context enrichment story.
- **R2-D4** `ChatPanel.test.tsx` — "patch event dispatches to useResumeStore.applyPatch (AC4, AC8)" test mislabels AC tags (tests patch behavior that AC6 forbids for the chat path). Fix label/remove test in a future test quality pass.
- **R2-D5** `AiController.java` / `buildChatDisposable` — `done` event sends hardcoded `"Stream complete"` summary; produces a duplicate assistant bubble after the token-accumulated bubble. Pre-existing from story 5-3. Address in a future UX polish pass (send accumulated token content as summary or use empty string to suppress the second bubble).

## Deferred from: code review of 6-1-documentrenderer-interface-and-pdfrenderer (2026-06-19)

- **W1** `PdfRenderException` not registered in `GlobalExceptionHandler` — iText font/write failures surface as generic 500 with `"An unexpected error occurred."` and no retry signal. Pre-existing catch-all pattern; acceptable for v1. Add a specific handler or error code when export reliability SLA is defined.
- **W2** NPE risk in `findSummaryItem` if Jackson bypasses record compact constructor — `section.items()` could be null if Jackson deserializes JSONB directly bypassing the record's compact constructor null-guard. Requires investigation of Jackson 2.18.x record constructor selection with JSONB. Not triggered by any current code path.
- **W3** Two-column template with `columns: null` in DB silently drops all body sections — `buildSectionOrder` returns empty when `layout.columns` is null for a two-column template. `TemplateService` validates definitions on write; no valid template in DB should have this state.
- **W4** `parseFontSize`/`parseMargin` silently ignore `rem`, `em`, `pt` CSS units — falls back to hardcoded defaults. `TemplateService` already validates only `px`/`in` units on template creation, so no valid template triggers this.
- **W5** `buildFallbackTemplate` creates bare `ResumeTemplate` entity with no `id`/`name` — latent JPA risk if fallback object is ever accidentally passed to a persistence operation. No current code path triggers it; add warning comment for story 6-2 implementer.
- **W6** `URL.revokeObjectURL` called synchronously after `a.click()` — common browser race; modern browsers handle this safely in practice. Address if download failures are reported on specific browser versions.

## Deferred from: code review of 6-2-docxrenderer-and-export-download-ux (2026-06-19)

- **W1** `DashboardPage.tsx` / `EditorPage.tsx` (exportDocx) — `URL.revokeObjectURL` called synchronously after `a.click()`; browser download initiation is async and revocation may race the download on Firefox. Pre-existing identical pattern in `exportPdf`; address with `setTimeout(() => URL.revokeObjectURL(url), 100)` if download failures are reported.
- **W2** `ExportFormatDialog.tsx` `onClose` handler — backdrop click / Escape during active export silently no-ops; Cancel button is disabled but Backdrop dismissal gives no feedback. Pre-existing design choice; address with a tooltip or `aria-description` in a future UX accessibility pass.
- **W3** `DashboardPage.tsx` `handleExport` — no AbortController or in-flight deduplication; rapid double-click can fire two parallel export fetch requests before `setIsExporting(true)` re-render. Pre-existing pattern across delete/duplicate handlers; address when global request cancellation strategy is introduced.
- **W4** `EditorPage.tsx` — `exportDocx` and `exportPdf` share `isExporting` Zustand state with no early-return guard; `isExporting` button-disabled state prevents concurrent clicks in normal usage but not in race conditions between button render and click. Pre-existing shared-state pattern; address if concurrent export bugs are observed in production.

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
