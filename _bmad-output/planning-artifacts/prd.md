---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
releaseMode: single-release
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-resume-enhancer.md"
  - "docs/IdeaDraft.md"
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - resume-enhancer

**Author:** Tsvetan
**Date:** 2026-05-13

## Executive Summary

Resume Enhancer is an AI-driven full-stack web application that solves the single most painful part of the modern job search: tailoring a resume to each role. ATS software screens over 83% of applications before human review, making keyword alignment non-negotiable — yet doing this thoughtfully across dozens of applications per week is exhausting and error-prone for job seekers.

The product's core insight is **write once, tailor infinitely**. Users enter their career history into a persistent experience profile one time. Every subsequent application reduces to selecting a template and pasting a job description — the AI rewrites and restructures the resume using the user's own words and achievements, optimized for that specific role. Value compounds with every new application.

Users interact with the AI conversationally at every step: requesting specific rewrites, asking for rationale, and steering output in natural language. Chat messages translate directly into document edits. The result exports as a polished PDF or DOCX, ready to submit.

Resume Enhancer is also a portfolio-grade engineering showcase: Spring Boot + Spring AI (GA 1.0, 2024) with Ollama for zero-cost local LLM inference, JWT + Spring Security authentication, PostgreSQL, OpenTelemetry distributed tracing, Grafana dashboards, Testcontainers integration tests, React/TypeScript/Tailwind CSS frontend, and full Docker Compose orchestration — no external API dependencies in v1.

### What Makes This Special

**Full lifecycle, one tool.** Competitors specialize in creation (Kickresume, Zety) or optimization (Jobscan) — never both. Resume Enhancer covers the entire journey: raw career data → template selection → AI enhancement → job tailoring → export. No context-switching, no data re-entry between tools.

**The persistent profile is the moat.** Once a user's career history lives in the app, marginal cost per application approaches zero. The profile becomes more valuable with every use — not just a document generator but a career intelligence layer.

**Conversational AI throughout.** Rather than rigid form-fill workflows, users steer the AI at any step in natural language. This mirrors how people actually think about their careers and lowers the barrier to producing polished output.

**Privacy-first local inference.** Ollama runs the LLM locally — no user career data sent to third-party providers. The Spring AI abstraction is designed for future multi-model support (OpenAI, Anthropic) without rewriting application logic.

> **Classification:** Full-stack web app (React/TypeScript SPA + Spring Boot REST API) · General domain · Medium complexity · Greenfield

## Success Criteria

### User Success

- A user completes the full end-to-end flow — create or upload a resume, receive AI-generated enhancements, tailor to a job description via the UI workflow and/or chat, and export a finished PDF or DOCX — without requiring external tools or re-entering data
- The "aha moment" is achieved: user pastes a job description and sees their resume rewritten in seconds using their own words and real achievements, reshaped to match the role's priorities and language
- AI suggestions are coherent, contextually relevant, and grounded in the user's actual experience profile — not generic filler
- Template output is ATS-compatible (single-column, semantic structure, no graphics or skill bars) and visually professional

### Business Success

As a portfolio project, success operates on two dimensions:

- **Technical credibility:** The implementation demonstrates production-grade engineering across the full stack — observable, tested, containerized — that differentiates it from tutorial-quality portfolio work
- **Architectural signal:** Demonstrates Spring AI integration patterns (AI model abstraction, prompt engineering, local LLM orchestration) that enterprise Java teams are actively hiring for
- **Self-sufficiency:** Fully runnable via `docker compose up` with zero external API dependencies — easy to demo, easy to hand off

### Technical Success

- Full-stack implementation complete: Spring Boot, Spring AI, Ollama, PostgreSQL, JWT, Spring Security, React/TypeScript, Tailwind CSS, Vite, Docker Compose, OpenTelemetry
- Unit test coverage via JUnit + Mockito for all business logic; integration test coverage via Testcontainers against a live PostgreSQL instance
- Distributed tracing via OpenTelemetry with Grafana dashboards demonstrating observable system behavior
- All services orchestrated via Docker Compose: app, PostgreSQL, Ollama, Grafana

