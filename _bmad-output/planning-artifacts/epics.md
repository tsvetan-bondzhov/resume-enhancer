---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories-epic2', 'step-03-create-stories-epic3', 'step-03-create-stories-epic4', 'step-03-create-stories-epic5', 'step-03-create-stories-epic6', 'step-03-create-stories-epic7']
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# resume-enhancer - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for resume-enhancer, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Unregistered users can create a new account with an email address and password
FR2: Registered users can sign in with their email address and password
FR3: Authenticated users can sign out and invalidate their active session
FR4: The system rejects requests made with expired or invalid tokens and requires re-authentication
FR5: Authenticated users can create an experience profile with sections for work experience, education, and skills
FR6: Authenticated users can edit any field of their experience profile at any time
FR7: The system automatically extracts work experience, education, and skills from an uploaded PDF or DOCX resume file and populates the experience profile
FR8: Authenticated users can review and correct auto-extracted profile data before confirming it
FR9: Authenticated users can create a new resume by combining their experience profile with a selected template
FR10: Authenticated users can upload an existing resume in PDF or DOCX format to seed a new resume workflow
FR11: Authenticated users can save a resume with a user-provided name
FR12: Authenticated users can save a modified resume as a new independent copy with a new name
FR13: Authenticated users can view a list of all their saved resumes
FR14: Authenticated users can open any previously saved resume for editing
FR15: Authenticated users can delete a saved resume
FR16: Authenticated users can download a saved resume in PDF or DOCX format
FR17: Authenticated users can show or hide individual sections within a resume without deleting them
FR18: Authenticated users can directly edit the text content of individual resume sections
FR19: Authenticated users can preview a rendered version of their resume within the editor
FR20: Authenticated users can browse a library of prebuilt resume templates
FR21: Authenticated users can select a template to apply to a resume
FR22: Authenticated users can create a custom resume template
FR23: Authenticated users can edit or delete their own custom templates
FR24: Authenticated users can request AI-generated improvement suggestions for their current resume
FR25: Authenticated users can accept or reject individual AI enhancement suggestions
FR26: The AI can ask the user follow-up questions to gather additional context before generating suggestions
FR27: Authenticated users can provide a job description and request the AI to tailor their resume to that role
FR28: The AI rewrites and restructures resume content to align with the language, priorities, and keywords of the provided job description
FR29: Authenticated users can open a persistent chat panel within the resume editor
FR30: Authenticated users can submit natural-language requests to the AI via the chat panel
FR31: The AI interprets chat messages and applies the requested changes directly to the resume document
FR32: The AI provides a brief explanation of what it changed in response to each chat request
FR33: AI chat responses are delivered to the UI progressively as they are generated
FR34: Authenticated users can ask the AI questions about the resume enhancement or tailoring process without triggering document edits
FR35: Authenticated users can export their resume as a PDF document
FR36: Authenticated users can export their resume as a DOCX document
FR37: Exported documents are rendered according to the selected template layout and are ATS-compatible
FR38: Admin users can view a list of all registered user accounts
FR39: Admin users can deactivate a user account without deleting the user's data or resumes
FR40: Admin users can view, create, edit, and delete templates in the shared prebuilt library
FR41: Admin users can publish or unpublish templates to control their availability to end users
FR42: Operators can observe distributed traces for all user-initiated operations via Grafana dashboards

### NonFunctional Requirements

NFR1: The authenticated dashboard page loads within 2 seconds on standard broadband
NFR2: AI chat responses begin streaming to the UI within 3 seconds of request submission under normal Ollama load
NFR3: The resume preview re-renders within 500ms of any in-editor content change (client-side)
NFR4: PDF/DOCX export completes within 10 seconds; the UI displays a progress indicator for any server-side operation exceeding 2 seconds
NFR5: All REST API endpoints (excluding AI inference calls) respond within 500ms under normal single-user load
NFR6: Passwords are stored as bcrypt hashes; plaintext passwords are never persisted or logged at any layer
NFR7: JWT access tokens expire within a configurable TTL (default: 1 hour); tokens are invalidated on explicit sign-out
NFR8: All API endpoints except sign-in and sign-up require a valid JWT token; requests without valid tokens receive a 401 response
NFR9: Admin-only endpoints enforce role-based access control; authenticated non-admin requests to admin endpoints receive a 403 response
NFR10: Uploaded files are validated for MIME type and maximum size before processing; invalid or oversized files are rejected with a descriptive error message
NFR11: All data in transit is encrypted via HTTPS/TLS in any non-localhost deployment
NFR12: The application degrades gracefully when the Ollama service is unavailable — AI features display a clear error state while non-AI features remain fully functional
NFR13: Malformed, corrupted, or unreadable PDF/DOCX uploads do not crash the application; the user receives a clear error and the option to enter profile data manually
NFR14: All service-layer business logic is covered by unit tests implemented with JUnit and Mockito
NFR15: All REST API endpoints are covered by integration tests that run against a live PostgreSQL instance provisioned via Testcontainers
NFR16: PDF/DOCX parsing is validated against a representative set of real-world resume formats in integration tests
NFR17: All user-initiated operations generate distributed traces via OpenTelemetry, accessible and queryable in Grafana
NFR18: Application logs include trace correlation IDs that link log entries to their corresponding distributed trace spans
NFR19: The frontend meets WCAG 2.1 AA: semantic HTML with correct heading hierarchy, full keyboard navigability, sufficient color contrast ratios, and screen reader labels on all icon-only controls and form inputs
NFR20: Focus is managed programmatically when modal dialogs open or close, and when AI suggestions or chat responses appear

### Additional Requirements

- **Backend skeleton already initialized** — Spring Boot 4.0.6, Java 25, Spring AI 2.0.0-M6 skeleton exists at project root; only additions are required, no new backend scaffolding
- **Missing pom.xml dependencies to add (first story):** `spring-boot-starter-security`, `jjwt-api` + `jjwt-impl` + `jjwt-jackson` (0.12.x), `poi-ooxml`, `pdfbox`, `itext7-core` (or OpenPDF), `springdoc-openapi-starter-webmvc-ui` 3.0.3, Caffeine, `frontend-maven-plugin`
- **Frontend scaffold required (first frontend story):** `npx shadcn@latest init -t vite` from project root creating `frontend/` subdirectory; then `npm install react-router-dom zustand`; install shadcn components: button, input, textarea, dialog, sheet, toast, tabs, badge, collapsible, checkbox, skeleton
- **ResumeDocument record hierarchy must be stabilized before AI, export, or CRUD stories begin** — defines the JSONB content model shared across all domains
- **JWT stateless strategy (no Redis blacklist in v1):** 1h TTL, client-side deletion on sign-out; Zustand in-memory only (no localStorage)
- **Flyway migrations V1–V4 already defined** — V1: users, V2: profiles tables, V3: resumes, V4: resume_templates; new stories must start at V5+
- **OllamaHealthGuard must be called at every AI controller entry point** — ensures graceful 503 degradation when Ollama is unavailable
- **OpenTelemetry span context does NOT auto-propagate through SseEmitter async thread** — explicit `Context.makeCurrent()` required; document in first AI story
- **SSE events: exactly 4 types** — `token`, `patch`, `done`, `error`; patch payload shape: `{"sectionId": "...", "itemIndex": 0, "field": "...", "newValue": "..."}`
- **Spring AI constraint:** All Spring AI dependency versions must be pinned explicitly — never rely on BOM resolution for milestone artifacts
- **Ollama model selection** — decide which model (`llama3`, `mistral`, etc.) before the first AI story; affects prompt engineering
- **Vitest frontend test setup** — add during frontend scaffold story (natural Vite pairing)
- **Production build:** `maven-frontend-plugin` runs `npm install` + `npm run build`; copies `frontend/dist/` → `src/main/resources/static/`; Spring Boot serves SPA via `WebMvcConfig` fallback
- **Springdoc/Swagger enabled only in `dev` profile** — disabled in prod via `springdoc.api-docs.enabled=false` in `application-prod.yml`
- **Docker Compose services:** `app`, `postgres` (PG16), `ollama`, `grafana` — update `compose.yaml` as needed during infrastructure story

### UX Design Requirements

