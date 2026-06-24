# Story 8.1: Custom Template Data Model & CRUD API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the custom template data model and user-facing CRUD API endpoints implemented,
so that authenticated users can create, edit, and delete their own resume templates separate from the prebuilt library, scoped to their own ownership.

## Scope

**Backend-only story.** Frontend "My Templates" gallery and template editor UI are story 8.2 — do NOT build any React/UI here. This story delivers: one Flyway migration, repository query methods, `TemplateService` custom-template methods, ownership-scoped controller endpoints, a forbidden exception + handler, and the matching unit + integration tests.

## Acceptance Criteria

1. **Migration (additive only).** A new Flyway migration **`V18__add_custom_template_support.sql`** is applied that adds an ownership index `idx_resume_templates_owner_id` on `resume_templates(owner_id)`. The `owner_id` column, `is_prebuilt`, and `is_published` columns **already exist from V4** and must NOT be re-added. Existing prebuilt/seeded templates are unaffected (their `owner_id` stays `NULL`).

2. **Create — `POST /api/v1/resume-templates/custom`.** An authenticated (non-admin) user posts a `CustomTemplateRequest` body. A new `ResumeTemplate` is persisted with `ownerId` = the authenticated user's UUID, `isPrebuilt = false`, and `isPublished = false`. HTTP **201** is returned with a `TemplateDto`. The endpoint requires authentication but **must NOT** carry `@PreAuthorize("hasRole('ADMIN')")`.

3. **List own — `GET /api/v1/resume-templates/custom`.** Returns only templates whose `ownerId` equals the authenticated user's UUID. Another user's custom templates are never included. HTTP **200** with a `List<TemplateDto>`.

4. **Update own — `PUT /api/v1/resume-templates/custom/{templateId}`.** Updates name/description/templateDefinition of a custom template the user owns; HTTP **200** with the updated `TemplateDto`. When the template belongs to a **different** user, HTTP **403** is returned with an RFC 7807 `ProblemDetail` body (`title: "Forbidden"`). When the template does not exist, HTTP **404** (`title: "Not Found"`).

5. **Delete own — `DELETE /api/v1/resume-templates/custom/{templateId}`.** Deletes a custom template the user owns; HTTP **204**. A different owner → **403**; unknown id → **404**. After deletion, any resume whose `templateId` referenced the deleted template falls back to the default template on next render/export — this is **already handled** by `ExportService.resolveTemplate(...)` (`findByIdAndIsPublishedTrue(...).orElseGet(buildFallbackTemplate)`); verify it, do not rebuild it.

6. **Ownership enforced in service, not just controller.** A user can only update/delete templates they own AND that are custom (`isPrebuilt = false`). Attempting to mutate a prebuilt template via the `/custom` endpoints returns **403** (not 404) — it exists but is not the caller's to edit.

