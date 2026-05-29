# Story 2.1: Profile Domain Model & CRUD API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the profile domain model and CRUD API endpoints implemented,
So that the frontend and all downstream features have a stable, tested API to read and write profile data.

## Acceptance Criteria

1. **Given** the Flyway migration `V2__create_profiles_tables.sql` already defines `profiles`, `profile_work_experiences`, `profile_education`, and `profile_skills` tables **When** the application starts **Then** all four tables exist with correct columns and foreign key constraints; **no new Flyway migration is created** for the basic schema.

2. **Given** an authenticated user calls `GET /api/v1/profile` **When** no profile exists yet **Then** HTTP 200 is returned with an empty-section `ProfileDto` (`summary: null`, empty arrays for `workExperiences`, `education`, `skills`) — **never a 404**.

3. **Given** an authenticated user submits a valid `ProfileUpdateRequest` to `PUT /api/v1/profile` **When** the request is processed **Then** the profile is persisted to the normalized tables and the updated `ProfileDto` is returned with HTTP 200.

4. **Given** a `PUT /api/v1/profile` request is submitted without a required field (e.g. a work experience with a blank `jobTitle`) **When** the request is processed **Then** HTTP 400 is returned with a `ProblemDetail` body whose `errors` property lists the specific validation failures.

5. **Given** any call to `GET` or `PUT /api/v1/profile` **When** the request is processed **Then** it is scoped to the authenticated user — a user can never read or write another user's profile (the profile is resolved from the JWT principal, never from a client-supplied id).

6. **Given** `ProfileService` is implemented **When** unit tests are run **Then** all service-layer methods have corresponding `ProfileServiceTest.java` tests (JUnit 5 + Mockito, **no Spring context**); a `ProfileControllerIntegrationTest.java` covers happy-path GET (empty + populated) and PUT against a Testcontainers PostgreSQL instance, plus the 401 (no token), 400 (validation), and per-user isolation paths.

## Tasks / Subtasks

- [ ] Task 1: Create profile JPA domain entities (AC: 1, 3)
  - [ ] Create package `com.tsvetanbondzhov.resumeenhancer.profile.domain`
  - [ ] `Profile.java` — `@Entity @Table(name = "profiles")`, extends `BaseEntity` (inherits `id`, `createdAt`, `updatedAt`). Fields: `@OneToOne(fetch = LAZY) @JoinColumn(name = "user_id", unique = true) User user;`, `@Column(name = "summary") String summary;`
  - [ ] On `Profile`, map the three child collections with `@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)`: `List<WorkExperience> workExperiences`, `List<Education> education`, `List<Skill> skills`. Initialize each to `new ArrayList<>()`. orphanRemoval + replace-on-PUT is how full-document updates work (see Dev Notes "PUT replace strategy").
  - [ ] `WorkExperience.java` — `@Entity @Table(name = "profile_work_experiences")` extends `BaseEntity`. `@ManyToOne @JoinColumn(name = "profile_id") Profile profile;` Fields (DB columns): `jobTitle`→`job_title`, `company`, `startDate`→`start_date` (`LocalDate`), `endDate`→`end_date` (`LocalDate`), `isCurrent`→`is_current` (`boolean`, default false), `description` (TEXT).
  - [ ] `Education.java` — `@Entity @Table(name = "profile_education")` extends `BaseEntity`. `@ManyToOne profile`. Fields: `institution`, `degree`, `fieldOfStudy`→`field_of_study`, `startDate`→`start_date` (`LocalDate`), `endDate`→`end_date` (`LocalDate`).
  - [ ] `Skill.java` — `@Entity @Table(name = "profile_skills")` extends `BaseEntity`. `@ManyToOne profile`. Field: `name` (`@Column(nullable = false)`).
  - [ ] Use Lombok `@Getter @Setter` on entities (matches `User.java` convention). Use `GenerationType.UUID` ids — already provided by `BaseEntity`; do NOT redeclare `@Id`.
  - [ ] Column names MUST match the existing V2 migration exactly (snake_case). Do not rely on implicit naming — set `@Column(name = "...")` / `@JoinColumn(name = "...")` explicitly.

- [ ] Task 2: Create `ProfileRepository` (AC: 2, 5)
  - [ ] Create `com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository extends JpaRepository<Profile, UUID>`
  - [ ] Add `Optional<Profile> findByUser(User user);` (or `Optional<Profile> findByUserId(UUID userId);`) — used to scope reads/writes to the authenticated user.

