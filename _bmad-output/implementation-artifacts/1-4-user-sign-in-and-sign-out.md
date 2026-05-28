# Story 1.4: User Sign-In & Sign-Out

Status: review

## Story

As a registered user,
I want to sign in with my email and password and sign out when I'm done,
So that my account is secure and my session is controlled.

## Acceptance Criteria

1. **Given** a registered user submits valid credentials to `POST /api/v1/auth/login` **When** the request is processed **Then** a JWT token is returned in the response body as `{ "token": "..." }` with a 1-hour TTL (configurable via `app.jwt.expiration-ms`).

2. **Given** a user submits incorrect credentials (wrong password or unknown email) **When** the login request is processed **Then** HTTP 401 is returned with a `ProblemDetail` body; no token is issued.

3. **Given** a logged-in user clicks Sign Out **When** sign-out completes **Then** the JWT token is cleared from `useAuthStore`, the user is redirected to `/login`, and subsequent API requests using the old token receive HTTP 401 (stateless — short TTL + client-side deletion, no server-side blacklist in v1).

4. **Given** a request is made to any protected endpoint without a JWT token **When** the JWT filter processes the request **Then** HTTP 401 is returned with a `ProblemDetail` body.

5. **Given** a request is made with an expired or malformed JWT **When** the JWT filter processes the request **Then** HTTP 401 is returned with a `ProblemDetail` body (NFR8).

6. **Given** a signed-in user navigates to `/login` directly **When** the route is evaluated **Then** they are redirected to the dashboard (`/`) — already authenticated.

## Tasks / Subtasks

- [x] Task 1: Add `login` method to `AuthService` (AC: 1, 2)
  - [x] Inject `UserRepository` and `PasswordEncoder` — already available via constructor (Story 1.3)
  - [x] `login(LoginRequest request)` → `AuthResponse`: load user by email via `userRepository.findByEmail()`; if absent OR `!passwordEncoder.matches(request.password(), user.getPasswordHash())` → throw `InvalidCredentialsException`; otherwise call `tokenService.generateToken(user)` and return `AuthResponse`
  - [x] `InvalidCredentialsException` — `extends RuntimeException`; message: "Invalid email or password" — deliberately vague to prevent user enumeration (security requirement)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/InvalidCredentialsException.java`
  - [x] Register handler in `GlobalExceptionHandler`: `InvalidCredentialsException` → `ProblemDetail` HTTP 401, title "Unauthorized", detail "Invalid email or password"
  - [x] **IMPORTANT:** `InvalidCredentialsException` is auth-domain only — it does NOT need to extend `DomainConflictException` (that is for 409). It extends `RuntimeException` directly and has its own handler in `GlobalExceptionHandler`.

- [x] Task 2: Create `LoginRequest` DTO (AC: 1, 2)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/LoginRequest.java`
  - [x] Java record; fields: `String email`, `String password`; annotate with `@NotBlank` on both, `@Email` on email; use `jakarta.validation.*`
  - [x] Note: `@Size(min=8)` is intentionally omitted on the password field — this is a login request, not signup. A user who registered when the min length was different must still be able to log in.

- [x] Task 3: Add `login` endpoint to `AuthController` (AC: 1, 2)
  - [x] Update `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthController.java`
  - [x] `POST /api/v1/auth/login` — accepts `@Valid @RequestBody LoginRequest`, returns `ResponseEntity<AuthResponse>` HTTP 200
  - [x] `SecurityConfig` already has `permitAll()` for `POST /api/v1/auth/login` (added in Story 1.3) — no change needed there

- [x] Task 4: Harden `JwtAuthenticationFilter` 401 response (AC: 4, 5)
  - [x] Update `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java`
  - [x] Current state (Story 1.3): on `JwtException`, clears SecurityContext and calls `filterChain.doFilter()` — Spring Security then rejects unauthenticated access with a generic 401 (default Spring Security error page, not `ProblemDetail`)
  - [x] Required state: on `JwtException`, write a `ProblemDetail` JSON 401 response directly from the filter — do NOT call `filterChain.doFilter()` after writing the response
  - [x] Implementation pattern applied as specified in Dev Notes
  - [x] Inject `ObjectMapper` via constructor (Spring auto-configures a `@Bean ObjectMapper` in `JacksonConfig` — just add it to the constructor)
  - [x] The filter must also handle the case where no Authorization header is present — in that case, continue with `filterChain.doFilter()` as before (Spring Security will enforce `authenticated()` rule and produce its own 401 for no-token requests — or we can rely on `AuthenticationEntryPoint`; see Dev Notes)

