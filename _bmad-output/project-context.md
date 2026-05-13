---
project_name: 'resume-enhancer'
user_name: 'Tsvetan'
date: '2026-05-13'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 62
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Backend**
- Java 25, Spring Boot 4.0.6, Spring AI 2.0.0-M6 (milestone — pin all Spring AI versions explicitly, no auto-upgrades)
- Spring Data JPA + Flyway, PostgreSQL 16, Lombok
- Spring Security + jjwt 0.12.x (`jjwt-api`, `jjwt-impl`, `jjwt-jackson`)
- Apache POI (`poi-ooxml`) — DOCX parsing/export
- Apache PDFBox (`pdfbox`) — PDF parsing
- iText 7 Community (`itext7-core`) or OpenPDF — PDF export generation
- Springdoc OpenAPI `springdoc-openapi-starter-webmvc-ui` 3.0.3
- Caffeine — in-memory cache provider (Spring `@Cacheable`)
- OpenTelemetry starter (Boot-managed)
- Testcontainers: PostgreSQL, Ollama, Grafana (test scope)
- `spring-boot-starter-webmvc` (servlet stack — NOT reactive/WebFlux)

**Frontend** (scaffolded under `frontend/`)
- React 18, TypeScript strict mode, Vite (`@vitejs/plugin-react`)
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- shadcn/ui (Radix UI primitives) — WCAG 2.1 AA
- React Router v6 (`react-router-dom`)
- Zustand — state management
- Native `EventSource` API — SSE client (no library)
- Native `fetch` via thin `apiClient` wrapper (no Axios)

**Infrastructure**
- Docker Compose: `app`, `postgres` (PG16), `ollama`, `grafana`
- Production: single Spring Boot JAR including `frontend/dist/` static assets

## Critical Implementation Rules

### Language-Specific Rules

**Java**
- Use Java records for all domain value objects and DTOs (`ResumeDocument`, `ResumeSection`, `ResumeItem`, `DocumentPatchEvent`)
- `Instant` for all date/time fields — serialized to ISO 8601 UTC via Jackson (`"2026-05-13T10:00:00Z"`); never epoch timestamps
- Lombok on `@Entity` classes only — records are preferred for immutable domain objects
- Package root: `com.tsvetanbondzhov.resumeenhancer` — all packages are sub-packages of this root
- Service layer throws typed domain exceptions only (`ResumeNotFoundException`, `OllamaUnavailableException`, `FileValidationException`) — never catch-and-swallow
- Constants: `UPPER_SNAKE_CASE`; methods: `camelCase` verbs (`getResumeById()`, `tailorResumeToJob()`)

**TypeScript**
- Strict mode enforced — `any` is forbidden; use typed interfaces from `frontend/src/types/api.ts`
- All backend DTO shapes live in `types/api.ts` — suffix with `Dto`, `Request`, or `Response`
- `string` for all date/time fields received from the API — parse with `new Date()` only at display time, never earlier
- Path alias `@/` → `src/` is pre-configured in both `tsconfig.json` and `vite.config.ts` — always use it
- Component files: `PascalCase.tsx`; utility, store, hook files: `camelCase.ts`

### Framework-Specific Rules

**Spring Boot / Spring Security**
- All security permit-all exclusions defined in `SecurityConfig` only — never in controllers or filters
- `JwtAuthenticationFilter` extends `OncePerRequestFilter` — populates `SecurityContextHolder`
- RBAC via `@PreAuthorize("hasRole('ADMIN')")` at method level — never URL-pattern based for admin endpoints
- `GlobalExceptionHandler` (`@ControllerAdvice`) is the sole place exceptions are mapped to HTTP responses — never return `ResponseEntity<Map<String, Object>>`
- All API routes prefixed `/api/v1/` — no exceptions
- Springdoc/Swagger enabled only in `dev` profile via `springdoc.api-docs.enabled=false` in `application-prod.yml`
- Flyway migrations only in `src/main/resources/db/migration/V*.sql` — no manual DDL ever