7. **Tests.** `TemplateServiceTest.java` adds unit coverage for: create-custom (asserts `ownerId` set, `isPrebuilt=false`, `isPublished=false`), list-own (filters by owner), update-own success, update-other-user → forbidden exception, delete-own success, delete-other-user → forbidden exception. `TemplateControllerIntegrationTest.java` adds, against Testcontainers PostgreSQL: custom create→list→update→delete happy path for one user, and a cross-user ownership 403 (user B cannot PUT/DELETE user A's custom template), plus 401 when unauthenticated.

## Tasks / Subtasks

- [x] **Task 1 — Flyway migration (AC: #1)**
  - [x] Create `src/main/resources/db/migration/V18__add_custom_template_support.sql`
  - [x] Single statement: `CREATE INDEX IF NOT EXISTS idx_resume_templates_owner_id ON resume_templates (owner_id);`
  - [x] Do NOT add columns — `owner_id`, `is_prebuilt`, `is_published` already exist from V4. Do NOT edit any existing V*.sql.
- [x] **Task 2 — Repository queries (AC: #3, #4, #5)**
  - [x] Add to `TemplateRepository`: `List<ResumeTemplate> findAllByOwnerId(UUID ownerId);`
  - [x] Add `Optional<ResumeTemplate> findByIdAndOwnerId(UUID id, UUID ownerId);` (used to enforce ownership in one query for update/delete)
- [x] **Task 3 — DTO (AC: #2, #4)**
  - [x] Added distinct `CustomTemplateRequest` record in `template/dto/` (same shape as `TemplateRequest`) to document intent and decouple admin/user request evolution.
- [x] **Task 4 — Forbidden exception (AC: #4, #6)**
  - [x] Add `TemplateAccessDeniedException extends RuntimeException` in the `template` package (with `serialVersionUID`).
  - [x] Add `@ExceptionHandler(TemplateAccessDeniedException.class)` to `GlobalExceptionHandler` returning `HttpStatus.FORBIDDEN`, `title "Forbidden"` (mirrors `handleResumeAccessDenied`, including `log.warn`).
- [x] **Task 5 — Service methods (AC: #2, #3, #4, #5, #6)**
  - [x] `createCustomTemplate(UUID ownerId, CustomTemplateRequest request)`: validates CSS vars, sets owner/prebuilt=false/published=false, saves, returns `toDto`. No `@CacheEvict` — custom templates are never published, so the `templates` cache (only `listPublishedTemplates` is `@Cacheable`) is unaffected.
  - [x] `listCustomTemplates(UUID ownerId)`: `@Transactional(readOnly=true)`, filters by owner.
  - [x] `updateCustomTemplate(...)`: ownership resolved via shared `resolveOwnedTemplate` — `findByIdAndOwnerId` empty + `findById` present → `TemplateAccessDeniedException` (403); `findById` empty → `TemplateNotFoundException` (404).
  - [x] `deleteCustomTemplate(...)`: same ownership resolution; on success `delete(template)`. `validateCssVariables` refactored to take the `templateDefinition` map so both request types reuse it.
- [x] **Task 6 — Controller endpoints (AC: #2, #3, #4, #5)**
  - [x] Added to `TemplateController` (NO `@PreAuthorize`): `POST /custom` → 201, `GET /custom` → 200, `PUT /custom/{templateId}` → 200, `DELETE /custom/{templateId}` → 204.
  - [x] Resolve UUID via injected `UserRepository`: `@AuthenticationPrincipal User principal` → `findByEmail(...).getId()` (`resolveOwnerId` helper); throws `IllegalStateException` if absent.
- [x] **Task 7 — Tests (AC: #7)**
  - [x] `TemplateServiceTest`: +10 cases (create-custom, create CSS reject, list-own, update-own, update-other→403, update-unknown→404, delete-own, delete-other→403, delete-prebuilt→403).
  - [x] `TemplateControllerIntegrationTest`: +5 cases (custom lifecycle, cross-user 403 PUT/DELETE, unknown→404, prebuilt→403, unauthenticated→401).
  - [x] `./mvnw test` — 531 backend tests green (24 in TemplateServiceTest, 17 in TemplateControllerIntegrationTest).

## Dev Notes

### What ALREADY exists (do not rebuild)

- **Entity** `template/domain/ResumeTemplate.java` already has every field needed: `name`, `description`, `isPrebuilt`, `isPublished`, `ownerId` (`@Column(name="owner_id")`, type `UUID`), and `templateDefinition` (`jsonb`). Extends `BaseEntity` (provides `id` UUID, `createdAt`, `updatedAt`). **No entity change required.**
- **Migration V4** (`V4__create_resume_templates_table.sql`) already created `owner_id UUID REFERENCES users (id) ON DELETE SET NULL`, plus `is_prebuilt` and `is_published` (both `BOOLEAN NOT NULL DEFAULT FALSE`). The epic text saying these may be "missing" is stale — they exist. Only the **index** is new.
- **Epic says `owner_user_id`; the real column/field is `owner_id` / `ownerId`.** Use the actual names. Do not introduce `owner_user_id`.
- **Epic says migration `V6`; V6 is already taken** (`V6__backfill_template_definitions.sql`). Migrations run through **V17**. Next free version is **V18**.
- **DTO** `template/dto/TemplateDto.java` already serializes `isPrebuilt`, `isPublished`, `templateDefinition`, timestamps. Reuse it for all custom responses — frontend `TemplateDto` interface (`frontend/src/types/api.ts:480`) already matches.
- **CSS validation** `TemplateService.validateCssVariables(...)` rejects rem/em units; reuse it on custom create/update (the existing `TemplateRequest` and a `CustomTemplateRequest` share the `templateDefinition` map shape it inspects).
- **Delete-fallback (AC#5) is already implemented.** `export/ExportService.resolveTemplate(UUID)` does `findByIdAndIsPublishedTrue(templateId).orElseGet(this::buildFallbackTemplate)`. A custom template is never published, so a resume pointing at a (now-deleted, and never-published) custom `templateId` already falls back. `Resume.templateId` is a loose `UUID` column (`@Column(name="template_id")`, no FK), so deleting a template leaves a harmless dangling id that the resolver tolerates. Verify with an assertion if convenient; no new fallback code.
- **Admin CRUD** lives on the same controller (`POST`/`PUT`/`DELETE /api/v1/resume-templates`, `GET /admin`, publish/unpublish) and is `@PreAuthorize("hasRole('ADMIN')")`. The custom endpoints are a **separate, non-admin surface** under `/custom`. Do not weaken or touch the admin endpoints.

### Auth / ownership pattern (critical)

- `JwtAuthenticationFilter` builds a lightweight `User` principal with **only email + role set — no `id`**. Therefore you cannot read the user UUID off the principal. Follow `auth/UserController.changePassword`: `@AuthenticationPrincipal User principal` → `userRepository.findByEmail(principal.getEmail())` → `.getId()`.
- Authorization for these endpoints is **ownership-based, enforced in the service**, NOT role-based `@PreAuthorize`. Any authenticated user reaches the endpoint; the service decides via `ownerId` match whether to allow or throw `TemplateAccessDeniedException` (→ 403).
- Distinguish 403 vs 404 deliberately (AC#4, AC#6): not-found-at-all = 404; exists-but-not-yours (other owner, or a prebuilt) = 403.

### Error contract

- All errors are RFC 7807 `ProblemDetail` via `GlobalExceptionHandler` (`@RestControllerAdvice`) — never `ResponseEntity<Map>`. New `TemplateAccessDeniedException` → 403 handler mirrors `handleResumeAccessDenied`. `TemplateNotFoundException` → existing 404 handler already present. `MethodArgumentNotValidException` (blank name / null definition) → existing 400 handler.

### Source tree components to touch

- NEW: `src/main/resources/db/migration/V18__add_custom_template_support.sql`
- NEW: `src/main/java/.../template/TemplateAccessDeniedException.java`
- NEW (optional): `src/main/java/.../template/dto/CustomTemplateRequest.java`
- UPDATE: `template/TemplateRepository.java` (2 query methods)
- UPDATE: `template/TemplateService.java` (4 custom methods; reuse `validateCssVariables`, `toDto`)
- UPDATE: `template/TemplateController.java` (4 `/custom` endpoints; inject `UserRepository`)
- UPDATE: `common/GlobalExceptionHandler.java` (1 handler)
- UPDATE: `test/.../template/TemplateServiceTest.java`
- UPDATE: `test/.../template/TemplateControllerIntegrationTest.java`

### Testing standards summary

- Unit: JUnit 5 + Mockito, `@ExtendWith(MockitoExtension.class)`, mirror package under `src/test`. Existing `TemplateServiceTest` uses `ReflectionTestUtils.setField` to populate `BaseEntity` id/timestamps on mock entities — reuse that helper for new fixtures.
- Integration: `@SpringBootTest(webEnvironment = RANDOM_PORT)`, `@ActiveProfiles("test")`, Testcontainers `PostgreSQLContainer("postgres:16")` via the nested `ContainersConfig`, `WebTestClient`. Use the existing `registerAndGetToken(email, "Password1")` helper for ordinary (non-admin) users — exactly what custom endpoints need. Every REST endpoint needs at least one happy-path integration test.

### Project Structure Notes

- Backend package root `com.tsvetanbondzhov.resumeenhancer`; domain package `template`. One package per domain — no cross-domain imports except via service interfaces. Reading `UserRepository` from the `auth` package into `TemplateController` mirrors the existing `UserController` dependency and is the established pattern for resolving the principal's persisted record.
- API routes prefixed `/api/v1/`; kebab-case plural nouns; path params `{camelCase}` → `/api/v1/resume-templates/custom/{templateId}` is consistent.
- DB naming: index `idx_<table>_<column>` → `idx_resume_templates_owner_id` is consistent. Flyway scripts `V<N>__<snake_case>.sql`; never modify an applied migration.
- No conflicts detected. The only variance from the epic text is corrected above (V6→V18, owner_user_id→owner_id, columns already exist).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-8-custom-template-authoring-deferred.md#Story 8.1]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/domain/ResumeTemplate.java]
- [Source: src/main/resources/db/migration/V4__create_resume_templates_table.sql]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java#validateCssVariables,toDto]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateRepository.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateDto.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateRequest.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/UserController.java#changePassword — principal-to-id resolution]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java — principal has email/role only, no id]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java#handleResumeAccessDenied — 403 pattern]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportService.java#resolveTemplate,buildFallbackTemplate — AC5 fallback already implemented]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/Resume.java#templateId — loose UUID, no FK]
- [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java — unit test patterns]
- [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java — WebTestClient + registerAndGetToken helpers]
- [Source: _bmad-output/project-context.md — Spring/Security/Flyway/testing rules]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia, BMad dev-story workflow)

### Debug Log References

- `./mvnw -o test -Dtest=TemplateServiceTest` → 24/24 pass
- `./mvnw -o test -Dtest=TemplateControllerIntegrationTest` → 17/17 pass (Testcontainers PostgreSQL 16; V18 migration applied cleanly)
- `./mvnw -o test` (full regression) → 531/531 pass, 0 failures (was 517 pre-story; +14 new tests)

### Completion Notes List

- AC#1: V18 migration adds index only; no columns added; existing V*.sql untouched. Verified migration applies in integration run.
- AC#2: `POST /custom` → 201 `TemplateDto`; owner set, isPrebuilt/isPublished false; no `@PreAuthorize`.
- AC#3: `GET /custom` filters by ownerId via `findAllByOwnerId`; cross-user isolation asserted.
- AC#4 & AC#6: 403/404 distinguished in service (`resolveOwnedTemplate`): not-found→404, exists-but-not-owned OR prebuilt(ownerId NULL)→403. Both surfaced as RFC 7807 ProblemDetail with correct titles via GlobalExceptionHandler.
- AC#5: Delete returns 204; fallback on deleted templateId verified pre-existing in `ExportService.resolveTemplate` (findByIdAndIsPublishedTrue → buildFallbackTemplate); no new fallback code.
- AC#7: Unit + integration coverage added per spec; all green.
- Auth: owner UUID resolved via injected `UserRepository.findByEmail(principal.getEmail()).getId()`, mirroring `UserController.changePassword` (JWT principal carries no id).
- No cache eviction on custom CRUD: only `listPublishedTemplates` is `@Cacheable("templates")`; custom templates are never published, so the cache is unaffected.
- Scope respected: no frontend changes, no auth response shape changes, admin endpoints untouched. `validateCssVariables` signature refactored to accept the `templateDefinition` map (private; reused by admin + custom paths) — internal refactor, no contract change.

### File List

**New:**
- `src/main/resources/db/migration/V18__add_custom_template_support.sql`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateAccessDeniedException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/CustomTemplateRequest.java`

**Modified:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateRepository.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java`

### Change Log

- 2026-06-24: Implemented Story 8.1 — custom template data model + CRUD API. V18 ownership index, 2 repository queries, `CustomTemplateRequest` DTO, `TemplateAccessDeniedException` + 403 handler, 4 ownership-scoped service methods, 4 `/custom` controller endpoints. +14 tests (10 unit, 4 integration net of helper additions). Full suite 531/531 green.
