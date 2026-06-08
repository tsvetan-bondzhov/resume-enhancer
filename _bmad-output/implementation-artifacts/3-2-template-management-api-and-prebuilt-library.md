# Story 3.2: Template Management API & Prebuilt Library

Status: done

## Story

As a developer,
I want the template entity, repository, and API implemented with at least three prebuilt templates seeded,
so that users can browse and apply templates when creating resumes.

## Acceptance Criteria

1. **Given** the Flyway migration V4 already defines the `resume_templates` table **When** a new migration `V5__seed_prebuilt_templates.sql` is applied **Then** at least three prebuilt templates (e.g. "Minimal", "Classic", "Modern") are present in the `resume_templates` table with `is_prebuilt = true` and `is_published = true`.

2. **Given** an authenticated user calls `GET /api/v1/resume-templates` **When** the request is processed **Then** all published prebuilt templates are returned as a list of `TemplateDto`; unpublished templates are excluded; results are cached via `@Cacheable` (Caffeine).

3. **Given** an authenticated user calls `GET /api/v1/resume-templates/{templateId}` **When** the template is published and prebuilt **Then** HTTP 200 is returned with the full `TemplateDto`.

4. **Given** a non-admin user attempts to call `POST`, `PUT`, or `DELETE` on `/api/v1/resume-templates` **When** the request is processed **Then** HTTP 403 is returned; admin-only mutations are enforced via `@PreAuthorize("hasRole('ADMIN')")`.

5. **Given** `TemplateService` is implemented **When** unit tests are run **Then** `TemplateServiceTest.java` covers list (cache hit/miss) and get-by-id; a `TemplateControllerIntegrationTest.java` verifies the list endpoint and 403 on unauthenticated mutation.

## Tasks / Subtasks

- [x] Task 1: Create Flyway migration V5 to seed prebuilt templates (AC: 1)
  - [x] Create `src/main/resources/db/migration/V5__seed_prebuilt_templates.sql`
  - [x] Insert at least 3 prebuilt templates: "Minimal", "Classic", "Modern" with `is_prebuilt = true`, `is_published = true`, `owner_id = NULL`, `template_definition = '{}'`
  - [x] Use `INSERT INTO resume_templates (id, name, description, is_prebuilt, is_published, owner_id, template_definition) VALUES (...)`; always specify `id` as a fixed UUID so integration tests can reference them
  - [x] DO NOT modify `V4__create_resume_templates_table.sql` — that migration is already applied

