# Project Context Analysis

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
