# Core Architectural Decisions

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
