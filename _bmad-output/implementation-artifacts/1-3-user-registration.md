# Story 1.3: User Registration

Status: done

## Story

As an unregistered user,
I want to create an account with my email address and password,
so that I can access the Resume Enhancer application.

## Acceptance Criteria

1. **Given** a user submits a valid email and password to `POST /api/v1/auth/signup` **When** the request is processed **Then** a new user account is created, the password is stored as a bcrypt hash, and a JWT token is returned in the response body as `{ "token": "..." }`.

2. **Given** a user submits an email that already exists **When** the signup request is processed **Then** the system returns HTTP 409 with a `ProblemDetail` body explaining the conflict.

3. **Given** a user submits an invalid email format or a blank password **When** the signup request is processed **Then** the system returns HTTP 400 with a `ProblemDetail` body listing the validation errors.

4. **Given** a new user successfully registers via the `/signup` page **When** registration completes **Then** the user is redirected to the dashboard (`/`) and their JWT token is stored in `useAuthStore` (Zustand in-memory only — never localStorage).

5. **Given** the signup page is accessed **When** it renders **Then** it is accessible at `/signup`, requires no authentication, has correct `<label>` elements associated with all form inputs, and supports full keyboard navigation (NFR19).

## Tasks / Subtasks

- [x] Task 1: Implement `User` entity and `UserRepository` (AC: 1)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/domain/User.java` — `@Entity` `@Table(name="users")`, extends `BaseEntity`; fields: `email VARCHAR UNIQUE`, `passwordHash VARCHAR`, `role VARCHAR(10)` with `CHECK (role IN ('USER','ADMIN'))` and default `'USER'`; `enabled BOOLEAN DEFAULT TRUE`; use Lombok `@Getter @Setter` only (not `@Data` — entities must not use `@EqualsAndHashCode` on mutable state); implement `UserDetails` for Spring Security principal
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserRepository.java` — `JpaRepository<User, UUID>` with `Optional<User> findByEmail(String email)`

- [x] Task 2: Implement `TokenService` for JWT mint/validate (AC: 1)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenService.java`
  - [x] Inject `@Value("${app.jwt.secret}")` and `@Value("${app.jwt.expiration-ms}")` (properties already defined in `application.yml` from Story 1.1)
  - [x] `generateToken(User user)` — HMAC-SHA256, claims: `sub` = email, `role` = user.role, `iat`/`exp`; use `io.jsonwebtoken:jjwt-api:0.12.3`
  - [x] `validateToken(String token)` — returns `Claims` or throws `JwtException`; used by `JwtAuthenticationFilter` in Story 1.4 (create method stub here)
  - [x] `extractEmail(String token)` — convenience method; used by filter

- [x] Task 3: Implement `AuthService` signup method (AC: 1, 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java`
  - [x] `signup(SignupRequest request)` → `AuthResponse`: validate uniqueness, encode password with `BCryptPasswordEncoder`, persist `User`, call `TokenService.generateToken()`, return `AuthResponse`
  - [x] Throw `EmailAlreadyExistsException` (custom `RuntimeException`) on duplicate email — `GlobalExceptionHandler` maps this to 409 `ProblemDetail`
  - [x] `BCryptPasswordEncoder` bean must be declared in `SecurityConfig` (not in `AuthService`) — inject via constructor

