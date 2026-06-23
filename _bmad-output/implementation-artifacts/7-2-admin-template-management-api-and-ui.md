# Story 7.2: Admin Template Management API & UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin user,
I want to create, edit, delete, and publish/unpublish templates in the prebuilt library,
so that I can maintain template quality and control which templates are available to end users.

## Acceptance Criteria

1. **Create template (admin only).** `POST /api/v1/resume-templates` with a valid `TemplateRequest` body creates a new `ResumeTemplate` with `is_prebuilt = true` and `is_published = false` by default. Returns HTTP **201** with the created `TemplateDto` (body must include the generated `id`, `isPrebuilt=true`, `isPublished=false`). The endpoint requires `ADMIN` role (`@PreAuthorize("hasRole('ADMIN')")`); a non-admin authenticated request receives HTTP 403 `ProblemDetail` (title "Forbidden"). The `templates` Caffeine cache is evicted on create (a newly-created unpublished template does not affect the published list, but eviction keeps the cache consistent and is required for the publish flow). (FR40, FR41, NFR9)

2. **Update template (admin only).** `PUT /api/v1/resume-templates/{templateId}` updates the template's `name`, `description`, and `templateDefinition`; `updatedAt` is refreshed (handled by `BaseEntity`/JPA auditing on save). Returns HTTP **200** with the updated `TemplateDto`. The `templates` cache entry is evicted (`@CacheEvict`). A non-existent `templateId` returns HTTP 404 `ProblemDetail` (title "Not Found"). The existing `cssVariables` rem/em validation must be preserved (invalid units → 400 `TemplateValidationException`). **This endpoint already exists and works — do not regress it.**

3. **Delete template (admin only).** `DELETE /api/v1/resume-templates/{templateId}` removes the template from the database and returns HTTP **204** (no body). The `templates` cache entry is evicted. Resumes that referenced this template id continue to render/export using default styling — no resume row is mutated and no error is thrown to the end user on next render. A non-existent `templateId` returns HTTP 404 `ProblemDetail`. The endpoint requires `ADMIN` role; non-admin → 403.

4. **Publish / unpublish (admin only).** `PATCH /api/v1/resume-templates/{templateId}/publish` sets `is_published = true`; `PATCH /api/v1/resume-templates/{templateId}/unpublish` sets `is_published = false`. Both return HTTP **200** with the updated `TemplateDto`, evict the `templates` cache, and are idempotent (publishing an already-published template stays 200/`isPublished=true`). After publish, the template appears in the end-user gallery (`GET /api/v1/resume-templates`, which returns only published templates); after unpublish it disappears from that list. Non-existent id → 404; non-admin → 403. (FR41)

5. **Admin list-all endpoint (admin only).** A new endpoint returns **all** templates including unpublished/drafts (the existing `GET /api/v1/resume-templates` returns published-only and must stay that way for end users). Implement as `GET /api/v1/resume-templates/admin` (or equivalent admin-scoped path) returning `List<TemplateDto>`, `@PreAuthorize("hasRole('ADMIN')")`. Non-admin → 403. This feeds the admin Templates tab. (FR41)

6. **Admin panel Templates tab.** The admin panel exposes a Templates view rendered by `TemplateManager.tsx`. It fetches the admin list-all endpoint and lists **all** templates (including drafts) in a table with columns: **Name**, **Status** (Published / Draft), **Actions** (Edit, Publish/Unpublish, Delete). Loading shows a `Skeleton`; load failure shows an inline error and an error toast (mirror `UserTable.tsx`).

7. **Delete confirmation flow.** Clicking **Delete** on a template row opens a shadcn/ui `Dialog`: `Delete template '[name]'? This cannot be undone.`. The **Cancel** button is default-focused (UX-DR19). On confirm, `DELETE /api/v1/resume-templates/{id}` is called; on success the row is removed from local state and a `"Template deleted"` success toast appears. On failure, an error toast appears and the row remains. (UX-DR18, UX-DR19)

8. **Publish/unpublish UI action.** Each row has a single toggle action: shows **Publish** when the template is a Draft and **Unpublish** when Published. On click it calls the corresponding PATCH endpoint, updates the row's Status cell and toggles the action label in local state, and shows a success toast (`"Template published"` / `"Template unpublished"`). On failure, an error toast and no state change.