- [ ] Task 3: Create DTOs and the update request (AC: 2, 3, 4)
  - [ ] Create package `com.tsvetanbondzhov.resumeenhancer.profile.dto`
  - [ ] `ProfileDto` — Java `record` (matches existing DTO style). Shape: `record ProfileDto(String summary, List<WorkExperienceDto> workExperiences, List<EducationDto> education, List<SkillDto> skills)`.
  - [ ] `WorkExperienceDto(String jobTitle, String company, LocalDate startDate, LocalDate endDate, boolean isCurrent, String description)`
  - [ ] `EducationDto(String institution, String degree, String fieldOfStudy, LocalDate startDate, LocalDate endDate)`
  - [ ] `SkillDto(String name)` (or a flat `List<String> skills` — pick `SkillDto` for forward-compat; keep consistent across read + write).
  - [ ] `ProfileUpdateRequest` — `record` with `@Valid` nested lists so Bean Validation cascades. Apply `jakarta.validation.constraints` mirroring `SignupRequest.java`:
    - Work experience entry: `@NotBlank(message = "Job title is required") String jobTitle`, `@NotBlank(message = "Company is required") String company`.
    - Education entry: `@NotBlank(message = "Institution is required") String institution`.
    - Skill entry: `@NotBlank(message = "Skill name is required") String name`.
    - Annotate the nested list fields on `ProfileUpdateRequest` with `@Valid` (and `@NotNull` defaulting to empty if desired) so per-element validation fires and surfaces through the existing `MethodArgumentNotValidException` handler.

- [ ] Task 4: Create `ProfileService` (AC: 2, 3, 5)
  - [ ] Create `com.tsvetanbondzhov.resumeenhancer.profile.ProfileService` (`@Service`).
  - [ ] Constructor-inject `ProfileRepository` and `UserRepository` (`com.tsvetanbondzhov.resumeenhancer.auth.UserRepository`).
  - [ ] `ProfileDto getProfile(String email)` — resolve `User` via `userRepository.findByEmail(email)`; find profile via `ProfileRepository`; **if absent, return an empty `ProfileDto`** (`null` summary, empty lists) — do NOT create a row and do NOT throw 404 (AC2).
  - [ ] `ProfileDto updateProfile(String email, ProfileUpdateRequest request)` (`@Transactional`) — resolve user; get-or-create the `Profile` row for that user; apply the PUT replace strategy (clear + repopulate child collections, see Dev Notes); set `summary`; save; map back to `ProfileDto`.
  - [ ] Map entity↔DTO with private helper methods in the service (no MapStruct — none is on the classpath; keep it plain). Map `null` collections in the request to empty lists.
  - [ ] If `userRepository.findByEmail(email)` is empty, throw a domain exception — but in practice the JWT filter guarantees an authenticated principal exists; treat a missing user as an unexpected 500 (do not invent a 404 contract for the authenticated route).

- [ ] Task 5: Create `ProfileController` (AC: 2, 3, 4, 5)
  - [ ] Create `com.tsvetanbondzhov.resumeenhancer.profile.ProfileController` — `@RestController @RequestMapping("/api/v1/profile") @Tag(name = "Profile")`.
  - [ ] `GET` → `@GetMapping public ProfileDto getProfile(Authentication authentication)` returning the service result (Spring serializes directly with HTTP 200 — no `ResponseEntity` wrapper needed; matches "direct DTO body" rule).
  - [ ] `PUT` → `@PutMapping public ProfileDto updateProfile(Authentication authentication, @Valid @RequestBody ProfileUpdateRequest request)`.
  - [ ] Resolve the authenticated user's email via `authentication.getName()` — this returns the email because the JWT principal's `getUsername()` is the email (see Dev Notes "CRITICAL: principal has no id"). Pass the email into the service. **Do NOT cast the principal and call `getId()` — it is null.**
  - [ ] No new `SecurityConfig` change is needed: `/api/v1/profile` is already covered by `.anyRequest().authenticated()`.

- [ ] Task 6: Write `ProfileServiceTest.java` (AC: 6) — JUnit 5 + Mockito, NO Spring context
  - [ ] Location: `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java`
  - [ ] `@ExtendWith(MockitoExtension.class)`; `@Mock ProfileRepository`, `@Mock UserRepository`; `@InjectMocks ProfileService`.
  - [ ] Test: `getProfile` when no profile exists → returns empty `ProfileDto` (null summary, empty lists), and does NOT save anything.
  - [ ] Test: `getProfile` when a profile exists → maps entity collections to DTO correctly.
  - [ ] Test: `updateProfile` when no profile exists → creates a profile bound to the resolved user, persists child entities, returns mapped DTO.
  - [ ] Test: `updateProfile` when a profile exists → replaces child collections (old entries removed, new applied) and updates summary.

