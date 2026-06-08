# Epic 6: Administration & Observability

Admins can manage users (view, deactivate) and the prebuilt template library (CRUD, publish/unpublish) via a lazy-loaded admin panel. OpenTelemetry span propagation through the SSE async boundary is implemented, Grafana dashboards show distributed traces for all user-initiated operations, and trace correlation IDs appear in logs.

### Story 6.1: Admin User Management API & UI

As an admin user,
I want to view all registered user accounts and deactivate specific users,
So that I can maintain user integrity and disable access for test accounts or bad actors without deleting their data.

**Acceptance Criteria:**

**Given** an admin user calls `GET /api/v1/admin/users`
**When** the request is processed
**Then** a paginated list of all registered users is returned as `AdminUserDto` objects (id, email, role, status, createdAt); the endpoint is protected by `@PreAuthorize("hasRole('ADMIN')")`; a non-admin authenticated request receives HTTP 403 (NFR9)

**Given** an admin user calls `PATCH /api/v1/admin/users/{userId}/deactivate`
**When** the request is processed
**Then** the user's `status` is set to `INACTIVE` in the `users` table; subsequent login attempts by that user return HTTP 401 with `ProblemDetail` detail "Account is deactivated"; the user's resumes and profile data remain untouched (FR39)

**Given** an admin user navigates to `/admin`
**When** the page renders
**Then** `AdminPage.tsx` is lazy-loaded via React `lazy()` + `Suspense` with a `Skeleton` placeholder during load; `UserTable.tsx` fetches from `GET /api/v1/admin/users` and displays the user list in a table with columns: Email, Role, Status, Created, Actions

**Given** the admin clicks "Deactivate" on a user row
**When** the action is triggered
**Then** a shadcn/ui `Dialog` confirmation appears: "Deactivate [email]? Their resumes will be preserved."; Cancel is default-focused; on confirm, `PATCH /api/v1/admin/users/{userId}/deactivate` is called; on success the row's Status cell updates to "Inactive" and a "User deactivated" Toast appears (UX-DR18, UX-DR19)

**Given** a non-admin authenticated user navigates to `/admin`
**When** the route is evaluated by the frontend router
**Then** the user is redirected to the dashboard (role-gated at route level, consistent with Story 1.5)

**Given** `AdminService` is implemented
**When** unit tests are run
**Then** `AdminServiceTest.java` covers user list and deactivate with Mockito mocks; `AdminControllerIntegrationTest.java` covers happy-path list and deactivate, plus a 403 case for a non-admin token, against Testcontainers PostgreSQL

### Story 6.2: Admin Template Management API & UI

As an admin user,
I want to create, edit, delete, and publish/unpublish templates in the prebuilt library,
So that I can maintain template quality and control which templates are available to end users.

**Acceptance Criteria:**

**Given** an admin user calls `POST /api/v1/resume-templates` with a `TemplateRequest` body
**When** the request is processed
**Then** a new `ResumeTemplate` entity is created with `is_prebuilt = true` and `is_published = false` by default; HTTP 201 returned with the new `TemplateDto`; the endpoint requires `ADMIN` role (`@PreAuthorize("hasRole('ADMIN')")`)

**Given** an admin user calls `PUT /api/v1/resume-templates/{templateId}`
**When** the request is processed
**Then** the template's name, description, and layout definition are updated; `updatedAt` is refreshed; HTTP 200 returned with the updated `TemplateDto`; the Caffeine cache entry for this template is evicted (`@CacheEvict`)

**Given** an admin user calls `DELETE /api/v1/resume-templates/{templateId}`
**When** the request is processed
**Then** the template is removed from the database; HTTP 204 returned; resumes that referenced this template fall back to the default template on next render/export; the cache entry is evicted

**Given** an admin user calls `PATCH /api/v1/resume-templates/{templateId}/publish` or `/unpublish`
**When** the request is processed
**Then** `is_published` is toggled accordingly; the published template becomes immediately visible in the end-user template gallery (cache evicted); the unpublished template is hidden from non-admin users (FR41)