**Spring AI (2.0.0-M6 — milestone constraints)**
- `AiService` is the only class that calls Spring AI `ChatClient` — no other class touches it directly
- Always check `OllamaHealthGuard` at the entry of every AI controller method before invoking `AiService`
- Use `SseEmitter` for all AI streaming — never `@Async` + polling
- `MessageWindowChatMemory` scoped per session/conversation ID — chat history is ephemeral
- OpenTelemetry span context must be explicitly propagated into the `SseEmitter` thread (does NOT auto-propagate across async boundary)
- Pin all Spring AI dependency versions explicitly in `pom.xml` — never rely on BOM version resolution for milestone artifacts

**React / Frontend**
- All HTTP calls via `lib/apiClient.ts` only — no raw `fetch()` in components or pages
- All SSE connections via `lib/sseClient.ts` only — no raw `EventSource` outside this file
- Never directly edit files under `frontend/src/components/ui/` — these are shadcn-managed
- Use existing Zustand stores (`useAuthStore`, `useResumeStore`, `useChatStore`, `useProfileStore`) — never introduce `useState` for cross-component shared data
- Zustand state updates always immutable: `set(state => ({ ...state, field: newValue }))` — never mutate state objects directly
- Admin panel (`AdminPage`) must be lazy-loaded via React `lazy()` + `Suspense`
- All routes except `/login` and `/signup` require authentication — redirect to `/login` if no token
- Vite dev proxy: `{ '/api': 'http://localhost:8080' }` — do not hardcode API URLs in components; use `VITE_API_BASE_URL` via `apiClient`

### Testing Rules

**Backend Unit Tests**
- Every new service method requires a `*Test.java` unit test (JUnit 5 + Mockito)
- Unit tests mirror main package structure under `src/test/java/...`; named `<Class>Test.java`
- `DocumentPatchService` and `FileValidator` are pure domain logic — test with no Spring context (`@ExtendWith(MockitoExtension.class)` only)
- Parser tests (`PdfParserTest`, `DocxParserTest`) validated against real-world sample files — not synthetic strings

**Backend Integration Tests**
- Integration tests named `<Controller>IntegrationTest.java`; annotated `@SpringBootTest`
- Use Testcontainers for PostgreSQL and Ollama — shared container config in `testcontainers/PostgresTestContainer.java`
- All REST endpoints must have at least one integration test covering the happy path
- SSE endpoint integration testing: use Spring Boot `WebTestClient` (document approach in first AI story)

**Frontend Tests**
- Co-located alongside source files as `<Component>.test.tsx` / `<hook>.test.ts`
- Use Vitest (natural pairing with Vite) — add to frontend scaffold story
- No frontend test should import from `components/ui/` directly — test behaviour, not shadcn internals

### Code Quality & Style Rules

**Naming Conventions**
- DB: `snake_case` plural tables (`users`, `resumes`, `resume_templates`); `snake_case` columns (`created_at`, `user_id`); FK: `<table_singular>_id`; indexes: `idx_<table>_<column>`
- Flyway scripts: `V<N>__<description_snake_case>.sql` (e.g. `V1__create_users_table.sql`)
- API endpoints: `kebab-case` plural nouns (`/api/v1/resume-templates`); path params: `{camelCase}` (`{resumeId}`); query params: `camelCase`
- JSON fields: `camelCase` everywhere (`resumeId`, `createdAt`)
- Java classes: `PascalCase` with layer suffix (`ResumeService`, `ResumeController`, `ResumeRepository`, `ResumeDto`)
- React components: `PascalCase`; Zustand stores: `use<Domain>Store`; custom hooks: `use<Purpose>`

**Backend Structure**
- Domain packages: `auth`, `profile`, `resume`, `template`, `ai`, `export`, `upload`, `admin`, `common`, `config` — one package per domain, no cross-domain imports except through service interfaces
- `BaseEntity` provides `id` (UUID), `createdAt`, `updatedAt` — all `@Entity` classes extend it
- `config/` package is isolated from domain packages — no domain logic in config classes

**API Response Shape**
- Success: direct DTO body — no wrapper envelope (e.g. `{ "id": "uuid", "name": "..." }`)
- Error: RFC 7807 `ProblemDetail` exclusively — Spring Boot 4 native support, no custom wrapper needed
- Ollama unavailability: always HTTP 503 with `detail: "AI features are temporarily unavailable"`

