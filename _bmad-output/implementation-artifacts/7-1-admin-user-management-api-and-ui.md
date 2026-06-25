# Story 7.1: Admin User Management API & UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin user,
I want to view all registered user accounts and deactivate specific users,
so that I can maintain user integrity and disable access for test accounts or bad actors without deleting their data.

## Acceptance Criteria

1. **List users (admin only).** `GET /api/v1/admin/users` returns a paginated list of all registered users as `AdminUserDto` objects with fields `id`, `email`, `role`, `status`, `createdAt`. The endpoint is protected by `@PreAuthorize("hasRole('ADMIN')")`. A non-admin authenticated request receives HTTP 403 with a `ProblemDetail` body. (NFR9)

2. **Deactivate a user.** `PATCH /api/v1/admin/users/{userId}/deactivate` sets the user's account to inactive (persisted as `enabled = false` in the `users` table). HTTP 200 returned with the updated `AdminUserDto` (status `INACTIVE`). The user's resumes and profile data remain untouched. Deactivating an already-inactive user is idempotent (still 200). A non-existent `userId` returns HTTP 404 `ProblemDetail`. (FR39)

3. **Deactivated user cannot log in.** After deactivation, a subsequent `POST /api/v1/auth/login` by that user returns HTTP 401 with `ProblemDetail` `detail` exactly `"Account is deactivated"`. Credentials remain valid (password unchanged) — only the active state blocks login.

4. **Lazy-loaded admin page.** Navigating to `/admin` renders `AdminPage.tsx`, lazy-loaded via React `lazy()` + `Suspense` with a `Skeleton` placeholder during load. `UserTable.tsx` fetches from `GET /api/v1/admin/users` and displays the user list in a table with columns: Email, Role, Status, Created, Actions.

5. **Deactivate confirmation flow.** Clicking "Deactivate" on a user row opens a shadcn/ui `Dialog`: `"Deactivate [email]? Their resumes will be preserved."`. The Cancel button is default-focused. On confirm, `PATCH /api/v1/admin/users/{userId}/deactivate` is called; on success the row's Status cell updates to "Inactive", the row's Deactivate action becomes disabled/hidden, and a "User deactivated" Toast appears. On failure, an error Toast appears and the row is unchanged. (UX-DR18, UX-DR19)

6. **Route-level role gating.** A non-admin authenticated user navigating to `/admin` is redirected to the dashboard (`/`), consistent with Story 1.5's `ProtectedRoute requireAdmin` pattern. (Already implemented in `router/index.tsx` — must not regress.)

7. **Test coverage.** `AdminServiceTest.java` covers list-users and deactivate with Mockito mocks (including not-found and idempotent-deactivate cases). `AdminControllerIntegrationTest.java` covers happy-path list and deactivate, plus a 403 case for a non-admin token, against Testcontainers PostgreSQL. `AuthServiceTest.java` (or `AuthControllerIntegrationTest.java`) is extended to verify a deactivated user receives 401 `"Account is deactivated"` on login. Frontend: `UserTable.test.tsx` and updated `AdminPage.test.tsx` cover fetch/render, the confirm dialog, and the deactivate success path with mocked `apiClient`.

## Tasks / Subtasks

