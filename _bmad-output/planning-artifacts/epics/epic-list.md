# Epic List

### Epic 1: Foundation — Project Infrastructure & Authentication
Users can register, sign in, sign out, and access a secured application that runs end-to-end via Docker Compose. All project wiring is complete: missing `pom.xml` dependencies added, frontend scaffolded with shadcn/ui + Vite, design token foundation established, routing with protected routes, JWT filter chain, and Spring Security configured.
**FRs covered:** FR1, FR2, FR3, FR4
**UX-DRs covered:** UX-DR12 (design tokens), UX-DR16 (responsive base breakpoints)

### Epic 2: Experience Profile Management
Users can build and maintain their persistent career profile via manual entry or by uploading an existing PDF/DOCX resume for auto-extraction. This is the data foundation that all resume generation and AI tailoring depends on.
**FRs covered:** FR5, FR6, FR7, FR8, FR10
**UX-DRs covered:** UX-DR20 (profile editor multi-step UX), UX-DR15 (empty states)

### Epic 3: Resume Management & Template Selection
Users can create resumes from their profile, browse and apply prebuilt templates, manage their resume library (save, clone, save-as, list, open, delete, download), edit resume content inline, and control section visibility. The complete editing loop is functional without AI. Custom template creation (FR22/FR23) is deferred to Epic 8.
**FRs covered:** FR9, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21
**UX-DRs covered:** UX-DR1 (D1/D6 hybrid layout), UX-DR2 (SplitPaneLayout), UX-DR3 (ResumeCanvas), UX-DR7 (SectionsPanel), UX-DR8 (ResumeDashboardCard), UX-DR9 (ResumeSidebarItem), UX-DR10 (TemplateGallery), UX-DR17 (undo delete), UX-DR18 (confirm dialogs), UX-DR19 (feedback patterns)

### Epic 4: Resume Experience Polish & Foundations
Addresses all UX deficiencies, data-layer gaps, and rendering bugs discovered during Epic 3. Ships the polish needed for a professional editing experience before AI features land: realistic dashboard previews, correctly paginated A4 rendering, independent column layouts, item-level CRUD and drag-to-reorder, an overhauled profile page, user settings, a simplified skill domain, extended contact fields on the summary, and a properly functioning LLM parsing pipeline.
**FRs covered:** FR10 (extended profile fields), FR11 (item-level editing)
**UX-DRs covered:** UX-DR3 (ResumeCanvas multi-page), UX-DR7 (SectionsPanel order override), UX-DR8 (ResumeDashboardCard live preview), UX-DR20 (profile free navigation)

### Epic 5: AI Enhancement & Conversational Chat
Users can enhance their resume with AI suggestions (accept/reject), tailor it to a specific job description, and interact with the AI via a persistent chat panel that applies changes directly to the live document in real time via SSE streaming. **The first story in this epic is an isolated AI spike** (Spring AI + Ollama + SseEmitter + frontend EventSource, end-to-end, before any resume integration) to validate the full streaming pipeline early and surface risks before dependent stories are built.
**FRs covered:** FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34
**UX-DRs covered:** UX-DR4 (DiffHighlight), UX-DR5 (ChatPanel), UX-DR6 (AIActionBar), UX-DR11 (StreamingIndicator), UX-DR13 (accessibility audit), UX-DR14 (focus management)

### Epic 6: Export & Document Generation
Users can export their resume as a PDF or DOCX, rendered according to the selected template layout and ATS-compatible, completing within 10 seconds. The `DocumentRenderer` interface, `PdfRenderer` (iText 7), and `DocxRenderer` (Apache POI) are implemented and independently tested. Completes the FR16 export stub from Epic 3.
**FRs covered:** FR35, FR36, FR37
**UX-DRs covered:** UX-DR19 (export progress bar, download toast)

### Epic 7: Administration & Observability
Admins can manage users (view, deactivate) and the prebuilt template library (CRUD, publish/unpublish) via a lazy-loaded admin panel. **FR42 requires dedicated stories** — OpenTelemetry span propagation through the SSE async boundary, Grafana dashboards showing distributed traces for all user-initiated operations, and trace correlation IDs in logs.
**FRs covered:** FR38, FR39, FR40, FR41, FR42

### Epic 8: Custom Template Authoring (Deferred)
Users can create, edit, and delete their own custom resume templates. Deferred from Epic 3 as it is not a prerequisite for AI features and represents the most complex UI work in the template domain (template definition format + editor). Implements FR22 and FR23 with a simplified template definition format as recommended in the architecture.
**FRs covered:** FR22, FR23

---