9. **Test coverage.** Backend: `TemplateServiceTest.java` adds coverage for create (defaults `isPrebuilt=true`/`isPublished=false`), update (already covered — keep), delete (deletes + cache behavior), publish, unpublish, listAll (returns published + unpublished), and the not-found path for delete/publish/unpublish (`TemplateNotFoundException`); cache-eviction annotations are verified by an integration-level assertion (see Dev Notes — unit tests cannot observe `@CacheEvict`). `TemplateControllerTest.java` (existing slice unit test) is updated: the `createTemplate_returnsNotImplemented` and `deleteTemplate_returnsNotImplemented` tests will break once 501 stubs are replaced — rewrite them to assert delegation + 201/204. `TemplateControllerIntegrationTest.java` adds admin-path happy paths (create 201, delete 204, publish/unpublish 200, list-all includes a draft) against Testcontainers PostgreSQL, **plus** confirms non-admin **403** on every mutation endpoint and on the admin list-all (the existing 403 tests for POST/PUT/DELETE stay; add 403 for publish/unpublish/list-all). Frontend: `TemplateManager.test.tsx` mocks `apiClient` and covers list render (including a draft row), the delete confirm dialog + success path, and the publish/unpublish toggle. The admin page test is updated to assert the Templates tab renders `TemplateManager`.

## Tasks / Subtasks