### Measurable Outcomes

- End-to-end resume creation flow completes in under 2 minutes (excluding AI inference time)
- PDF/DOCX export produces a correctly rendered, ATS-parseable document for every supported template
- All endpoints covered by integration tests; all service-layer logic covered by unit tests
- System observable end-to-end: every user-initiated action produces a traceable span in Grafana

## User Journeys

### Journey 1: Jordan — First Professional Resume (Create Path, Success)

Jordan is a recent CS graduate with three internships, a capstone project, and a GitHub portfolio — but no polished resume. She's been applying through LinkedIn's "Easy Apply" and getting no responses. A friend mentions resume tailoring and she signs up for Resume Enhancer.

**Opening:** Jordan lands on the dashboard after signing up. She's prompted to fill in her experience profile — she spends 10 minutes entering her internships, projects, and skills. This is the only time she'll ever do this.

**Rising Action:** She selects a clean, minimal template from the prebuilt library. The app generates a draft resume. The AI then surfaces three targeted suggestions: reframe her internship bullet points from task-based to outcome-based, add quantified impact to her capstone project, and tighten her skills section to remove noise. She accepts two, rejects one.

**Climax:** She finds a backend engineering role at a fintech startup. She pastes the job description. In seconds, the AI rewrites her resume — same experience, same projects, but now using the JD's exact language around "distributed systems," "REST APIs," and "CI/CD pipelines." Her skills section reorders to match what the role prioritizes. For the first time, the resume feels like it was written *for* this job.

**Resolution:** She exports as PDF, names the resume "Backend - Fintech - May 2026", and saves it. Next time she applies, tailoring takes 30 seconds. Jordan gets three callbacks in her first week.

*Requirements revealed:* experience profile, template selection, AI enhancement with accept/reject, JD tailoring, resume naming and saving, PDF export.

---

### Journey 2: Marcus — Career Pivot via Upload (Upload Path, Success)

Marcus is a 35-year-old project manager pivoting into product management. He has a solid resume in DOCX format from five years ago, but it's written in PM-speak for a completely different industry. He uploads it to Resume Enhancer.

**Opening:** Marcus uploads his DOCX. The app parses it in seconds — experience, education, and skills are automatically extracted and populate his profile. He scans the extracted data, corrects one date, and adds a recent certification he completed last month.

**Rising Action:** He selects a template, reviews the generated resume. He opens the chat panel and types: *"Can you reframe my project delivery bullets to sound more product-focused — less about timelines and more about user outcomes?"* The AI responds, updates three bullet points, and explains the changes. Marcus asks a follow-up question about quantifying his impact. The AI asks for the numbers; he provides them; the bullets update again.

**Climax:** He finds a Senior PM role at a SaaS company. He pastes the JD. The AI restructures his resume around product discovery, stakeholder alignment, and roadmap ownership — the exact language in the posting. Sections he hadn't thought were relevant (his cross-functional collaboration experience) are promoted and reframed.

**Resolution:** Marcus saves two versions — one generalist PM resume, one tailored to SaaS. He exports both as PDF and DOCX. He lands two first-round interviews within a week.

*Requirements revealed:* PDF/DOCX upload, auto-extraction to profile, profile editing, conversational AI with document edits, show/hide sections, resume cloning, multiple export formats.

---

### Journey 3: Priya — Multiple Versions, Recovery Path (Edit Path, Edge Case)

Priya is actively applying to 20+ roles simultaneously. She's a data scientist tailoring to both ML engineering and analytics roles — very different skill emphasis for each. She's already created two base resumes in Resume Enhancer.

**Opening:** She opens her "ML Engineer" resume to update it after a JD review. She hides the "Analytics Tools" section — it's not relevant here. She edits one bullet point directly in the editor.

**Rising Action:** She pastes a new JD and requests tailoring. The AI suggests moving her PyTorch experience above scikit-learn. She accepts. Then she notices the AI incorrectly de-emphasized her model deployment experience — critical for this role. She types in chat: *"Put model deployment back as the second bullet under ML Experience."* The AI corrects it immediately and confirms what changed.