- [x] **Task 1 — Backend: `AdminUserDto` and `AdminService` (AC: #1, #2)**
  - [x] Create `admin/dto/AdminUserDto.java` as a Java `record` with fields `UUID id, String email, String role, String status, Instant createdAt`. `status` is `"ACTIVE"` when `user.isEnabled()` is true, else `"INACTIVE"`.
  - [x] Create `admin/AdminService.java` (`@Service`):
    - `Page<AdminUserDto> listUsers(Pageable pageable)` — `userRepository.findAll(pageable).map(this::toDto)`.
    - `AdminUserDto deactivateUser(UUID userId)` — load via `userRepository.findById`; throw `UserNotFoundException` (new typed domain exception) if absent; set `enabled = false`; save; return DTO. Idempotent if already disabled.
  - [x] Add a private `toDto(User)` mapper.
  - [x] Create `admin/UserNotFoundException.java` extending `RuntimeException` (constructor takes `UUID`/message). Register a handler in `GlobalExceptionHandler` → HTTP 404 `ProblemDetail` (title "Not Found").

- [x] **Task 2 — Backend: `AdminController` (AC: #1, #2, #6)**
  - [x] Create `admin/AdminController.java` (`@RestController`, `@RequestMapping("/api/v1/admin")`, `@Tag(name = "Admin")`).
  - [x] `@GetMapping("/users")` — annotate `@PreAuthorize("hasRole('ADMIN')")`; accept `Pageable` (`@PageableDefault(size = 20, sort = "createdAt")`); return `Page<AdminUserDto>` (200).
  - [x] `@PatchMapping("/users/{userId}/deactivate")` — annotate `@PreAuthorize("hasRole('ADMIN')")`; `@PathVariable UUID userId`; return `AdminUserDto` (200).
  - [x] Do NOT add any URL-pattern admin matchers to `SecurityConfig` — RBAC is method-level only (`@EnableMethodSecurity` is already on `SecurityConfig`). The catch-all `.anyRequest().authenticated()` already covers `/api/v1/admin/**`.

- [x] **Task 3 — Backend: enforce deactivation at login (AC: #3)**
  - [x] Create `auth/AccountDeactivatedException.java` extending `DomainAuthException` (so it maps to 401 via the existing `handleDomainAuth` handler). Message: `"Account is deactivated"`.
  - [x] In `AuthService.login`, after the password match succeeds, check `if (!user.isEnabled()) throw new AccountDeactivatedException();` — BEFORE minting the token. Place the check after password verification so it does not become an account-existence oracle.
  - [x] Confirm `handleDomainAuth` in `GlobalExceptionHandler` returns 401 with `detail = ex.getMessage()` — it does; no handler change needed. Verify the rendered `detail` is exactly `"Account is deactivated"`.

- [x] **Task 4 — Backend tests (AC: #7)**
  - [x] `admin/AdminServiceTest.java` (`@ExtendWith(MockitoExtension.class)`): list maps users→DTO with correct status; deactivate sets enabled=false and returns INACTIVE DTO; deactivate of missing user throws `UserNotFoundException`; deactivate of already-disabled user stays 200/INACTIVE (idempotent).
  - [x] `admin/AdminControllerIntegrationTest.java` (`@SpringBootTest`, Testcontainers PostgreSQL via `testcontainers/PostgresTestContainer.java`): seed an ADMIN and a USER; admin token → 200 list contains both; admin token → deactivate USER returns 200 INACTIVE and DB row `enabled=false`; USER token → both endpoints return 403.
  - [x] Extend auth tests: a deactivated user logging in receives 401 with detail `"Account is deactivated"` (prefer `AuthControllerIntegrationTest.java` for the end-to-end status+body assertion; a unit test in `AuthServiceTest.java` asserting the exception type is also acceptable).

- [x] **Task 5 — Frontend: types + API wiring (AC: #1, #4)**
  - [x] Add to `frontend/src/types/api.ts`: `AdminUserDto` (`{ id: string; email: string; role: "USER" | "ADMIN"; status: "ACTIVE" | "INACTIVE"; createdAt: string }`) and a `Page<T>` interface matching Spring's page JSON (`content: T[]`, `totalElements`, `totalPages`, `number`, `size`) — or reuse an existing page type if one already exists in this file.
  - [x] No new apiClient method needed: use `apiClient.get<Page<AdminUserDto>>("/api/v1/admin/users")` and `apiClient.patch<AdminUserDto>(\`/api/v1/admin/users/${userId}/deactivate\`)`.

- [x] **Task 6 — Frontend: `UserTable.tsx` (AC: #4, #5)**
  - [x] Create `frontend/src/components/admin/UserTable.tsx`. On mount, fetch users via `apiClient.get`. Maintain local component state for the list and a per-operation loading flag (`isDeactivating` per row or a `deactivatingId`); do NOT introduce a global `isLoading`. Date display via existing `lib/dateUtils.ts`.
  - [x] Render a shadcn/ui table (`components/ui/table`) with columns Email, Role, Status, Created, Actions. Status renders "Active"/"Inactive". Actions column shows a "Deactivate" button, disabled/hidden when status is INACTIVE.
  - [x] Deactivate flow: clicking opens a shadcn/ui `Dialog` (`components/ui/dialog`) with copy `Deactivate {email}? Their resumes will be preserved.`; Cancel button has `autoFocus` (default focus per UX-DR19); on confirm call the PATCH, update the row's status to INACTIVE in local state, show success Toast `"User deactivated"`. On error, show an error Toast and leave the row unchanged.
  - [x] Use existing Toast mechanism (check `components/ui/` for `sonner`/`toast` — reuse whatever Stories 3.x/6.x already use; do not add a new toast library).

- [x] **Task 7 — Frontend: replace placeholder `AdminPage.tsx` (AC: #4, #6)**
  - [x] Replace the placeholder body of `frontend/src/pages/AdminPage.tsx` to render a page heading and `<UserTable />`. Keep it as the default export (router lazy-imports the default). Do NOT change `router/index.tsx` — lazy + Suspense + Skeleton + `requireAdmin` gating already exist there from Story 1.5.

- [x] **Task 8 — Frontend tests (AC: #7)**
  - [x] Create `frontend/src/components/admin/UserTable.test.tsx`: mock `apiClient`; assert table rows render from a mocked page response; assert clicking Deactivate opens the dialog; assert confirm calls PATCH and updates the row + fires the success toast; assert an INACTIVE user has no enabled Deactivate action.
  - [x] Update `frontend/src/pages/AdminPage.test.tsx`: the current test asserts the literal text "Admin Page" which will break — update it to assert the page renders the heading and the user table (mock `apiClient`). Do not leave the obsolete assertion.

- [x] **Task 9 — Lint & verify (Definition of Done)**
  - [x] Backend: all new/changed tests green; no catch-and-swallow; errors only via `ProblemDetail`.
  - [x] Frontend: `cd frontend && npm run lint` passes with 0 errors; `npm run test` green; no `any`, no raw `fetch`, no new Zustand store outside `stores/`.

## Dev Notes

### Critical reconciliation — there is no `status` column; use the existing `enabled` boolean

The epic AC language ("status is set to `INACTIVE`", `AdminUserDto.status`) is a **presentation concept**, not a DB column. The `users` table (`V1__create_users_table.sql`) and `User` entity (`auth/domain/User.java`) already have a `boolean enabled` column. **Deactivation = `user.setEnabled(false)`.** `AdminUserDto.status` is derived: `enabled ? "ACTIVE" : "INACTIVE"`.

- **Do NOT create a new Flyway migration** — no schema change is required (column already exists). [Source: src/main/resources/db/migration/V1__create_users_table.sql; src/main/java/.../auth/domain/User.java]
- Migrations V1–V17 already exist; never modify applied migrations. [Source: architecture project-context.md#Database Changes]

### Login deactivation check is NOT currently enforced — you must add it

`User implements UserDetails` and overrides `isEnabled()`, but the app uses a **custom `JwtAuthenticationFilter` + manual `AuthService.login`**, NOT Spring's `DaoAuthenticationProvider`. Therefore Spring does **not** auto-check `enabled`. Two consequences:

1. `AuthService.login` (`auth/AuthService.java`) ignores `enabled` today — add the explicit check after password match (Task 3). [Source: src/main/java/.../auth/AuthService.java lines 33-48]
2. `JwtAuthenticationFilter` hardcodes `principal.setEnabled(true)` for an already-issued token (line 52). A deactivated user holding a still-valid JWT will keep access until the token expires (1h TTL, no refresh in v1). This is **acceptable for this story** — deactivation blocks *new* logins (AC #3). Do not attempt a DB lookup in the filter; that is out of scope and contradicts the stateless design. [Source: src/main/java/.../auth/JwtAuthenticationFilter.java line 52; architecture impl-patterns#JWT Handling]

### Error surfaces

- `DomainAuthException` already maps to **401** with `detail = ex.getMessage()` via `GlobalExceptionHandler.handleDomainAuth`. Subclass it for `AccountDeactivatedException` so no new handler is needed. [Source: src/main/java/.../common/GlobalExceptionHandler.java lines 42-50; src/main/java/.../common/DomainAuthException.java]
- `@PreAuthorize` denials throw `AuthorizationDeniedException`, already handled → **403** `ProblemDetail` (title "Forbidden"). No SecurityConfig change needed. [Source: GlobalExceptionHandler.java lines 167-174]
- New `UserNotFoundException` needs a handler → 404 `ProblemDetail`. Follow the exact shape of `handleResumeNotFound`. [Source: GlobalExceptionHandler.java lines 97-103]

### Route gating already exists — do not rebuild it

`router/index.tsx` already wires `/admin` under `<ProtectedRoute requireAdmin />` with `lazy(() => import("@/pages/AdminPage"))`, `<Suspense fallback={<Skeleton .../>}>`, and a redirect to `/` for non-admins. AC #4 and #6 are **already satisfied at the routing layer** — your job is to fill in `AdminPage`/`UserTable`, not touch the router. [Source: frontend/src/router/index.tsx lines 20-31, 67-79]

### `AdminPage.tsx` and `AdminPage.test.tsx` are placeholders

`AdminPage.tsx` is currently `return <div>Admin Page</div>` and its test asserts that literal string. Both must be rewritten (Tasks 7, 8). The placeholder test WILL fail once the page changes — update it, don't ignore it. [Source: frontend/src/pages/AdminPage.tsx; frontend/src/pages/AdminPage.test.tsx]

### API / payload contracts

- `apiClient.get` / `apiClient.patch` (body-less PATCH supported) already exist. Use them — no raw `fetch`, no new client methods. [Source: frontend/src/lib/apiClient.ts lines 56-63]
- Spring `Page<T>` serializes as `{ content: [...], totalElements, totalPages, number, size, ... }`. Type it explicitly in `types/api.ts`; never use `any`. [Source: architecture impl-patterns#Anti-Patterns]
- Existing `UserDto` (`{id,email,role}`) is the auth user shape — do NOT overload it; create a distinct `AdminUserDto` that adds `status` and `createdAt`. [Source: frontend/src/types/api.ts lines 16-20]

### Source tree — files to create / modify

**Backend (new):**
- `src/main/java/.../admin/AdminController.java`
- `src/main/java/.../admin/AdminService.java`
- `src/main/java/.../admin/UserNotFoundException.java`
- `src/main/java/.../admin/dto/AdminUserDto.java`
- `src/main/java/.../auth/AccountDeactivatedException.java`
- `src/test/java/.../admin/AdminServiceTest.java`
- `src/test/java/.../admin/AdminControllerIntegrationTest.java`

**Backend (modify):**
- `src/main/java/.../auth/AuthService.java` — add `!isEnabled()` check in `login`
- `src/main/java/.../common/GlobalExceptionHandler.java` — add `UserNotFoundException` → 404 handler
- `src/test/java/.../auth/AuthControllerIntegrationTest.java` (or `AuthServiceTest.java`) — deactivated-login 401 test

**Frontend (new):**
- `frontend/src/components/admin/UserTable.tsx`
- `frontend/src/components/admin/UserTable.test.tsx`

**Frontend (modify):**
- `frontend/src/pages/AdminPage.tsx` — replace placeholder, render `<UserTable />`
- `frontend/src/pages/AdminPage.test.tsx` — replace obsolete assertion
- `frontend/src/types/api.ts` — add `AdminUserDto` (+ `Page<T>` if not present)

[Source: architecture project-structure-boundaries.md#Complete Project Directory Structure (admin/, components/admin/)]

### Testing standards summary

- Every new service method gets a `*Test.java` unit test (JUnit 5 + Mockito, `@ExtendWith(MockitoExtension.class)`, no Spring context). [Source: project-context.md#Backend Unit Tests]
- Integration tests: `<Controller>IntegrationTest.java`, `@SpringBootTest`, Testcontainers PostgreSQL via shared `testcontainers/PostgresTestContainer.java`. Every REST endpoint needs ≥1 happy-path integration test; admin endpoints additionally need the 403 non-admin case. [Source: project-context.md#Backend Integration Tests]
- Frontend tests co-located, Vitest + Testing Library; never import from `components/ui/` internals — test behaviour. Mock `apiClient`. [Source: project-context.md#Frontend Tests]

### Project Structure Notes

- `admin/` backend package and `components/admin/` frontend dir are pre-defined in the architecture and currently empty/placeholder — this story populates them. No structural variance.
- One naming variance to record: the architecture/epic refer to a "status" while the schema uses `enabled`. Resolution: keep `enabled` in the data layer, expose `status` only in `AdminUserDto`. This is intentional and documented above; do not migrate the column.
- `@PreAuthorize("hasRole('ADMIN')")` must be on the controller methods. If omitted, the endpoint is effectively open to any authenticated user (the catch-all only requires authentication). [Source: project-context.md#Security — All @PreAuthorize ADMIN checks are on controller methods]

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7-administration-observability.md#Story 7.1]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Naming Patterns, #Format Patterns, #Enforcement Guidelines]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure, #Requirements to Structure Mapping (Admin FR38–42)]
- [Source: _bmad-output/project-context.md#Spring Boot / Spring Security, #Security, #Frontend]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/domain/User.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java]
- [Source: src/main/resources/db/migration/V1__create_users_table.sql]
- [Source: frontend/src/router/index.tsx]
- [Source: frontend/src/lib/apiClient.ts]
- [Source: frontend/src/stores/useAuthStore.ts]
- [Source: frontend/src/types/api.ts]
- Prior-art pattern (route role-gating + lazy admin page): Story 1.5 (`1-5-protected-routes-and-application-shell.md`)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / Senior Software Engineer)

### Debug Log References

- Backend unit tests: `AdminServiceTest` (4) + `AuthServiceTest` (7) — all green.
- Backend integration (Testcontainers PostgreSQL): `AdminControllerIntegrationTest` (5) + `AuthControllerIntegrationTest` (11) — all green.
- Full backend regression: 49 surefire test classes, 0 failures / 0 errors / 0 skipped.
- Frontend targeted: `UserTable.test.tsx` + `AdminPage.test.tsx` (7) — green.
- Full frontend suite: 59 files, 752 tests — all green.
- `npm run lint`: 0 issues in story files. Pre-existing 14 errors / 5 warnings in `EditorPage.tsx` (refs-during-render) are unrelated to this story and untouched.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- AC #1: `GET /api/v1/admin/users` returns `Page<AdminUserDto>` with method-level `@PreAuthorize("hasRole('ADMIN')")`; non-admin → 403 ProblemDetail (verified in integration test).
- AC #2: `PATCH /api/v1/admin/users/{userId}/deactivate` sets `enabled=false`, returns 200 INACTIVE DTO; idempotent for already-disabled users; missing id → 404 ProblemDetail. Resume/profile data untouched (no cascade — only `User.enabled` mutated).
- AC #3: `AuthService.login` throws `AccountDeactivatedException` (extends `DomainAuthException` → 401) AFTER password verification; integration test asserts `detail == "Account is deactivated"`.
- AC #4/#6: `AdminPage` renders heading + `<UserTable />`; router lazy/Suspense/Skeleton/`requireAdmin` already present from Story 1.5 and left untouched (no regression).
- AC #5: shadcn/ui `Dialog` confirm flow with email-specific copy; Cancel default-focused (UX-DR19); success updates row to Inactive + hides action + "User deactivated" toast; failure shows error toast and leaves row unchanged.
- AC #7: all specified backend + frontend tests authored and passing.
- Deviation (documented & in-spec): `AdminUserDto.fromUser(User)` static factory used in place of a private `toDto` mapper — equivalent mapping, keeps the DTO self-contained. `UserTable` uses a semantic HTML `<table>` because no `components/ui/table.tsx` exists in this codebase (story said "shadcn/ui table" but none is installed; adding one was out of scope and the rule forbids editing `components/ui/`). Date rendered via `Intl.DateTimeFormat` since `createdAt` is a full ISO instant (the `dateUtils` helpers target partial resume dates).
- No new Flyway migration (deactivation uses existing `enabled` column, per Dev Notes).
- ✅ Resolved review finding [patch]: removed redundant `setIsLoadingUsers(true)` from the mount effect in `UserTable.tsx` (line 37) that triggered ESLint `react-hooks/set-state-in-effect`. `isLoadingUsers` already initializes to `true` and the effect runs once (empty deps), so the call was a no-op on first mount — no behavior change (skeleton still renders on mount). Lint: the `UserTable.tsx` error is gone; only pre-existing errors in other files (EditorPage, SummaryStep, authShared, profileStepShared, sectionRendererShared, usePageLayout) remain, all out of scope. Targeted tests green: `UserTable.test.tsx` + `AdminPage.test.tsx` (7 passed).

### File List

**Backend (new):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/admin/AdminController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/admin/AdminService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/admin/UserNotFoundException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/admin/dto/AdminUserDto.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AccountDeactivatedException.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/admin/AdminServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/admin/AdminControllerIntegrationTest.java`

**Backend (modified):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java`

**Frontend (new):**
- `frontend/src/components/admin/UserTable.tsx`
- `frontend/src/components/admin/UserTable.test.tsx`

**Frontend (modified):**
- `frontend/src/pages/AdminPage.tsx`
- `frontend/src/pages/AdminPage.test.tsx`
- `frontend/src/types/api.ts`

### Change Log

| Date | Change |
| --- | --- |
| 2026-06-23 | Implemented Story 7.1 — Admin user management API & UI. Added `AdminController`/`AdminService`/`AdminUserDto`/`UserNotFoundException`; enforced deactivated-login block via `AccountDeactivatedException` in `AuthService`; added 404 handler. Built `UserTable` + confirm-dialog deactivate flow and replaced `AdminPage` placeholder; added `AdminUserDto`/`Page<T>` types. Full suites green (backend 0 failures across 49 classes; frontend 752 tests). Status → review. |
| 2026-06-23 | Addressed code review findings - 1 item resolved. Removed redundant `setIsLoadingUsers(true)` from `UserTable.tsx` mount effect (ESLint `react-hooks/set-state-in-effect`). No behavior change; targeted tests (7) green; `UserTable.tsx` lint error cleared. Status remains review. |