UX-DR1: Implement the D1/D6 hybrid layout — D6 dashboard home screen (`/`) as resume card gallery with mini previews, tailored/base badges, "New Resume" CTA; D1 Command Center as the editor (`/resumes/:id`) with three-column layout: collapsible left sidebar (240px expanded / 48px collapsed icon rail), A4 resume canvas center column, chat panel right column (288px)
UX-DR2: Implement `SplitPaneLayout` component — CSS grid three-column container, sidebar collapse/expand via chevron button with `aria-expanded`, collapse state persisted to `localStorage`, keyboard shortcut `[`, 150ms ease-out transition on `grid-template-columns`
UX-DR3: Implement `ResumeCanvas` component — renders `ResumeDocument` record hierarchy as semantic HTML (`<article>`, `<section>`, `<h2>`, `<ul>`), states: `idle`/`streaming`/`diff`/`print-preview`, A4 aspect ratio (1:1.414) with drop shadow, `zinc-100` background behind canvas, ARIA live region on streaming container, fixed width with vertical scroll
UX-DR4: Implement `DiffHighlight` component — wraps AI-changed text in styled `<mark>` elements; states: `visible` (post-AI), `faded` (after first user interaction), `hidden` (cleared); emerald-100/emerald-700 for additions, amber-100/amber-700 for rewrites; always paired with `aria-label="AI addition"/"AI rewrite"` and a small icon (never color-only)
UX-DR5: Implement `ChatPanel` component — `role="log"`, `aria-live="polite"`, `aria-label="AI conversation"`, SSE token-by-token streaming, `StreamingIndicator` (pulsing `bg-blue-400` dot) during inference, states: `idle`/`streaming`/`error`; error state shows "AI is offline — check your Ollama connection" with Retry button; focus trapped to input on panel open
UX-DR6: Implement `AIActionBar` component — persistent "✦ Tailor to Job" and "✦ Enhance" toolbar buttons with `text-blue-600` / `bg-blue-50` tint; clicking pre-fills chat input with prompt template and focuses it, or opens JD modal; `StreamingIndicator` embedded in toolbar during active inference
UX-DR7: Implement `SectionsPanel` component — shadcn/ui `Collapsible` within left sidebar; checkbox list with drag-to-reorder handles using `@dnd-kit/sortable`; keyboard alternative for reorder (arrow keys); changes dispatched live to `ResumeCanvas`; collapsed by default
UX-DR8: Implement `ResumeDashboardCard` component — dashboard card with embedded mini `ResumeCanvas` at reduced scale, Tailored/Base badge, hover card-lift shadow, hover action icons: Open, Export, Duplicate, Delete
UX-DR9: Implement `ResumeSidebarItem` component — sidebar list item with name, template label, date, Tailored/Base badge, hover-revealed action icons: duplicate, delete, export; active state with blue background
UX-DR10: Implement `TemplateGallery` component — visual grid of template thumbnails with hover preview, filter tabs (All / Minimal / Classic / Modern), one-click apply with active selection highlight
UX-DR11: Implement `StreamingIndicator` component — CSS `pulse` animation on `bg-blue-400` dot; `visible`/`hidden` states; disappears when SSE stream closes; `prefers-reduced-motion` disables animation
UX-DR12: Establish design token foundation in Tailwind config — primary accent `blue-600`, neutral palette `zinc/slate`, border radius `md`, typography `Inter` font, `border zinc-200`, muted text `zinc-500`; configure shadcn/ui CSS variable dark mode
UX-DR13: Implement color contrast audit — verify all production color combinations meet WCAG 2.1 AA minimums: `blue-600` on white ≥4.5:1, `zinc-900` on `zinc-50` ≥4.5:1, all button/link states; configure Lighthouse accessibility CI gate ≥90 score
UX-DR14: Implement programmatic focus management for dialogs and AI responses — focus moves to first interactive element on Dialog open; returns to trigger on close; `role="status"` on autosave timestamp; skip link "Skip to resume canvas" (`#resume-canvas`) hidden visually, visible on focus
UX-DR15: Implement empty states — dashboard first-time user: centered illustration + "Your resumes live here" + "Build your profile to get started" CTA; sidebar: "No resumes yet" + New Resume button; skeleton loading: `ResumeCanvas` renders `Skeleton` rectangles during load; 3 skeleton rows in sidebar list
UX-DR16: Implement responsive breakpoints — `<768px` dashboard-only read-only mode with "Open on desktop for full editing" banner; `768–1023px` sidebar collapses to icon rail, chat converts to shadcn/ui `Sheet` bottom drawer; `≥1024px` full three-column; use Tailwind `md:` and `lg:` responsive utilities; `rem` for font sizes, no `px` for layout-critical values
UX-DR17: Implement undo delete pattern — 5-second soft-delete with shadcn/ui `Toast` "Deleted. Undo?" before permanent removal; `bg-red-50` tint for error toasts; `bg-emerald-50` for success toasts; `bg-amber-50` inline callout for warnings
UX-DR18: Implement confirm-before-destroy dialogs — shadcn/ui `Dialog` with explicit confirmation for resume delete, resume revert, and template delete; Cancel button is default-focused (right-positioned) in destructive dialogs; Enter key must not trigger destructive action by default
UX-DR19: Implement feedback patterns — success `Toast` (bottom-right, 4s auto-dismiss): "Resume saved", "Download ready", "Changes applied"; AI completion summary as inline chat bubble not toast; linear progress bar in toolbar for PDF export; autosave dot indicator on Save button label when unsaved changes exist
UX-DR20: Implement profile editor multi-step UX — one section at a time: Experience → Education → Skills → Summary; progress indicator at top; each step saves independently; "Add another" pattern for repeating entries; inline field validation on `blur` (errors below field, `text-red-600`)

### FR Coverage Map

FR1:  Epic 1 — User registration
FR2:  Epic 1 — User sign-in
FR3:  Epic 1 — User sign-out
FR4:  Epic 1 — Token validation & 401 enforcement
FR5:  Epic 2 — Create experience profile
FR6:  Epic 2 — Edit experience profile
FR7:  Epic 2 — Auto-extract profile from uploaded PDF/DOCX
FR8:  Epic 2 — Review & correct extracted data
FR9:  Epic 3 — Create resume from profile + template
FR10: Epic 2 — Upload resume to seed workflow (parsing infrastructure)
FR11: Epic 3 — Save resume with name
FR12: Epic 3 — Save-as new independent copy
FR13: Epic 3 — List saved resumes (dashboard)
FR14: Epic 3 — Open resume for editing
FR15: Epic 3 — Delete resume
FR16: Epic 3 — Download resume from library (stub; rendering built in Epic 5)
FR17: Epic 3 — Show/hide resume sections
FR18: Epic 3 — Inline text editing of resume sections
FR19: Epic 3 — Preview resume in editor (ResumeCanvas)
FR20: Epic 3 — Browse prebuilt template library
FR21: Epic 3 — Apply template to resume
FR22: Epic 7 — Create custom resume template (deferred — not a blocker for AI features)
FR23: Epic 7 — Edit/delete custom templates (deferred — not a blocker for AI features)
FR24: Epic 4 — Request AI enhancement suggestions
FR25: Epic 4 — Accept/reject AI suggestions
FR26: Epic 4 — AI follow-up questions for context
FR27: Epic 4 — JD tailoring request
FR28: Epic 4 — AI rewrites resume against JD
FR29: Epic 4 — Open persistent chat panel
FR30: Epic 4 — Submit natural-language requests via chat
FR31: Epic 4 — AI applies changes directly to document
FR32: Epic 4 — AI explains what it changed
FR33: Epic 4 — SSE streaming of AI responses
FR34: Epic 4 — AI Q&A without document edits
FR35: Epic 5 — Export as PDF
FR36: Epic 5 — Export as DOCX
FR37: Epic 5 — ATS-compatible template rendering
FR38: Epic 6 — Admin: view user list
FR39: Epic 6 — Admin: deactivate user
FR40: Epic 6 — Admin: template management (CRUD on prebuilt library)
FR41: Epic 6 — Admin: publish/unpublish templates
FR42: Epic 6 — OpenTelemetry distributed tracing + Grafana dashboards

## Epic List

### Epic 1: Foundation — Project Infrastructure & Authentication
Users can register, sign in, sign out, and access a secured application that runs end-to-end via Docker Compose. All project wiring is complete: missing `pom.xml` dependencies added, frontend scaffolded with shadcn/ui + Vite, design token foundation established, routing with protected routes, JWT filter chain, and Spring Security configured.
**FRs covered:** FR1, FR2, FR3, FR4
**UX-DRs covered:** UX-DR12 (design tokens), UX-DR16 (responsive base breakpoints)

### Epic 2: Experience Profile Management
Users can build and maintain their persistent career profile via manual entry or by uploading an existing PDF/DOCX resume for auto-extraction. This is the data foundation that all resume generation and AI tailoring depends on.
**FRs covered:** FR5, FR6, FR7, FR8, FR10
**UX-DRs covered:** UX-DR20 (profile editor multi-step UX), UX-DR15 (empty states)

### Epic 3: Resume Management & Template Selection
Users can create resumes from their profile, browse and apply prebuilt templates, manage their resume library (save, clone, save-as, list, open, delete, download), edit resume content inline, and control section visibility. The complete editing loop is functional without AI. Custom template creation (FR22/FR23) is deferred to Epic 7.
**FRs covered:** FR9, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21
**UX-DRs covered:** UX-DR1 (D1/D6 hybrid layout), UX-DR2 (SplitPaneLayout), UX-DR3 (ResumeCanvas), UX-DR7 (SectionsPanel), UX-DR8 (ResumeDashboardCard), UX-DR9 (ResumeSidebarItem), UX-DR10 (TemplateGallery), UX-DR17 (undo delete), UX-DR18 (confirm dialogs), UX-DR19 (feedback patterns)