- [x] Task 5: Write backend unit tests (AC: 1, 2)
  - [x] Update `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java`
  - [x] `@ExtendWith(MockitoExtension.class)` — NO Spring context
  - [x] Add tests: `login_validCredentials_returnsToken()`, `login_unknownEmail_throwsInvalidCredentialsException()`, `login_wrongPassword_throwsInvalidCredentialsException()`
  - [x] Mock: `UserRepository`, `PasswordEncoder`, `TokenService`

- [x] Task 6: Write backend integration tests (AC: 1, 2, 4, 5)
  - [x] Update `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java`
  - [x] Reuse the same `ContainersConfig` Testcontainers PostgreSQL setup already in that class — no new container setup
  - [x] Add tests: `login_validCredentials_returns200WithToken()`, `login_unknownEmail_returns401ProblemDetail()`, `login_wrongPassword_returns401ProblemDetail()`, `login_blankEmail_returns400ProblemDetail()`, `protectedEndpoint_withoutToken_returns401ProblemDetail()`, `protectedEndpoint_withExpiredToken_returns401ProblemDetail()`
  - [x] For the protected endpoint tests, use any existing protected endpoint (e.g. `GET /api/v1/profile` — will 404 but the JWT filter should intercept first with 401)
  - [x] Expired token test: generate a token with `expirationMs = 0` or use a pre-built expired token string. Simplest approach: create a helper `TokenService` instance with `expirationMs = -1000` (already expired) in the test.

- [x] Task 7: Implement `LoginPage.tsx` (AC: 1, 2, 3, 6)
  - [x] Replace placeholder `frontend/src/pages/LoginPage.tsx` (currently `<div>Login Page</div>`)
  - [x] Pattern: mirror `SignupPage.tsx` structure exactly — same layout, same Tailwind classes, same shadcn/ui components (`Input`, `Button`), same `isSubmitting` local state, same Toast error pattern
  - [x] Form fields: email input + password input + "Sign In" button
  - [x] `autoComplete="current-password"` on password field (not `new-password` as in signup)
  - [x] On submit: call `POST /api/v1/auth/login` via `apiClient.post<AuthResponse>("/api/v1/auth/login", request)`
  - [x] On success: call `setAuth(response.token, response.user ?? null)` then `navigate("/")`
  - [x] On 401 error: show Toast "Invalid email or password" (do NOT show field-level errors for 401 — the server intentionally returns a single vague message)
  - [x] On 400 error (blank fields): show field-level errors below each input using the same `FieldErrors` pattern as `SignupPage.tsx`
  - [x] **AC6 — redirect if already authenticated:** Check `useAuthStore` token at page load; if token exists, redirect to `/` using `<Navigate to="/" replace />` before rendering the form
  - [x] Accessibility: every `<input>` has `<label htmlFor>`, `aria-invalid`, `aria-describedby` on error, `role="alert"` on error paragraphs (NFR19)
  - [x] "Don't have an account?" link to `/signup`
  - [x] Add `LoginRequest` interface to `frontend/src/types/api.ts`: `interface LoginRequest { email: string; password: string }`

- [x] Task 8: Add Sign Out to application (AC: 3)
  - [x] Story 1.5 will implement the full application shell (nav bar). For this story, sign-out must work correctly as a **function** that the next story can wire to a button.
  - [x] `useAuthStore.clearAuth()` is already implemented (Story 1.3) — calling it clears token and user from Zustand memory.
  - [x] The `apiClient` already handles 401 → `clearAuth()` (Story 1.2/1.3) — this satisfies the "subsequent requests get 401" AC automatically because once `clearAuth()` runs, `apiClient` stops sending the Authorization header.
  - [x] For this story: implement a `useSignOut` hook at `frontend/src/hooks/useSignOut.ts` — calls `useAuthStore.getState().clearAuth()` then redirects to `/login` via `useNavigate`. This hook is the canonical sign-out entry point for Story 1.5's navigation bar.
  - [x] Do NOT add a nav bar or header in this story — that is Story 1.5's scope.