**Given** an admin user is on the admin panel
**When** they navigate to the Templates tab
**Then** `TemplateManager.tsx` is shown; all templates (including unpublished) are listed with columns: Name, Status (Published/Draft), Actions (Edit, Publish/Unpublish, Delete)

**Given** the admin clicks Delete on a template
**When** the delete is triggered
**Then** a shadcn/ui `Dialog` confirmation: "Delete template '[name]'? This cannot be undone."; Cancel is default-focused; on confirm, `DELETE /api/v1/resume-templates/{id}` is called; the row is removed from the list and a "Template deleted" Toast appears (UX-DR18)

**Given** `TemplateService` admin mutations are implemented
**When** unit tests are run
**Then** `TemplateServiceTest.java` adds coverage for create, update, delete, publish, and unpublish (Mockito mocks); cache eviction behavior is verified; `TemplateControllerIntegrationTest.java` adds admin-path tests and confirms non-admin 403 on all mutation endpoints

### Story 6.3: OpenTelemetry Span Propagation Through SSE & Log Correlation

As an operator,
I want all user-initiated operations — including AI SSE streaming paths — to produce distributed traces with correlated log entries,
So that I can link logs to traces and debug the full request lifecycle without relying on the Grafana UI.

**Acceptance Criteria:**

**Given** `spring-boot-starter-opentelemetry` is in `pom.xml`
**When** a user initiates any non-AI operation (login, profile save, resume CRUD, export)
**Then** a complete distributed trace is generated with spans for: HTTP request, service layer, repository layer; each span carries a `traceId` that also appears in the correlated log lines (NFR17, NFR18)

**Given** a user initiates an AI operation (chat, tailor, enhance) that uses `SseEmitter`
**When** the SSE async thread runs
**Then** the OpenTelemetry span context is explicitly propagated via `Context.makeCurrent()` at the `SseEmitter` callback entry point; the async AI inference spans (token generation, patch emission) are children of the originating HTTP request span — not orphaned traces (NFR17, architecture constraint)

**Given** a distributed trace spans the AI SSE path
**When** application logs are inspected
**Then** every log line emitted during the SSE async thread includes the `traceId` and `spanId` correlation fields; log entries from the HTTP thread and the async SSE thread are linkable via the same `traceId` (NFR18)

**Given** an AI operation results in an error (Ollama unavailable, patch parse failure)
**When** the error span is recorded
**Then** the span's status is set to `ERROR` with a descriptive message; the error is visible in any OTel-compatible trace view alongside the originating request span

**Given** the OTel propagation implementation is complete
**When** integration tests run
**Then** `ChatControllerIntegrationTest.java` includes at least one test verifying that a trace ID generated during the HTTP phase is present in the async SSE emission logs (using a test log appender or in-memory span exporter)

### Story 6.4: Grafana Dashboard Provisioning

As an operator,
I want a pre-configured Grafana dashboard provisioned as code in the Docker Compose setup,
So that I can immediately observe request rates, latencies, AI inference durations, and error rates without manual Grafana UI configuration.

**Acceptance Criteria:**

**Given** the Grafana + OTel Collector service is defined in `compose.yaml`
**When** `docker compose up` is run
**Then** the Grafana service starts with the OTel Collector as a data source auto-provisioned; no manual data source setup is required (NFR17)

**Given** the Grafana data source is configured
**When** the Grafana UI is accessed at `http://localhost:3000`
**Then** a pre-configured dashboard is immediately visible showing: request rate per endpoint, p99 latency per endpoint, AI inference duration (SSE stream duration), error rate; traces are searchable by `traceId`

**Given** the dashboard is defined as code
**When** the repository is inspected
**Then** the dashboard is stored as a Grafana JSON provisioning file committed to the repository (e.g. `grafana/provisioning/dashboards/resume-enhancer.json`); it is mounted into the Grafana container via `compose.yaml` volume — no manual UI setup is ever required to reproduce it

**Given** Story 6.3 OTel span propagation is complete and the app is running via `docker compose up`
**When** a sequence of operations is performed (login → create resume → tailor → export)
**Then** all four operation types appear as traces in the Grafana dashboard; AI inference spans are correctly nested under their HTTP request spans

---
