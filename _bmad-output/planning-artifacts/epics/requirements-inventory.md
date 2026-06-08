# Requirements Inventory

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