### Epic 4: AI Enhancement & Conversational Chat
Users can enhance their resume with AI suggestions (accept/reject), tailor it to a specific job description, and interact with the AI via a persistent chat panel that applies changes directly to the live document in real time via SSE streaming. **The first story in this epic is an isolated AI spike** (Spring AI + Ollama + SseEmitter + frontend EventSource, end-to-end, before any resume integration) to validate the full streaming pipeline early and surface risks before dependent stories are built.
**FRs covered:** FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34
**UX-DRs covered:** UX-DR4 (DiffHighlight), UX-DR5 (ChatPanel), UX-DR6 (AIActionBar), UX-DR11 (StreamingIndicator), UX-DR13 (accessibility audit), UX-DR14 (focus management)

### Epic 5: Export & Document Generation
Users can export their resume as a PDF or DOCX, rendered according to the selected template layout and ATS-compatible, completing within 10 seconds. The `DocumentRenderer` interface, `PdfRenderer` (iText 7), and `DocxRenderer` (Apache POI) are implemented and independently tested. Completes the FR16 export stub from Epic 3.
**FRs covered:** FR35, FR36, FR37
**UX-DRs covered:** UX-DR19 (export progress bar, download toast)

### Epic 6: Administration & Observability
Admins can manage users (view, deactivate) and the prebuilt template library (CRUD, publish/unpublish) via a lazy-loaded admin panel. **FR42 requires dedicated stories** — OpenTelemetry span propagation through the SSE async boundary, Grafana dashboards showing distributed traces for all user-initiated operations, and trace correlation IDs in logs.
**FRs covered:** FR38, FR39, FR40, FR41, FR42

### Epic 7: Custom Template Authoring (Deferred)
Users can create, edit, and delete their own custom resume templates. Deferred from Epic 3 as it is not a prerequisite for AI features and represents the most complex UI work in the template domain (template definition format + editor). Implements FR22 and FR23 with a simplified template definition format as recommended in the architecture.
**FRs covered:** FR22, FR23

---

## Epic 1: Foundation — Project Infrastructure & Authentication

Users can register, sign in, sign out, and access a secured application that runs end-to-end via Docker Compose. All project wiring is complete: missing `pom.xml` dependencies added, frontend scaffolded with shadcn/ui + Vite, design token foundation established, routing with protected routes, JWT filter chain, and Spring Security configured.

### Story 1.1: Project Dependencies & Backend Wiring

As a developer,
I want all required backend dependencies added to `pom.xml` and the Spring Boot application configured to start cleanly with Docker Compose services,
So that subsequent stories have a working, compilable foundation to build on.

**Acceptance Criteria:**

**Given** the project skeleton exists with Spring Boot 4.0.6 and Spring AI 2.0.0-M6
**When** `./mvnw spring-boot:run` is executed with `docker compose up` running
**Then** the application starts without errors and connects to PostgreSQL and Ollama

**Given** the `pom.xml` is updated
**When** the build compiles
**Then** `spring-boot-starter-security`, `jjwt-api/impl/jackson` (0.12.x), `poi-ooxml`, `pdfbox`, `itext7-core`, `springdoc-openapi-starter-webmvc-ui` 3.0.3, Caffeine, and `frontend-maven-plugin` are all present with explicit versions

**Given** Spring AI dependencies are declared
**When** any Spring AI artifact version is checked
**Then** all Spring AI artifact versions are pinned explicitly in `pom.xml` properties — no BOM-only version resolution

**Given** the application starts in the `dev` profile
**When** `/swagger-ui.html` is accessed
**Then** the Swagger UI is accessible; when started in `prod` profile, it returns 404

### Story 1.2: Frontend Scaffold & Design Token Foundation

As a developer,
I want the React/TypeScript frontend scaffolded with shadcn/ui, Vite, Tailwind CSS, and the design token foundation configured,
So that all frontend stories have a consistent visual foundation and component library to build on.

**Acceptance Criteria:**

**Given** `npx shadcn@latest init -t vite` has been run in the `frontend/` directory
**When** `cd frontend && npm run dev` is executed
**Then** the Vite dev server starts on `:5173` and the default app renders without errors

**Given** the frontend scaffold is complete
**When** the Tailwind config is inspected
**Then** the design token foundation is configured: primary accent `blue-600`, neutral palette `zinc/slate`, border radius `md`, `Inter` font family

**Given** shadcn/ui components are installed
**When** the component list is checked
**Then** `button`, `input`, `textarea`, `dialog`, `sheet`, `toast`, `tabs`, `badge`, `collapsible`, `checkbox`, `skeleton` are all present under `frontend/src/components/ui/`

**Given** Zustand and React Router are installed
**When** `frontend/package.json` is inspected
**Then** `react-router-dom` and `zustand` are listed as dependencies

**Given** the Vite config is set up
**When** a request to `/api/**` is made from the dev server
**Then** it is proxied to `http://localhost:8080`

**Given** Vitest is configured
**When** `npm run test` is executed
**Then** the test runner starts and exits cleanly with 0 failures (no tests yet, but the runner is wired)

**Given** the `@/` path alias is configured
**When** a TypeScript file uses `import { x } from '@/components/...'`
**Then** TypeScript and Vite both resolve the alias without errors

### Story 1.3: User Registration

As an unregistered user,
I want to create an account with my email address and password,
So that I can access the Resume Enhancer application.

**Acceptance Criteria:**

**Given** a user submits a valid email and password to `POST /api/v1/auth/signup`
**When** the request is processed
**Then** a new user account is created, the password is stored as a bcrypt hash, and a JWT token is returned in the response body

**Given** a user submits an email that already exists
**When** the signup request is processed
**Then** the system returns HTTP 409 with a `ProblemDetail` body explaining the conflict

**Given** a user submits an invalid email format or a blank password
**When** the signup request is processed
**Then** the system returns HTTP 400 with a `ProblemDetail` body listing the validation errors

**Given** a new user successfully registers via the `/signup` page
**When** registration completes
**Then** the user is redirected to the dashboard and their JWT token is stored in `useAuthStore` (Zustand, not localStorage)

**Given** the signup page is accessed
**When** it renders
**Then** it is accessible at `/signup`, requires no authentication, and has correct form labels and keyboard navigation (NFR19)

### Story 1.4: User Sign-In & Sign-Out

As a registered user,
I want to sign in with my email and password and sign out when I'm done,
So that my account is secure and my session is controlled.

**Acceptance Criteria:**

**Given** a registered user submits valid credentials to `POST /api/v1/auth/login`
**When** the request is processed
**Then** a JWT token is returned; the token has a 1-hour TTL (configurable via `app.jwt.expiration-ms`)

**Given** a user submits incorrect credentials
**When** the login request is processed
**Then** HTTP 401 is returned with a `ProblemDetail` body; no token is issued

**Given** a logged-in user clicks Sign Out
**When** sign-out completes
**Then** the JWT token is cleared from `useAuthStore`, the user is redirected to `/login`, and subsequent API requests using the old token receive HTTP 401

**Given** a request is made to any protected endpoint without a JWT token
**When** the JWT filter processes the request
**Then** HTTP 401 is returned with a `ProblemDetail` body

**Given** a request is made with an expired or malformed JWT
**When** the JWT filter processes the request
**Then** HTTP 401 is returned (NFR4/NFR8 satisfied)

**Given** a signed-in user navigates to `/login` directly
**When** the route is evaluated
**Then** they are redirected to the dashboard (already authenticated)

### Story 1.5: Protected Routes & Application Shell

As an authenticated user,
I want all application routes to require authentication and have a consistent navigation shell,
So that the application is secure and easy to navigate.

**Acceptance Criteria:**

**Given** an unauthenticated user attempts to navigate to any route except `/login` or `/signup`
**When** the router evaluates the route
**Then** the user is redirected to `/login`

**Given** the router configuration is inspected
**When** routes are listed
**Then** `/login` and `/signup` are public; `/`, `/resumes/:id`, `/profile`, and `/admin` are protected by `ProtectedRoute`

**Given** an authenticated user with `USER` role attempts to access `/admin`
**When** the route is evaluated
**Then** they are redirected to the dashboard (role-gated at route level)

**Given** an authenticated user is on any protected page
**When** the page renders
**Then** a consistent `AppShell` navigation is visible with links to Dashboard, Profile, and (if ADMIN) Admin panel

**Given** the application is viewed on a screen narrower than 768px
**When** the layout renders
**Then** the responsive base breakpoints are applied per UX-DR16 (no broken layouts below tablet width)

---

## Epic 2: Experience Profile Management

Users can build and maintain their persistent career profile via manual entry or by uploading an existing PDF/DOCX resume for auto-extraction. This is the data foundation that all resume generation and AI tailoring depends on.