**Climax:** She wants to save this as a new version, not overwrite her base. She chooses "Save As" and names it "ML Eng - FAANG - May 2026". Her original is untouched.

**Resolution:** Priya now manages five named resume versions from a single profile. She can see all her resumes in the management view, download any of them, and delete the ones that didn't land. The edge case — the wrong AI edit — was recoverable in one chat message.

*Requirements revealed:* show/hide sections, inline editing, conversational correction, save vs. save-as, resume management (list, delete, download), chat as correction mechanism.

---

### Journey 4: Sam — Admin, Template Quality & User Management

Sam is a developer maintaining Resume Enhancer for a small team using it internally. He has admin access.

**Opening:** Sam logs into the admin panel. He sees user accounts and the template library.

**Rising Action:** A user reports that one of the prebuilt templates renders poorly on DOCX export — a known font issue. Sam opens the template in the template editor, corrects the font definition, and saves. All resumes using that template will reflect the fix on next export.

He also receives a request to add a new two-section template for academic CVs. He creates it, marks it as a prebuilt, and it appears in the template selector for all users.

**Climax:** Sam reviews the user list and deactivates a test account that's been running automated requests. He confirms the account is inactive without deleting historical resumes.

**Resolution:** Sam has maintained template quality and user integrity without touching application code. The system is self-administrable.

*Requirements revealed:* admin panel, user management (view, deactivate), template management (view, edit, create, delete, publish), prebuilt template designation.

---

### Journey Requirements Summary

| Capability Area | Revealed By |
|---|---|
| Experience profile (create, edit) | Journey 1, 2 |
| Resume management (create, clone, save-as, list, delete, download) | Journey 1, 2, 3 |
| PDF/DOCX upload + auto-extraction | Journey 2 |
| Template selection (prebuilt library) | Journey 1, 2 |
| AI enhancement with accept/reject | Journey 1 |
| Job description tailoring | Journey 1, 2, 3 |
| Conversational AI with live document edits | Journey 2, 3 |
| Inline section editing + show/hide | Journey 3 |
| PDF and DOCX export | Journey 1, 2, 3 |
| Admin: user management | Journey 4 |
| Admin: template management (CRUD, publish) | Journey 4 |

The journeys above establish what the product must do. The following section documents what makes the implementation approach novel.

## Innovation & Novel Patterns

### Detected Innovation Areas

**Spring AI + Local LLM Integration (JVM-native AI pattern):** Resume Enhancer is among the first full-stack applications to demonstrate Spring AI (GA 1.0, April 2024) in a real product workflow — not a tutorial or proof-of-concept. The architecture uses Spring AI's model abstraction layer over Ollama, enabling local LLM inference with zero cloud API dependency. This pattern (Spring Boot service + Spring AI + Ollama) is exactly what enterprise Java teams are beginning to adopt, making this a live reference implementation of an emerging standard.

**Chat-to-Document Edit UX:** The conversational AI interface directly mutates resume content in real time — not advisory output the user must manually apply. A user types a correction or request in natural language; the AI interprets it, updates the structured document, and explains the change. This tight coupling between conversational AI and a live structured document is a novel UX pattern in the resume tool space, where AI is typically a separate "suggestions" panel.

**Privacy-First Local Inference:** Running the LLM locally means career data — work history, salary context, personal achievements — never leaves the user's machine. This is a meaningful architectural choice for a domain where users are sharing sensitive professional information, and distinguishes Resume Enhancer from every cloud-dependent competitor.

### Market Context & Competitive Landscape

Existing tools (Jobscan, Kickresume, TailoredCV, Reztune) are all cloud-only, sending user data to external LLM APIs. No mainstream open-source, self-hostable resume tool with AI enhancement exists. Resume Enhancer occupies an uncontested position on the privacy + self-hostability axis.

