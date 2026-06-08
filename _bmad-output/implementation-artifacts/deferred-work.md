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

## Work planned for Phase 2
- A toast is displayed when a user tries to sign up with an email that is already in use. This is not the best user experience as the error might be missed by the user. TODO: Brainstorm a better way to handle this. 

## Deferred from: code review of 3-5-inline-section-editing-and-section-visibility (2026-06-05)

- `act()` warnings in `useAutosave.test.ts` and `EditorPage.test.tsx` -- `useResumeStore.setState()` called outside `act()` in `beforeEach`/`afterEach`; all tests pass; address in a future test quality pass.
- In-flight PUT request not cancelled on component unmount in `useAutosave.ts` -- timer is cleared on unmount but an already-dispatched PUT can still resolve and write to the global Zustand store; no data loss; address when adding a global request cancellation strategy.
- Redundant double dirty-check in `useAutosave.ts` (lines 67 and 70-77) -- two overlapping `JSON.stringify` guards both prevent spurious PUTs; logic is correct and safe; the first guard (line 67) is subsumed by the snapshot guard (lines 70-77); defer cleanup to a future refactor pass.

## Deferred from: code review of 3-6-resume-save-save-as-and-name-management (2026-06-05)

- JSX indentation misalignment in `EditorPage.tsx` centerSlot close tags (lines 206-209) — cosmetic; close tags for the inner canvas `div` and fragment are slightly misaligned relative to their open tags. Address in a future formatting/refactor pass.
