---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/product-brief-resume-enhancer.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "docs/IdeaDraft.md"
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-05-13'
project_name: 'resume-enhancer'
user_name: 'Tsvetan'
date: '2026-05-13'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

42 FRs across 8 capability areas, each with direct architectural implications:

| Capability Area | FR Count | Architectural Impact |
|---|---|---|
| User Authentication & Account Management | FR1–4 | JWT filter chain, Spring Security, bcrypt, session invalidation |
| Experience Profile Management | FR5–8 | Structured domain model, PDF/DOCX parsing service (Apache POI + PDFBox) |
| Resume Management | FR9–19 | Rich CRUD with clone/save-as, section show/hide, inline editing, preview rendering |
| Template Management | FR20–23 | Template entity with user-scoped and shared variants; prebuilt vs. custom |
| AI Enhancement & Job Tailoring | FR24–28 | Spring AI ChatClient, prompt engineering layer, structured output (change deltas not free-text) |
| Conversational AI Interface | FR29–34 | SSE endpoint for streaming, chat-as-document-editor pattern, stateful conversation context |
| Export & Document Generation | FR35–37 | PDF/DOCX rendering engine, ATS-compatible layout, shared with preview renderer |
| Administration | FR38–42 | RBAC (USER/ADMIN roles), admin-scoped endpoints returning 403 to non-admins, OpenTelemetry for FR42 |

**Non-Functional Requirements:**

NFRs that directly constrain architectural decisions:

- **Performance (NFR1–5):** Dashboard ≤2s load; AI stream begins ≤3s; preview re-render ≤500ms (client-side); export ≤10s; REST endpoints ≤500ms. Drives: SSE must start flushing immediately (no buffering), client-side reactive preview, async export with progress feedback.
- **Security (NFR6–11):** bcrypt passwords, configurable JWT TTL (default 1h), explicit sign-out invalidation, 401/403 enforcement, RBAC, file MIME+size validation, HTTPS in non-localhost. Drives: JWT blacklist or stateless invalidation strategy decision, Spring Security method-level RBAC.
- **Reliability (NFR12–13):** Graceful degradation when Ollama unavailable; malformed upload handling. Drives: AI service must be fully isolated behind a health-checked abstraction; non-AI feature paths must have zero dependency on it.
- **Testing (NFR14–16):** Unit tests (JUnit + Mockito) for all service-layer logic; integration tests (Testcontainers + live PostgreSQL) for all REST endpoints; parsing validated against real-world samples. Drives: layered architecture with injectable service boundaries; Testcontainers PostgreSQL and Ollama containers in test scope.
- **Observability (NFR17–18):** OpenTelemetry distributed traces on every user-initiated action; trace correlation IDs in logs. Drives: span propagation through async AI inference (SSE is async — context must be explicitly carried).
- **Accessibility (NFR19–20):** WCAG 2.1 AA; programmatic focus management for dialogs and AI responses. Largely satisfied by shadcn/ui Radix primitives; requires discipline on icon-only controls and chat response focus management.

**Scale & Complexity:**

- **Primary domain:** Full-stack web app (React 18 SPA + Spring Boot REST API)
- **Complexity level:** Medium — well-understood patterns throughout, but with three genuinely hard integration points: (1) SSE + structured document mutation from AI, (2) PDF/DOCX parsing variance, (3) OpenTelemetry span propagation across async AI calls
- **Estimated architectural components:** 12 — Auth, Profile, Resume, Template, AI Chat, AI Enhancement, Export, Upload/Parse, Admin, Observability, Document Rendering (shared preview + export), SSE Gateway

### Technical Constraints & Dependencies

**Existing skeleton (pom.xml):**
- Spring Boot **4.0.6**, Java **25** (virtual threads available), Spring AI **2.0.0-M6** (milestone — Ollama starter present)
- Flyway migrations, Spring Data JPA, PostgreSQL driver, Lombok, OpenTelemetry starter
- `spring-boot-docker-compose` for dev-time service auto-wiring
- Testcontainers for PostgreSQL, Ollama, Grafana (test scope)

**Missing dependencies to add:**
- `spring-boot-starter-security` + JWT library (e.g. `jjwt` or `spring-security-oauth2-resource-server`)
- `spring-boot-starter-web` (for SSE via `SseEmitter` or `Flux`) — verify if `spring-boot-starter-webmvc` covers this
- Apache POI (`poi-ooxml`) for DOCX parsing/export
- PDFBox (`pdfbox`) for PDF parsing
- iText or Flying Saucer for PDF export generation (separate from parsing)
- React frontend dependencies managed separately via Vite/npm

**External runtime services (Docker Compose):**
- PostgreSQL (primary data store)
- Ollama (local LLM inference — graceful degradation required)
- Grafana + OpenTelemetry Collector (observability)

**Spring AI constraint:** Version 2.0.0-M6 is a milestone release. API surface may still change. Pin all Spring AI dependency versions explicitly; avoid auto-upgrades. Validate the ChatClient streaming API and structured output support against this specific version early.

### Cross-Cutting Concerns Identified

1. **AI Availability Guard** — Every AI code path must check Ollama health before invoking. Non-AI paths (profile CRUD, resume CRUD, export, auth) must have zero runtime dependency on the AI service. Implemented as a service-layer health check + feature flag pattern, not scattered null checks.

2. **Structured Resume Document Model** — Resumes are typed domain objects (sections → items → fields), not free-text blobs. The AI reads from and writes back to this structure. Diff highlighting requires the backend to return structured change deltas (which fields changed, old value vs. new value), not a rewritten document string. This model is the single most critical shared abstraction in the system.

3. **SSE + Async Span Propagation** — OpenTelemetry span context does not automatically propagate through async boundaries in Spring. AI inference via SSE is inherently async. Explicit context carrier/propagation code is required at the SSE boundary to satisfy NFR17–18.