- [ ] Task 7: Write `ProfileControllerIntegrationTest.java` (AC: 2, 3, 4, 5, 6) — Testcontainers PostgreSQL
  - [ ] Location: `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileControllerIntegrationTest.java`
  - [ ] Copy the harness from `AuthControllerIntegrationTest`: `@SpringBootTest(webEnvironment = RANDOM_PORT)`, `@ActiveProfiles("test")`, inner `@TestConfiguration` `ContainersConfig` with `@Bean @ServiceConnection PostgreSQLContainer(postgres:16)`, `WebTestClient` bound to `http://localhost:{port}`.
  - [ ] Helper: register a user via `POST /api/v1/auth/signup` (or persist a `User` + mint a token via injected `TokenService`) to obtain a valid `Bearer` token, then send it in the `Authorization` header.
  - [ ] Test: `GET /api/v1/profile` with token but no saved profile → 200 with empty arrays and null summary (AC2).
  - [ ] Test: `PUT /api/v1/profile` valid payload → 200, returned DTO echoes the saved data (AC3); a follow-up `GET` returns the persisted data.
  - [ ] Test: `PUT /api/v1/profile` with a work experience missing `jobTitle` → 400, `$.title == "Bad Request"`, `$.errors` is non-empty (AC4).
  - [ ] Test: per-user isolation — user A saves a profile; user B's `GET` returns an empty profile, never A's data (AC5).
  - [ ] Test (already exists in `AuthControllerIntegrationTest`): no-token `GET /api/v1/profile` → 401. Do not duplicate unless useful; isolation + validation are the new value here.

- [ ] Task 8: Build + test gate (required before marking `review`)
  - [ ] Run `./mvnw test` — all new and existing tests must pass.
  - [ ] Docker must be available/running for Testcontainers PostgreSQL.

## Dev Notes

### CRITICAL: The JWT principal has NO id (and is detached)

`JwtAuthenticationFilter` (`src/main/java/.../auth/JwtAuthenticationFilter.java:51-56`) builds the `SecurityContext` principal like this:

```java
User principal = new User();
principal.setEmail(email);
principal.setRole(role);
principal.setEnabled(true);
principal.setPasswordHash("");
// NOTE: id is NEVER set
```

**Consequences for this story:**
- `authentication.getName()` returns the **email** (because `User.getUsername()` returns `email`, see `User.java:44-47`).
- You **must** resolve the persisted `User` (and thus the user id for FK scoping) via `userRepository.findByEmail(email)`. Calling `((User) principal).getId()` returns `null` and will break FK persistence and user-scoping (AC5).
- This is the single most likely implementation mistake for this story. Resolve user-by-email in the service.

### PUT replace strategy (full-document semantics)

`PUT /api/v1/profile` replaces the entire profile. With `@OneToMany(cascade = ALL, orphanRemoval = true)`:
- Get-or-create the `Profile` for the user.
- For each child collection, **clear in place and re-add** (do not reassign the collection reference — Hibernate-managed collections must be mutated, not replaced, to trigger orphanRemoval):
  ```java
  profile.getWorkExperiences().clear();
  request.workExperiences().forEach(dto -> profile.getWorkExperiences().add(toEntity(dto, profile)));
  ```
- Set `summary`, then `profileRepository.save(profile)`. `@Transactional` flush handles delete-orphans + inserts.

### Existing patterns to follow (do NOT reinvent)

- **DTOs are Java `records`** with `jakarta.validation` annotations — see `auth/dto/SignupRequest.java:7-16`. Mirror `@NotBlank(message = "...")` exactly.
- **Direct DTO response bodies**, no envelope wrapper. `AuthController` uses `ResponseEntity` for status control; for `200 OK` you can return the DTO directly (Spring defaults to 200). Either is acceptable — prefer returning the DTO directly per the architecture "direct DTO body" rule.
- **Validation errors are already handled globally.** `GlobalExceptionHandler.handleValidation` (`common/GlobalExceptionHandler.java:42-56`) maps `MethodArgumentNotValidException` → 400 `ProblemDetail` with a `errors` map (`field → [messages]`). For nested-list validation to reach this handler, annotate the request's list fields with `@Valid` and put constraints on the element records. **No new exception handler is required for AC4.**
- **No new domain exception is needed.** GET never 404s (AC2); PUT validation is handled by the global handler. Do not add a `ProfileNotFoundException`.
- **`BaseEntity`** (`common/BaseEntity.java`) already provides `id` (`GenerationType.UUID`), `createdAt`, `updatedAt` via JPA auditing. Extend it; never redeclare `@Id`.
- **Entity style:** `@Getter @Setter` Lombok, explicit `@Table(name=...)` and `@Column(name=...)` — see `auth/domain/User.java`.