## Dev Notes

### What Story 1.3 Built (Current State)

All of the following exist and are fully implemented — DO NOT recreate them:

**Backend (all in `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/`):**
- `domain/User.java` — `@Entity`, implements `UserDetails`, fields: `email`, `passwordHash`, `role`, `enabled`
- `UserRepository.java` — `findByEmail(String email): Optional<User>`
- `TokenService.java` — `generateToken(User)`, `validateToken(String): Claims`, `extractEmail(String)`; uses jjwt 0.12.3 HMAC-SHA256
- `AuthService.java` — has `signup()` method; this story adds `login()` to the same class
- `AuthController.java` — has `POST /api/v1/auth/signup`; this story adds `POST /api/v1/auth/login`
- `JwtAuthenticationFilter.java` — exists, already wired in `SecurityConfig`; needs hardening in Task 4
- `EmailAlreadyExistsException.java` — extends `DomainConflictException` (introduced by 1.3 review)
- `dto/SignupRequest.java`, `dto/AuthResponse.java` — Java records; `AuthResponse` has only `token: String`

**Backend (config/common):**
- `config/SecurityConfig.java` — already has `permitAll()` for both `/api/v1/auth/signup` AND `/api/v1/auth/login`; `BCryptPasswordEncoder` bean declared here; `JwtAuthenticationFilter` registered before `UsernamePasswordAuthenticationFilter`
- `common/GlobalExceptionHandler.java` — handles `DomainConflictException` (409), `MethodArgumentNotValidException` (400), `Exception` (500); this story adds `InvalidCredentialsException` (401)
- `common/DomainConflictException.java` — base class for domain 409 exceptions; `InvalidCredentialsException` should NOT extend this

**Frontend:**
- `frontend/src/stores/useAuthStore.ts` — `token: string | null`, `user: UserDto | null`, `setAuth(token, user)`, `clearAuth()`
- `frontend/src/lib/apiClient.ts` — on 401: calls `useAuthStore.getState().clearAuth()` (but does NOT redirect — that is a known deferred gap from Story 1.3)
- `frontend/src/types/api.ts` — has `AuthResponse`, `SignupRequest`, `UserDto`, `ApiErrorResponse`
- `frontend/src/router/index.tsx` — `/login` and `/signup` are public; all others wrapped in `ProtectedRoute`; `ProtectedRoute` redirects to `/login` if no token
- `frontend/src/pages/LoginPage.tsx` — currently a placeholder stub `<div>Login Page</div>`; replaced in Task 7
- `frontend/src/pages/SignupPage.tsx` — fully implemented; use as the exact pattern for `LoginPage.tsx`

### JWT Filter 401 Response — Critical Architecture Decision

The current `JwtAuthenticationFilter` (Story 1.3) on `JwtException` does:
```java
SecurityContextHolder.clearContext();
// then calls filterChain.doFilter() — Spring Security's default 401 is NOT ProblemDetail
```

This story must change it to write a `ProblemDetail` JSON response directly because:
- AC4 and AC5 require HTTP 401 with a `ProblemDetail` body
- Spring Security's default `AuthenticationEntryPoint` returns a non-JSON 401 response

**Two valid approaches — use Approach A:**

**Approach A (preferred — filter writes response directly):**
Inject `ObjectMapper` via constructor, on `JwtException` write the response and `return`:
```java
response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
response.setContentType(MediaType.APPLICATION_JSON_VALUE);
ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
problem.setTitle("Unauthorized");
response.getWriter().write(objectMapper.writeValueAsString(problem));
return; // critical — do not fall through to filterChain
```

**Approach B (alternative — custom AuthenticationEntryPoint):**
Register a custom `AuthenticationEntryPoint` in `SecurityConfig`. More Spring-idiomatic but adds more classes. Avoid for this story's scope.

**For the no-token case (no Authorization header):** Do NOT write a 401 from the filter. Continue with `filterChain.doFilter()` as before. Spring Security's `authenticated()` rule will generate the 401 (the `AuthenticationEntryPoint`). This ensures the filter only handles token-present-but-invalid cases.