### Story 2.1: Profile Domain Model & CRUD API

As a developer,
I want the profile domain model and CRUD API endpoints implemented,
So that the frontend and all downstream features have a stable, tested API to read and write profile data.

**Acceptance Criteria:**

**Given** the Flyway migration V2 already defines `profiles`, `profile_work_experiences`, `profile_education`, and `profile_skills` tables
**When** the application starts
**Then** all four tables exist with correct columns and foreign key constraints; no new Flyway migrations are needed for the basic schema

**Given** an authenticated user calls `GET /api/v1/profile`
**When** no profile exists yet
**Then** HTTP 200 is returned with an empty-section `ProfileDto` (empty arrays for work, education, skills) — never a 404

**Given** an authenticated user submits a valid `ProfileUpdateRequest` to `PUT /api/v1/profile`
**When** the request is processed
**Then** the profile is persisted to the normalized tables and the updated `ProfileDto` is returned with HTTP 200

**Given** a `PUT /api/v1/profile` request is submitted without a required field (e.g. blank job title)
**When** the request is processed
**Then** HTTP 400 is returned with a `ProblemDetail` body listing the specific validation errors

**Given** any call to `GET` or `PUT /api/v1/profile`
**When** the request is processed
**Then** it is scoped to the authenticated user — a user can never read or write another user's profile

**Given** `ProfileService` is implemented
**When** unit tests are run
**Then** all service-layer methods have corresponding `ProfileServiceTest.java` tests (JUnit 5 + Mockito, no Spring context); a `ProfileControllerIntegrationTest.java` covers happy-path GET and PUT against a Testcontainers PostgreSQL instance

### Story 2.2: Profile Page UI — Manual Entry

As an authenticated user,
I want to build my experience profile by manually entering my work experience, education, and skills,
So that I have a complete career profile to generate resumes from.

**Acceptance Criteria:**

**Given** an authenticated user navigates to `/profile`
**When** the page renders
**Then** `ProfilePage.tsx` is displayed within the `AppShell` layout; the multi-step UX (UX-DR20) is shown: one section at a time with a progress indicator (Experience → Education → Skills → Summary)

**Given** the user is on the Experience step
**When** they click "Add another"
**Then** a new empty work experience entry is appended to the list; each entry has fields for job title, company, start date, end date (or "current"), and description

**Given** the user clicks out of a required field (blur event) leaving it empty
**When** the field loses focus
**Then** an inline validation error appears below the field in `text-red-600`; the step cannot proceed until the error is resolved

**Given** the user completes a step and clicks "Save & Continue"
**When** the save request to `PUT /api/v1/profile` succeeds
**Then** the current step's data is persisted; the UI advances to the next step; a success `Toast` "Profile saved" appears (bottom-right, 4s)

**Given** the user is on the first load with no existing profile
**When** the profile page renders
**Then** the empty-state illustration with "Your profile is empty — start building below" CTA is shown (UX-DR15) before any step content

**Given** all steps are complete and saved
**When** the profile is viewed on subsequent visits
**Then** the existing data is pre-populated in each step's form fields; `useProfileStore` holds the loaded profile state; no direct `useState` is used for cross-step shared data

**Given** the profile form components are implemented
**When** frontend tests are run
**Then** `ProfileForm.test.tsx` verifies that: blur validation fires on empty required fields, "Add another" appends an entry, and saving calls `apiClient` with the correct payload

### Story 2.3: File Upload Infrastructure & Resume Parsing

As a developer,
I want the file upload endpoint, MIME/size validation, and PDF/DOCX parsing services implemented,
So that stories 2.4 and future upload flows have a tested, reusable parsing foundation.

**Acceptance Criteria:**