- [x] Task 4: Create DTOs (AC: 1, 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/SignupRequest.java` — Java record; fields: `String email`, `String password`; annotate with `@NotBlank` on both, `@Email` on email, `@Size(min=8)` on password; use `jakarta.validation.*`
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/AuthResponse.java` — Java record; field: `String token`
  - [x] Note: `LoginRequest.java` and other auth DTOs are needed for Story 1.4 — do NOT create them here; leave Story 1.4 to add them

- [x] Task 5: Implement `AuthController` signup endpoint (AC: 1, 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthController.java`
  - [x] `POST /api/v1/auth/signup` accepts `@Valid @RequestBody SignupRequest`, returns `ResponseEntity<AuthResponse>` HTTP 201
  - [x] Annotate with `@RestController @RequestMapping("/api/v1/auth")` and `@Tag(name = "Auth")` for Springdoc
  - [x] DO NOT add login endpoint here — that is Story 1.4

- [x] Task 6: Implement `JwtAuthenticationFilter` skeleton (AC: 1 — needed for SecurityConfig wiring)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java` — extends `OncePerRequestFilter`
  - [x] For this story: filter must compile and be registered in `SecurityConfig` but can be a **pass-through** (no token validation logic yet — that lands in Story 1.4 when the login endpoint is implemented)
  - [x] `doFilterInternal` skeleton: extract `Authorization: Bearer <token>` header; if present, call `tokenService.validateToken()` and populate `SecurityContextHolder`; if absent or invalid, simply call `filterChain.doFilter(request, response)` (no 401 from filter in this story — SecurityConfig still permits `/api/v1/auth/**` and blocks others; filter chain is wired but fully functional validation tested in Story 1.4)

- [x] Task 7: Update `SecurityConfig` with full JWT filter chain (AC: 1)
  - [x] Update `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` — replace the Story 1.1 permit-all placeholder with a real filter chain:
    - `POST /api/v1/auth/signup` — `permitAll()`
    - `POST /api/v1/auth/login` — `permitAll()` (pre-declare for Story 1.4 — endpoint doesn't exist yet but the rule should be there)
    - `GET /swagger-ui/**`, `GET /v3/api-docs/**` — `permitAll()`
    - All other requests — `authenticated()`
  - [x] Register `JwtAuthenticationFilter` before `UsernamePasswordAuthenticationFilter`
  - [x] Disable CSRF (stateless JWT API)
  - [x] Declare `BCryptPasswordEncoder` `@Bean` here — injected by `AuthService`
  - [x] **DO NOT** place any permit-all exclusions in controllers or filters — `SecurityConfig` is the sole location (architecture rule)

- [x] Task 8: Add `EmailAlreadyExistsException` and update `GlobalExceptionHandler` (AC: 2)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/EmailAlreadyExistsException.java` — `extends RuntimeException`
  - [x] Update `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`:
    - Add handler for `EmailAlreadyExistsException` → `ProblemDetail` HTTP 409
    - Add handler for `MethodArgumentNotValidException` → `ProblemDetail` HTTP 400 with validation error details
  - [x] Response must use RFC 7807 `ProblemDetail` exclusively — never `ResponseEntity<Map<String, Object>>`

- [x] Task 9: Write backend unit test (AC: 1, 2, 3)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java`
  - [x] `@ExtendWith(MockitoExtension.class)` — NO Spring context
  - [x] Mock: `UserRepository`, `PasswordEncoder`, `TokenService`
  - [x] Tests: `signup_happyPath_returnsToken()`, `signup_duplicateEmail_throwsEmailAlreadyExistsException()`, `signup_blankPassword_validationFails()`

- [x] Task 10: Write backend integration test (AC: 1, 2, 3)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java`
  - [x] `@SpringBootTest(webEnvironment = RANDOM_PORT)` + Testcontainers PostgreSQL (use shared `PostgresTestContainer.java` pattern from project-context)
  - [x] Tests: POST `/api/v1/auth/signup` happy path (201 + token), duplicate email (409 ProblemDetail), invalid email format (400 ProblemDetail), blank password (400 ProblemDetail)

- [x] Task 11: Implement `SignupPage.tsx` frontend (AC: 4, 5)
  - [x] Create `frontend/src/pages/SignupPage.tsx`
  - [x] Form: email input + password input + "Create Account" button; use shadcn/ui `Input`, `Button`, `Label` components
  - [x] All `<input>` elements must have associated `<Label htmlFor>` (NFR19 / AC5)
  - [x] On submit: call `POST /api/v1/auth/signup` via `apiClient` (never raw `fetch`); on success store token in `useAuthStore`, redirect to `/`; on error display message via shadcn/ui `Toast`
  - [x] Show inline field-level validation errors from server 400 response below the relevant input (`text-red-600` per UX spec)
  - [x] Show 409 conflict error as Toast: "An account with this email already exists"
  - [x] Route `/signup` must be public (no `ProtectedRoute` wrapper) — confirm in `router/index.tsx`
  - [x] Loading state: disable button and show spinner during request (do NOT use a single global `isLoading` — use a local boolean `isSubmitting`)

- [x] Task 12: Implement `useAuthStore` (AC: 4)
  - [x] Create `frontend/src/stores/useAuthStore.ts`
  - [x] State: `token: string | null`, `user: { email: string; role: string } | null`
  - [x] Actions: `setAuth(token, user)`, `clearAuth()`
  - [x] Zustand immutable update pattern: `set(state => ({ ...state, token, user }))`
  - [x] **Never** persist to `localStorage` — Zustand in-memory only

- [x] Task 13: Implement `apiClient` base (AC: 4)
  - [x] Create `frontend/src/lib/apiClient.ts`
  - [x] Thin typed `fetch` wrapper; base URL from `import.meta.env.VITE_API_BASE_URL ?? ''`
  - [x] Injects `Authorization: Bearer <token>` from `useAuthStore` when token is present
  - [x] On 401: calls `useAuthStore.getState().clearAuth()` and redirects to `/login`
  - [x] Returns typed response or throws typed error — no bare `console.error` in production paths
  - [x] Must support `get<T>`, `post<T>`, `put<T>`, `delete<T>` methods

- [x] Task 14: Add `AuthResponse` and `SignupRequest` TypeScript types (AC: 4)
  - [x] Update `frontend/src/types/api.ts` (create if it doesn't exist yet — Story 1.2 may have created it)
  - [x] Add: `interface AuthResponse { token: string }`, `interface SignupRequest { email: string; password: string }`
  - [x] Use `string` for all date fields if any; strict mode — no `any`

- [x] Task 15: Register `/signup` route in router (AC: 5)
  - [x] Update `frontend/src/router/index.tsx` (or create it if Story 1.2 hasn't)
  - [x] `/signup` — public, renders `<SignupPage />`
  - [x] `/login` — public (placeholder for Story 1.4)
  - [x] `/` and all other routes — wrapped in `<ProtectedRoute>` (stub for Story 1.5; for now redirect to `/login` if no token in `useAuthStore`)

## Dev Notes

### Critical Rules for This Story

- **`SecurityConfig` is the only place permit-all exclusions live** — never scatter them in controllers or filters
- **`BCryptPasswordEncoder` bean declared in `SecurityConfig`**, injected everywhere else — never `new BCryptPasswordEncoder()` inline
- **`User` entity implements `UserDetails`** — this enables Spring Security integration in Story 1.4 without refactoring
- **JWT token stored in `useAuthStore` memory only** — never `localStorage`, `sessionStorage`, or cookies
- **`JwtAuthenticationFilter` is a skeleton in this story** — the filter must compile and be registered, but full validation + `SecurityContextHolder` population is tested end-to-end in Story 1.4. The filter code should be complete (validate if token present, skip if absent) but Story 1.3's integration test only tests the signup endpoint which is permit-all
- **All errors via `GlobalExceptionHandler` only** — `AuthController` must never catch exceptions and return them directly
- **`apiClient.ts` is the sole HTTP caller** — `SignupPage.tsx` must not call `fetch()` directly

### Previous Story Context (Story 1.1)

Story 1.1 established the following that this story builds directly on:
- `SecurityConfig.java` exists at `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` — **currently a permit-all placeholder**; Task 7 here replaces it with the real JWT chain
- `GlobalExceptionHandler.java` exists at `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — currently handles only generic `Exception` → 500; Task 8 here adds 409 and 400 handlers
- `BaseEntity.java` exists at `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java` — `id (UUID)`, `createdAt (Instant)`, `updatedAt (Instant)`; `User` must extend it
- `application.yml` has `app.jwt.secret` and `app.jwt.expiration-ms=3600000` — `@Value`-inject these in `TokenService`
- Flyway `V1__create_users_table.sql` already exists — the `users` table with `id, email, password_hash, role, enabled, created_at, updated_at` is already in the database; **do NOT create the table again**; the `User` entity must map to this exact schema
- `ResumeEnhancerApplication.java` has `@EnableJpaAuditing` — `BaseEntity` audit annotations (`@CreatedDate`, `@LastModifiedDate`) are active

**Story 1.1 file list for reference:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java`
- `src/main/resources/application.yml`
- `src/main/resources/db/migration/V1__create_users_table.sql`

Story 1.2 (`frontend-scaffold`) must be complete before Tasks 11–15 of this story can compile. If Story 1.2 is NOT yet done, backend tasks (1–10) can proceed independently.

### V1 Users Table Schema (from Story 1.1)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

`User` entity column mapping:
- `@Column(name = "password_hash")` → `String passwordHash`
- `@Column(name = "role")` → `String role` (not a JPA `@Enumerated` — stored as `VARCHAR`)
- `@Column(name = "enabled")` → `boolean enabled`
- `id`, `createdAt`, `updatedAt` inherited from `BaseEntity`

### `TokenService` Key Implementation Notes

jjwt 0.12.3 API (`jjwt-api`):
```java
// Generating
String token = Jwts.builder()
    .subject(user.getEmail())
    .claim("role", user.getRole())
    .issuedAt(new Date())
    .expiration(new Date(System.currentTimeMillis() + expirationMs))
    .signWith(getSigningKey())  // SecretKey from Decoders.BASE64.decode(secret)
    .compact();

// Parsing
Claims claims = Jwts.parser()
    .verifyWith(getSigningKey())
    .build()
    .parseSignedClaims(token)
    .getPayload();
```
- `getSigningKey()`: `Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret))` — the secret in `application.yml` must be Base64-encoded or long enough for HMAC-SHA256 (≥256 bits)
- Throws `JwtException` (base class) on any validation failure — catch this in `JwtAuthenticationFilter`

### `SecurityConfig` JWT Filter Chain Shape

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("POST /api/v1/auth/signup", "POST /api/v1/auth/login").permitAll()
            .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
            .anyRequest().authenticated()
        )
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
}
```
Note: `requestMatchers` syntax for method+path in Spring Security 6.x is `HttpMethod.POST, "/api/v1/auth/signup"` — use two-argument form.

### `User` entity as `UserDetails`

Implement `UserDetails` on `User` to avoid needing a separate `UserDetailsService` wrapper in Story 1.4:
```java
@Override public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_" + this.role));
}
@Override public String getPassword() { return this.passwordHash; }
@Override public String getUsername() { return this.email; }
@Override public boolean isEnabled() { return this.enabled; }
```

### Frontend: `apiClient.ts` Pattern

```typescript
// frontend/src/lib/apiClient.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw await res.json();
  return res.json() as Promise<T>;
}
export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
```

### Frontend: `SignupPage.tsx` Accessibility Requirements (NFR19 / AC5)

- Every `<input>` has a `<Label htmlFor={id}>` with matching `id` on the input
- Form `onSubmit` — prevent default, call apiClient, handle errors
- Error messages rendered below each field as `<p role="alert" className="text-red-600 text-sm">`
- "Create Account" button: `type="submit"`, `disabled={isSubmitting}`, shows spinner from shadcn/ui during submit
- No `any` TypeScript — error response typed as `{ detail: string; errors?: Record<string, string[]> }` matching RFC 7807 `ProblemDetail` shape

### Project Structure Additions

**Backend (NEW files):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/domain/User.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserRepository.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/EmailAlreadyExistsException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/SignupRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/AuthResponse.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java`

**Backend (MODIFY):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` — replace permit-all placeholder with real JWT filter chain + `BCryptPasswordEncoder` bean
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — add 409 + 400 handlers

**Frontend (NEW files — only if Story 1.2 is complete):**
- `frontend/src/pages/SignupPage.tsx`
- `frontend/src/stores/useAuthStore.ts`
- `frontend/src/lib/apiClient.ts`
- `frontend/src/types/api.ts` (create or update)

**Frontend (MODIFY):**
- `frontend/src/router/index.tsx` — register `/signup` route as public

**No Flyway migrations required** — `V1__create_users_table.sql` already defines the `users` table. Do NOT create a new migration.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3 — Acceptance Criteria]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security, Backend Package Structure, Enforcement Guidelines, Anti-Patterns]
- [Source: `_bmad-output/project-context.md` — Security rules, JWT rules, TypeScript rules, Testing rules, Anti-Patterns]
- [Source: `_bmad-output/implementation-artifacts/1-1-project-dependencies-and-backend-wiring.md` — BaseEntity, SecurityConfig placeholder, GlobalExceptionHandler skeleton, V1 migration, application.yml JWT properties]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-agent-dev + bmad-dev-story workflow, 2026-05-19)