- [x] **Task 1 — Backend: `TemplateService` admin mutations (AC: #1, #3, #4, #5)**
  - [x] Add `TemplateDto createTemplate(TemplateRequest request)` to `template/TemplateService.java`: build a new `ResumeTemplate`, set `name`/`description`/`templateDefinition` from the request, `setPrebuilt(true)`, `setPublished(false)`, `ownerId = null`; run the **same** `cssVariables` rem/em validation already in `updateTemplate` (extract it into a private `validateCssVariables(TemplateRequest)` helper and call it from both `create` and `update` to avoid duplication — Sonar S4144/duplication); `save`; return `toDto`. Annotate `@CacheEvict(value = "templates", allEntries = true)` and `@Transactional`.
  - [x] Add `void deleteTemplate(UUID templateId)`: `findById` → throw `TemplateNotFoundException("Template not found: " + templateId)` if absent (so the 404 handler fires); `templateRepository.delete(...)`. Annotate `@CacheEvict(value = "templates", allEntries = true)` and `@Transactional`. Do NOT touch resume rows (fallback is handled at render time — see Dev Notes).
  - [x] Add `TemplateDto setPublished(UUID templateId, boolean published)`: `findById` (404 if absent), `template.setPublished(published)`, `save`, return `toDto`. Annotate `@CacheEvict(value = "templates", allEntries = true)` and `@Transactional`. (One method backs both publish and unpublish.)
  - [x] Add `List<TemplateDto> listAllTemplates()`: `templateRepository.findAll().stream().map(this::toDto).toList()`. Annotate `@Transactional(readOnly = true)`. Do **not** mark `@Cacheable` (admin must always see fresh drafts; the `templates` cache is reserved for the published list only).
  - [x] Reuse the existing private `toDto(ResumeTemplate)` mapper — do not duplicate it.

- [x] **Task 2 — Backend: `TemplateController` endpoints (AC: #1, #3, #4, #5)**
  - [x] In `template/TemplateController.java`, replace the `createTemplate` stub (currently returns `501 NOT_IMPLEMENTED`) with: `return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createTemplate(request));` — keep `@PostMapping`, `@PreAuthorize("hasRole('ADMIN')")`, `@Valid @RequestBody`. Change the return type to `ResponseEntity<TemplateDto>`.
  - [x] Replace the `deleteTemplate` stub (currently `501`) with: call `templateService.deleteTemplate(templateId)` then `return ResponseEntity.noContent().build();` (204). Keep `@DeleteMapping("/{templateId}")` + `@PreAuthorize("hasRole('ADMIN')")`. Return type stays `ResponseEntity<Void>`.
  - [x] Add `@PatchMapping("/{templateId}/publish")` and `@PatchMapping("/{templateId}/unpublish")`, both `@PreAuthorize("hasRole('ADMIN')")`, returning `ResponseEntity<TemplateDto>` (200) by delegating to `templateService.setPublished(id, true/false)`.
  - [x] Add `@GetMapping("/admin")` `@PreAuthorize("hasRole('ADMIN')")` returning `List<TemplateDto>` via `templateService.listAllTemplates()`. (Place it so it does not collide with `@GetMapping("/{templateId}")` — a literal `/admin` segment is matched before the path-variable mapping by Spring, so this is safe, but verify with the integration test.)
  - [x] `updateTemplate` already exists and is correct — leave it. Do NOT add URL-pattern matchers to `SecurityConfig`; RBAC is method-level (`@EnableMethodSecurity` is already active; `.anyRequest().authenticated()` covers the rest). [mirror Story 7.1 Task 2]

- [x] **Task 3 — Backend tests (AC: #9)**
  - [x] Update `template/TemplateControllerTest.java`: delete/replace `createTemplate_returnsNotImplemented` and `deleteTemplate_returnsNotImplemented` (they assert 501 and WILL fail). Add: `createTemplate_delegatesAndReturns201` (mock `templateService.createTemplate` → assert 201 + body), `deleteTemplate_delegatesAndReturns204`, `publish_delegatesAndReturns200`, `unpublish_delegatesAndReturns200`, `listAllTemplates_delegatesAndReturns200`. Keep the existing `updateTemplate` test.
  - [x] Add to `template/TemplateServiceTest.java` (`@ExtendWith(MockitoExtension.class)`, mock `TemplateRepository`): create sets `isPrebuilt=true`/`isPublished=false` and returns DTO; create with rem/em css → `TemplateValidationException`; delete missing → `TemplateNotFoundException`; delete present calls `repository.delete`; `setPublished(true)`/`setPublished(false)` flips the flag and returns DTO; setPublished missing → `TemplateNotFoundException`; `listAllTemplates` returns both published and unpublished (mock `findAll`). (If `TemplateServiceTest.java` does not yet exist, create it.)
  - [x] Extend `template/TemplateControllerIntegrationTest.java` (Testcontainers PostgreSQL). Seed an ADMIN token using the **`TokenService` + `PasswordEncoder` seed pattern from `AdminControllerIntegrationTest`** (do NOT only use signup, which yields USER role — you need a real ADMIN). Add: admin create → 201 with `isPublished=false`; admin list-all (`GET /admin`) includes the newly-created draft (which is absent from the public `GET /`); admin publish → 200 then the template appears in public `GET /`; admin unpublish → 200 then it disappears; admin delete → 204 then public/admin GET no longer return it. Add **non-admin 403** cases for `/admin`, `/{id}/publish`, `/{id}/unpublish` (the existing POST/PUT/DELETE 403 tests stay). Keep all existing tests green.

- [x] **Task 4 — Frontend: types + API wiring (AC: #1–#5)**
  - [x] `frontend/src/types/api.ts`: `TemplateDto`, `TemplateRequest`, `TemplateDefinitionDto` already exist (lines ~473–493). No new types are strictly required. If a create form sends a minimal definition, reuse `TemplateRequest`. Do NOT redefine existing types.
  - [x] Use existing `apiClient` methods (all present): `apiClient.get<TemplateDto[]>("/api/v1/resume-templates/admin")`, `apiClient.post<TemplateDto>("/api/v1/resume-templates", body)`, `apiClient.put`, `apiClient.delete("/api/v1/resume-templates/${id}")`, `apiClient.patch<TemplateDto>("/api/v1/resume-templates/${id}/publish")`. No new client methods, no raw `fetch`. [Source: frontend/src/lib/apiClient.ts]

- [x] **Task 5 — Frontend: `TemplateManager.tsx` (AC: #6, #7, #8)**
  - [x] Create `frontend/src/components/admin/TemplateManager.tsx`, **mirroring `UserTable.tsx`** (default export; fetch on mount with a `cancelled` guard in the effect cleanup; `isLoading` skeleton; `loadError` inline message + `toast.error`; `sonner` `toast`; shadcn `Dialog`; `Button`, `Badge`, `Skeleton`).
  - [x] Render a semantic `<table>` (there is **no** `components/ui/table.tsx` in this repo — Story 7.1 used a plain styled `<table>`; follow that, do not add a ui/table component) with columns Name, Status, Actions. Status renders a `Badge`: "Published" (`variant="secondary"`) / "Draft" (`variant="outline"`). Actions: a Publish/Unpublish toggle button (label depends on `isPublished`), an Edit button, and a destructive Delete button.
  - [x] Delete flow: per UX-DR18/DR19 — clicking Delete opens a `Dialog` with copy `Delete template '{name}'? This cannot be undone.`; Cancel `ref`-focused on open (copy the `cancelRef` + `setTimeout(...focus(), 0)` effect from `UserTable.tsx`); on confirm call `apiClient.delete`, remove the row from local state, `toast.success("Template deleted")`; on error `toast.error(...)` and keep the row. Disable both dialog buttons while the delete is in flight (track a `deletingId`).
  - [x] Publish/unpublish toggle: call `apiClient.patch` to `.../publish` or `.../unpublish` based on current state; on success update the row's `isPublished` in local state and `toast.success`; track an in-flight id to disable the button; on error `toast.error` and no change.
  - [x] **Edit scope decision (resolve, do not gold-plate):** A full template-definition editor is heavyweight and not strictly required by the epic ACs (the epic lists Edit as an action but the PUT contract only needs name/description/definition). Implement Edit as a minimal shadcn `Dialog` form editing **Name** and **Description** that PUTs via `apiClient.put` (sending the existing `templateDefinition` unchanged so validation passes), updating the row on success with a toast. Do not build a visual layout/CSS editor — that belongs to Epic 8 (custom template authoring). Record this scoping in the Dev Agent Record.

- [x] **Task 6 — Frontend: admin page Templates tab (AC: #6)**
  - [x] Update `frontend/src/pages/AdminPage.tsx` to present two tabs using the existing `components/ui/tabs.tsx` (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`): **Users** (existing `<UserTable />`) and **Templates** (`<TemplateManager />`). Keep `AdminPage` as the default export (router lazy-imports the default — do NOT touch `router/index.tsx`; lazy/Suspense/Skeleton/`requireAdmin` already exist from Story 1.5). Update the page heading to reflect both responsibilities (e.g. "Administration") rather than only "User Management".

- [x] **Task 7 — Frontend tests (AC: #9)**
  - [x] Create `frontend/src/components/admin/TemplateManager.test.tsx`: mock `apiClient`; assert rows render from a mocked `TemplateDto[]` including one Draft and one Published; clicking Delete opens the dialog, confirm calls `apiClient.delete` and removes the row + fires success toast; clicking Publish on a draft calls `.../publish` and flips the badge; clicking Unpublish on a published row calls `.../unpublish`. Mock `sonner`'s `toast` (see how `UserTable.test.tsx` does it).
  - [x] Update `frontend/src/pages/AdminPage.test.tsx`: it currently asserts the Users heading/table only. Add an assertion that the Templates tab exists and, when activated, renders `TemplateManager` (mock `apiClient` for both `/admin/users` and `/resume-templates/admin`). Do not leave assertions that break under the new tabbed layout.

- [x] **Task 8 — Lint & verify (Definition of Done)**
  - [x] Backend: all new/changed tests green; full `./mvnw test` regression passes (Story 7.1 baseline: ~49 surefire classes, 0 failures). No catch-and-swallow; all errors surface via `ProblemDetail`.
  - [x] Frontend: `cd frontend && npm run lint` introduces **0 new** errors in story files (pre-existing errors in `EditorPage.tsx` etc. are out of scope — do not touch); `npm run test` green. No `any`, no raw `fetch`, no new Zustand store outside `stores/`, no imports from `components/ui/` internals in tests.

## Dev Notes

### Current state of the template backend — three of four mutations are stubs/missing

Read these files before coding; this story finishes a partially-built controller:

- `template/TemplateController.java`: `listPublishedTemplates` (GET `/`) and `getPublishedTemplate` (GET `/{id}`) are **done**. `updateTemplate` (PUT) is **done and correct**. **`createTemplate` and `deleteTemplate` are stubs returning `501 NOT_IMPLEMENTED`** — you replace them. There is **no** publish/unpublish endpoint and **no** admin list-all endpoint yet. [Source: src/main/java/.../template/TemplateController.java lines 43-60]
- `template/TemplateService.java`: has `listPublishedTemplates` (`@Cacheable("templates")`), `getPublishedTemplate`, and `updateTemplate` (`@CacheEvict(value="templates", allEntries=true)`, with rem/em css validation). You add `createTemplate`, `deleteTemplate`, `setPublished`, `listAllTemplates`. [Source: src/main/java/.../template/TemplateService.java]
- `template/domain/ResumeTemplate.java`: Lombok `@Getter/@Setter`, extends `BaseEntity` (provides `id`, `createdAt`, `updatedAt` auditing). Fields: `name`, `description`, `boolean isPrebuilt`, `boolean isPublished`, `UUID ownerId`, `Map<String,Object> templateDefinition` (jsonb). Setters: `setPrebuilt`/`setPublished` (Lombok strips the `is` prefix for boolean fields). [Source: src/main/java/.../template/domain/ResumeTemplate.java]
- `template/TemplateRepository.java`: `JpaRepository<ResumeTemplate, UUID>` with `findAllByIsPublishedTrue()` and `findByIdAndIsPublishedTrue(UUID)`. `findAll()` and `delete(...)` come from `JpaRepository` — no new repo methods needed for list-all/delete. [Source: src/main/java/.../template/TemplateRepository.java]
- DTOs already exist and are reused: `TemplateDto` (id, name, description, isPrebuilt, isPublished, templateDefinition, createdAt, updatedAt) and `TemplateRequest` (`@NotBlank name`, `description`, `@NotNull Map templateDefinition`). [Source: src/main/java/.../template/dto/TemplateDto.java, TemplateRequest.java]

### Exception handlers already exist — do NOT add new ones

`GlobalExceptionHandler` already maps `TemplateNotFoundException` → **404** ("Not Found") and `TemplateValidationException` → **400**. Just throw these from the service; the 404/400 surfaces are handled. `@PreAuthorize` denials map to **403** ("Forbidden") via the existing `AuthorizationDeniedException` handler — no `SecurityConfig` change. [Source: src/main/java/.../common/GlobalExceptionHandler.java lines 114-133, plus the `AuthorizationDeniedException` handler proven by Story 7.1]

### Cache eviction — must be `allEntries = true`, and unit tests cannot observe it

The published list is cached under a single `@Cacheable("templates")` key (`listPublishedTemplates` takes no args → default key). Therefore every mutation must `@CacheEvict(value = "templates", allEntries = true)` (matching the existing `updateTemplate`). A Mockito unit test cannot verify `@CacheEvict` (it's a Spring proxy concern). The epic AC "cache evicted → newly published template immediately visible" is best proven in the **integration test**: publish a draft via the admin endpoint, then assert it appears in the public `GET /api/v1/resume-templates` in the same test (the cache was populated by an earlier public GET). Do not write a brittle reflection-based unit assertion for the annotation. [Source: src/main/java/.../template/TemplateService.java line 44]

### DELETE fallback is already safe at the render layer — do NOT mutate resume rows

The epic AC says "resumes that referenced this template fall back to the default template on next render/export." This already works with **zero** backend changes to resumes:
- Frontend `ResumeCanvas.tsx` fetches `GET /api/v1/resume-templates/{templateId}` and, on **any** error (a deleted template id → 404), `catch`es and sets `template = null`, rendering with default Tailwind styling. [Source: frontend/src/components/resume/ResumeCanvas.tsx lines 38-58]
- So "fall back to default" = the existing null-template path. Your DELETE must NOT cascade to or null out `resumes.template_id`; just delete the template row. Verify the export path (`export/` PDF/DOCX renderers from Epic 6) tolerates a missing template id similarly — if an exporter does a hard `findByIdAndIsPublishedTrue(...).orElseThrow()`, note it as a deferred edge case rather than expanding scope here. The AC is satisfied for render; flag export if it differs.

### Admin integration test must seed a real ADMIN — signup yields USER

The existing `TemplateControllerIntegrationTest` only uses `registerAndGetToken(...)` which creates a **USER** (hence its tests only assert 403 for mutations). For the new admin happy-path tests you need an ADMIN token. **Copy the seeding pattern from `AdminControllerIntegrationTest`**: inject `TokenService` + `PasswordEncoder` + `UserRepository`, `seedUser(email, "ADMIN", true)`, then `tokenService.generateToken(admin)`. Keep the existing `WebTestClient` + Testcontainers `ContainersConfig` setup. [Source: src/test/java/.../admin/AdminControllerIntegrationTest.java lines 42-78; src/test/java/.../template/TemplateControllerIntegrationTest.java lines 46-67]

### Route mapping order — `/admin` literal vs `/{templateId}` path var

`GET /api/v1/resume-templates/{templateId}` already exists. Adding `GET /api/v1/resume-templates/admin` is safe because Spring matches the more-specific literal segment before the path variable, but **assert it in the integration test** (admin list-all returns an array, not a 404/UUID-parse error). If a collision surfaces, prefer a distinct path like `GET /api/v1/resume-templates/all` over reordering. (`{templateId}` is typed `UUID`, so a non-UUID `admin` segment would 400 if it fell through — another reason to verify.)

### Frontend — mirror Story 7.1 patterns exactly

`UserTable.tsx` is the canonical reference for `TemplateManager.tsx`: mount-effect fetch with `cancelled` cleanup guard, `isLoading` Skeleton, `loadError` branch, `sonner` `toast.success/error`, shadcn `Dialog` confirm with `cancelRef` default-focus (UX-DR19), per-row in-flight id to disable buttons, and a semantic `<table>` (no `components/ui/table.tsx` exists). [Source: frontend/src/components/admin/UserTable.tsx]
- `components/ui/tabs.tsx` exists — use it for the Users/Templates split in `AdminPage.tsx`. [verified: frontend/src/components/ui/ contains tabs.tsx, dialog.tsx, sonner.tsx]
- `AdminPage.tsx` currently renders only a "User Management" heading + `<UserTable />`. It is the lazy default export wired in `router/index.tsx` under `requireAdmin` — keep the default export, do not touch the router. [Source: frontend/src/pages/AdminPage.tsx; Story 7.1 Dev Notes]
- The end-user `TemplateGallery.tsx` fetches the **published-only** `GET /api/v1/resume-templates` — leave it untouched; the admin tab uses the new `/admin` endpoint. [Source: frontend/src/components/resume/TemplateGallery.tsx line 84]

### Avoid Sonar findings (Epic 9 just cleaned these up)

- Extract the duplicated `cssVariables` rem/em validation into a single private helper used by both `createTemplate` and `updateTemplate` (don't copy the loop — Sonar flags duplication). [Source: existing loop in TemplateService.updateTemplate lines 51-61]
- Component props that are objects/arrays should be `readonly` where the codebase convention applies (Story 9-11). Frontend: no `any`, prefer `globalThis` over `window` (Story 9-10). [Source: project-context.md; Epic 9 stories 9-10, 9-11]

### Testing standards summary

- Backend unit: JUnit 5 + Mockito, `@ExtendWith(MockitoExtension.class)`, no Spring context — one `*Test.java` per service. [Source: project-context.md#Backend Unit Tests]
- Backend integration: `<Controller>IntegrationTest.java`, `@SpringBootTest(RANDOM_PORT)`, `@ActiveProfiles("test")`, Testcontainers PostgreSQL via the in-class `ContainersConfig` + `@ServiceConnection`, `WebTestClient`. Every endpoint ≥1 happy path; admin endpoints additionally need the non-admin 403 case. [Source: project-context.md#Backend Integration Tests; existing TemplateControllerIntegrationTest]
- Frontend: co-located Vitest + Testing Library, mock `apiClient`, never import `components/ui/` internals — test behaviour. [Source: project-context.md#Frontend Tests]

### Project Structure Notes

- `components/admin/TemplateManager.tsx` is pre-defined in the architecture (FR40, FR41) and currently absent — this story creates it. `AdminPage.tsx` lazy-load (FR38–FR41) already exists. No structural variance. [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md lines 156, 183]
- New admin list-all path: the epic does not pin the URL; chosen `GET /api/v1/resume-templates/admin` keeps all template ops under the existing `TemplateController`/`/api/v1/resume-templates` mapping rather than spreading them into `AdminController` (which is auth/user-scoped). Documented variance: the epic narrative implies the "Templates tab" lives in the admin panel, which it does on the frontend; the backend stays in the cohesive template package. No new package.
- No Flyway migration required: `resume_templates` table (V4) and the `is_published`/`is_prebuilt` columns already exist; create/delete/publish operate on existing schema. Never modify applied migrations V1–V17. [Source: src/main/resources/db/migration/V4__create_resume_templates_table.sql, V5__seed_prebuilt_templates.sql]

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7-administration-observability.md#Story 7.2]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure (TemplateManager.tsx FR40/FR41)]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Naming Patterns, #Anti-Patterns]
- [Source: _bmad-output/project-context.md#Spring Boot / Spring Security, #Security, #Frontend]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateRepository.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/domain/ResumeTemplate.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateDto.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/template/dto/TemplateRequest.java]
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java]
- [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java]
- [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerTest.java]
- [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/admin/AdminControllerIntegrationTest.java] (admin-token seeding pattern)
- [Source: frontend/src/components/admin/UserTable.tsx] (canonical table+dialog+toast pattern to mirror)
- [Source: frontend/src/pages/AdminPage.tsx], [frontend/src/components/ui/tabs.tsx], [frontend/src/lib/apiClient.ts]
- [Source: frontend/src/components/resume/ResumeCanvas.tsx] (delete fallback: null template → defaults)
- [Source: frontend/src/types/api.ts#TemplateDto, #TemplateRequest, #TemplateDefinitionDto]
- Prior-art story (admin API + lazy admin page + confirm-dialog deactivate + admin-token integration test): `7-1-admin-user-management-api-and-ui.md`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / Senior Software Engineer)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Backend: added `createTemplate`, `deleteTemplate`, `setPublished`, `listAllTemplates` to `TemplateService`; extracted shared `validateCssVariables(TemplateRequest)` helper used by both create and update (removes the duplicated rem/em loop — Sonar S4144). All mutations annotated `@CacheEvict(value="templates", allEntries=true)`; `listAllTemplates` is `@Transactional(readOnly=true)` and intentionally NOT `@Cacheable` so admins always see fresh drafts.
- Backend controller: replaced the 501 `createTemplate`/`deleteTemplate` stubs with 201/204 delegations, added `GET /admin`, `PATCH /{id}/publish`, `PATCH /{id}/unpublish`. The `/admin` literal segment resolves before the `/{templateId}` UUID path variable — verified by integration test (returns array, not 404/parse error).
- Cache eviction is proven at the integration level: the lifecycle test creates a draft (absent from public `GET /`), publishes it (now present in public `GET /` despite the cache being warmed by an earlier public GET), then unpublishes (gone again) — exactly the assertion strategy the Dev Notes prescribed instead of a brittle reflection unit test.
- DELETE does not touch resume rows; the existing render-time null-template fallback (`ResumeCanvas.tsx`) already covers "deleted template → default styling", so no resume schema changes were made.
- **Edit scope decision (resolved, not gold-plated):** `TemplateManager` implements Edit as a minimal shadcn `Dialog` editing Name + Description only, PUTting the existing `templateDefinition` unchanged so backend validation passes. A full visual layout/CSS editor was deliberately NOT built — that belongs to Epic 8 (custom template authoring).
- Frontend: `TemplateManager.tsx` mirrors `UserTable.tsx` (mount-effect fetch with `cancelled` cleanup guard, Skeleton loading, inline `loadError` + `toast.error`, `sonner` toasts, `cancelRef` default-focused on the delete dialog per UX-DR19, per-row in-flight id to disable buttons, semantic `<table>`). `AdminPage.tsx` now uses the existing `components/ui/tabs.tsx` for a Users/Templates split with heading changed to "Administration"; default export preserved (router untouched).
- Tests: backend full suite 516 passing (template unit 21, template integration 12). Frontend full suite 760 passing (TemplateManager 7, AdminPage 2 new). Lint introduces 0 new errors (13 pre-existing errors remain only in out-of-scope files: EditorPage, SummaryStep, authShared, profileStepShared, sectionRendererShared, usePageLayout, useAutosave, DashboardPage).

### File List

- src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java (modified)
- src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java (modified)
- src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java (modified)
- src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerTest.java (modified)
- src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateControllerIntegrationTest.java (modified)
- frontend/src/components/admin/TemplateManager.tsx (new)
- frontend/src/components/admin/TemplateManager.test.tsx (new)
- frontend/src/pages/AdminPage.tsx (modified)
- frontend/src/pages/AdminPage.test.tsx (modified)

### Change Log

| Date | Change |
| --- | --- |
| 2026-06-23 | Story 7.2 drafted with full implementation context. Status → ready-for-dev. |
| 2026-06-23 | Implemented all 9 ACs: backend create/delete/publish/unpublish/list-all + controller endpoints; frontend TemplateManager + AdminPage tabs. Backend 516 tests green, frontend 760 tests green, 0 new lint errors. Status → review. |
