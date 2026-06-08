# Story 3.1: ResumeDocument Model & Resume CRUD API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the `ResumeDocument` typed record hierarchy defined and all resume CRUD endpoints implemented,
so that the frontend and all downstream features (AI, export) share a stable, tested resume content model.

## Acceptance Criteria

1. **Given** the Flyway migration V3 already defines the `resumes` table with a `resume_content` JSONB column **When** the application starts **Then** the `resumes` table exists; no new migration is needed for the basic schema.

2. **Given** the `ResumeDocument`, `ResumeSection`, and `ResumeItem` Java records are defined **When** any service reads or writes resume content **Then** all code uses these typed records exclusively; `ResumeDocumentConverter` is the only class that deserializes raw JSON; no other class handles raw JSON strings.

3. **Given** an authenticated user calls `POST /api/v1/resumes` with a `CreateResumeRequest` (profileId + templateId) **When** the request is processed **Then** a new `Resume` entity is created with content derived from the user's profile, the template is associated, a name is required, and the new `ResumeDto` is returned with HTTP 201.

4. **Given** an authenticated user calls `GET /api/v1/resumes` **When** the request is processed **Then** only that user's resumes are returned as a list of `ResumeDto` objects (HTTP 200); no other user's data is included.

5. **Given** an authenticated user calls `GET /api/v1/resumes/{resumeId}` **When** the resume belongs to another user **Then** HTTP 403 is returned with a `ProblemDetail` body.

6. **Given** an authenticated user calls `DELETE /api/v1/resumes/{resumeId}` **When** the request is processed **Then** the resume is removed from the database and HTTP 204 is returned.

7. **Given** an authenticated user calls `POST /api/v1/resumes/{resumeId}/clone` with a `SaveAsRequest` (new name) **When** the request is processed **Then** a new independent resume entity is created with a copy of the original's content and the provided name; HTTP 201 returned with the new `ResumeDto`.

8. **Given** `ResumeService` is implemented **When** unit tests are run **Then** `ResumeServiceTest.java` covers create, get, list, delete, and clone with Mockito mocks; `ResumeControllerIntegrationTest.java` covers all happy-path endpoints against Testcontainers PostgreSQL.

## Tasks / Subtasks

- [x] Task 1: Define `ResumeDocument`, `ResumeSection`, `ResumeItem` Java records (AC: 2)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocument.java` — Java record with fields: `List<ResumeSection> sections`
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java` — Java record with fields: `String id`, `String title`, `boolean visible`, `List<ResumeItem> items`
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` — Java record with fields: `String id`, `Map<String, String> fields` (flexible key-value for AI patch targeting)
  - [x] All three must be plain Java records — do NOT use Lombok on records; records are immutable by design

- [x] Task 2: Implement `ResumeDocumentConverter` JPA `@Converter` (AC: 2)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocumentConverter.java`
  - [x] Annotate with `@Converter(autoApply = false)` — explicitly applied on `Resume.resumeContent` field via `@Convert(converter = ResumeDocumentConverter.class)`
  - [x] Inject the Spring-managed `ObjectMapper` bean — DO NOT create `new ObjectMapper()` internally; use `@Autowired` constructor injection (JPA converters support Spring-managed beans via `@Component`)
  - [x] `convertToDatabaseColumn(ResumeDocument attribute)`: serialize to JSON string using `ObjectMapper.writeValueAsString`; return `"{}"` on null input
  - [x] `convertToEntityAttribute(String dbData)`: deserialize using `ObjectMapper.readValue(dbData, ResumeDocument.class)`; return empty `ResumeDocument(List.of())` on null/blank input; throw `IllegalStateException` wrapping `JsonProcessingException` on malformed JSON (never swallow)
  - [x] The `ObjectMapper` bean from `JacksonConfig` registers `JavaTimeModule` and disables `WRITE_DATES_AS_TIMESTAMPS` — this is the one to use

