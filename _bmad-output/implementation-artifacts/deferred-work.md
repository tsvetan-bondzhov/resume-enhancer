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

## Work planned for Phase 2
- A toast is displayed when a user tries to sign up with an email that is already in use. This is not the best user experience as the error might be missed by the user. TODO: Brainstorm a better way to handle this. 