**Given** a file is submitted to `POST /api/v1/upload`
**When** `FileValidator` processes it before parsing
**Then** it accepts only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` MIME types and rejects files exceeding 10MB — both conditions return HTTP 422 with a `ProblemDetail` body describing the rejection reason

**Given** a valid PDF is submitted to `POST /api/v1/upload`
**When** `PdfParser` processes it via PDFBox
**Then** extracted text sections (work experience, education, skills) are returned as a structured `ParsedResumeDto`; the call completes without error

**Given** a valid DOCX is submitted to `POST /api/v1/upload`
**When** `DocxParser` processes it via Apache POI
**Then** extracted text sections are returned as a structured `ParsedResumeDto`

**Given** a malformed or corrupted PDF/DOCX is submitted
**When** the parser attempts to process it
**Then** `FileValidationException` is thrown; `GlobalExceptionHandler` maps it to HTTP 422 with a descriptive `ProblemDetail`; the application does not crash (NFR13)

**Given** the parsing services are implemented
**When** unit tests are run
**Then** `FileValidatorTest.java` tests both MIME and size rejection paths (no Spring context); `PdfParserTest.java` and `DocxParserTest.java` run against at least two real-world resume sample files each (not synthetic strings) per NFR16

### Story 2.4: Resume Upload to Seed Profile

As an authenticated user,
I want to upload my existing PDF or DOCX resume to auto-populate my profile,
So that I don't have to re-enter my career history manually if I already have a resume.

**Acceptance Criteria:**

**Given** an authenticated user is on `/profile`
**When** they click "Upload existing resume"
**Then** a file picker limited to `.pdf` and `.docx` files is shown; the user can select a file to upload

**Given** a valid PDF or DOCX is selected and submitted
**When** the upload request to `POST /api/v1/upload` completes
**Then** the extracted `ParsedResumeDto` is used to pre-populate the profile form fields (work experience, education, skills sections); the user sees the auto-filled data in the profile editor immediately

**Given** the file exceeds 10MB or has an invalid MIME type
**When** the upload is rejected by the server (HTTP 422)
**Then** a `Toast` error appears: "File rejected — must be a PDF or DOCX under 10MB"; the form is unchanged

**Given** the file is valid but the parser extracts no recognizable content
**When** the parsed result has empty sections
**Then** the empty profile form is shown with a Toast warning "We couldn't extract profile data — please enter your details manually"; the empty state does not break the form

**Given** the user reviews the auto-extracted data
**When** they edit any field
**Then** inline editing works identically to manual entry (Story 2.2); they can correct or add to any auto-filled field before saving

**Given** the user saves the pre-populated profile
**When** `PUT /api/v1/profile` is called
**Then** the reviewed data is persisted; the user proceeds through the multi-step form to confirm each section (UX-DR20)

---

## Epic 3: Resume Management & Template Selection

Users can create resumes from their profile, browse and apply prebuilt templates, manage their resume library (save, clone, save-as, list, open, delete, download), edit resume content inline, and control section visibility. The complete editing loop is functional without AI. Custom template creation (FR22/FR23) is deferred to Epic 7.

### Story 3.1: ResumeDocument Model & Resume CRUD API

As a developer,
I want the `ResumeDocument` typed record hierarchy defined and all resume CRUD endpoints implemented,
So that the frontend and all downstream features (AI, export) share a stable, tested resume content model.

**Acceptance Criteria:**

**Given** the Flyway migration V3 already defines the `resumes` table with a `resume_content` JSONB column
**When** the application starts
**Then** the `resumes` table exists; no new migration is needed for the basic schema

**Given** the `ResumeDocument`, `ResumeSection`, and `ResumeItem` Java records are defined
**When** any service reads or writes resume content
**Then** all code uses these typed records exclusively; `ResumeDocumentConverter` is the only class that deserializes raw JSON; no other class handles raw JSON strings

**Given** an authenticated user calls `POST /api/v1/resumes` with a `CreateResumeRequest` (profileId + templateId)
**When** the request is processed
**Then** a new `Resume` entity is created with content derived from the user's profile, the template is associated, a name is required, and the new `ResumeDto` is returned with HTTP 201

**Given** an authenticated user calls `GET /api/v1/resumes`
**When** the request is processed
**Then** only that user's resumes are returned as a list of `ResumeDto` objects (HTTP 200); no other user's data is included

**Given** an authenticated user calls `GET /api/v1/resumes/{resumeId}`
**When** the resume belongs to another user
**Then** HTTP 403 is returned with a `ProblemDetail` body

**Given** an authenticated user calls `DELETE /api/v1/resumes/{resumeId}`
**When** the request is processed
**Then** the resume is removed from the database and HTTP 204 is returned

**Given** an authenticated user calls `POST /api/v1/resumes/{resumeId}/clone` with a `SaveAsRequest` (new name)
**When** the request is processed
**Then** a new independent resume entity is created with a copy of the original's content and the provided name; HTTP 201 returned with the new `ResumeDto`

**Given** `ResumeService` is implemented
**When** unit tests are run
**Then** `ResumeServiceTest.java` covers create, get, list, delete, and clone with Mockito mocks; `ResumeControllerIntegrationTest.java` covers all happy-path endpoints against Testcontainers PostgreSQL

### Story 3.2: Template Management API & Prebuilt Library

As a developer,
I want the template entity, repository, and API implemented with at least three prebuilt templates seeded,
So that users can browse and apply templates when creating resumes.

**Acceptance Criteria:**

**Given** the Flyway migration V4 already defines the `resume_templates` table
**When** a new migration `V5__seed_prebuilt_templates.sql` is applied
**Then** at least three prebuilt templates (e.g. "Minimal", "Classic", "Modern") are present in the `resume_templates` table with `is_prebuilt = true` and `is_published = true`

**Given** an authenticated user calls `GET /api/v1/resume-templates`
**When** the request is processed
**Then** all published prebuilt templates are returned as a list of `TemplateDto`; unpublished templates are excluded; results are cached via `@Cacheable` (Caffeine)

**Given** an authenticated user calls `GET /api/v1/resume-templates/{templateId}`
**When** the template is published and prebuilt
**Then** HTTP 200 is returned with the full `TemplateDto`

**Given** a non-admin user attempts to call `POST`, `PUT`, or `DELETE` on `/api/v1/resume-templates`
**When** the request is processed
**Then** HTTP 403 is returned; admin-only mutations are enforced via `@PreAuthorize("hasRole('ADMIN')")`

**Given** `TemplateService` is implemented
**When** unit tests are run
**Then** `TemplateServiceTest.java` covers list (cache hit/miss) and get-by-id; a `TemplateControllerIntegrationTest.java` verifies the list endpoint and 403 on unauthenticated mutation

### Story 3.3: Dashboard — Resume Gallery

As an authenticated user,
I want to see all my saved resumes on the dashboard as visual cards,
So that I can quickly open, duplicate, delete, or export any resume from a central view.

**Acceptance Criteria:**

**Given** an authenticated user navigates to `/`
**When** the page renders
**Then** `DashboardPage.tsx` is shown within `AppShell`; all of the user's resumes are fetched from `GET /api/v1/resumes` and displayed as `ResumeDashboardCard` components (UX-DR8)

**Given** the user has no saved resumes
**When** the dashboard renders
**Then** the empty state is shown: centered illustration + "Your resumes live here" + "Build your profile to get started" CTA (UX-DR15)

**Given** the user hovers over a `ResumeDashboardCard`
**When** the hover state activates
**Then** the card lifts with shadow and action icons appear: Open, Export (stub), Duplicate, Delete

**Given** the user clicks Delete on a card
**When** the delete action is triggered
**Then** the resume is soft-deleted client-side; a shadcn/ui `Toast` "Deleted. Undo?" appears for 5 seconds; if the user does not click Undo within 5 seconds, `DELETE /api/v1/resumes/{id}` is called; if Undo is clicked the resume is restored in the UI without any server call (UX-DR17)

**Given** the user clicks Duplicate on a card
**When** the action is triggered
**Then** `POST /api/v1/resumes/{id}/clone` is called with a default name "{original name} (copy)"; the new card appears in the gallery; a "Resume duplicated" Toast is shown

**Given** the user clicks Open on a card
**When** the action is triggered
**Then** the user is navigated to `/resumes/{id}`

**Given** the dashboard loads
**When** the API call is in progress
**Then** three skeleton `ResumeDashboardCard` placeholders are shown (UX-DR15)

### Story 3.4: Resume Editor Layout & ResumeCanvas

As an authenticated user,
I want a three-column editor layout with a live A4 resume preview,
So that I can see my resume rendered in real time as I make changes.

**Acceptance Criteria:**

**Given** an authenticated user navigates to `/resumes/:id`
**When** the page renders
**Then** `EditorPage.tsx` renders the `SplitPaneLayout` (UX-DR2): a collapsible left sidebar (240px expanded / 48px collapsed icon rail), a center `ResumeCanvas` column, and a right chat panel column (288px)

**Given** the editor page loads
**When** `GET /api/v1/resumes/{resumeId}` completes
**Then** `ResumeCanvas` renders the `ResumeDocument` as semantic HTML (`<article>`, `<section>`, `<h2>`, `<ul>`) in `idle` state with A4 aspect ratio (1:1.414), drop shadow, and `zinc-100` background (UX-DR3)

**Given** the left sidebar is expanded
**When** the user clicks the collapse chevron button or presses `[`
**Then** the sidebar collapses to the 48px icon rail with a 150ms ease-out transition on `grid-template-columns`; `aria-expanded` is updated on the trigger; collapse state is persisted to `localStorage` (UX-DR2)

**Given** the resume document is loading
**When** the API call is in progress
**Then** `ResumeCanvas` renders `Skeleton` rectangles at paragraph and heading positions (UX-DR15)

**Given** the editor renders on a viewport between 768–1023px
**When** the layout is evaluated
**Then** the sidebar collapses to the icon rail automatically; the chat panel converts to a shadcn/ui `Sheet` bottom drawer (UX-DR16)

**Given** a user navigates to `/resumes/:id` for a resume they do not own
**When** the API returns HTTP 403
**Then** the user is redirected to the dashboard with a Toast "Access denied"

### Story 3.5: Inline Section Editing & Section Visibility

As an authenticated user,
I want to edit the text content of resume sections directly in the editor and show or hide individual sections,
So that I can refine my resume content and control what appears in the final output.

**Acceptance Criteria:**

**Given** the user clicks on any text field within `ResumeCanvas`
**When** the field enters edit mode
**Then** the field becomes an editable `contenteditable` or `<textarea>`; changes are dispatched to `useResumeStore` immediately (optimistic update); a debounced `PUT /api/v1/resumes/{id}` is triggered 500ms after the last keystroke (UX-DR3 inline editing)

**Given** a debounced save request is in flight
**When** the autosave succeeds
**Then** an autosave dot indicator on the Save button disappears; no explicit user action is needed

**Given** a debounced save request fails
**When** the API returns an error
**Then** the Zustand state is reverted to the last successfully persisted state; a Toast "Save failed — changes reverted" is shown; the state update uses the immutable pattern `set(state => ({ ...state, ... }))`

**Given** the `SectionsPanel` in the left sidebar is visible
**When** the user toggles a section checkbox off
**Then** the section is marked hidden in `useResumeStore`; `ResumeCanvas` removes that section from the rendered view immediately; the change is persisted via the debounced save

**Given** the `SectionsPanel` section list is displayed
**When** the user drags a section to reorder it using `@dnd-kit/sortable`
**Then** the section order is updated in `useResumeStore` and reflected in `ResumeCanvas` immediately; the new order is persisted

**Given** keyboard-only users interact with the sections reorder list
**When** they use arrow keys on a focused section item
**Then** the section moves up or down one position (keyboard alternative per UX-DR7)

**Given** inline editing is implemented
**When** frontend tests are run
**Then** `ResumeSection.test.tsx` verifies that: editing a field updates `useResumeStore`, the debounced save is scheduled (mocked timer), and a failed save reverts state

### Story 3.6: Resume Save, Save-As & Name Management

As an authenticated user,
I want to explicitly save my resume with a name and create independent copies,
So that I can manage multiple versions of my resume without overwriting my work.

**Acceptance Criteria:**

**Given** a new resume has been created via `POST /api/v1/resumes`
**When** the user edits the resume name in the editor toolbar
**Then** a `PUT /api/v1/resumes/{id}` request is triggered to update the name; the new name appears in the sidebar item and browser tab title

**Given** the user clicks "Save As"
**When** a name dialog appears and the user confirms
**Then** `POST /api/v1/resumes/{resumeId}/clone` is called with the new name; the user is navigated to the new resume's editor URL `/resumes/{newId}`; a Toast "Resume saved as '{name}'" is shown

**Given** the user tries to save with a blank name
**When** the save or save-as action is triggered
**Then** a validation error "Name is required" appears inline; the save does not proceed

**Given** `PUT /api/v1/resumes/{id}` is called to update resume content or name
**When** the update is processed
**Then** HTTP 200 is returned with the updated `ResumeDto`; the resume's `updatedAt` timestamp is refreshed

### Story 3.7: Template Gallery & Template Switching

As an authenticated user,
I want to browse the prebuilt template library and apply a template to my resume,
So that I can choose a layout that matches my career goals or personal style.

**Acceptance Criteria:**

**Given** the user opens the `TemplateGallery` from the editor sidebar
**When** the gallery renders
**Then** all published prebuilt templates are fetched from `GET /api/v1/resume-templates` and displayed as thumbnail cards in a visual grid with filter tabs: All / Minimal / Classic / Modern (UX-DR10)

**Given** the user hovers over a template thumbnail
**When** the hover state activates
**Then** a larger preview is shown; the currently applied template has an "Active" highlight

**Given** the user clicks a template thumbnail
**When** the template is applied
**Then** `PUT /api/v1/resumes/{id}` is called with the new `templateId`; `ResumeCanvas` re-renders immediately with the new template layout; a Toast "Template applied" is shown

**Given** the template list is loading
**When** the API call is in progress
**Then** skeleton placeholder cards are shown in the gallery grid

**Given** a template was previously applied to a resume
**When** the user opens the template gallery
**Then** the currently active template is highlighted with the active selection style (UX-DR10)

### Story 3.8: Resume Deletion with Undo & Confirm Dialogs

As an authenticated user,
I want safe deletion patterns with undo and confirmation dialogs,
So that I never accidentally lose work without the ability to recover.

**Acceptance Criteria:**

**Given** the user initiates a resume delete from the dashboard card or sidebar item
**When** the delete action is triggered
**Then** no confirmation dialog is shown; instead, the resume is soft-deleted from the UI immediately and a shadcn/ui Toast "Deleted. Undo?" appears for 5 seconds (UX-DR17)

**Given** the 5-second Undo window is active
**When** the user clicks "Undo" in the Toast
**Then** the resume is restored in the UI and no API delete call is made

**Given** the 5-second Undo window expires
**When** no Undo action was taken
**Then** `DELETE /api/v1/resumes/{id}` is called; on success the item is removed permanently; on API failure a Toast "Failed to delete — your resume has been restored" appears and the item is restored in the UI

**Given** the user triggers a destructive action that is irreversible (resume revert to original)
**When** the action is initiated
**Then** a shadcn/ui `Dialog` confirmation appears with the destructive action and a Cancel button; Cancel button is default-focused; pressing Enter must not trigger the destructive action (UX-DR18)

**Given** the `ResumeSidebarItem` component is implemented
**When** the user hovers over a sidebar item
**Then** action icons for duplicate, delete, and export (stub) appear; the active resume has a blue background highlight (UX-DR9)

---

## Epic 4: AI Enhancement & Conversational Chat

Users can enhance their resume with AI suggestions (accept/reject), tailor it to a specific job description, and interact with the AI via a persistent chat panel that applies changes directly to the live document in real time via SSE streaming. The first story is an isolated AI spike to validate the full streaming pipeline before any resume integration.

### Story 4.1: AI Streaming Spike — Spring AI + Ollama + SSE End-to-End

As a developer,
I want an isolated end-to-end spike that proves Spring AI + Ollama + SseEmitter + frontend EventSource work together,
So that the full streaming pipeline is validated and risks are surfaced before dependent stories are built.

**Acceptance Criteria:**

**Given** Ollama is running via Docker Compose with a model available (e.g. `llama3` or `mistral`)
**When** a POST request is made to `POST /api/v1/ai/chat` with a simple prompt
**Then** the endpoint returns an SSE stream; `token` events arrive progressively; a `done` event closes the stream

**Given** the SSE endpoint is called
**When** `OllamaHealthGuard` is invoked at the controller entry point
**Then** if Ollama is unavailable, the endpoint immediately returns HTTP 503 with `ProblemDetail` detail "AI features are temporarily unavailable" — no Spring AI call is made

**Given** the SSE stream is active
**When** the `SseEmitter` async thread runs
**Then** OpenTelemetry span context is explicitly propagated via `Context.makeCurrent()` into the emitter thread; the trace ID appears in the logs for both the request and the async emission (NFR17, NFR18)

**Given** a minimal frontend test harness page exists at `/ai-test` (dev only)
**When** the user submits a prompt
**Then** a `lib/sseClient.ts` `EventSource` connection is opened; `token` events are appended to a text area in real time; the `done` event closes the connection; `error` events display the error message inline

**Given** the SSE stream receives a `patch` event with a valid `DocumentPatchEvent` JSON payload
**When** the event is dispatched
**Then** `useStreamingChat` hook parses the payload and dispatches it to `useResumeStore.applyPatch()` without error (unit test — no live resume needed for the spike)

**Given** `AiService` is implemented
**When** unit tests are run
**Then** `AiServiceTest.java` mocks `ChatClient` and verifies token and done event emission; the test does not require a live Ollama instance

**Given** the spike is complete
**When** the team reviews it
**Then** the chosen Ollama model, prompt format, and any Spring AI 2.0.0-M6 API constraints are documented in a brief note in `docs/ai-spike-findings.md`

### Story 4.2: DocumentPatchService & useResumeStore.applyPatch

As a developer,
I want the `DocumentPatchService` (backend) and `useResumeStore.applyPatch` (frontend) implemented and fully tested,
So that AI-generated patch events can be applied to a `ResumeDocument` in both layers with confidence.

**Acceptance Criteria:**

**Given** a `DocumentPatchEvent` record with a valid `sectionId`, `itemIndex`, `field`, and `newValue`
**When** `DocumentPatchService.apply(document, patchEvent)` is called
**Then** the correct field within the correct `ResumeSection` and `ResumeItem` is updated; the rest of the `ResumeDocument` is unchanged; the updated document is returned

**Given** a `DocumentPatchEvent` references a non-existent `sectionId`
**When** `DocumentPatchService.apply(document, patchEvent)` is called
**Then** a typed domain exception is thrown (not a silent no-op); `GlobalExceptionHandler` would map this to a 422 in a web context

**Given** `DocumentPatchService` is pure domain logic
**When** unit tests are run
**Then** `DocumentPatchServiceTest.java` uses no Spring context (`@ExtendWith(MockitoExtension.class)` only); all edge cases (invalid sectionId, null field, boundary itemIndex) are covered

**Given** `useResumeStore.applyPatch(event)` is called on the frontend
**When** the patch event is processed
**Then** the state update is immutable (`set(state => ...)`); the correct section/item/field is updated; all other state is preserved

**Given** `useResumeStore.applyPatch` is implemented
**When** frontend tests are run
**Then** `useResumeStore.test.ts` verifies correct patching of a nested field, immutable state update, and no mutation of original state object

### Story 4.3: AI Chat Panel & SSE Streaming Integration

As an authenticated user,
I want a persistent chat panel in the resume editor where I can submit natural-language requests to the AI,
So that I can make conversational edits to my resume without leaving the editor.

**Acceptance Criteria:**

**Given** the user is in the resume editor at `/resumes/:id`
**When** the page renders
**Then** the `ChatPanel` component is visible in the right column (288px); it has `role="log"`, `aria-live="polite"`, and `aria-label="AI conversation"` (UX-DR5)

**Given** the user types a message and submits it
**When** the submit action is triggered
**Then** `POST /api/v1/ai/chat` is called via `lib/sseClient.ts`; a `StreamingIndicator` (pulsing `bg-blue-400` dot) appears in the chat panel (UX-DR11); focus is trapped to the input field while the panel is open (UX-DR14)

**Given** the SSE stream is active
**When** `token` events arrive
**Then** each token is appended to the current AI message bubble in real time; no full re-renders occur for each token

**Given** the SSE stream emits a `patch` event
**When** the event is received by `useStreamingChat`
**Then** the patch is dispatched to `useResumeStore.applyPatch()`; `ResumeCanvas` re-renders the updated section immediately

**Given** the SSE stream emits a `done` event
**When** the stream closes
**Then** the `StreamingIndicator` disappears; the AI's `done` summary is displayed as an inline chat bubble (not a Toast); focus returns to the chat input field

**Given** the SSE stream emits an `error` event or the connection fails
**When** the error state is entered
**Then** `ChatPanel` displays "AI is offline — check your Ollama connection" with a Retry button; the error is shown inline in the panel, not as a Toast (UX-DR5)

**Given** the `ChatPanel` is rendered
**When** `prefers-reduced-motion` is enabled in the OS
**Then** the `StreamingIndicator` pulse animation is disabled (UX-DR11)

**Given** `ChatPanel.test.tsx` is implemented
**When** tests run
**Then** the following are verified: message submission calls `sseClient`, token events append to the message, a done event clears the streaming indicator, and an error event shows the error state inline

### Story 4.4: AI Enhancement — Suggestions with Accept/Reject

As an authenticated user,
I want to request AI-generated improvement suggestions for my resume and accept or reject each one individually,
So that I can improve my resume quality while staying in control of every change.

**Acceptance Criteria:**

**Given** the user clicks "✦ Enhance" in the `AIActionBar`
**When** the action is triggered
**Then** the chat input is pre-filled with the enhance prompt template and focused; or the enhance request is sent directly to `POST /api/v1/ai/enhance` — the interaction follows the pattern established in the AI spike (UX-DR6)

**Given** `POST /api/v1/ai/enhance` is called
**When** the SSE stream begins
**Then** `OllamaHealthGuard` is checked first; if Ollama is unavailable, HTTP 503 is returned immediately with no stream opened

**Given** the SSE stream emits `patch` events
**When** each patch arrives
**Then** the changed text is rendered in `ResumeCanvas` wrapped in `DiffHighlight` `<mark>` elements: additions use `emerald-100/emerald-700`, rewrites use `amber-100/amber-700`; each mark has `aria-label="AI addition"` or `aria-label="AI rewrite"` and a small icon (never color-only) (UX-DR4)

**Given** AI diff highlights are visible in `ResumeCanvas`
**When** the user clicks "Accept" on a highlighted change
**Then** the `DiffHighlight` transitions to `hidden` state; the underlying text change is committed to `useResumeStore` and persisted

**Given** AI diff highlights are visible
**When** the user clicks "Reject" on a highlighted change
**Then** `useResumeStore.applyPatch()` is called with the original value to revert the field; the `DiffHighlight` transitions to `hidden`; the original text is restored in `ResumeCanvas`

**Given** the user interacts with the resume after AI suggestions appear
**When** any user interaction occurs (scroll, click outside)
**Then** all `DiffHighlight` components transition from `visible` to `faded` state (dimmed but still visible)

**Given** `DiffHighlight` is implemented
**When** frontend tests are run
**Then** `DiffHighlight.test.tsx` verifies: visible state renders `<mark>` with correct color classes and aria-label, faded state applies reduced opacity, hidden state removes the mark from the DOM

### Story 4.5: AI Job Description Tailoring

As an authenticated user,
I want to provide a job description and have the AI rewrite my resume to align with that role,
So that I can quickly create targeted versions of my resume for specific job applications.

**Acceptance Criteria:**

**Given** the user clicks "✦ Tailor to Job" in the `AIActionBar`
**When** the action is triggered
**Then** a shadcn/ui `Dialog` opens with a `<textarea>` for pasting the job description; Cancel and "Tailor Resume" buttons are shown (UX-DR6)

**Given** the user submits a non-empty job description
**When** "Tailor Resume" is clicked
**Then** the dialog closes; `POST /api/v1/ai/tailor` is called with `{resumeId, jobDescription}` as `TailorRequest`; an SSE stream begins; `StreamingIndicator` appears in the `AIActionBar` toolbar during active inference (UX-DR6)

**Given** the dialog submit is attempted with an empty job description
**When** "Tailor Resume" is clicked
**Then** an inline validation error "Job description is required" appears; the request is not submitted

**Given** `POST /api/v1/ai/tailor` is called
**When** the SSE stream emits `patch` events
**Then** each patch is applied to `useResumeStore` and rendered in `ResumeCanvas` with `DiffHighlight` overlays; accept/reject follows the same pattern as Story 4.4

**Given** the tailoring stream completes with a `done` event
**When** the stream closes
**Then** the resume gets a "Tailored" badge visible on the `ResumeDashboardCard` and `ResumeSidebarItem`; the `StreamingIndicator` in the toolbar disappears

**Given** Ollama is unavailable when the tailor request is submitted
**When** `OllamaHealthGuard` fails
**Then** HTTP 503 is returned; the dialog shows an inline error "AI features are temporarily unavailable — try again later"; no SSE stream is opened

**Given** `TailorController` and `AiService` are implemented for tailoring
**When** unit tests are run
**Then** `AiServiceTest.java` covers the tailor prompt invocation with a mock `ChatClient`; an integration test verifies the 503 response when Ollama is unavailable (mock `OllamaHealthGuard`)

### Story 4.6: AI Q&A Chat (Without Document Edits)

As an authenticated user,
I want to ask the AI questions about resume writing or the tailoring process without triggering document edits,
So that I can get guidance and context while keeping my document unchanged.

**Acceptance Criteria:**

**Given** the user submits a question in the `ChatPanel` (e.g. "What makes a good summary section?")
**When** the AI processes the message
**Then** the response is delivered as `token` events only — no `patch` events are emitted; `ResumeCanvas` is not modified

**Given** the AI response contains only `token` events
**When** the `done` event arrives
**Then** the full response is displayed in the `ChatPanel` as a chat bubble; the `done` summary is shown inline; `useResumeStore` state is unchanged

**Given** the user asks a follow-up question in the same session
**When** the follow-up is submitted
**Then** `MessageWindowChatMemory` (scoped per conversation/session ID) includes prior messages in the context window; the AI's response references the prior conversation

**Given** the user starts a new editor session (new page load)
**When** a chat message is submitted
**Then** the chat history is ephemeral — no prior session messages are included in the new session's context; `MessageWindowChatMemory` is session-scoped

**Given** the AI explicitly asks a follow-up question in its response (FR26)
**When** the user reads the AI response
**Then** the question is displayed in the chat bubble; the user can respond naturally via the chat input; the AI uses the follow-up answer in the next inference

**Given** `AiService` processes a chat message
**When** `DocumentPatchService` is not involved
**Then** no `patch` events are emitted; the response consists only of `token` and `done` events

### Story 4.7: Accessibility Audit & Focus Management for AI Features

As a user with accessibility needs,
I want all AI-related UI components to meet WCAG 2.1 AA standards with correct focus management,
So that I can use the AI features fully with keyboard navigation and assistive technologies.

**Acceptance Criteria:**

**Given** the `DiffHighlight` component renders AI-changed text
**When** audited for accessibility
**Then** every `<mark>` element has an explicit `aria-label` ("AI addition" or "AI rewrite") and a visible icon alongside the color indicator — color is never the sole differentiator (UX-DR4, NFR19)

**Given** a `Dialog` component opens (tailor JD modal, or confirm dialogs from Epic 3)
**When** the dialog opens
**Then** focus moves to the first interactive element inside the dialog; when the dialog closes, focus returns to the trigger element that opened it (UX-DR14, NFR20)

**Given** AI suggestions or streaming responses appear in the `ChatPanel`
**When** a new message is appended
**Then** `role="status"` or the `aria-live="polite"` region on the panel announces the update; a screen reader user receives the notification without a focus change

**Given** a skip link "Skip to resume canvas" pointing to `#resume-canvas` is implemented
**When** a keyboard user reaches the page
**Then** the skip link is visually hidden but becomes visible on focus; activating it moves focus to the `ResumeCanvas` container (UX-DR14)

**Given** the production color combinations are audited via Lighthouse
**When** the Lighthouse accessibility score is checked
**Then** the score is ≥90; all combinations verified: `blue-600` on white ≥4.5:1, `zinc-900` on `zinc-50` ≥4.5:1, all interactive states (UX-DR13, NFR19)

**Given** all icon-only controls in AI components are implemented (StreamingIndicator, action icons)
**When** audited
**Then** each icon-only control has an accessible label via `aria-label` or `<title>`; no control is identifiable by icon alone

---

## Epic 5: Export & Document Generation

Users can export their resume as a PDF or DOCX, rendered according to the selected template layout and ATS-compatible, completing within 10 seconds. The `DocumentRenderer` interface, `PdfRenderer` (iText 7), and `DocxRenderer` (Apache POI) are implemented and independently tested. Completes the FR16 export stub from Epic 3.

### Story 5.1: DocumentRenderer Interface & PdfRenderer

As an authenticated user,
I want to export my resume as a PDF rendered according to my selected template,
So that I have a professionally formatted, ATS-compatible document ready to submit.

**Acceptance Criteria:**

**Given** the `DocumentRenderer` interface is defined in the `export` package
**When** any renderer is inspected
**Then** the interface contract is `render(ResumeDocument doc, ResumeTemplate template) → byte[]`; `PdfRenderer` and `DocxRenderer` implement it independently with no shared mutable state

**Given** an authenticated user calls `GET /api/v1/resumes/{resumeId}/export?format=pdf`
**When** the request is processed
**Then** `OllamaHealthGuard` is NOT consulted (export has no AI dependency); `ExportService` calls `PdfRenderer.render()` with the resume's `ResumeDocument` and its associated `ResumeTemplate`; the response streams the `byte[]` with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="<resumeName>.pdf"`

**Given** `PdfRenderer` renders a `ResumeDocument` via iText 7
**When** the output PDF is inspected
**Then** the layout matches the selected template (sections in correct order, correct typography); the document is ATS-compatible: single-column, semantic text, no graphics or skill-bar images, all text selectable (NFR4, FR37)

**Given** the export takes longer than 2 seconds
**When** the UI monitors the export request
**Then** a linear progress bar appears in the editor toolbar (`isExporting` flag in `useResumeStore`); the progress bar clears when the download is triggered (UX-DR19)

**Given** the export completes successfully
**When** the file download begins
**Then** a "Download ready" `Toast` appears bottom-right with 4s auto-dismiss; the progress bar is removed (UX-DR19)

**Given** `PdfRenderer` is implemented
**When** unit tests are run
**Then** `PdfRendererTest.java` uses no Spring context (`@ExtendWith(MockitoExtension.class)` only); at least two real-world template + document combinations are rendered and the output `byte[]` is verified non-empty and valid (readable by a PDF library); an `ExportControllerIntegrationTest.java` covers the happy-path `GET /export?format=pdf` against Testcontainers PostgreSQL

**Given** a resume is associated with a template that has been unpublished by an admin
**When** the user attempts to export
**Then** `ExportService` falls back to the default prebuilt template rather than failing; export succeeds with HTTP 200

### Story 5.2: DocxRenderer & Export Download UX

As an authenticated user,
I want to export my resume as a DOCX document rendered according to my selected template,
So that I can submit my resume to employers or recruitment systems that require Word format.

**Acceptance Criteria:**

**Given** an authenticated user calls `GET /api/v1/resumes/{resumeId}/export?format=docx`
**When** the request is processed
**Then** `ExportService` calls `DocxRenderer.render()` with the resume's `ResumeDocument` and `ResumeTemplate`; the response streams the `byte[]` with `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` and `Content-Disposition: attachment; filename="<resumeName>.docx"`

**Given** `DocxRenderer` renders a `ResumeDocument` via Apache POI
**When** the output DOCX is opened in a word processor
**Then** sections appear in the correct template order; headings use Word heading styles (`Heading 1`, `Heading 2`); bullet items use list styles; no raw HTML is embedded; the document is ATS-parseable (FR37)

**Given** an unsupported `format` query parameter is passed (e.g. `?format=txt`)
**When** the export request is processed
**Then** HTTP 400 is returned with a `ProblemDetail` body: `"Unsupported export format. Use 'pdf' or 'docx'."`

**Given** the export request completes within 10 seconds
**When** the performance is measured under single-user load
**Then** both PDF and DOCX exports complete within the NFR4 10-second budget; the linear progress bar in the toolbar is visible for any export exceeding 2 seconds

**Given** the Export button is triggered from a `ResumeDashboardCard` hover action (the FR16 stub from Epic 3)
**When** the export action is triggered from the dashboard
**Then** a format selection (`PDF` / `DOCX`) dialog appears; on confirm, the appropriate `GET /export?format=<x>` request is made; on download, a "Download ready" Toast appears (UX-DR19)

**Given** `DocxRenderer` is implemented
**When** unit tests are run
**Then** `DocxRendererTest.java` renders at least two real-world template + document combinations and verifies the output DOCX is valid (non-empty, opens without error via Apache POI in test); `ExportControllerIntegrationTest.java` adds a DOCX happy-path case

---

## Epic 6: Administration & Observability

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

### Story 6.3: OpenTelemetry Span Propagation Through SSE & Grafana Dashboards

As an operator,
I want distributed traces for all user-initiated operations visible in Grafana, including AI SSE streaming paths,
So that I can observe, debug, and measure system behavior across the full request lifecycle.

**Acceptance Criteria:**

**Given** `spring-boot-starter-opentelemetry` is in `pom.xml` and the Grafana + OTel Collector service is in `compose.yaml`
**When** a user initiates any non-AI operation (login, profile save, resume CRUD, export)
**Then** a complete distributed trace is generated with spans for: HTTP request, service layer, repository layer; the trace is queryable in Grafana and correlates to the request's `traceId` (NFR17)

**Given** a user initiates an AI operation (chat, tailor, enhance) that uses `SseEmitter`
**When** the SSE async thread runs
**Then** the OpenTelemetry span context is explicitly propagated via `Context.makeCurrent()` at the `SseEmitter` callback entry point; the async AI inference spans (token generation, patch emission) are children of the originating HTTP request span — not orphaned traces (NFR17, architecture constraint)

**Given** a distributed trace spans the AI SSE path
**When** application logs are inspected
**Then** every log line emitted during the SSE async thread includes the `traceId` and `spanId` correlation fields; log entries from the HTTP thread and the async SSE thread are linkable via the same `traceId` (NFR18)

**Given** the Grafana service is running via `docker compose up`
**When** the Grafana UI is accessed
**Then** a pre-configured dashboard is visible that shows: request rate, p99 latency per endpoint, AI inference duration, error rate; traces are searchable by `traceId`; the dashboard is defined as a JSON provisioning file in `compose.yaml` (not manual UI setup)

**Given** an AI operation results in an error (Ollama unavailable, patch parse failure)
**When** the error span is recorded
**Then** the span's status is set to `ERROR` with a descriptive message; the error is visible in the Grafana trace view alongside the originating request span

**Given** the OTel propagation implementation is complete
**When** integration tests run
**Then** `ChatControllerIntegrationTest.java` includes at least one test verifying that a trace ID generated during the HTTP phase is present in the async SSE emission logs (using a test log appender or in-memory span exporter)

---

## Epic 7: Custom Template Authoring (Deferred)

Users can create, edit, and delete their own custom resume templates. Deferred from Epic 3 as it is not a prerequisite for AI features and represents the most complex UI work in the template domain. Implements FR22 and FR23 with a simplified template definition format as recommended in the architecture.

### Story 7.1: Custom Template Data Model & CRUD API

As a developer,
I want the custom template data model and CRUD API endpoints implemented,
So that authenticated users can create, edit, and delete their own templates separate from the prebuilt library.

**Acceptance Criteria:**

**Given** the `resume_templates` table already has `owner_user_id` (nullable FK) and `is_prebuilt` columns from V4
**When** a new Flyway migration `V6__add_custom_template_support.sql` is applied
**Then** any missing columns required for user-owned templates are added (e.g. `is_published` defaults, ownership indexes `idx_resume_templates_owner_user_id`); existing prebuilt templates are unaffected

**Given** an authenticated user calls `POST /api/v1/resume-templates/custom` with a `CustomTemplateRequest` body
**When** the request is processed
**Then** a new `ResumeTemplate` entity is created with `owner_user_id` set to the authenticated user's ID and `is_prebuilt = false`; HTTP 201 returned with `TemplateDto`; the endpoint does NOT require `ADMIN` role

**Given** an authenticated user calls `GET /api/v1/resume-templates/custom`
**When** the request is processed
**Then** only the templates owned by the authenticated user are returned; another user's custom templates are never included

**Given** an authenticated user calls `PUT /api/v1/resume-templates/custom/{templateId}`
**When** the template belongs to a different user
**Then** HTTP 403 is returned with a `ProblemDetail` body; users can only edit their own custom templates

**Given** an authenticated user calls `DELETE /api/v1/resume-templates/custom/{templateId}`
**When** the request is processed
**Then** the template is deleted; HTTP 204 returned; resumes that referenced this custom template fall back to the default prebuilt template on next render/export

**Given** `TemplateService` custom-template methods are implemented
**When** unit tests are run
**Then** `TemplateServiceTest.java` adds coverage for custom create, list-own, update-own (403 on other's), and delete-own; `TemplateControllerIntegrationTest.java` adds custom template happy-path and ownership 403 tests against Testcontainers PostgreSQL

### Story 7.2: Custom Template Authoring UI

As an authenticated user,
I want to create and edit my own resume templates using a simplified definition format,
So that I can design a layout that reflects my personal style beyond the prebuilt options.

**Acceptance Criteria:**

**Given** the user navigates to the Template Gallery (`TemplateGallery.tsx`) in the editor
**When** the gallery renders
**Then** a "My Templates" tab appears alongside the prebuilt filter tabs (All / Minimal / Classic / Modern); it lists the user's custom templates; an "Create New Template" button is visible in this tab

**Given** the user clicks "Create New Template"
**When** the template creation flow opens
**Then** a dedicated `TemplateEditorPage.tsx` (or shadcn/ui `Sheet` panel) opens with: a Name field, a simplified template definition editor (YAML or JSON textarea with syntax highlighting), and a live `ResumeCanvas` preview that re-renders as the definition changes

**Given** the user edits the template definition
**When** the definition is valid
**Then** the `ResumeCanvas` preview updates within 500ms to reflect the new layout (client-side render, no server round-trip required for preview); the definition format supports at minimum: section ordering, section visibility defaults, typography scale choice, and color accent selection

**Given** the user submits an invalid template definition (malformed YAML/JSON or missing required fields)
**When** the save is attempted
**Then** inline validation errors appear below the editor with a descriptive message; the save request is not submitted until the definition is valid

**Given** the user saves a valid custom template
**When** `POST /api/v1/resume-templates/custom` or `PUT .../custom/{id}` succeeds
**Then** the template appears in the "My Templates" tab; a "Template saved" Toast is shown; the user can immediately apply it to any resume via the gallery

**Given** the user clicks Delete on a custom template in "My Templates"
**When** the delete is triggered
**Then** a shadcn/ui `Dialog` confirmation: "Delete '[name]'? Resumes using it will revert to the default template."; Cancel is default-focused; on confirm, `DELETE /api/v1/resume-templates/custom/{id}` is called; the template is removed from the gallery (UX-DR18)

**Given** the template editor is rendered
**When** a screen reader or keyboard-only user interacts with it
**Then** the Name field, definition textarea, preview region, and action buttons are all keyboard-navigable and have correct ARIA labels; the live preview region has `aria-live="polite"` so screen readers are notified of layout updates (NFR19)

**Given** `TemplateEditorPage.test.tsx` (or equivalent) is implemented
**When** frontend tests run
**Then** the following are verified: typing in the definition field triggers a debounced preview update, save with an invalid definition shows validation errors and does not call `apiClient`, save with a valid definition calls `POST /api/v1/resume-templates/custom` with the correct payload