- [x] Task 3: Create `Resume` JPA entity (AC: 1, 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/Resume.java`
  - [x] Extends `BaseEntity` (provides `id` UUID, `createdAt`, `updatedAt` via `@AuditingEntityListener`)
  - [x] Use Lombok `@Getter @Setter` — consistent with Profile, WorkExperience, Education, Skill pattern
  - [x] `@Table(name = "resumes")` — V3 migration already created this table
  - [x] Fields: `@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") User user`, `@Column(name = "template_id") UUID templateId` (nullable — template association is optional for initial creation), `@Column(name = "name", nullable = false) String name`, `@Convert(converter = ResumeDocumentConverter.class) @Column(name = "resume_content", columnDefinition = "jsonb") ResumeDocument resumeContent`, `@Column(name = "is_tailored") boolean isTailored`
  - [x] `templateId` is stored as UUID (not a `@ManyToOne` to `ResumeTemplate`) — templates are not yet implemented (Story 3.2); a UUID nullable FK avoids a hard JPA dependency on the template entity before it exists

- [x] Task 4: Create `ResumeRepository` (AC: 3, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeRepository.java`
  - [x] `extends JpaRepository<Resume, UUID>`
  - [x] Methods: `List<Resume> findAllByUser(User user)`, `Optional<Resume> findByIdAndUser(UUID id, User user)`
  - [x] Follow same pattern as `ProfileRepository` — interface only, Spring Data generates implementation

- [x] Task 5: Define DTOs (AC: 3, 4, 5, 7)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/ResumeDto.java` — record: `UUID id, String name, UUID templateId, ResumeDocument content, boolean isTailored, Instant createdAt, Instant updatedAt`
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/CreateResumeRequest.java` — record: `@NotBlank String name, UUID templateId` (templateId nullable — user may create a resume without a template)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/SaveAsRequest.java` — record: `@NotBlank String name`
  - [x] `Instant` fields on `ResumeDto` serialize to ISO 8601 UTC via `JacksonConfig` `ObjectMapper` — no manual formatting needed
  - [x] Use Jakarta Bean Validation annotations (`@NotBlank`) — consistent with `ProfileUpdateRequest` pattern

- [x] Task 6: Implement `ResumeService` (AC: 3, 4, 5, 6, 7)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`
  - [x] Constructor-inject `ResumeRepository`, `UserRepository`, `ProfileRepository`
  - [x] `createResume(String email, CreateResumeRequest request) → ResumeDto` (HTTP 201)
  - [x] `listResumes(String email) → List<ResumeDto>` (HTTP 200)
  - [x] `getResume(String email, UUID resumeId) → ResumeDto` (HTTP 200)
  - [x] `deleteResume(String email, UUID resumeId)` (HTTP 204)
  - [x] `cloneResume(String email, UUID resumeId, SaveAsRequest request) → ResumeDto` (HTTP 201)
  - [x] Annotate: `@Transactional(readOnly = true)` on reads, `@Transactional` on writes
  - [x] Throw `IllegalStateException` only for "authenticated user not found in DB"

- [x] Task 7: Create `ResumeNotFoundException` and `ResumeAccessDeniedException` (AC: 5, 6, 7)
  - [x] Create both in `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/`
  - [x] `ResumeAccessDeniedException extends RuntimeException` — maps to HTTP 403 via `GlobalExceptionHandler`
  - [x] `ResumeNotFoundException extends RuntimeException` — maps to HTTP 404 via `GlobalExceptionHandler`
  - [x] Add both handlers to `GlobalExceptionHandler.java` in `common/`
  - [x] Follow exact pattern of `DomainAuthException` and `DomainConflictException` handlers already in `GlobalExceptionHandler`

- [x] Task 8: Implement `ResumeController` (AC: 3, 4, 5, 6, 7)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeController.java`
  - [x] `@RestController @RequestMapping("/api/v1/resumes") @Tag(name = "Resume")`
  - [x] Constructor-inject `ResumeService`
  - [x] All five endpoints implemented with correct HTTP status codes
  - [x] All methods take `Authentication authentication` — pass `authentication.getName()` (email) to service
  - [x] Validate request bodies with `@Valid`
  - [x] Return direct DTO bodies — NO `ResponseEntity<Map<...>>` wrapper

- [x] Task 9: Unit tests — `ResumeServiceTest.java` (AC: 8)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`
  - [x] `@ExtendWith(MockitoExtension.class)` — no Spring context
  - [x] Mock: `ResumeRepository`, `UserRepository`, `ProfileRepository`
  - [x] `@InjectMocks ResumeService`
  - [x] 9 test methods covering all operations including profile-seeded document and access denied scenarios

- [x] Task 10: Integration tests — `ResumeControllerIntegrationTest.java` (AC: 8)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java`
  - [x] `@SpringBootTest(webEnvironment = RANDOM_PORT) @ActiveProfiles("test")`
  - [x] Inline `@TestConfiguration` with `PostgreSQLContainer` + `@ServiceConnection`
  - [x] `cleanDb()` `@BeforeEach` — delete resumes then users (FK order)
  - [x] 6 integration tests covering all happy-path endpoints and the 403 isolation test

- [x] Task 11: Update frontend `types/api.ts` (AC: 3, 4)
  - [x] MODIFIED `frontend/src/types/api.ts` — expanded `ResumeDto` + added `ResumeItemDto`, `ResumeSectionDto`, `ResumeDocumentDto`, `CreateResumeRequest`, `SaveAsRequest`
  - [x] Placed new interfaces after `ParsedResumeDtoResponse`
  - [x] `useResumeStore.ts` automatically benefits from expanded type

## Dev Notes

### CRITICAL: `ResumeDocumentConverter` must use the Spring-managed `ObjectMapper`

`JacksonConfig.java` defines a `@Bean ObjectMapper` with `JavaTimeModule` registered and timestamps disabled. The converter **must** inject this bean — not create its own. JPA converters annotated with `@Component` (or declared as Spring beans) can use constructor injection.

```java
@Converter(autoApply = false)
@Component
public class ResumeDocumentConverter implements AttributeConverter<ResumeDocument, String> {

    private final ObjectMapper objectMapper;

    public ResumeDocumentConverter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }
    // ...
}
```

If `@Component` causes circular-dependency issues with JPA bootstrap, an alternative is `@Lazy` injection or using `@PersistenceUnitUtil`. The `@Component` approach is preferred — it works correctly with Spring Boot 4.x.

### `Resume` entity — `templateId` as nullable `UUID` (not `@ManyToOne`)

Story 3.2 implements the `ResumeTemplate` entity. Binding `Resume` to `ResumeTemplate` via `@ManyToOne` now would create a JPA dependency that doesn't compile until Story 3.2 is done. Store as `UUID templateId` (nullable column already exists in V3 DDL: `template_id UUID NULL`). Add the proper `@ManyToOne` in Story 3.2 if needed, or keep as UUID reference (simpler, no lazy-load issues).

### Building `ResumeDocument` from profile in `createResume`

The initial resume content is derived from the user's profile. Map the profile to sections:

```java
private ResumeDocument buildFromProfile(Profile profile) {
    List<ResumeSection> sections = new ArrayList<>();

    // Work Experience section
    List<ResumeItem> expItems = profile.getWorkExperiences().stream()
        .map(we -> new ResumeItem(
            UUID.randomUUID().toString(),
            Map.of(
                "jobTitle", we.getJobTitle() != null ? we.getJobTitle() : "",
                "company", we.getCompany() != null ? we.getCompany() : "",
                "startDate", we.getStartDate() != null ? we.getStartDate().toString() : "",
                "endDate", we.getEndDate() != null ? we.getEndDate().toString() : "",
                "description", we.getDescription() != null ? we.getDescription() : ""
            )
        ))
        .toList();
    sections.add(new ResumeSection("experience", "Work Experience", true, expItems));

    // Education section
    List<ResumeItem> eduItems = profile.getEducation().stream()
        .map(edu -> new ResumeItem(
            UUID.randomUUID().toString(),
            Map.of(
                "institution", edu.getInstitution() != null ? edu.getInstitution() : "",
                "degree", edu.getDegree() != null ? edu.getDegree() : "",
                "fieldOfStudy", edu.getFieldOfStudy() != null ? edu.getFieldOfStudy() : ""
            )
        ))
        .toList();
    sections.add(new ResumeSection("education", "Education", true, eduItems));

    // Skills section
    List<ResumeItem> skillItems = profile.getSkills().stream()
        .map(s -> new ResumeItem(
            UUID.randomUUID().toString(),
            Map.of("name", s.getName() != null ? s.getName() : "")
        ))
        .toList();
    sections.add(new ResumeSection("skills", "Skills", true, skillItems));

    return new ResumeDocument(sections);
}
```

If no profile exists, return `new ResumeDocument(List.of())`.

### Ownership check pattern — use `findByIdAndUser` not `findById`

Never do:
```java
Resume resume = repository.findById(id).orElseThrow(NotFoundException::new);
if (!resume.getUser().getId().equals(currentUser.getId())) throw new AccessDeniedException();
```

This leaks whether the resource exists. Instead:
```java
Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
    .orElseThrow(() -> new ResumeAccessDeniedException("Access denied or resume not found"));
```
Returns 403 for both "wrong owner" and "not found" — consistent with the epics spec (AC5 says 403 when belongs to another user).

### No `ResumeNotFoundException` needed for most operations

Per AC5 the spec says return 403 (not 404) when a user accesses another user's resume. `findByIdAndUser` achieves this naturally — both "not yours" and "doesn't exist" return empty Optional → 403. `ResumeNotFoundException` is kept for edge cases where a 404 is semantically correct (e.g., a future admin endpoint).

### Integration test pattern — copy `ProfileControllerIntegrationTest` exactly

No shared `PostgresTestContainer.java` exists (the architecture doc lists it as planned but it was never created — each integration test uses its own inline `@TestConfiguration`). Copy:
- `ContainersConfig` nested class with `@ServiceConnection` `PostgreSQLContainer`
- `registerAndGetToken(email, password)` helper
- `WebTestClient.bindToServer()` setup
- `@BeforeEach cleanDb()` with repository `deleteAll()` calls

For `cleanDb()` delete `resumeRepository.deleteAll()` before `userRepository.deleteAll()` (FK constraint: `resumes.user_id` references `users`).

### `GlobalExceptionHandler` — add two new handlers

Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` and add:

```java
@ExceptionHandler(ResumeAccessDeniedException.class)
public ProblemDetail handleResumeAccessDenied(ResumeAccessDeniedException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.FORBIDDEN, ex.getMessage());
    problem.setTitle("Forbidden");
    return problem;
}

@ExceptionHandler(ResumeNotFoundException.class)
public ProblemDetail handleResumeNotFound(ResumeNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Not Found");
    return problem;
}
```

Import the two exception classes. Preserve ALL existing handlers.

### `ResumeDto` — `content` field in JSON response

The frontend needs the full `ResumeDocument` in the `GET /api/v1/resumes/{id}` response to render the editor. The `ResumeDto` record must include `ResumeDocument content` (not just metadata). The `ObjectMapper` will serialize `ResumeDocument` as a nested JSON object — this is what the frontend reads.

For `GET /api/v1/resumes` (list), the `content` field will be included per the DTO definition. If the content is large this could be bandwidth-intensive, but keeping one DTO shape is simpler for now (the list endpoint is used by the dashboard which currently doesn't need content, but consistent shape simplifies frontend typing). This is an acceptable v1 trade-off noted in architecture.

### Frontend `ResumeDto` update — existing store compatibility

`useResumeStore.ts` already has `resumes: ResumeDto[]` and `currentResume: ResumeDto | null`. After updating `types/api.ts`, these store fields automatically gain the richer type. The `applyPatch` stub (no-op until Story 4.2) works on `currentResume` — no changes to `useResumeStore.ts` needed in this story.

### No frontend API calls yet

This story is backend-only + types update. The actual frontend API calls (`apiClient.post('/api/v1/resumes', ...)`, etc.) are implemented in Story 3.3 (Dashboard) and Story 3.4 (Editor). Do NOT add `apiClient` methods in this story.

### V3 migration — already applied, do NOT modify

`src/main/resources/db/migration/V3__create_resumes_table.sql` already exists and created the `resumes` table with `resume_content JSONB NOT NULL DEFAULT '{}'`. This migration is already applied in any running DB. Do NOT touch it. There is NO new Flyway migration needed.

### Deferred work to be aware of

From `deferred-work.md`:
- `apiClient.ts` is missing a `patch` HTTP method (needed in Story 4.2 for `PUT /api/v1/resumes/{id}`)
- No abort controllers on inflight requests (pre-existing pattern, not this story's concern)

These are not blockers for this story.

### Project Structure Notes

**Files to CREATE (backend):**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocument.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocumentConverter.java` — NEW @Converter @Component
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/Resume.java` — NEW @Entity
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeRepository.java` — NEW JpaRepository
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/ResumeDto.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/CreateResumeRequest.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/SaveAsRequest.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` — NEW @Service
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeController.java` — NEW @RestController
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeAccessDeniedException.java` — NEW exception
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeNotFoundException.java` — NEW exception
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` — NEW unit test
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java` — NEW integration test

**Files to MODIFY:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — add two new `@ExceptionHandler` methods; preserve all existing handlers
- `frontend/src/types/api.ts` — update existing `ResumeDto` interface + add `ResumeDocumentDto`, `ResumeSectionDto`, `ResumeItemDto`, `CreateResumeRequest`, `SaveAsRequest`

**Files NOT to touch:**
- `src/main/resources/db/migration/V3__create_resumes_table.sql` — already applied, never modify
- `frontend/src/stores/useResumeStore.ts` — no changes needed; type widening is automatic
- Any `components/ui/` files — shadcn-managed
- Any file in Epic 2 domain (`profile/`, `upload/`)

### References

- Story ACs: [Source: _bmad-output/planning-artifacts/epics.md lines 501–538]
- Epic 3 overview: [Source: _bmad-output/planning-artifacts/epics.md lines 496–499]
- V3 migration (resumes table): [Source: src/main/resources/db/migration/V3__create_resumes_table.sql]
- V4 migration (resume_templates table): [Source: src/main/resources/db/migration/V4__create_resume_templates_table.sql]
- BaseEntity pattern: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java]
- Profile domain pattern (entity + service + controller): [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/]
- GlobalExceptionHandler existing handlers: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java]
- JacksonConfig ObjectMapper bean: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/config/JacksonConfig.java]
- ProfileService constructor-injection + resolveUser pattern: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java]
- ProfileController Authentication.getName() pattern: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileController.java]
- ProfileControllerIntegrationTest pattern: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileControllerIntegrationTest.java]
- ProfileServiceTest Mockito pattern: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java]
- JSONB data architecture decision: [Source: _bmad-output/planning-artifacts/architecture.md lines 174–186]
- ResumeDocument architectural boundary: [Source: _bmad-output/planning-artifacts/architecture.md lines 640–644]
- Resume package structure: [Source: _bmad-output/planning-artifacts/architecture.md lines 468–481]
- ResumeStore current state: [Source: frontend/src/stores/useResumeStore.ts]
- Existing types/api.ts: [Source: frontend/src/types/api.ts]
- Deferred work log: [Source: _bmad-output/implementation-artifacts/deferred-work.md]
- Previous story learnings (2.4): [Source: _bmad-output/implementation-artifacts/2-4-resume-upload-to-seed-profile.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Hibernate 7 + PostgreSQL JSONB: `@AttributeConverter` alone does not cast the string to JSONB on write. Fixed by adding `@JdbcTypeCode(SqlTypes.JSON)` alongside `@Convert` on `Resume.resumeContent`. This tells Hibernate's JDBC layer to use the JSON SqlType, which PostgreSQL JDBC driver handles correctly.

### Completion Notes List

- Task 1-3: `ResumeDocument`, `ResumeSection`, `ResumeItem` plain records created; `ResumeDocumentConverter` Spring-managed `@Component` with constructor-injected `ObjectMapper`; `Resume` entity with `@JdbcTypeCode(SqlTypes.JSON)` added alongside `@Convert` to handle Hibernate 7 JSONB write casting.
- Task 4-5: `ResumeRepository` with `findAllByUser`/`findByIdAndUser`; three DTOs as records with Jakarta Validation.
- Task 6: `ResumeService` with all 5 operations, `buildFromProfile` mapping work/education/skills to typed sections, `findByIdAndUser` ownership check pattern (403 for both wrong-owner and not-found).
- Task 7: `ResumeAccessDeniedException` (403) and `ResumeNotFoundException` (404) + handlers added to `GlobalExceptionHandler`.
- Task 8: `ResumeController` with all 5 endpoints, `@Valid`, `Authentication.getName()` pattern.
- Task 9: 9 unit tests (Mockito, no Spring context) — all pass.
- Task 10: 6 integration tests (Testcontainers PostgreSQL, WebTestClient) — all pass.
- Task 11: `frontend/src/types/api.ts` updated with full `ResumeDto` + `ResumeDocumentDto`/`ResumeSectionDto`/`ResumeItemDto`/`CreateResumeRequest`/`SaveAsRequest`.
- Full test suite: 52 tests, 0 failures. Frontend lint: 0 errors.
- ✅ Resolved review finding [Med]: Mutable collections in records — compact constructors with `List.copyOf()`/`Map.copyOf()` added to `ResumeDocument`, `ResumeSection`, `ResumeItem`.
- ✅ Resolved review finding [High]: `ResumeDocumentConverter.convertToEntityAttribute` data leakage — `dbData` removed from exception message.
- ✅ Resolved review finding [Med]: `Resume` entity missing `@NoArgsConstructor` — `@NoArgsConstructor` Lombok annotation added.
- ✅ Resolved review finding [Med]: `cloneResume` shallow copy — `deepCopyDocument()` helper reconstructs full `ResumeDocument` tree.
- ✅ Resolved review finding [Low]: Raw `assert` in integration test — replaced with AssertJ `assertThat(...)`.
- ✅ Resolved review finding [Low]: `ResumeNotFoundException` dead code — Javadoc added documenting design decision (kept for future admin endpoints; 403-always pattern documented).
- ✅ Resolved review finding [Low]: `CreateResumeRequest` missing `profileId` — comment added in `ResumeService.createResume` explaining single-profile-per-user design and v1 scope.
- Post-review test suite: 52 tests, 0 failures. Clean compile verified.
- ✅ Resolved review finding [High]: `ResumeDocumentConverter.convertToDatabaseColumn` null handling — changed from returning `"{}"` to throwing `IllegalStateException("resumeContent must not be null")`.
- ✅ Resolved review finding [High]: `Resume.resumeContent` missing `nullable = false` — added `nullable = false` to `@Column` annotation.
- ✅ Resolved review finding [Med]: `resolveUser` PII leak — removed email from exception message; now `"Authenticated user not found in database"` with no PII.
- ✅ Resolved review finding [Med]: `deepCopyDocument` redundant `Map.copyOf()` — removed inner `Map.copyOf(item.fields())` call (compact constructor already does this); updated Javadoc to accurately describe compact constructor guarantees.
- ✅ Resolved review finding [Low]: `GlobalExceptionHandler.handleResumeAccessDenied` missing log — added `log.warn("Resume access denied for request")` before 403 response.
- ✅ Resolved review finding [Low]: TypeScript `templateId` undocumented format — added `/** UUID */` JSDoc comment above `templateId` in `ResumeDto` and `CreateResumeRequest` in `api.ts`.
- Second post-review test suite: 52 tests, 0 failures. Frontend lint: 0 errors.
- ✅ Resolved review finding [High]: `ResumeDto.isTailored` Jackson serialization — verified Jackson 2.21.2 (via Spring Boot 4.0.6) correctly serializes Java record `boolean isTailored` as `"isTailored"` (record component name preserved, not stripped). Integration test `$.isTailored` passes. No change required.
- ✅ Resolved review finding [Med]: `buildFromProfile` null-safe collection access — wrapped `getWorkExperiences()`, `getEducation()`, `getSkills()` with `!= null ? ... : List.<T>of()` null-guards; added imports for `WorkExperience`, `Education`, `Skill`.
- ✅ Resolved review finding [Med]: `cloneResume` resets `isTailored` to `false` — changed `clone.setTailored(original.isTailored())` to `clone.setTailored(false)`.
- ✅ Resolved review finding [Low]: Unused `import org.hibernate.annotations.ColumnTransformer` removed from `Resume.java`.
- ✅ Resolved review finding [Low]: `cloneResume_notOwner_throwsResumeAccessDeniedException` unit test added to `ResumeServiceTest`.
- ✅ Resolved review finding [Low]: Compact constructors null-safe — `List.copyOf(sections)` → `sections != null ? List.copyOf(sections) : List.of()` in `ResumeDocument`; same for `items` in `ResumeSection`; `Map.copyOf(fields)` → null-safe in `ResumeItem`.
- Third post-review test suite: 53 tests, 0 failures. Frontend lint: 0 errors.

### File List

**Backend — New files:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocument.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocumentConverter.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/Resume.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeRepository.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/ResumeDto.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/CreateResumeRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/SaveAsRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeAccessDeniedException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeNotFoundException.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java`

**Modified files:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `frontend/src/types/api.ts`

## Change Log

- 2026-06-05: Story implemented — `ResumeDocument` record hierarchy, `ResumeDocumentConverter`, `Resume` entity, `ResumeRepository`, DTOs, `ResumeService`, `ResumeController`, domain exceptions, unit tests (9), integration tests (6), frontend type updates. All 52 backend tests pass, frontend lint 0 errors. Status: review.
- 2026-06-05: Addressed code review findings — 7 items resolved (Date: 2026-06-05): immutable compact constructors on records, data-leakage fix in converter exception, `@NoArgsConstructor` on `Resume`, deep copy in `cloneResume`, AssertJ in integration test, `ResumeNotFoundException` design documented, `CreateResumeRequest` profileId absence explained. 52 tests pass. Status: review.
- 2026-06-05: Addressed second round of code review findings — 6 items resolved: `convertToDatabaseColumn` null throws `IllegalStateException`, `Resume.resumeContent` `nullable=false`, `resolveUser` PII removed from exception, `deepCopyDocument` simplified + Javadoc corrected, `handleResumeAccessDenied` adds `log.warn`, `templateId` JSDoc `/** UUID */` in `api.ts`. 52 tests pass, lint clean. Status: review.
- 2026-06-05: Addressed third round of code review findings — 6 items resolved: `isTailored` Jackson serialization verified correct (Jackson 2.21.2, no change needed); null-safe collection guards in `buildFromProfile`; `cloneResume` resets `isTailored=false`; unused `ColumnTransformer` import removed from `Resume.java`; `cloneResume_notOwner` unit test added; compact constructors null-safe for all three domain records. 53 tests pass, lint clean. Status: review.
