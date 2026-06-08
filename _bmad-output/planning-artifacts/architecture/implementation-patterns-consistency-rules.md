# Implementation Patterns & Consistency Rules

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