However, this default 401 from Spring Security may NOT be `ProblemDetail`. If integration tests for AC4 (no-token → 401 ProblemDetail) fail because Spring Security returns HTML or a non-JSON 401, you must also configure the `AuthenticationEntryPoint`. Add to `SecurityConfig`:
```java
.exceptionHandling(ex -> ex
    .authenticationEntryPoint((request, response, authException) -> {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Authentication required");
        problem.setTitle("Unauthorized");
        response.getWriter().write(objectMapper.writeValueAsString(problem));
    })
)
```
Inject `ObjectMapper` into `SecurityConfig` if you add this.

### `InvalidCredentialsException` Handler in `GlobalExceptionHandler`

Add to `GlobalExceptionHandler.java`:
```java
@ExceptionHandler(InvalidCredentialsException.class)
public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNAUTHORIZED,
            ex.getMessage()
    );
    problem.setTitle("Unauthorized");
    return problem;
}
```
Note: `InvalidCredentialsException` is in the `auth` package. `GlobalExceptionHandler` is in the `common` package. This is a cross-domain import. To avoid repeating the Story 1.3 review violation pattern, consider a `DomainAuthException` in `common` that `InvalidCredentialsException` extends — mirroring the `DomainConflictException` pattern. This is recommended but not mandatory; the code review will catch it either way.

### `LoginPage.tsx` — Redirect-If-Authenticated Pattern

```tsx
import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/stores/useAuthStore"

export default function LoginPage() {
  const token = useAuthStore((state) => state.token)
  if (token) return <Navigate to="/" replace />
  // ... rest of the form
}
```

This satisfies AC6 without adding a new route guard.

### `useSignOut` Hook

```typescript
// frontend/src/hooks/useSignOut.ts
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/useAuthStore"

export function useSignOut() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  return () => {
    clearAuth()
    navigate("/login", { replace: true })
  }
}
```

Story 1.5 will import and call `useSignOut()` from the navigation bar. Do not add any UI in this story.

### `LoginRequest` TypeScript Type

Add to `frontend/src/types/api.ts`:
```typescript
export interface LoginRequest {
  email: string
  password: string
}
```

No other type changes needed — `AuthResponse` (already `{ token: string; user?: UserDto }`) is reused for the login response.

### Security Note — User Enumeration

`InvalidCredentialsException` must use the same message for "email not found" and "password incorrect":
- Message: `"Invalid email or password"` — never `"Email not found"` or `"Incorrect password"`
- This is intentional (NFR6 / security requirement) — tests must not check for distinct messages per failure mode

### jjwt 0.12.3 — Expired Token Behavior

`tokenService.validateToken(expiredToken)` throws `io.jsonwebtoken.ExpiredJwtException` which is a subclass of `JwtException`. The filter's `catch (JwtException ex)` block covers both expired and malformed tokens — no additional handling needed.

### Flyway Migrations

**No Flyway migrations required for this story.** The `users` table from `V1__create_users_table.sql` is complete. Do NOT create a new migration.

### Project Structure — Files This Story Changes