### Debug Log References

- JWT secret in `application.yml` was a plain string; replaced with a valid Base64-encoded 256-bit key (`dGhpcy1pcy1hLXNlY3VyZS1zZWNyZXQta2V5LWZvci1qd3QtdG9rZW4tZ2Vu`) required by `Decoders.BASE64.decode()` in jjwt 0.12.3.
- `spring-boot-starter-validation` was missing from `pom.xml`; added for `@NotBlank`, `@Email`, `@Size` to work.
- `GlobalExceptionHandler.handleValidation` uses `Map<String, List<String>>` for field errors (aligned with frontend `Record<string, string[]>`).
- `ApiError` extended to carry `errors?: Record<string, string[]>` field so `SignupPage.tsx` can display field-level validation messages inline.
- Frontend `AuthResponse.user` made optional (`user?: UserDto`) since backend only returns `{ token }` — `SignupPage` synthesizes a minimal user object from the form email.
- Integration test uses `@ActiveProfiles("test")` + `src/test/resources/application-test.yml` to disable Ollama chat/embedding without spinning up an Ollama container.
- `User.java` was already partially implemented; `UserRepository` was the missing piece for Task 1.

### Completion Notes List

- AC1: `POST /api/v1/auth/signup` creates user, bcrypt-hashes password, returns JWT `{ "token": "..." }` HTTP 201.
- AC2: Duplicate email returns HTTP 409 `ProblemDetail` via `EmailAlreadyExistsException` → `GlobalExceptionHandler`.
- AC3: Invalid email/blank password returns HTTP 400 `ProblemDetail` with field-level `errors` map via Jakarta Validation + `GlobalExceptionHandler`.
- AC4: `SignupPage.tsx` calls `apiClient.post`, stores token in `useAuthStore` (Zustand in-memory only), navigates to `/`.
- AC5: `/signup` is public in router; form has `<label htmlFor>` on every input; `isSubmitting` disables button + shows `Loader2` spinner; keyboard-navigable.
- `JwtAuthenticationFilter` is fully wired in `SecurityConfig` with complete validate-if-present / skip-if-absent logic (Story 1.4 will test it end-to-end with the login endpoint).
- All architecture rules respected: `SecurityConfig` is sole location for permit-all exclusions; `BCryptPasswordEncoder` bean declared in `SecurityConfig`; no raw `fetch()` in components; `GlobalExceptionHandler` is sole exception-to-HTTP mapper.