- [x] Task 2: Create `ResumeTemplate` JPA entity (AC: 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/domain/ResumeTemplate.java`
  - [x] Extends `BaseEntity` (provides `id` UUID, `createdAt`, `updatedAt`)
  - [x] Use Lombok `@Getter @Setter @NoArgsConstructor` — consistent with `Resume` entity pattern
  - [x] `@Table(name = "resume_templates")`
  - [x] Fields: `@Column(name = "name", nullable = false) String name`, `@Column(name = "description") String description`, `@Column(name = "is_prebuilt", nullable = false) boolean isPrebuilt`, `@Column(name = "is_published", nullable = false) boolean isPublished`, `@Column(name = "owner_id") UUID ownerId`, `@JdbcTypeCode(SqlTypes.JSON) @Column(name = "template_definition", columnDefinition = "jsonb", nullable = false) Map<String, Object> templateDefinition`
  - [x] `ownerId` stored as plain UUID (not `@ManyToOne`) — same pattern as `Resume.templateId`; avoids coupling to User entity in template package
  - [x] `templateDefinition` is `Map<String, Object>` stored as JSONB — no typed converter needed; Jackson handles `Map<String, Object>` natively via `@JdbcTypeCode(SqlTypes.JSON)`

- [x] Task 3: Create `TemplateRepository` (AC: 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateRepository.java`
  - [x] `extends JpaRepository<ResumeTemplate, UUID>`
  - [x] Methods: `List<ResumeTemplate> findAllByIsPublishedTrue()`, `Optional<ResumeTemplate> findByIdAndIsPublishedTrue(UUID id)`

- [x] Task 4: Define `TemplateDto` and `TemplateRequest` records (AC: 2, 3, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateDto.java` — record: `UUID id, String name, String description, boolean isPrebuilt, boolean isPublished, Map<String, Object> templateDefinition, Instant createdAt, Instant updatedAt`
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateRequest.java` — record: `@NotBlank String name, String description, Map<String, Object> templateDefinition` (used by admin mutations in Story 6.2; stub the record here)

- [x] Task 5: Implement `TemplateService` (AC: 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java`
  - [x] Constructor-inject `TemplateRepository`
  - [x] `listPublishedTemplates() → List<TemplateDto>` — `@Transactional(readOnly = true)`, annotated `@Cacheable("templates")`
  - [x] `getPublishedTemplate(UUID templateId) → TemplateDto` — `@Transactional(readOnly = true)`; throw `TemplateNotFoundException` when not found
  - [x] `toDto(ResumeTemplate)` private helper

- [x] Task 6: Create `TemplateNotFoundException` (AC: 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateNotFoundException.java`
  - [x] `extends RuntimeException`
  - [x] Add handler to `GlobalExceptionHandler.java`: maps to HTTP 404 with `ProblemDetail` title "Not Found"
  - [x] Follow exact pattern of `ResumeNotFoundException` handler

- [x] Task 7: Implement `TemplateController` (AC: 2, 3, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java`
  - [x] `@RestController @RequestMapping("/api/v1/resume-templates") @Tag(name = "Template")`
  - [x] Constructor-inject `TemplateService`
  - [x] `GET /api/v1/resume-templates` → `listPublishedTemplates()` — returns `List<TemplateDto>` HTTP 200
  - [x] `GET /api/v1/resume-templates/{templateId}` → `getPublishedTemplate(templateId)` — returns `TemplateDto` HTTP 200
  - [x] `POST /api/v1/resume-templates` — stub endpoint returning HTTP 403 via `@PreAuthorize("hasRole('ADMIN')")` (full impl in Story 6.2)
  - [x] `PUT /api/v1/resume-templates/{templateId}` — stub endpoint with `@PreAuthorize("hasRole('ADMIN')")`
  - [x] `DELETE /api/v1/resume-templates/{templateId}` — stub endpoint with `@PreAuthorize("hasRole('ADMIN')")`
  - [x] Use `Authentication authentication` and `authentication.getName()` only on admin stubs if needed; read endpoints are open to any authenticated user
  - [x] Return direct DTO bodies — NO `ResponseEntity<Map<...>>`

- [x] Task 8: Unit tests — `TemplateServiceTest.java` (AC: 5)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java`
  - [x] `@ExtendWith(MockitoExtension.class)` — no Spring context
  - [x] Mock: `TemplateRepository`; `@InjectMocks TemplateService`
  - [x] Test cases:
    - `listPublishedTemplates_returnsOnlyPublishedTemplates()`
    - `listPublishedTemplates_emptyWhenNonePublished()`
    - `getPublishedTemplate_returnsDto_whenFound()`
    - `getPublishedTemplate_throwsNotFoundException_whenNotFound()`
  - [x] Note: `@Cacheable` behavior is not testable in unit tests (no Spring context) — test underlying repository calls only; cache is validated in integration test

- [x] Task 9: Integration tests — `TemplateControllerIntegrationTest.java` (AC: 5)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java`
  - [x] `@SpringBootTest(webEnvironment = RANDOM_PORT) @ActiveProfiles("test")`
  - [x] Inline `@TestConfiguration` with `PostgreSQLContainer` + `@ServiceConnection` — exact pattern from `ResumeControllerIntegrationTest`
  - [x] `@BeforeEach` is NOT needed for `deleteAll` — V5 seeds static data that Flyway applies at startup; no cleanup necessary unless tests create data
  - [x] `@Autowired UserRepository userRepository` — for `registerAndGetToken` helper
  - [x] Test cases:
    - `listTemplates_authenticated_returnsPublishedTemplates()` — verifies seeded templates present
    - `listTemplates_unauthenticated_returns401()` — no JWT
    - `getTemplate_byId_returns200()` — uses a seeded template UUID
    - `getTemplate_unknownId_returns404()`
    - `postTemplate_nonAdmin_returns403()` — USER role gets 403
    - `putTemplate_nonAdmin_returns403()`
    - `deleteTemplate_nonAdmin_returns403()`

- [x] Task 10: Update frontend `types/api.ts` (AC: 2, 3)
  - [x] Add `TemplateDto` and `TemplateDefinition` interfaces to `frontend/src/types/api.ts`
  - [x] Place after `ParsedResumeDtoResponse`

## Dev Notes

### CRITICAL: V4 DDL already applied — V5 is INSERT-only

`V4__create_resume_templates_table.sql` is already applied to the running DB. The schema includes:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name VARCHAR(255) NOT NULL`
- `description TEXT`
- `is_prebuilt BOOLEAN NOT NULL DEFAULT FALSE`
- `is_published BOOLEAN NOT NULL DEFAULT FALSE`
- `owner_id UUID REFERENCES users(id) ON DELETE SET NULL`
- `template_definition JSONB NOT NULL DEFAULT '{}'`
- `created_at`, `updated_at` TIMESTAMP WITH TIME ZONE

V5 is **seed data only** — no DDL changes. Use fixed UUIDs in the INSERT so integration tests can rely on them:

```sql
INSERT INTO resume_templates (id, name, description, is_prebuilt, is_published, owner_id, template_definition)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Minimal',  'Clean single-column layout', true, true, NULL, '{}'),
  ('11111111-0000-0000-0000-000000000002', 'Classic',  'Traditional two-column layout', true, true, NULL, '{}'),
  ('11111111-0000-0000-0000-000000000003', 'Modern',   'Contemporary accent-color layout', true, true, NULL, '{}');
```

### CRITICAL: `ResumeTemplate` entity — use `@JdbcTypeCode(SqlTypes.JSON)` for JSONB field

Story 3.1 debug log confirmed: Hibernate 7 + PostgreSQL JSONB requires `@JdbcTypeCode(SqlTypes.JSON)` alongside `@Column(columnDefinition = "jsonb")` to handle JSONB write casting. Apply the same fix to `templateDefinition`. The `Resume.resumeContent` field already does this — mirror it exactly.

`templateDefinition` type is `Map<String, Object>` (not a typed record, because the template definition format is not yet finalized — it is formalized in Story 7.x). Jackson natively handles `Map<String, Object>` serialization without a custom `@Converter` — do NOT create one.

```java
@JdbcTypeCode(SqlTypes.JSON)
@Column(name = "template_definition", columnDefinition = "jsonb", nullable = false)
private Map<String, Object> templateDefinition;
```

The `@Convert(converter = ...)` annotation is NOT needed for `Map<String, Object>` — Hibernate's built-in JSON handling handles it via `@JdbcTypeCode`.

### Caching: `@Cacheable("templates")` — cache named "templates" already configured

`CacheConfig.java` already registers a Caffeine cache named `"templates"` with 10-minute TTL and max size 100. Do NOT create or modify `CacheConfig.java`. Simply apply `@Cacheable("templates")` to `listPublishedTemplates()`:

```java
@Cacheable("templates")
@Transactional(readOnly = true)
public List<TemplateDto> listPublishedTemplates() {
    return templateRepository.findAllByIsPublishedTrue().stream()
            .map(this::toDto)
            .toList();
}
```

Note: cache eviction (`@CacheEvict`) is only needed when admin mutates templates — that is Story 6.2's concern. For now, the 10-minute TTL expiry is sufficient.

### Admin stub endpoints: `@PreAuthorize` provides the 403 automatically

Spring Security's method-level `@PreAuthorize("hasRole('ADMIN')")` returns HTTP 403 automatically when the authenticated user does not have `ADMIN` role. No explicit business logic needed in the stub:

```java
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
@PreAuthorize("hasRole('ADMIN')")
public TemplateDto createTemplate(@Valid @RequestBody TemplateRequest request) {
    throw new UnsupportedOperationException("Implemented in Story 6.2");
}
```

**Important:** Spring Security processes `@PreAuthorize` before the method body executes — the 403 is returned without ever hitting `UnsupportedOperationException`. Alternatively, just return `null` or an empty body; what matters is the annotation.

### `TemplateNotFoundException` — follow `ResumeNotFoundException` pattern exactly

```java
package com.tsvetanbondzhov.resumeenhancer.template;

public class TemplateNotFoundException extends RuntimeException {
    public TemplateNotFoundException(String message) {
        super(message);
    }
}
```

Add to `GlobalExceptionHandler.java`:
```java
@ExceptionHandler(TemplateNotFoundException.class)
public ProblemDetail handleTemplateNotFound(TemplateNotFoundException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Not Found");
    return problem;
}
```

Add import: `import com.tsvetanbondzhov.resumeenhancer.template.TemplateNotFoundException;`

### `getPublishedTemplate` — return 404 for any non-found or unpublished template

The `findByIdAndIsPublishedTrue(UUID id)` repository method returns empty for both "not found" and "unpublished" cases. Both should result in 404 (not 403) — templates are publicly browsable by any authenticated user; there is no ownership concept in this story. Example:

```java
public TemplateDto getPublishedTemplate(UUID templateId) {
    return templateRepository.findByIdAndIsPublishedTrue(templateId)
            .map(this::toDto)
            .orElseThrow(() -> new TemplateNotFoundException("Template not found: " + templateId));
}
```

### Integration test pattern — copy `ResumeControllerIntegrationTest` exactly

Key elements to copy:
- `ContainersConfig` nested class with `@ServiceConnection PostgreSQLContainer`
- `registerAndGetToken(email, password)` helper (signup + login, extract token)
- `WebTestClient.bindToServer().baseUrl("http://localhost:" + port).build()`

There is no `cleanDb()` needed because:
- The seeded data is inserted by V5 Flyway migration at test container startup
- Tests only read data (no write endpoints to clean up in this story)

For `postTemplate_nonAdmin_returns403()`, register a USER-role user, get token, call `POST /api/v1/resume-templates` with any body, assert 403. The `@PreAuthorize` handles it.

For `listTemplates_unauthenticated_returns401()`, call the endpoint with no `Authorization` header and assert 401.

### `TemplateDto.isPrebuilt` / `isPublished` Jackson serialization with Java records

Java records with `boolean` fields named `isPrebuilt` and `isPublished` serialize correctly via Jackson as `"isPrebuilt"` and `"isPublished"` (Jackson 2.21.2 + Spring Boot 4.0.6 preserves component name). No custom `@JsonProperty` needed. Verified in Story 3.1 for `ResumeDto.isTailored`.

### Package placement — `template` package, not `resume` package

All template classes go under `com.tsvetanbondzhov.resumeenhancer.template` — mirroring the architecture's package boundary. Do NOT put anything in the `resume` package. Per the architecture's domain package rule: one package per domain, no cross-domain imports except through service interfaces.

### `ownerId` in `ResumeTemplate` entity — store as `UUID`, not `@ManyToOne`

`ownerId` is stored as a plain `UUID` column (nullable), not a JPA `@ManyToOne` to `User`. This is the same pattern as `Resume.templateId` used in Story 3.1. Avoids cross-package JPA entity coupling. In this story's scope, all seeded templates have `owner_id = NULL` (prebuilt/system-owned).

### Frontend `TemplateDto` — add to `types/api.ts`

Add to the end of `frontend/src/types/api.ts`, after `ParsedResumeDtoResponse`:

```typescript
export interface TemplateDto {
  id: string
  name: string
  description: string | null
  isPrebuilt: boolean
  isPublished: boolean
  /** Flexible JSONB map — format TBD in Epic 7 */
  templateDefinition: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TemplateRequest {
  name: string
  description: string | null
  templateDefinition: Record<string, unknown>
}
```

No `apiClient` calls are added yet — the actual frontend consumption of templates happens in Story 3.7. Add the types now so TypeScript doesn't break when Story 3.7 references them.

### `BaseEntity` does NOT include `ownerId` / `isPrebuilt` / `isPublished` — do NOT add to `BaseEntity`

`BaseEntity` provides only `id`, `createdAt`, `updatedAt`. Template-specific fields belong in `ResumeTemplate` only. Do NOT modify `BaseEntity.java`.

### No `@EnableJpaAuditing` needed — it's already configured

`ResumeEnhancerApplication.java` (or a config class) already has `@EnableJpaAuditing` in place (confirmed by the fact that `Resume` entity's `createdAt`/`updatedAt` work correctly in Story 3.1). Do not add it again.

### Project Structure Notes

**Files to CREATE (backend):**
- `src/main/resources/db/migration/V5__seed_prebuilt_templates.sql` — seed data
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/domain/ResumeTemplate.java` — NEW `@Entity`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateRepository.java` — NEW `JpaRepository`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateDto.java` — NEW record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateRequest.java` — NEW record (stub for Story 6.2)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java` — NEW `@Service`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java` — NEW `@RestController`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateNotFoundException.java` — NEW exception
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java` — NEW unit test
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java` — NEW integration test

**Files to MODIFY:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — add `TemplateNotFoundException` handler; preserve ALL existing handlers
- `frontend/src/types/api.ts` — add `TemplateDto` and `TemplateRequest` interfaces

**Files NOT to touch:**
- `src/main/resources/db/migration/V4__create_resume_templates_table.sql` — already applied, never modify
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/CacheConfig.java` — cache already configured
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/**` — no changes to resume package
- Any `frontend/src/components/ui/` files — shadcn-managed

### References

- Story ACs: [Source: _bmad-output/planning-artifacts/epics.md lines 540–566]
- V4 migration (resume_templates DDL): [Source: src/main/resources/db/migration/V4__create_resume_templates_table.sql]
- `CacheConfig.java` — "templates" cache already registered: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/config/CacheConfig.java]
- `Resume` entity JSONB pattern (`@JdbcTypeCode` + `@Column(columnDefinition="jsonb")`): [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/Resume.java]
- `BaseEntity` fields/auditing: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/BaseEntity.java]
- `GlobalExceptionHandler` existing handlers: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java]
- `ResumeController` + `ResumeService` patterns: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/]
- `ResumeControllerIntegrationTest` pattern: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java]
- `ResumeServiceTest` Mockito pattern: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java]
- Story 3.1 debug log (JSONB Hibernate 7 fix): [Source: _bmad-output/implementation-artifacts/3-1-resumedocument-model-and-resume-crud-api.md#Dev Notes]
- Architecture template package structure: [Source: _bmad-output/planning-artifacts/architecture.md lines 483–489]
- Existing `frontend/src/types/api.ts`: [Source: frontend/src/types/api.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Integration tests initially returned HTTP 500 on `@PreAuthorize` admin stubs because Spring Security 7's `AuthorizationDeniedException` (extends `AccessDeniedException`) was not handled in `GlobalExceptionHandler` and fell through to the generic `Exception` handler. Fix: added explicit `@ExceptionHandler(AccessDeniedException.class)` handler returning HTTP 403. This fix also benefits all future `@PreAuthorize`-protected endpoints project-wide.
- Code review finding [High]: Replaced `@ExceptionHandler(AccessDeniedException.class)` in `GlobalExceptionHandler` with `@ExceptionHandler(AuthorizationDeniedException.class)` — handles `@PreAuthorize` MVC-layer denials without risking interception of filter-chain security flow. `SecurityConfig` now also has an explicit `accessDeniedHandler` for filter-level 403s.

### Completion Notes List

- AC1: V5 Flyway migration seeds 3 prebuilt templates (Minimal, Classic, Modern) with fixed UUIDs for integration test stability.
- AC2: `GET /api/v1/resume-templates` returns published templates with Caffeine cache (`@Cacheable("templates")`); cache already configured in `CacheConfig.java`.
- AC3: `GET /api/v1/resume-templates/{templateId}` returns 200 for known published IDs; 404 via `TemplateNotFoundException` for unknown/unpublished IDs.
- AC4: `POST`, `PUT`, `DELETE` on `/api/v1/resume-templates` return 403 for non-ADMIN users via `@PreAuthorize("hasRole('ADMIN')")`.
- AC5: 4 unit tests (Mockito, no Spring context) + 7 integration tests (Testcontainers Postgres) all pass. Full suite: 64 tests, 0 failures.
- Frontend `types/api.ts` extended with `TemplateDto` and `TemplateRequest` interfaces.
- Code review findings addressed (2026-06-05):
  - [High] Replaced `AccessDeniedException` handler in `GlobalExceptionHandler` with `AuthorizationDeniedException` (Spring Security 6+ MVC-layer type); added `accessDeniedHandler` to `SecurityConfig` for filter-chain denials.
  - [High] Added `@NotNull` to `TemplateRequest.templateDefinition` — null body now returns 400 instead of DB constraint violation 500.
  - [Med] Replaced `UnsupportedOperationException` stubs with `ResponseEntity.status(NOT_IMPLEMENTED).build()` in all three admin stub endpoints.
  - [Med] Fixed `$.length() == 3` hardcoded assertion in `listTemplates_authenticated_returnsPublishedTemplates` → `assertThat(size).isGreaterThanOrEqualTo(3)`.
  - [Low] `TemplateServiceTest.buildTemplate()` now sets `id`, `createdAt`, `updatedAt` via `ReflectionTestUtils.setField` so `toDto()` maps all fields correctly.
- Second code review findings addressed (2026-06-05):
  - [High] `TemplateService.toDto()` wraps `templateDefinition` with `Map.copyOf()` to prevent cache-side or Hibernate proxy mutation.
  - [Med] `SecurityConfig.accessDeniedHandler` lambda now guards with `if (!response.isCommitted())` before writing to the response.
  - [Med] `TemplateServiceTest.buildTemplate()` now uses `TEMPLATE_ID` constant instead of `UUID.randomUUID()` so mock stub `findByIdAndIsPublishedTrue(TEMPLATE_ID)` round-trips correctly.
  - [Med] `GlobalExceptionHandler.handleAuthorizationDenied` now logs `log.warn("Authorization denied")` before returning 403.
  - [Low] V5 migration UUID literals now use explicit `::uuid` PostgreSQL cast.
  - [Low] `TemplateNotFoundException` now has `private static final long serialVersionUID = 1L`.

### File List

- `src/main/resources/db/migration/V5__seed_prebuilt_templates.sql` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/domain/ResumeTemplate.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateRepository.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateDto.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateRequest.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateNotFoundException.java` (new)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java` (new)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` (modified — added `TemplateNotFoundException` handler + `AccessDeniedException` handler)
- `frontend/src/types/api.ts` (modified — added `TemplateDto` and `TemplateRequest` interfaces)

### Review Findings (Pass 3 — 2026-06-05)

- [x] [Review][Patch] `Map.copyOf()` throws NPE on null JSONB values in `toDto()` [TemplateService.java:44] — Fixed: replaced `Map.copyOf()` with `Collections.unmodifiableMap(new HashMap<>(...))` which tolerates null values while still preventing external mutation.

## Change Log

- 2026-06-05: Story created — ready for implementation.
- 2026-06-05: Story implemented — all 10 tasks complete, 64 tests passing, status → review.
- 2026-06-05: Addressed code review findings — 5 items resolved (2 High, 2 Med, 1 Low); 64 tests still passing.
- 2026-06-05: Addressed second code review findings — 6 items resolved (1 High, 3 Med, 2 Low); 64 tests still passing, status remains review.
- 2026-06-05: Addressed third code review finding — 1 patch applied (Map.copyOf NPE on null JSONB values); status → done.
