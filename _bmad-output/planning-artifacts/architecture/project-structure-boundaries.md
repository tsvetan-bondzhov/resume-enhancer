# Project Structure & Boundaries

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