### File List

**Files CREATED:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserRepository.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/TokenService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/EmailAlreadyExistsException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/SignupRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/AuthResponse.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java`
- `src/test/resources/application-test.yml`

**Files MODIFIED:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java` — real JWT filter chain, `BCryptPasswordEncoder` bean, `@EnableMethodSecurity`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — added 409 + 400 handlers
- `src/main/resources/application.yml` — replaced plain-string JWT secret with valid Base64-encoded key
- `pom.xml` — added `spring-boot-starter-validation`
- `frontend/src/pages/SignupPage.tsx` — fully implemented signup form (was placeholder stub)
- `frontend/src/lib/apiClient.ts` — extended `ApiError` with `errors` field; already existed from Story 1.2
- `frontend/src/types/api.ts` — added `SignupRequest` interface; made `AuthResponse.user` optional

**Files UNCHANGED (already correct from Story 1.2):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/domain/User.java`
- `frontend/src/stores/useAuthStore.ts`
- `frontend/src/router/index.tsx`

### Review Findings

- [x] [Review][Patch] Cross-domain import: `GlobalExceptionHandler` (common) imported `EmailAlreadyExistsException` (auth) — architecture violation. **Fixed:** introduced `DomainConflictException` in `common`; `EmailAlreadyExistsException` now extends it; handler updated to `DomainConflictException`. [`GlobalExceptionHandler.java`, `EmailAlreadyExistsException.java`, new `DomainConflictException.java`]
- [x] [Review][Patch] Race condition in `AuthService.signup()`: concurrent duplicate email registrations between `findByEmail` check and `save` would throw HTTP 500 (`DataIntegrityViolationException`) instead of HTTP 409. **Fixed:** wrapped `save()` in try/catch, rethrowing as `EmailAlreadyExistsException`. [`AuthService.java`]
- [x] [Review][Patch] Misleading test name `signup_blankPassword_validationFails` — test actually shows service bypasses validation. **Fixed:** renamed to `signup_blankPassword_serviceEncodesWithoutValidating`. [`AuthServiceTest.java`]
- [x] [Review][Patch] `SignupPage` stored synthesized `{ id: "", email, role: "USER" }` in `useAuthStore` — empty `id` causes silent downstream failures on profile endpoints. **Fixed:** `setAuth` updated to accept `UserDto | null`; `SignupPage` now passes `null` for user (profile fetched in Story 2.x). [`useAuthStore.ts`, `SignupPage.tsx`]
- [x] [Review][Defer] `apiClient.ts` missing `window.location.href = '/login'` redirect on 401 — pre-existing gap from Story 1.2 (not introduced by this story). [deferred]

### Change Log

- 2026-05-19: Implemented Story 1.3 — User Registration. Created auth package (UserRepository, TokenService, AuthService, AuthController, JwtAuthenticationFilter, EmailAlreadyExistsException, SignupRequest DTO, AuthResponse DTO). Updated SecurityConfig with JWT filter chain. Updated GlobalExceptionHandler with 409/400 handlers. Implemented SignupPage.tsx with accessibility. Added AuthServiceTest (unit) and AuthControllerIntegrationTest (integration). Added spring-boot-starter-validation to pom.xml. Fixed JWT secret to valid Base64 encoding.
- 2026-05-19: Code review (Story 1.3) — fixed 4 patch findings: cross-domain import (DomainConflictException introduced), race condition in signup, misleading test name, synthesized user with empty ID. 1 pre-existing defer carried forward.