**Backend (NEW files):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/InvalidCredentialsException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/LoginRequest.java`

**Backend (MODIFY):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java` — add `login()` method
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthController.java` — add `POST /api/v1/auth/login` endpoint
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java` — harden 401 response (Task 4)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — add `InvalidCredentialsException` handler (401)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` — potentially add `AuthenticationEntryPoint` (see Dev Notes Task 4)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java` — add login unit tests
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java` — add login + filter integration tests

**Frontend (NEW files):**
- `frontend/src/hooks/useSignOut.ts`

**Frontend (MODIFY):**
- `frontend/src/pages/LoginPage.tsx` — replace placeholder with full implementation
- `frontend/src/types/api.ts` — add `LoginRequest` interface

**Files to NOT touch:**
- `frontend/src/router/index.tsx` — already correct (public `/login`, `ProtectedRoute` on others)
- `frontend/src/stores/useAuthStore.ts` — already correct
- `frontend/src/lib/apiClient.ts` — already correct (on 401: clearAuth; no redirect — deferred from 1.3)
- `src/main/resources/db/migration/` — NO migrations
- Any files under `frontend/src/components/ui/` — shadcn-managed, never edit

### Testing Patterns from Story 1.3

**Unit test pattern** (`@ExtendWith(MockitoExtension.class)`):
```java
@Mock UserRepository userRepository;
@Mock PasswordEncoder passwordEncoder;
@Mock TokenService tokenService;
@InjectMocks AuthService authService;
```

**Integration test pattern** (reuse existing `ContainersConfig` in `AuthControllerIntegrationTest`):
- `@SpringBootTest(webEnvironment = RANDOM_PORT)`
- `@ActiveProfiles("test")` (uses `src/test/resources/application-test.yml` — Ollama disabled, cache disabled)
- `@Import(AuthControllerIntegrationTest.ContainersConfig.class)`
- Use `WebTestClient.bindToServer().baseUrl(...)` for requests

For login integration tests, you need a pre-registered user. Call the signup endpoint first in the test (or use `userRepository.save()` directly):
```java
// Setup: register a user first
webTestClient().post().uri("/api/v1/auth/signup")
    .contentType(MediaType.APPLICATION_JSON)
    .bodyValue(objectMapper.writeValueAsString(new SignupRequest("test@example.com", "Password1")))
    .exchange().expectStatus().isCreated();
// Then test login
```

### Lint Requirement

Before marking story `review`: run `cd frontend && npm run lint` — must pass with 0 errors.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered. All 17 backend tests passed on first run. Frontend lint returned 0 errors.

### Completion Notes List

- Created `InvalidCredentialsException` extending `RuntimeException` directly (not `DomainConflictException`) with deliberate vague message "Invalid email or password" to prevent user enumeration.
- Added `login()` method to `AuthService` — checks email existence and password match, throws `InvalidCredentialsException` on either failure (same exception for both cases per security requirement).
- Created `LoginRequest` DTO as a Java record with `@NotBlank @Email` on email and `@NotBlank` on password (no `@Size(min=8)` — login intent, not signup).
- Added `POST /api/v1/auth/login` endpoint to `AuthController` returning HTTP 200 with `AuthResponse`.
- Added `InvalidCredentialsException` handler to `GlobalExceptionHandler` (cross-domain import from `auth` package — intentional per story notes).
- Hardened `JwtAuthenticationFilter`: on `JwtException`, now writes `ProblemDetail` JSON 401 response directly and returns without calling `filterChain.doFilter()`. Injected `ObjectMapper` via constructor.
- Added custom `AuthenticationEntryPoint` to `SecurityConfig` to ensure no-token (missing Authorization header) requests also return `ProblemDetail` JSON 401 (not Spring Security's default HTML/WWW-Authenticate response).
- Added 3 unit tests to `AuthServiceTest` covering login happy path, unknown email, and wrong password scenarios.
- Added 6 integration tests to `AuthControllerIntegrationTest`: login success (200), unknown email (401), wrong password (401), blank email (400), protected endpoint without token (401), protected endpoint with expired token (401). Expired token test uses a local `TokenService` instance with `expirationMs = -1000`.
- Implemented full `LoginPage.tsx` mirroring `SignupPage.tsx` structure with redirect-if-authenticated guard (AC6), field-level errors for 400, toast for 401, accessibility attributes (aria-invalid, aria-describedby, role="alert"), `autoComplete="current-password"`.
- Added `LoginRequest` interface to `frontend/src/types/api.ts`.
- Created `useSignOut` hook at `frontend/src/hooks/useSignOut.ts` as the canonical sign-out entry point for Story 1.5's nav bar.

### File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/InvalidCredentialsException.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/LoginRequest.java` (new)
- `frontend/src/hooks/useSignOut.ts` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java` (modified)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthController.java` (modified)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java` (modified)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` (modified)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` (modified)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java` (modified)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java` (modified)
- `frontend/src/pages/LoginPage.tsx` (modified)
- `frontend/src/types/api.ts` (modified)

### Change Log

- Implemented user sign-in (POST /api/v1/auth/login) and sign-out (useSignOut hook) — all 6 ACs satisfied (Date: 2026-05-20)
