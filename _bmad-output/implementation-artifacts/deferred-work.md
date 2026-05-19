# Deferred Work

## Deferred from: code review of 1-2-frontend-scaffold-and-design-token-foundation (2026-05-19)

- **F4** `sseClient.ts` — `EventSource` cannot send JWT auth header; token must be passed as query param if SSE endpoint requires auth. Architectural constraint known — address when SSE auth is required in Story 4.x.
- **F10** No 404/catch-all route in router (`frontend/src/router/index.tsx`) — unmatched paths show blank screen. Story 1.5 application shell scope.
- **F11** `apiClient.ts` missing `patch` HTTP method — add when first PATCH endpoint is consumed in Story 4.2.