4. **JWT Security Filter Chain** — All endpoints except `/auth/signup` and `/auth/login` require a valid JWT. RBAC enforced at method level (`@PreAuthorize`) for admin endpoints. Token invalidation on sign-out requires a decision: stateless (short TTL + client-side deletion) vs. server-side blacklist (Redis or DB).

5. **Export Rendering Pipeline** — PDF and DOCX export share the same template + structured document model as the in-browser preview. A single `DocumentRenderingService` abstraction must serve both; two separate implementations (browser preview renderer vs. server-side export renderer) sharing a common input contract.

6. **File Upload Security** — MIME type validation (not just extension), maximum file size enforcement, and malformed file handling must be applied before any parsing begins. A dedicated upload validation layer before the parsing service.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application: Java/Spring Boot backend (existing skeleton) + React SPA frontend (to be scaffolded).

### Backend

No starter needed. Spring Boot 4.0.6 skeleton already initialized at project root with:
- Spring AI 2.0.0-M6 (Ollama), Flyway, Spring Data JPA, PostgreSQL, Lombok, OpenTelemetry, Testcontainers

**Additions required (not yet in pom.xml):**
- `spring-boot-starter-security`
- `jjwt-api` + `jjwt-impl` + `jjwt-jackson` (io.jsonwebtoken, latest 0.12.x)
- `poi-ooxml` (Apache POI — DOCX parsing/export)
- `pdfbox` (Apache PDFBox — PDF parsing)
- `itext7-core` (iText 7 Community) or OpenPDF for PDF generation/export

### Frontend Starter: shadcn/ui CLI (Vite template)

**Rationale:** Single command scaffolds the exact stack from the PRD and UX spec — Vite + React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui — with path aliases and config pre-wired. Officially maintained by the shadcn/ui team. No manual wiring.

**Initialization Command:**

```bash
# From project root — creates frontend/ subdirectory
npx shadcn@latest init -t vite
# When prompted: project name → "frontend", base color → Zinc (matches UX spec)
```