Spring AI's GA release in 2024 opened a window for JVM-native AI applications. Early, high-quality reference implementations in this space have outsized portfolio value as hiring teams look for engineers who understand this emerging stack.

### Validation Approach

- **Spring AI pattern validation:** The architecture is validated if the AI model abstraction layer successfully swaps between Ollama (local) and a cloud provider (e.g., OpenAI) with no application logic changes — demonstrating the abstraction is real, not nominal
- **Chat-to-document edit validation:** The UX is validated if a user can correct an AI mistake through chat alone (no manual editing required) — matching Journey 3 (Priya's recovery path)
- **Local inference quality validation:** Output quality is validated if AI suggestions are coherent and contextually grounded — accepted by users more often than rejected across test scenarios

## Web Application Specific Requirements

### Project-Type Overview

Resume Enhancer is a single-page application (SPA) built with React 18+ and TypeScript, bundled with Vite. All routes require authentication; no public-facing pages. The React frontend communicates with the Spring Boot REST API via JWT-authenticated HTTP requests.

### Technical Architecture Considerations

**Frontend Stack:**
- React 18+ with TypeScript — component architecture, strong typing throughout
- Vite — fast dev server, optimized production builds
- Tailwind CSS — utility-first styling; no custom CSS framework
- React Router — client-side routing for dashboard, resume editor, profile, admin panel
- State management: React Context or lightweight solution (Zustand/Jotai) — no Redux overhead needed at this scale

**API Communication:**
- REST API over HTTP/HTTPS; JSON request/response bodies
- JWT Bearer token in `Authorization` header for all authenticated requests
- Token refresh strategy: silent refresh or re-login on 401
- Server-Sent Events (SSE) for AI response streaming — token-by-token chat output and live document preview updates (SSE preferred over WebSocket for one-directional server→client flow)

**Real-Time Requirements:**
- AI chat responses stream token-by-token to the UI via SSE
- Resume preview re-renders reactively as AI applies edits — no full page reload
- Document save operations are async with optimistic UI updates

### Browser Matrix

| Browser | Support Level |
|---|---|
| Chrome (latest 2) | Full |
| Firefox (latest 2) | Full |
| Safari (latest 2) | Full |
| Edge (latest 2) | Full |
| Mobile browsers | Responsive layout; not primary use case |
| IE11 / legacy | Not supported |

### Responsive Design

- Desktop-first layout (resume editing is inherently a desktop task)
- Responsive down to tablet (1024px); mobile layout degrades gracefully but is not optimized
- Resume preview renders at fixed aspect ratio (A4) with scroll; does not reflow for small screens

### Implementation Considerations

- Vite proxy configuration for local dev API calls (avoids CORS during development)
- Environment variables via `.env` files for API base URL, feature flags
- Spring Boot serves built static assets; no SSR required
- Bundle splitting: lazy-load admin panel routes to keep initial bundle small

## Product Scope & Release Strategy

### Strategy & Philosophy

**Approach:** Complete feature implementation — single release (v1). This is a portfolio project where all features are core requirements, not incremental validation bets. The goal is a fully functional, production-grade demonstration across the complete user lifecycle.

**Resource Requirements:** Solo developer or small team (1-2 engineers); full-stack capability required across Spring Boot/Spring AI backend and React/TypeScript frontend. Docker and DevOps familiarity needed for Docker Compose orchestration and observability setup.

### Complete Feature Set

**Core User Journeys Supported:**
All four journeys (see User Journeys section) are in scope for v1.

**Must-Have Capabilities (load-bearing for v1):**

- User authentication: sign up, sign in, JWT + Spring Security
- Persistent experience profile: create and edit (experience, education, skills)
- Resume management: create, clone, save, save-as, list, download, delete
- PDF/DOCX upload with auto-extraction into profile
- Template management: prebuilt library; user-created templates
- AI enhancement: AI-suggested improvements with accept/reject per suggestion
- Job description tailoring: AI rewrites resume against pasted JD
- Conversational AI chat with live document edits (SSE streaming)
- Show/hide resume sections; inline section editing
- PDF and DOCX export
- Admin panel: user management (view, deactivate), template management (CRUD, publish/unpublish)
- Docker Compose orchestration: app + PostgreSQL + Ollama + Grafana
- OpenTelemetry tracing + Grafana dashboards

**Nice-to-Have Capabilities (v1 polish, deferrable if timeline pressured):**

- Resume preview live re-render during AI edits (can degrade to refresh-on-save if complex)
- Advanced template editor (can ship with a simpler template definition format initially)
- Granular AI suggestion explanations — can simplify to change-only confirmation
- Grafana dashboard polish — basic tracing is must-have; custom dashboards are nice-to-have

**Out of Scope (v2+):**

- Multiple LLM provider selection (OpenAI, Anthropic, Gemini via user-supplied API keys)
- Cover letter generation
- ATS match score / keyword gap visualization
- LinkedIn profile import
- Job board integrations or browser extensions
- Mobile native applications
- Team or organizational accounts
- Personalized career intelligence (learning which phrasings land interviews per role type)
- Automatic experience highlight suggestion per role

### Risk Mitigation Strategy

**Technical Risks:**
- *Spring AI + Ollama integration:* Spike this early — validate streaming chat, prompt structure, and document edit flow before building other features around it; pin dependency versions to guard against API churn in this recently-GA framework
- *PDF/DOCX parsing:* Apache POI and PDFBox are mature but format variance is wide. Implement with explicit fallback to manual profile entry; validate against 5–10 real-world resume samples in integration tests
- *LLM output quality:* Local models produce lower quality than frontier cloud models. Accept/reject UX makes every AI output recoverable; prompt engineering is an iterative investment throughout development

**Resource Risks:**
- Solo development increases scope risk. Build auth + profile + resume CRUD first (no AI) to establish a working foundation; add AI features incrementally on top; observability last
- If timeline is compressed: defer Grafana dashboard polish and advanced template editor; core AI workflows are non-negotiable

## Functional Requirements

### User Authentication & Account Management

- **FR1:** Unregistered users can create a new account with an email address and password
- **FR2:** Registered users can sign in with their email address and password
- **FR3:** Authenticated users can sign out and invalidate their active session
- **FR4:** The system rejects requests made with expired or invalid tokens and requires re-authentication

### Experience Profile Management

- **FR5:** Authenticated users can create an experience profile with sections for work experience, education, and skills
- **FR6:** Authenticated users can edit any field of their experience profile at any time
- **FR7:** The system automatically extracts work experience, education, and skills from an uploaded PDF or DOCX resume file and populates the experience profile
- **FR8:** Authenticated users can review and correct auto-extracted profile data before confirming it

### Resume Management

- **FR9:** Authenticated users can create a new resume by combining their experience profile with a selected template
- **FR10:** Authenticated users can upload an existing resume in PDF or DOCX format to seed a new resume workflow
- **FR11:** Authenticated users can save a resume with a user-provided name
- **FR12:** Authenticated users can save a modified resume as a new independent copy with a new name
- **FR13:** Authenticated users can view a list of all their saved resumes
- **FR14:** Authenticated users can open any previously saved resume for editing
- **FR15:** Authenticated users can delete a saved resume
- **FR16:** Authenticated users can download a saved resume in PDF or DOCX format
- **FR17:** Authenticated users can show or hide individual sections within a resume without deleting them
- **FR18:** Authenticated users can directly edit the text content of individual resume sections
- **FR19:** Authenticated users can preview a rendered version of their resume within the editor

### Template Management

- **FR20:** Authenticated users can browse a library of prebuilt resume templates
- **FR21:** Authenticated users can select a template to apply to a resume
- **FR22:** Authenticated users can create a custom resume template
- **FR23:** Authenticated users can edit or delete their own custom templates

### AI Enhancement & Job Tailoring

- **FR24:** Authenticated users can request AI-generated improvement suggestions for their current resume
- **FR25:** Authenticated users can accept or reject individual AI enhancement suggestions
- **FR26:** The AI can ask the user follow-up questions to gather additional context before generating suggestions
- **FR27:** Authenticated users can provide a job description and request the AI to tailor their resume to that role
- **FR28:** The AI rewrites and restructures resume content to align with the language, priorities, and keywords of the provided job description

### Conversational AI Interface

- **FR29:** Authenticated users can open a persistent chat panel within the resume editor
- **FR30:** Authenticated users can submit natural-language requests to the AI via the chat panel
- **FR31:** The AI interprets chat messages and applies the requested changes directly to the resume document
- **FR32:** The AI provides a brief explanation of what it changed in response to each chat request
- **FR33:** AI chat responses are delivered to the UI progressively as they are generated
- **FR34:** Authenticated users can ask the AI questions about the resume enhancement or tailoring process without triggering document edits

### Export & Document Generation

- **FR35:** Authenticated users can export their resume as a PDF document
- **FR36:** Authenticated users can export their resume as a DOCX document
- **FR37:** Exported documents are rendered according to the selected template layout and are ATS-compatible

### Administration

- **FR38:** Admin users can view a list of all registered user accounts
- **FR39:** Admin users can deactivate a user account without deleting the user's data or resumes
- **FR40:** Admin users can view, create, edit, and delete templates in the shared prebuilt library
- **FR41:** Admin users can publish or unpublish templates to control their availability to end users
- **FR42:** Operators can observe distributed traces for all user-initiated operations via Grafana dashboards

## Non-Functional Requirements

### Performance

- **NFR1:** The authenticated dashboard page loads within 2 seconds on standard broadband
- **NFR2:** AI chat responses begin streaming to the UI within 3 seconds of request submission under normal Ollama load
- **NFR3:** The resume preview re-renders within 500ms of any in-editor content change (client-side)
- **NFR4:** PDF/DOCX export completes within 10 seconds; the UI displays a progress indicator for any server-side operation exceeding 2 seconds
- **NFR5:** All REST API endpoints (excluding AI inference calls) respond within 500ms under normal single-user load

### Security

- **NFR6:** Passwords are stored as bcrypt hashes; plaintext passwords are never persisted or logged at any layer
- **NFR7:** JWT access tokens expire within a configurable TTL (default: 1 hour); tokens are invalidated on explicit sign-out
- **NFR8:** All API endpoints except sign-in and sign-up require a valid JWT token; requests without valid tokens receive a 401 response
- **NFR9:** Admin-only endpoints enforce role-based access control; authenticated non-admin requests to admin endpoints receive a 403 response
- **NFR10:** Uploaded files are validated for MIME type and maximum size before processing; invalid or oversized files are rejected with a descriptive error message
- **NFR11:** All data in transit is encrypted via HTTPS/TLS in any non-localhost deployment

### Reliability

- **NFR12:** The application degrades gracefully when the Ollama service is unavailable — AI features display a clear error state while non-AI features (profile management, resume CRUD, export) remain fully functional
- **NFR13:** Malformed, corrupted, or unreadable PDF/DOCX uploads do not crash the application; the user receives a clear error and the option to enter profile data manually

### Testing & Quality

- **NFR14:** All service-layer business logic is covered by unit tests implemented with JUnit and Mockito
- **NFR15:** All REST API endpoints are covered by integration tests that run against a live PostgreSQL instance provisioned via Testcontainers
- **NFR16:** PDF/DOCX parsing is validated against a representative set of real-world resume formats in integration tests

### Observability

- **NFR17:** All user-initiated operations generate distributed traces via OpenTelemetry, accessible and queryable in Grafana
- **NFR18:** Application logs include trace correlation IDs that link log entries to their corresponding distributed trace spans

### Accessibility

- **NFR19:** The frontend meets WCAG 2.1 AA: semantic HTML with correct heading hierarchy, full keyboard navigability, sufficient color contrast ratios, and screen reader labels on all icon-only controls and form inputs
- **NFR20:** Focus is managed programmatically when modal dialogs open or close, and when AI suggestions or chat responses appear