### Database schema is already in place — read it, don't migrate

`src/main/resources/db/migration/V2__create_profiles_tables.sql` already defines all four tables. **AC1 is satisfied by the existing migration — do NOT add a V5 migration.** Map entities to these exact columns:

- `profiles`: `id`, `user_id` (UNIQUE, FK→users, ON DELETE CASCADE), `summary` (TEXT, nullable), `created_at`, `updated_at`
- `profile_work_experiences`: `id`, `profile_id` (FK), `job_title`, `company`, `start_date` (DATE), `end_date` (DATE), `is_current` (BOOLEAN NOT NULL default false), `description` (TEXT), `created_at`, `updated_at`
- `profile_education`: `id`, `profile_id` (FK), `institution`, `degree`, `field_of_study`, `start_date` (DATE), `end_date` (DATE), `created_at`, `updated_at`
- `profile_skills`: `id`, `profile_id` (FK), `name` (VARCHAR NOT NULL), `created_at`, `updated_at`

Note the DB itself leaves `job_title`/`company`/`institution` **nullable** — the "required field" enforcement (AC4) lives at the **DTO Bean Validation layer**, not the DB.

### Date handling

`start_date`/`end_date` are SQL `DATE` → map to `java.time.LocalDate` in entities and DTOs. Jackson serializes `LocalDate` as ISO `"2026-05-13"` (the `JavaTimeModule` is registered in `config/JacksonConfig.java` and dates-as-timestamps is disabled). No extra config needed.

### Testing standards (from architecture + existing tests)

- **Unit (service):** JUnit 5 + Mockito, **no Spring context** — `@ExtendWith(MockitoExtension.class)`, mock the repositories. Required by NFR14 and AC6.
- **Integration (controller):** `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `@ActiveProfiles("test")` + Testcontainers PostgreSQL via an inner `@TestConfiguration` with `@Bean @ServiceConnection PostgreSQLContainer`. Use `WebTestClient` bound to `http://localhost:{port}`. **Copy the exact harness from `src/test/java/.../auth/AuthControllerIntegrationTest.java:23-56`.**
- For authenticated requests, obtain a token by hitting `POST /api/v1/auth/signup` first (simplest, end-to-end) — the integration test class already demonstrates signup/login flows.
- Test file location mirrors main packages under `src/test/java/...` named `<Class>Test.java` / `<Controller>IntegrationTest.java`.

### Project Structure Notes

- New code lands under `com.tsvetanbondzhov.resumeenhancer.profile.*` exactly as the architecture's target tree specifies (`profile/`, `profile/domain/`, `profile/repository/`, `profile/dto/`). See `architecture.md#Structure Patterns` (lines 455-467).
- `ProfileService` may live directly in the `profile` package (like `AuthService` lives in `auth`) or in a `profile.service` subpackage. The architecture target tree places it directly in `profile/` — follow that for consistency with `auth/`.
- Cross-package import allowed: `profile` may import `auth.UserRepository` and `auth.domain.User` (User is the shared identity; profile is 1:1 with it). No circular dependency is introduced.
- This is a **backend-only** story. No frontend, no `frontend/src/types/api.ts` changes (Story 2.2 consumes this contract and will add the TS types).

### References

- Epic + ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Profile Domain Model & CRUD API (lines 366-396)]
- Data architecture (normalized profile tables): [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture (lines 181-186)]
- Naming, response/error format, test locations: [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules (lines 283-347)]
- Target package tree for `profile/`: [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns (lines 455-467)]
- Schema: [Source: src/main/resources/db/migration/V2__create_profiles_tables.sql]
- JWT principal construction (no id): [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java:51-63]
- DTO/validation pattern: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/dto/SignupRequest.java]
- Global validation/error handling: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java:42-56]
- BaseEntity (id + auditing): [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java]
- Integration test harness: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/auth/AuthControllerIntegrationTest.java:23-56]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

- 2026-05-29: Story 2.1 drafted and contexted for implementation (status → ready-for-dev).