**Post-init additions:**
```bash
cd frontend
npm install react-router-dom zustand
npx shadcn@latest add button input textarea dialog sheet toast tabs badge
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript strict mode, React 18, Node via Vite dev server
- **Styling Solution:** Tailwind CSS v4 via `@tailwindcss/vite` plugin; CSS variable design tokens auto-configured
- **Build Tooling:** Vite with `@vitejs/plugin-react`; production build outputs to `dist/`
- **Component Library:** shadcn/ui on Radix UI primitives — WCAG 2.1 AA keyboard/focus handling built in
- **Code Organization:** `src/components/ui/` for shadcn components; custom components alongside using same token layer
- **Path Aliases:** `@/` → `src/` pre-configured in `tsconfig.json` and `vite.config.ts`
- **Development Experience:** HMR, TypeScript checking, ESLint pre-configured

**Additional Frontend Decisions (not from starter, decided here):**
- **Routing:** React Router v6 (`react-router-dom`) — client-side SPA routing for `/`, `/resumes/:id`, `/profile`, `/admin`
- **State Management:** Zustand — lightweight, no boilerplate, sufficient for resume/chat/profile state at this scale
- **SSE Client:** Native browser `EventSource` API — no library needed for one-directional server→client streaming
- **API Client:** Native `fetch` with a thin typed wrapper — no Axios needed; keep bundle lean

**Note:** Project initialization using this command should be one of the first implementation stories (frontend setup epic).

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- JWT invalidation strategy: stateless + 1h TTL, client-side deletion on sign-out
- Resume document storage model: JSONB for resume content, normalized tables for profile data
- JWT library: jjwt 0.12.x (`jjwt-api`, `jjwt-impl`, `jjwt-jackson`)
- SSE implementation: `SseEmitter` (servlet stack — matches `spring-boot-starter-webmvc`)
- AI chat memory: in-memory per-session via Spring AI `MessageWindowChatMemory`

**Important Decisions (Shape Architecture):**
- RBAC: Spring Security `@PreAuthorize` at method level + role claims in JWT (`USER`, `ADMIN`)
- API versioning: `/api/v1/**` base path, JSON REST, standard HTTP status codes
- API documentation: Springdoc OpenAPI `springdoc-openapi-starter-webmvc-ui` 3.0.3 — Swagger UI at `/swagger-ui.html`, spec at `/v3/api-docs`
- Caching: Caffeine in-memory cache for template reads only (no Redis in v1)
- File upload: Spring MVC `MultipartFile`, MIME type + size validation layer before parser
- Frontend dev proxy: Vite `server.proxy` forwards `/api/**` → `http://localhost:8080`
- Production build: maven-frontend-plugin builds `frontend/dist/` into `src/main/resources/static/`; single deployable JAR

**Deferred Decisions (Post-v1):**
- JWT blacklist / server-side invalidation (requires Redis, target v2)
- Multi-provider AI switching (OpenAI/Anthropic — Spring AI abstraction already enables this)
- CI/CD pipeline (out of scope for portfolio self-hosted demo)

### Data Architecture

**Database:** PostgreSQL 16 via Spring Data JPA + Flyway migrations.

**Resume Content Storage (Decision: JSONB):**
Resume content stored as a `JSONB` column (`resume_content`) on the `resumes` table. The Java domain model is a typed record hierarchy (`ResumeDocument` → `ResumeSection[]` → `ResumeItem[]` → fields). JPA maps this via a JSON converter. Rationale: the AI reads and writes the entire document as a unit; content structure varies by template; no SQL-level querying of resume fields is required. The JSONB approach eliminates migration cost on structural changes and aligns with how Spring AI consumes and produces structured output.

**Profile Data Storage (Decision: Normalized):**
Experience profile stored in normalized relational tables (`profile_work_experiences`, `profile_education`, `profile_skills`). Rationale: profile fields are edited individually, queried by field, and serve as the source of truth the AI reads to build resume content. Relational structure here is appropriate.

**Caching:** Spring `@Cacheable` with Caffeine in-memory provider on template read operations. No distributed cache needed at this scale.

**Migrations:** Flyway `src/main/resources/db/migration/V*.sql` — sequential versioned scripts. All schema changes go through Flyway; no manual DDL.

### Authentication & Security

**JWT Library:** `io.jsonwebtoken:jjwt-api:0.12.x` + `jjwt-impl` + `jjwt-jackson`. Explicit and demonstrable in a portfolio context; full control over token construction and validation.

**JWT Strategy:** Stateless. Access token TTL: 1 hour (configurable via `app.jwt.expiration-ms`). Sign-out: client deletes token; no server-side blacklist in v1. Tokens signed with HMAC-SHA256 using a configured secret.

**RBAC:** Spring Security `@PreAuthorize("hasRole('ADMIN')")` on admin controller methods. Roles stored in `users.role` enum column (`USER`, `ADMIN`), included as a claim in the JWT. `SecurityContextHolder` populated by a `JwtAuthenticationFilter` in the filter chain.

**Security exclusions (permit-all):**
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /swagger-ui/**` and `GET /v3/api-docs/**` (dev profile only; disabled via `springdoc.api-docs.enabled=false` in prod)

**File Upload Security:** MIME type validation (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) checked before parsing. Max size: 10MB (`spring.servlet.multipart.max-file-size=10MB`). Malformed files caught and returned as 422 with a descriptive message (NFR13).

### API & Communication Patterns

**REST API:** Base path `/api/v1/**`. JSON request/response bodies. Standard HTTP semantics (200/201/204/400/401/403/404/422/500).

**API Documentation:** Springdoc OpenAPI `springdoc-openapi-starter-webmvc-ui` **3.0.3** (Spring Boot 4.x compatible).
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI spec (JSON): `http://localhost:8080/v3/api-docs`
- OpenAPI spec (YAML): `http://localhost:8080/v3/api-docs.yaml`
- Disabled in production via Spring profile property.

**SSE Streaming:** Spring MVC `SseEmitter` on AI chat and tailoring endpoints. Emitter created per request, passed to the Spring AI `ChatClient` stream callback. SSE events carry either chat text tokens or structured `DocumentPatchEvent` payloads (for live resume mutations). OpenTelemetry span context explicitly propagated into the async emitter thread.

**AI Chat Context:** Spring AI `MessageWindowChatMemory` (in-memory, windowed to last N messages) scoped per HTTP session/conversation ID. Chat history is ephemeral; document state persisted in PostgreSQL is the durable record.

**Error Handling:** Global `@ControllerAdvice` `GlobalExceptionHandler` maps exceptions to RFC 7807 Problem Detail responses. Ollama unavailability maps to a 503 with a user-friendly message (NFR12).

### Frontend Architecture

**Stack (from starter + decisions):** React 18 + TypeScript strict + Vite + Tailwind CSS v4 + shadcn/ui (Radix UI) + React Router v6 + Zustand.

**Routing:** All routes require authentication (redirect to `/login` if no token). Route structure:
- `/login`, `/signup` — public
- `/` — dashboard (resume gallery)
- `/resumes/:id` — resume editor (three-column: sidebar + canvas + chat)
- `/profile` — experience profile
- `/admin` — admin panel (lazy-loaded, role-gated)

**State Management:** Zustand stores per domain: `useAuthStore` (JWT token, user), `useResumeStore` (current resume, sections, diff state), `useChatStore` (messages, streaming state), `useProfileStore` (profile data).

**SSE Client:** Native `EventSource` API. SSE connection opened on chat submit, closed on completion event. Document patch events parsed and applied to `useResumeStore` reactively.

**API Client:** Thin typed `apiClient` wrapper around `fetch` — injects `Authorization: Bearer <token>` header, handles 401 redirect to login, returns typed response or throws typed error.

**Bundle Optimization:** Admin panel route lazy-loaded via React `lazy()` + `Suspense`. shadcn/ui components installed on-demand (not bulk-imported).

**Dev Proxy:** `vite.config.ts` `server.proxy`: `{ '/api': 'http://localhost:8080' }` — eliminates CORS during development.

### Infrastructure & Deployment

**Docker Compose Services (4):**
- `app` — Spring Boot JAR (includes built frontend static assets)
- `postgres` — PostgreSQL 16
- `ollama` — Ollama local LLM inference
- `grafana` — Grafana + OpenTelemetry Collector

**Production Build:** `frontend-maven-plugin` (or equivalent) runs `npm install` + `npm run build` during `mvn package`, copying `frontend/dist/` to `src/main/resources/static/`. Spring Boot serves the SPA; all non-`/api/**` requests return `index.html` (SPA fallback via `WebMvcConfigurer`).

**CI/CD:** Out of scope for v1. Project runs via `docker compose up`.

### Decision Impact Analysis

**Implementation Sequence (dependency order):**
1. Backend: Auth (JWT filter chain, User entity, login/signup endpoints) — all other features depend on this
2. Backend: Profile CRUD (normalized tables, Flyway migrations) — AI and resume features depend on profile data
3. Backend: Resume CRUD + JSONB model — foundation for AI and export
4. Backend: Template management — needed before resume generation
5. Backend: File upload + parsing (Apache POI + PDFBox) — can parallel-track with resume CRUD
6. Backend: Spring AI integration + SSE (spike first per PRD risk mitigation)
7. Backend: Export rendering (iText / OpenPDF for PDF; Apache POI for DOCX)
8. Backend: Admin endpoints
9. Backend: OpenTelemetry span propagation through AI SSE path
10. Frontend: Scaffold + auth screens
11. Frontend: Dashboard + resume editor (three-column layout)
12. Frontend: Chat panel + SSE client + document patch application
13. Frontend: Admin panel (lazy-loaded)

**Cross-Component Dependencies:**
- `ResumeDocument` JSONB model is shared between Resume CRUD, AI service, and Export — must be defined first and kept stable
- JWT filter chain must exist before any protected endpoint is testable
- Spring AI `ChatClient` + `SseEmitter` integration must be spiked before building the full chat UX
- Vite dev proxy depends on Spring Boot running on port 8080 (default; document this in README)

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

8 areas where AI agents could make different choices without explicit rules: naming conventions (DB, API, code), response envelope format, error response shape, date serialization, SSE event structure, state mutation approach, loading state granularity, test file location.

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural — `users`, `resumes`, `resume_templates`, `profile_work_experiences`
- Columns: `snake_case` — `created_at`, `user_id`, `resume_content`
- Foreign keys: `<referenced_table_singular>_id` — `user_id`, `template_id`
- Indexes: `idx_<table>_<column(s)>` — `idx_resumes_user_id`, `idx_users_email`
- Flyway scripts: `V<N>__<description_snake_case>.sql` — `V1__create_users_table.sql`

**API Naming Conventions:**
- Endpoints: `kebab-case` plural nouns — `/api/v1/resumes`, `/api/v1/resume-templates`
- Path parameters: `camelCase` in `@PathVariable`, `{id}` style — `/api/v1/resumes/{resumeId}`
- Query parameters: `camelCase` — `?templateId=`, `?userId=`
- Request/response JSON fields: `camelCase` — `{ "resumeId": ..., "createdAt": ... }`

**Java Code Naming:**
- Packages: `com.tsvetanbondzhov.resumeenhancer.<domain>.<layer>` — e.g. `resume.service`, `auth.controller`
- Classes: `PascalCase` with layer suffix — `ResumeService`, `ResumeController`, `ResumeRepository`, `ResumeDto`
- Methods: `camelCase` verbs — `getResumeById()`, `tailorResumeToJob()`
- Constants: `UPPER_SNAKE_CASE`

**TypeScript/React Naming:**
- Components: `PascalCase` — `ResumeEditor`, `ChatPanel`, `TemplatePicker`
- Component files: `PascalCase.tsx`; utility/store/hook files: `camelCase.ts`
- Zustand stores: `use<Domain>Store` — `useResumeStore`, `useChatStore`, `useAuthStore`
- Custom hooks: `use<Purpose>` — `useStreamingChat`, `useResumeEditor`
- API types: suffix `Dto`, `Request`, or `Response` — `ResumeDto`, `TailorRequest`

### Structure Patterns

**Backend Package Structure:**
```
com.tsvetanbondzhov.resumeenhancer
  ├── auth/           (JwtFilter, SecurityConfig, AuthController, AuthService, TokenService)
  ├── profile/        (ProfileController, ProfileService, ProfileRepository, domain records)
  ├── resume/         (ResumeController, ResumeService, ResumeRepository, ResumeDocument model)
  ├── template/       (TemplateController, TemplateService, TemplateRepository)
  ├── ai/             (ChatController, AiService, DocumentPatchService, prompts/)
  ├── export/         (ExportController, ExportService, renderers/)
  ├── upload/         (UploadController, ParsingService, validators/)
  ├── admin/          (AdminController, AdminService)
  ├── common/         (GlobalExceptionHandler, ApiResponse, BaseEntity)
  └── config/         (SecurityConfig, CacheConfig, OpenTelemetryConfig, SpringDocConfig)
```

**Frontend Directory Structure:**
```
frontend/src/
  ├── components/
  │   ├── ui/           (shadcn/ui copied components — do not manually edit)
  │   ├── layout/       (AppShell, Sidebar, EditorLayout, ThreeColumnLayout)
  │   ├── resume/       (ResumeCanvas, ResumeSection, DiffHighlight, SectionToggle)
  │   ├── chat/         (ChatPanel, ChatMessage, StreamingIndicator)
  │   ├── profile/      (ProfileForm, ExperienceSection, EducationSection)
  │   └── admin/        (UserTable, TemplateManager)
  ├── pages/            (DashboardPage, EditorPage, ProfilePage, AdminPage, LoginPage)
  ├── stores/           (useAuthStore.ts, useResumeStore.ts, useChatStore.ts, useProfileStore.ts)
  ├── hooks/            (useStreamingChat.ts, useResumeEditor.ts, useApi.ts)
  ├── lib/              (apiClient.ts, sseClient.ts, utils.ts)
  ├── types/            (api.ts — all DTO interfaces mirroring backend response shapes)
  └── router/           (index.tsx — React Router config + ProtectedRoute component)
```

**Test File Location:**
- Backend unit tests: `src/test/java/...` mirroring main package structure; named `<Class>Test.java`
- Backend integration tests: same location; named `<Controller>IntegrationTest.java`; annotated `@SpringBootTest`
- Frontend tests: co-located as `<Component>.test.tsx` / `<hook>.test.ts` alongside source files

### Format Patterns

**API Success Response:** Direct DTO body — no wrapper envelope. Jackson serializes the DTO directly.
```json
{ "id": "uuid", "name": "Backend Engineer - May 2026", "createdAt": "2026-05-13T10:00:00Z" }
```

**API Error Response:** RFC 7807 `ProblemDetail` (Spring Boot 4 native):
```json
{ "type": "about:blank", "title": "Not Found", "status": 404, "detail": "Resume 'abc' not found", "instance": "/api/v1/resumes/abc" }
```

**Date/Time Format:** ISO 8601 UTC strings everywhere — `"2026-05-13T10:00:00Z"`. Never epoch timestamps. Java: `Instant` serialized via Jackson. TypeScript: `string` typed, parsed with `new Date()` only at display time.

**SSE Event Structure:**
```
event: token
data: {"token": "word"}

event: patch
data: {"sectionId": "experience-0", "itemIndex": 0, "field": "description", "newValue": "Led..."}

event: done
data: {"summary": "4 sections updated, 2 skills reordered"}

event: error
data: {"detail": "AI features are temporarily unavailable"}
```

### Communication Patterns

**Zustand State Updates:** Always immutable — `set(state => ({ ...state, field: newValue }))`. Never mutate state objects directly.

**SSE Client Pattern:** `EventSource` opened inside `useStreamingChat` hook's `useEffect`. Cleanup (`.close()`) on effect cleanup. Token events dispatched to `useChatStore`; patch events dispatched to `useResumeStore`.

**Loading State Naming:** Per-operation boolean flags — `isTailoring`, `isEnhancing`, `isSaving`, `isExporting`. Never a single global `isLoading` flag. Enables granular UI feedback per action.

**Optimistic Updates:** Profile and resume text edits update local Zustand state immediately; backend persist debounced 500ms. On persist failure: revert to last confirmed server state + show Toast error.

### Process Patterns

**Backend Error Handling:**
- Service layer throws typed domain exceptions: `ResumeNotFoundException`, `OllamaUnavailableException`, `FileValidationException`
- `GlobalExceptionHandler` (`@ControllerAdvice`) maps all exceptions to `ProblemDetail`
- Never catch-and-swallow in service or repository layer
- Ollama errors always surface as HTTP 503 with detail `"AI features are temporarily unavailable"`

**Frontend Error Handling:**
- `apiClient` throws typed `ApiError` with `status` and `detail` from `ProblemDetail`
- Errors shown via shadcn/ui `Toast` for non-contextual failures
- AI streaming errors displayed inline in the chat panel (contextual, not toast)
- No bare `console.error` in production paths

**JWT Handling on Frontend:**
- Token stored in Zustand memory only — not `localStorage` or `sessionStorage` (XSS mitigation)
- 401 response from `apiClient` clears `useAuthStore` token + redirects to `/login`
- No silent token refresh in v1 (1h TTL acceptable)

### Enforcement Guidelines

**All AI agents MUST:**
- Use `snake_case` for all database identifiers; `camelCase` for all JSON fields
- Return errors exclusively as `ProblemDetail` — never plain strings or custom envelopes
- Place all Spring Security permit-all exclusions in `SecurityConfig` only
- Use the typed `ResumeDocument` record hierarchy for all resume content reads/writes — never raw JSON strings
- Prefix all backend API routes with `/api/v1/`
- Use `SseEmitter` for all AI streaming — never `@Async` + polling
- Never directly edit files under `frontend/src/components/ui/` (shadcn managed)
- Use existing Zustand stores — never introduce `useState` for cross-component shared data
- Write a `*Test.java` unit test for every new service method
- Never store the JWT in browser storage — Zustand in-memory only

**Anti-Patterns to Avoid:**
- `ResponseEntity<Map<String, Object>>` as API response type (use typed DTOs + ProblemDetail)
- `any` type in TypeScript (strict mode enforced; use generated or hand-written DTO interfaces from `types/api.ts`)
- Direct `fetch()` calls in React components (use `apiClient` from `lib/apiClient.ts`)
- Creating new Zustand stores outside `stores/` directory
- Hardcoded API base URLs in components (use Vite env variable `VITE_API_BASE_URL` via `apiClient`)

## Project Structure & Boundaries

### Complete Project Directory Structure

```
resume-enhancer/                          ← git root (Spring Boot project)
├── pom.xml
├── compose.yaml                          ← Docker Compose: app, postgres, ollama, grafana
├── .env.example
├── README.md
├── mvnw / mvnw.cmd
│
├── src/
│   ├── main/
│   │   ├── java/com/tsvetanbondzhov/resumeenhancer/
│   │   │   ├── ResumeEnhancerApplication.java
│   │   │   ├── auth/
│   │   │   │   ├── AuthController.java          ← POST /api/v1/auth/login, /signup
│   │   │   │   ├── AuthService.java
│   │   │   │   ├── TokenService.java             ← JWT mint/validate (jjwt)
│   │   │   │   ├── JwtAuthenticationFilter.java  ← OncePerRequestFilter
│   │   │   │   ├── dto/
│   │   │   │   │   ├── LoginRequest.java
│   │   │   │   │   ├── SignupRequest.java
│   │   │   │   │   └── AuthResponse.java
│   │   │   │   └── domain/
│   │   │   │       └── User.java                 ← @Entity, role enum USER/ADMIN
│   │   │   ├── profile/
│   │   │   │   ├── ProfileController.java        ← GET/PUT /api/v1/profile
│   │   │   │   ├── ProfileService.java
│   │   │   │   ├── domain/
│   │   │   │   │   ├── Profile.java              ← @Entity (1:1 with User)
│   │   │   │   │   ├── WorkExperience.java       ← @Entity
│   │   │   │   │   ├── Education.java            ← @Entity
│   │   │   │   │   └── Skill.java                ← @Entity
│   │   │   │   ├── repository/
│   │   │   │   │   └── ProfileRepository.java
│   │   │   │   └── dto/
│   │   │   │       ├── ProfileDto.java
│   │   │   │       └── ProfileUpdateRequest.java
│   │   │   ├── resume/
│   │   │   │   ├── ResumeController.java         ← CRUD /api/v1/resumes
│   │   │   │   ├── ResumeService.java
│   │   │   │   ├── ResumeRepository.java
│   │   │   │   ├── domain/
│   │   │   │   │   ├── Resume.java               ← @Entity (resume_content JSONB)
│   │   │   │   │   ├── ResumeDocument.java       ← typed record: root of content model
│   │   │   │   │   ├── ResumeSection.java        ← record: section with items
│   │   │   │   │   ├── ResumeItem.java           ← record: bullet/entry
│   │   │   │   │   └── ResumeDocumentConverter.java ← JPA @Converter (JSONB ↔ record)
│   │   │   │   └── dto/
│   │   │   │       ├── ResumeDto.java
│   │   │   │       ├── CreateResumeRequest.java
│   │   │   │       └── SaveAsRequest.java
│   │   │   ├── template/
│   │   │   │   ├── TemplateController.java       ← /api/v1/resume-templates
│   │   │   │   ├── TemplateService.java
│   │   │   │   ├── TemplateRepository.java
│   │   │   │   ├── domain/
│   │   │   │   │   └── ResumeTemplate.java       ← @Entity (prebuilt flag, owner)
│   │   │   │   └── dto/
│   │   │   │       ├── TemplateDto.java
│   │   │   │       └── TemplateRequest.java
│   │   │   ├── ai/
│   │   │   │   ├── ChatController.java           ← POST /api/v1/ai/chat (SSE)
│   │   │   │   ├── TailorController.java         ← POST /api/v1/ai/tailor (SSE)
│   │   │   │   ├── EnhanceController.java        ← POST /api/v1/ai/enhance (SSE)
│   │   │   │   ├── AiService.java                ← Spring AI ChatClient wrapper
│   │   │   │   ├── DocumentPatchService.java     ← applies DocumentPatchEvent to ResumeDocument
│   │   │   │   ├── OllamaHealthGuard.java        ← checks Ollama availability before AI calls
│   │   │   │   ├── dto/
│   │   │   │   │   ├── ChatRequest.java
│   │   │   │   │   ├── TailorRequest.java
│   │   │   │   │   └── DocumentPatchEvent.java   ← SSE patch payload record
│   │   │   │   └── prompts/
│   │   │   │       ├── tailor-system.st          ← StringTemplate prompt files
│   │   │   │       ├── enhance-system.st
│   │   │   │       └── chat-system.st
│   │   │   ├── export/
│   │   │   │   ├── ExportController.java         ← GET /api/v1/resumes/{id}/export?format=pdf|docx
│   │   │   │   ├── ExportService.java
│   │   │   │   ├── DocumentRenderer.java         ← interface: render(ResumeDocument, Template) → byte[]
│   │   │   │   └── renderers/
│   │   │   │       ├── PdfRenderer.java          ← iText 7 / OpenPDF
│   │   │   │       └── DocxRenderer.java         ← Apache POI
│   │   │   ├── upload/
│   │   │   │   ├── UploadController.java         ← POST /api/v1/upload
│   │   │   │   ├── ParsingService.java
│   │   │   │   ├── validators/
│   │   │   │   │   └── FileValidator.java        ← MIME + size checks
│   │   │   │   └── parsers/
│   │   │   │       ├── PdfParser.java            ← PDFBox
│   │   │   │       └── DocxParser.java           ← Apache POI
│   │   │   ├── admin/
│   │   │   │   ├── AdminController.java          ← /api/v1/admin/** (@PreAuthorize ADMIN)
│   │   │   │   └── AdminService.java
│   │   │   ├── common/
│   │   │   │   ├── GlobalExceptionHandler.java   ← @ControllerAdvice → ProblemDetail
│   │   │   │   └── BaseEntity.java               ← id (UUID), createdAt, updatedAt
│   │   │   └── config/
│   │   │       ├── SecurityConfig.java           ← filter chain, permit-all, RBAC
│   │   │       ├── CacheConfig.java              ← Caffeine bean
│   │   │       ├── SpringDocConfig.java          ← Springdoc bean, JWT SecurityScheme
│   │   │       ├── JacksonConfig.java            ← Instant → ISO 8601, camelCase
│   │   │       └── WebMvcConfig.java             ← SPA fallback (non-/api/** → index.html)
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml           ← Swagger enabled
│   │       ├── application-prod.yml          ← Swagger disabled
│   │       ├── db/migration/
│   │       │   ├── V1__create_users_table.sql
│   │       │   ├── V2__create_profiles_tables.sql
│   │       │   ├── V3__create_resumes_table.sql
│   │       │   └── V4__create_resume_templates_table.sql
│   │       └── static/                       ← frontend/dist/ copied here by maven-frontend-plugin
│   └── test/
│       └── java/com/tsvetanbondzhov/resumeenhancer/
│           ├── auth/
│           │   ├── AuthServiceTest.java
│           │   └── AuthControllerIntegrationTest.java
│           ├── resume/
│           │   ├── ResumeServiceTest.java
│           │   └── ResumeControllerIntegrationTest.java
│           ├── ai/
│           │   ├── AiServiceTest.java
│           │   ├── DocumentPatchServiceTest.java
│           │   └── ChatControllerIntegrationTest.java
│           ├── upload/
│           │   ├── FileValidatorTest.java
│           │   ├── PdfParserTest.java
│           │   └── DocxParserTest.java
│           ├── export/
│           │   ├── PdfRendererTest.java
│           │   └── DocxRendererTest.java
│           └── testcontainers/
│               └── PostgresTestContainer.java    ← shared Testcontainers config
└── frontend/                                     ← shadcn init -t vite output
    ├── package.json
    ├── vite.config.ts                            ← proxy /api → localhost:8080
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── .env.example                              ← VITE_API_BASE_URL
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── router/
        │   └── index.tsx                         ← React Router config + ProtectedRoute
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── SignupPage.tsx
        │   ├── DashboardPage.tsx                 ← resume card gallery (FR13)
        │   ├── EditorPage.tsx                    ← three-column layout (FR14, FR18, FR29)
        │   ├── ProfilePage.tsx                   ← experience profile (FR5, FR6)
        │   └── AdminPage.tsx                     ← lazy-loaded (FR38–FR41)
        ├── components/
        │   ├── ui/                               ← shadcn managed — do not edit
        │   ├── layout/
        │   │   ├── AppShell.tsx
        │   │   ├── ThreeColumnLayout.tsx
        │   │   └── CollapsibleSidebar.tsx
        │   ├── resume/
        │   │   ├── ResumeCanvas.tsx              ← A4 preview (FR19)
        │   │   ├── ResumeSection.tsx             ← block editing (FR18)
        │   │   ├── SectionToggle.tsx             ← show/hide (FR17)
        │   │   ├── DiffHighlight.tsx             ← AI change overlay
        │   │   └── EditorToolbar.tsx             ← Tailor/Enhance actions (FR24, FR27)
        │   ├── chat/
        │   │   ├── ChatPanel.tsx                 ← persistent chat (FR29)
        │   │   ├── ChatMessage.tsx
        │   │   └── StreamingIndicator.tsx
        │   ├── profile/
        │   │   ├── ProfileForm.tsx
        │   │   ├── ExperienceSection.tsx
        │   │   ├── EducationSection.tsx
        │   │   └── SkillsSection.tsx
        │   ├── template/
        │   │   ├── TemplateGallery.tsx           ← visual browsing (FR20)
        │   │   └── TemplateCard.tsx
        │   └── admin/
        │       ├── UserTable.tsx                 ← (FR38, FR39)
        │       └── TemplateManager.tsx           ← (FR40, FR41)
        ├── stores/
        │   ├── useAuthStore.ts
        │   ├── useResumeStore.ts
        │   ├── useChatStore.ts
        │   └── useProfileStore.ts
        ├── hooks/
        │   ├── useStreamingChat.ts               ← EventSource lifecycle
        │   ├── useResumeEditor.ts                ← debounced autosave
        │   └── useApi.ts
        ├── lib/
        │   ├── apiClient.ts                      ← fetch wrapper, auth header, 401 handler
        │   ├── sseClient.ts                      ← EventSource wrapper
        │   └── utils.ts
        └── types/
            └── api.ts                            ← all DTO interfaces (ResumeDto, ProfileDto, etc.)
```

### Architectural Boundaries

**API Boundary:**
- All backend REST routes under `/api/v1/**` — JWT-protected except auth endpoints
- Swagger UI at `/swagger-ui.html` — permit-all in dev, disabled via profile in prod
- SPA fallback: all unmatched non-`/api/**` requests served `src/main/resources/static/index.html`

**AI Service Boundary:**
- `AiService` is the sole caller of Spring AI `ChatClient` — no other class touches it
- `OllamaHealthGuard` checked at entry of every AI controller method — throws `OllamaUnavailableException` (503) on failure
- `DocumentPatchService` applies `DocumentPatchEvent` objects to `ResumeDocument` — pure domain logic, no AI dependency, fully unit-testable in isolation

**Data Boundary:**
- `ResumeDocument` record hierarchy is the canonical in-memory representation of resume content
- `ResumeDocumentConverter` is the only class that touches raw JSON — all other code works with typed records
- Profile data accessed only via `ProfileRepository` — never queried directly from AI or export layers

**Export Boundary:**
- `DocumentRenderer` interface is the contract: `render(ResumeDocument, ResumeTemplate) → byte[]`
- `PdfRenderer` and `DocxRenderer` implement it independently with no shared state
- `ExportController` streams the result as a file download — no business logic in the controller

**Frontend → Backend Boundary:**
- All HTTP calls via `lib/apiClient.ts` only — no raw `fetch()` in components or pages
- All SSE connections via `lib/sseClient.ts` only — no raw `EventSource` outside this file
- All backend DTO shapes typed in `types/api.ts` — TypeScript strict, no `any`

### Requirements to Structure Mapping

| FR Category | Backend Location | Frontend Location |
|---|---|---|
| Auth (FR1–4) | `auth/` | `pages/Login`, `pages/Signup`, `stores/useAuthStore` |
| Profile (FR5–8) | `profile/` | `pages/ProfilePage`, `components/profile/` |
| Resume CRUD (FR9–19) | `resume/` | `pages/DashboardPage`, `pages/EditorPage`, `components/resume/` |
| Templates (FR20–23) | `template/` | `components/template/` |
| AI Enhancement (FR24–28) | `ai/` (enhance, tailor) | `components/resume/EditorToolbar`, `stores/useResumeStore` |
| Conversational AI (FR29–34) | `ai/` (chat) | `components/chat/`, `stores/useChatStore`, `hooks/useStreamingChat` |
| Export (FR35–37) | `export/` | `EditorToolbar` (download action) |
| Admin (FR38–42) | `admin/` | `pages/AdminPage`, `components/admin/` |
| Upload + Parse (FR7, FR10) | `upload/` | `components/profile/ProfileForm` (upload trigger) |

### Data Flow

```
User action (UI)
  → apiClient.ts (fetch + JWT Bearer header)
  → JwtAuthenticationFilter (Spring Security)
  → @RestController
  → @Service (business logic, typed domain exceptions)
  → @Repository (Spring Data JPA)
  → PostgreSQL

AI action (chat submit / tailor / enhance)
  → sseClient.ts (EventSource open)
  → ChatController / TailorController / EnhanceController (SseEmitter)
  → OllamaHealthGuard (→ 503 OllamaUnavailableException if down)
  → AiService (Spring AI ChatClient → Ollama)
  → DocumentPatchService (stream → DocumentPatchEvent records)
  → SseEmitter.send(patch/token/done event) → browser EventSource
  → useStreamingChat hook dispatches:
      token events → useChatStore
      patch events → useResumeStore.applyPatch()
  → ResumeCanvas re-renders with DiffHighlight
```

### Development Workflow Integration

**Local development:**
- `docker compose up` starts postgres, ollama, grafana
- `./mvnw spring-boot:run` starts Spring Boot (auto-wires Docker Compose services)
- `cd frontend && npm run dev` starts Vite dev server on `:5173` with `/api/**` proxied to `:8080`

**Production build:**
- `mvn package` → `maven-frontend-plugin` builds `frontend/dist/` → copies to `src/main/resources/static/`
- Spring Boot JAR includes all static assets — single deployable artifact
- `docker compose up` with the built image serves the full app on `:8080`

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are mutually compatible. Spring Boot 4.0.6 + Spring AI 2.0.0-M6 + Springdoc OpenAPI 3.0.3 confirmed compatible for Spring Boot 4.x. Java 25 compatible with all declared dependencies. `spring-boot-starter-webmvc` (servlet stack) is consistent with the `SseEmitter` choice — no reactive stack conflict. jjwt 0.12.x is independent of Spring Security version. Caffeine is the default in-memory cache provider for Spring Boot's `@Cacheable`. No version conflicts identified.

**Pattern Consistency:**
- Naming conventions consistent: `snake_case` DB, `camelCase` JSON, `PascalCase` Java/React classes — no collisions
- `SseEmitter` pattern consistent with servlet stack decision
- `ProblemDetail` error format consistent with Spring Boot 4 native support — no custom wrapper needed
- Zustand immutable update pattern consistent with React strict mode
- JWT in-memory only (Zustand) consistent with no `localStorage` anti-pattern rule

**Structure Alignment:**
- Package structure maps directly to FR categories — no orphaned packages
- Frontend component hierarchy matches the UX spec three-column layout
- Test file locations follow mirrored package convention consistently
- `config/` package isolated from domain packages — clean separation

### Requirements Coverage Validation ✅

**Functional Requirements (42 FRs — all covered):**

| Category | FRs | Coverage |
|---|---|---|
| Auth (FR1–4) | 4 | `auth/` package, JWT filter chain, Spring Security, bcrypt |
| Profile (FR5–8) | 4 | `profile/` package, normalized tables, `upload/` for FR7 |
| Resume CRUD (FR9–19) | 11 | `resume/` package, JSONB model, SectionToggle (FR17), ResumeSection (FR18), ResumeCanvas (FR19) |
| Templates (FR20–23) | 4 | `template/` package, prebuilt flag on entity, Caffeine cache for reads |
| AI Enhancement (FR24–28) | 5 | `ai/` package, EnhanceController + TailorController, DocumentPatchEvent for structured output |
| Conversational AI (FR29–34) | 6 | ChatController + SseEmitter, useStreamingChat hook, MessageWindowChatMemory for FR26/FR34 |
| Export (FR35–37) | 3 | `export/` package, DocumentRenderer interface, PDF + DOCX renderers, ATS layout via template |
| Admin (FR38–42) | 5 | `admin/` package, @PreAuthorize ADMIN, FR42 via OpenTelemetry + Grafana |

**Non-Functional Requirements (20 NFRs — all covered):**

| NFR Group | Coverage |
|---|---|
| Performance (NFR1–5) | SSE immediate flush, client-side reactive preview (Zustand), async export with progress, Caffeine cache |
| Security (NFR6–11) | bcrypt, configurable JWT TTL, stateless invalidation, 401/403, RBAC @PreAuthorize, MIME/size validation, HTTPS in prod |
| Reliability (NFR12–13) | OllamaHealthGuard (503 degradation), FileValidator + parser error → 422 |
| Testing (NFR14–16) | *Test.java unit tests for all services, *IntegrationTest.java Testcontainers, real-world sample parsing tests |
| Observability (NFR17–18) | spring-boot-starter-opentelemetry, Grafana in Docker Compose, explicit async span propagation required for SSE |
| Accessibility (NFR19–20) | shadcn/ui Radix primitives (WCAG AA), diff highlight uses color + icon (not color alone), programmatic focus management |

### Implementation Readiness Validation ✅

**Decision Completeness:** All critical decisions documented with specific versions. No ambiguous TBD decisions blocking implementation. Deferred decisions explicitly labelled as post-v1.

**Structure Completeness:** Every file in the project tree named specifically. Every FR maps to a specific file location. All integration boundaries defined.

**Pattern Completeness:** 8 conflict areas identified and resolved. Concrete examples provided for SSE events, ProblemDetail, API response shape, Zustand update pattern. Anti-patterns enumerated.

### Gap Analysis Results

**Critical Gaps:** None.

**Important Gaps (non-blocking, address in first relevant story):**
1. **OpenTelemetry SSE span propagation** — exact mechanism (`Context.makeCurrent()` in the SseEmitter thread) not yet specified. Document in the first AI/chat implementation story.
2. **`ResumeDocument` field schema** — record hierarchy is named but exact field shape not yet defined. First resume CRUD story should define and stabilize this schema.
3. **Ollama model selection** — which model to configure (`llama3`, `mistral`, etc.) is undocumented. Affects prompt engineering. Decide before first AI story.

**Nice-to-Have Gaps:**
- Frontend test tooling: Vitest is the natural pairing with Vite — not yet specified; add to frontend setup story
- Integration test pattern for SSE endpoints (Spring Boot `WebTestClient` approach)

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION** ✅

**Confidence Level:** High

**Key Strengths:**
- All 42 FRs and 20 NFRs map to specific architectural decisions
- `ResumeDocument` JSONB + typed record model cleanly unifies AI, export, and CRUD
- `OllamaHealthGuard` isolates AI availability from non-AI feature paths
- `DocumentRenderer` interface makes PDF/DOCX renderers independently testable and swappable
- Springdoc OpenAPI 3.0.3 added for development/debugging ergonomics
- Spring AI model abstraction already in place for future multi-provider support

**Areas for Future Enhancement:**
- JWT blacklist (Redis) for true sign-out invalidation (v2)
- Multi-provider AI — Spring AI abstraction already enables this
- Vitest frontend test setup (add in frontend scaffold story)
- OTel span propagation pattern for SSE (document in first AI story)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries defined in this document
- Refer to this document for all architectural questions before making independent decisions

**First Implementation Priority:**
1. Add missing `pom.xml` dependencies (Spring Security, jjwt, Apache POI, PDFBox, iText, Springdoc, Caffeine)
2. Scaffold frontend: `npx shadcn@latest init -t vite` in `frontend/` directory
3. Define and stabilize `ResumeDocument` record hierarchy
4. Implement auth (JWT filter chain, login/signup endpoints) — all other stories depend on this