**Frontend Structure**
- New Zustand stores only in `frontend/src/stores/` — never outside this directory
- New custom hooks only in `frontend/src/hooks/`
- Loading state: per-operation boolean flags (`isTailoring`, `isEnhancing`, `isSaving`, `isExporting`) — never a single global `isLoading`
- Optimistic updates: profile/resume text edits update Zustand immediately; backend persist debounced 500ms; on failure revert + show Toast
- Errors: non-contextual failures → shadcn/ui `Toast`; AI streaming errors → inline in chat panel; no bare `console.error` in production paths

### Development Workflow Rules

**Local Development**
- Start services: `docker compose up` (postgres, ollama, grafana)
- Start backend: `./mvnw spring-boot:run` from project root — auto-wires Docker Compose services
- Start frontend: `cd frontend && npm run dev` — Vite on `:5173`, `/api/**` proxied to `:8080`
- Backend must be running before frontend dev server makes API calls

**Production Build**
- `mvn package` — `maven-frontend-plugin` runs `npm install` + `npm run build`, copies `frontend/dist/` → `src/main/resources/static/`
- Single deployable JAR; Spring Boot serves SPA via `WebMvcConfig` fallback (all non-`/api/**` → `index.html`)
- Full deployment: `docker compose up` with built image on `:8080`

**Database Changes**
- All schema changes via Flyway migration scripts only — naming: `V<N>__<description>.sql`
- Never modify existing migration scripts after they have been applied — always create a new version
- Next available migration version tracked by existing scripts in `src/main/resources/db/migration/` (V1–V4 already defined)

**Dependency Management**
- Spring AI BOM manages Spring AI versions — but explicitly pin all Spring AI artifact versions in properties due to milestone status
- New backend dependencies added to `pom.xml` with explicit version where not Boot-managed
- Frontend dependencies managed via `frontend/package.json` — never install frontend packages from project root

### Critical Don't-Miss Rules

**Security**
- JWT stored in Zustand in-memory only — never `localStorage`, `sessionStorage`, or cookies
- `apiClient` receives a 401 → clears `useAuthStore` token + redirects to `/login` — no silent refresh in v1
- File upload: validate MIME type (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) AND size (≤10MB) in `FileValidator` before any parsing begins
- All `@PreAuthorize` ADMIN checks are on controller methods — if missing, endpoint is effectively public to any authenticated user

**Data Model**
- `ResumeDocument` record hierarchy is the canonical in-memory representation — `ResumeDocumentConverter` is the ONLY class that touches raw JSON; all other code works with typed records
- AI reads from and writes back to the typed `ResumeDocument` structure — the backend returns structured `DocumentPatchEvent` change deltas, never a rewritten document string
- Profile data accessed only via `ProfileRepository` — never queried directly from AI or export layers
- `DocumentRenderer` interface contract: `render(ResumeDocument, ResumeTemplate) → byte[]` — `PdfRenderer` and `DocxRenderer` implement independently with no shared state

**SSE / AI Streaming**
- SSE events have exactly 4 types: `token` (chat text), `patch` (document mutation), `done` (completion summary), `error` (failure detail) — no other event types
- `patch` event payload shape: `{"sectionId": "...", "itemIndex": 0, "field": "...", "newValue": "..."}` — `useStreamingChat` dispatches patch events to `useResumeStore.applyPatch()`, token events to `useChatStore`
- OpenTelemetry context does NOT propagate automatically through `SseEmitter` async thread — explicit `Context.makeCurrent()` required

**Anti-Patterns (forbidden)**
- `ResponseEntity<Map<String, Object>>` as API response type — use typed DTOs + `ProblemDetail`
- `any` type in TypeScript — strict mode, always use interfaces from `types/api.ts`
- Raw `fetch()` calls in React components — use `lib/apiClient.ts`
- Raw `EventSource` outside `lib/sseClient.ts`
- New Zustand stores outside `frontend/src/stores/`
- Hardcoded API base URLs — use `VITE_API_BASE_URL` via `apiClient`
- Editing files under `frontend/src/components/ui/` — shadcn-managed
- Manual DDL — all schema changes via Flyway scripts
- Calling Spring AI `ChatClient` outside `AiService`

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-05-13
