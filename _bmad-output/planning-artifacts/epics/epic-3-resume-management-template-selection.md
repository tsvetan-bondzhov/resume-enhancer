# Epic 3: Resume Management & Template Selection

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


### Story 3.9: LLM-Based Resume Parsing Pipeline

As a user uploading a resume,
I want my uploaded PDF or DOCX to be intelligently parsed into structured sections, job titles, companies, dates, and skills,
So that my profile is pre-populated with typed, actionable data rather than raw unformatted text.

**Background / Scope:**

The existing `SectionExtractor` produces only three flat `List<String>` buckets (work/education/skills) with no typed field extraction. This story implements the hybrid pipeline defined in `llm-based-resume-parsing-architecture.md`: heuristic pre-segmentation for section boundaries + Ollama LLM for per-section field extraction, with full graceful degradation to heuristics when Ollama is unavailable.

`AiService` and `OllamaHealthGuard` are scaffolded here (first appearance of the `ai` package) so the parsing pipeline has no forward dependency on Epic 4.

**In scope:** `AiService`, `OllamaHealthGuard`, `OllamaUnavailableException`; modified `SectionExtractor.segmentByHeaders()`; `RawSection` record, `ResumeItemDto` record, `ResumeSectionType` enum; `LlmSectionExtractor`; modified `ParsingService`; prompt template `resume-section-extraction.st`; unit and integration tests.

**Out of scope:** SSE streaming, `DocumentPatchService`, chat UI -- all Epic 4.

**Acceptance Criteria:**

**Given** the Spring AI 2.0.0-M6 Ollama starter dependency is present in `pom.xml`
**When** the application starts
**Then** `AiService` is a `@Service` bean in the `ai` package with `ChatClient` injected via constructor; `OllamaHealthGuard` is a `@Component` that checks Ollama reachability; `OllamaUnavailableException` is a typed domain exception in the `ai` package -- `AiService` is the only class in the codebase that calls `ChatClient` directly; `LlmSectionExtractor` calls `AiService.extractResumeSection()` only, never `ChatClient` directly

**Given** `SectionExtractor.segmentByHeaders(rawText)` is called
**When** the input contains section headings
**Then** it returns a `List<RawSection>` where each `RawSection` record holds a `title` (String) and `lines` (List<String>); the keyword set covers: experience, work, employment, education, degree, skills, technologies, certifications, projects, summary, publications, languages, volunteering; section detection fires only when the keyword constitutes the full normalized line -- not a mid-sentence substring match (fixes the existing brittleness bug where `"5 years of experience"` falsely triggers a section switch)

**Given** `ResumeSectionType` enum is defined
**When** `segmentByHeaders()` classifies a section header
**Then** recognized headers map to `WORK_EXPERIENCE`, `EDUCATION`, `SKILLS`, `CERTIFICATIONS`, `PROJECTS`, `SUMMARY`, `LANGUAGES`, `VOLUNTEERING`; unrecognized headers map to `UNKNOWN` with raw lines stored as a single `text` field per item -- content is never silently dropped

**Given** Ollama is available
**When** `ParsingService.parse(file)` is called
**Then** `OllamaHealthGuard.isAvailable()` returns true; `LlmSectionExtractor` is invoked; for each `RawSection`, `AiService.extractResumeSection(sectionType, sectionText)` is called with a prompt built from `src/main/resources/prompts/resume-section-extraction.st`; the JSON response is validated and converted to `List<ResumeItemDto>`; a `ResumeDocument` with typed `ResumeSection` / `ResumeItem` entries is assembled and returned alongside the backward-compatible `ParsedResumeDto` (unchanged three-bucket structure)

**Given** Ollama is unavailable
**When** `ParsingService.parse(file)` is called
**Then** `OllamaHealthGuard.isAvailable()` returns false; `ParsingService` catches `OllamaUnavailableException` and returns a heuristic-only `ParsedResumeDto`; the upload endpoint always returns HTTP 200 -- never 503; no `LlmSectionExtractor` call is made

**Given** `LlmSectionExtractor` receives a malformed JSON response for one section
**When** the JSON parse check fails
**Then** that section falls back to heuristic lines; all other sections retain their LLM-extracted output; the malformed response is logged at WARN; the upload is never blocked

**Given** `LlmSectionExtractor` receives a structurally valid JSON response
**When** the date format check runs
**Then** date fields not matching `\d{4}(-\d{2})?` or `"Present"` are nulled out; the item is kept with all remaining valid fields intact

**Given** `LlmSectionExtractor` receives a JSON response where no field value for an item appears as a case-insensitive substring in `rawText`
**When** the anchor check runs
**Then** the item is included but `lowConfidence: true` is set in the intermediate `ResumeItemDto` and logged at WARN; it is never silently dropped

**Given** a resume section exceeds 3000 characters
**When** `LlmSectionExtractor` prepares the prompt
**Then** the section text is truncated to 3000 characters before sending; truncation is logged at WARN

**Given** the total LLM parsing time exceeds 30 seconds
**When** `ParsingService` detects the timeout
**Then** heuristic `ParsedResumeDto` is returned; the upload endpoint returns HTTP 200

**Given** `LlmSectionExtractorTest.java` and `ParsingServiceTest.java` are run
**When** tests execute
**Then** `LlmSectionExtractorTest` covers: JSON parse failure falls back to heuristic lines; date fields with invalid format are nulled; anchor-check failure sets `lowConfidence: true`; all using a mocked `AiService`; `ParsingServiceTest` asserts that when `OllamaHealthGuard.isAvailable()` returns false, heuristic `ParsedResumeDto` is returned and `LlmSectionExtractor` is never called

---

### Story 3.10: Template Definition Backfill & ResumeCanvas Template Application

As a user editing a resume,
I want my selected template's layout, typography, and section order to be visually applied in the editor canvas and reflected in the sidebar template thumbnails,
So that switching templates gives me an immediate, accurate preview of how my resume will look.

**Background / Scope:**

`V5__seed_prebuilt_templates.sql` inserts `{}` (empty JSONB) for all three templates. `ResumeCanvas` renders with hardcoded Tailwind classes and has no template awareness. `TemplateGallery` thumbnails show identical placeholder line boxes regardless of template.

This story backfills real template definitions, adds the Java `TemplateDefinition` record hierarchy, wires `ResumeCanvas` to consume template definitions from the API, and updates `TemplateGallery` thumbnails to visually reflect each template's layout type -- including accent color.

**In scope:** `V6__backfill_template_definitions.sql`; `TemplateDefinition`, `TemplateLayout`, `TemplateColumns`, `SectionStyle` Java records in `export` package including `TemplateDefinition.DEFAULT`; `TemplateService` CSS unit validation; updated `ResumeCanvas.tsx` with `templateId` prop, CSS variable injection, template-driven section ordering, and layout-type rendering; updated `TemplateGallery.tsx` thumbnails differentiated by layout type and accent color; `EditorPage.tsx` prop wiring; unit and component tests.

**Out of scope:** server-side PDF/DOCX export rendering (Epic 5), `itemSeparator` rendering (picked up in Epic 5), custom template authoring (Epic 7).

**Acceptance Criteria:**

**Given** `V6__backfill_template_definitions.sql` is applied
**When** `GET /api/v1/resume-templates` is called
**Then** all three templates return fully populated `templateDefinition` JSONB: Minimal (`id: 11111111-0000-0000-0000-000000000001`) has `layoutType: "single-column"`; Classic (`id: ...000000000002`) has `layoutType: "two-column"`; Modern (`id: ...000000000003`) has `layoutType: "modern-accent"`; all three include `cssVariables` (with `--accent-color` defined), `layout`, and `metadata` sections matching the schema in `template-structure-and-application-architecture.md`

**Given** `TemplateDefinition`, `TemplateLayout`, `TemplateColumns`, `SectionStyle` Java records are defined in the `export` package
**When** `ObjectMapper.convertValue(rawMap, TemplateDefinition.class)` is called on any of the three prebuilt template definitions
**Then** the records deserialize without error; `TemplateDefinition.isTwoColumn()` returns true only for Classic; `TemplateDefinition.isModernAccent()` returns true only for Modern; `TemplateDefinition.DEFAULT` is a compile-time constant with `layoutType: "single-column"`, `headerFormat: "name-contact"`, `sectionOrder: ["experience", "education", "skills"]`, and 0.75in page margins

**Given** `TemplateService.updateTemplate()` receives a `templateDefinition` with `cssVariables` containing `rem` or `em` units
**When** validation runs
**Then** the update is rejected with a descriptive error identifying the offending variable; only `px` and `in` units are accepted; the template is not persisted

**Given** `ResumeCanvas` receives a non-null `templateId` prop
**When** the component mounts or `templateId` changes
**Then** `GET /api/v1/resume-templates/{templateId}` is called via `apiClient`; on success the `templateDefinition.cssVariables` are injected as inline `style` on the root `<article>` element; sections render in the order defined by `layout.sectionOrder` (single-column / modern-accent) or right-column then left-column order (two-column); sections present in the document but absent from the template order arrays render last in document order; sections are never silently dropped

**Given** `ResumeCanvas` receives `templateId: null`
**When** the component renders
**Then** hardcoded CSS default values are applied (matching `TemplateDefinition.DEFAULT`); no API call to the template endpoint is made; rendering does not error or show a loading state

**Given** the template fetch fails (network error or 404)
**When** `ResumeCanvas` handles the error
**Then** hardcoded CSS defaults are applied silently; no error is shown to the user; `template` state is set to `null`

**Given** `layoutType` is `"modern-accent"`
**When** `ResumeCanvas` renders
**Then** the header element receives `bg-[var(--accent-color)]` styling; each section `<h2>` receives `border-b-2 border-[var(--accent-color)]`; the layout is otherwise single-column (no grid)

**Given** `layoutType` is `"two-column"`
**When** `ResumeCanvas` renders
**Then** the root `<article>` uses CSS Grid with `grid-template-columns: 1fr 2fr`; sections listed in `columns.left` render in the left grid area; sections listed in `columns.right` render in the right grid area; the renderer reads column assignment exclusively from the template JSON and has no hardcoded knowledge of which section types belong in which column

**Given** `TemplateGallery` renders template thumbnail cards
**When** `templateDefinition.layoutType` and `cssVariables["--accent-color"]` are available
**Then** single-column thumbnails show a full-width line stack on a white background; two-column thumbnails show a narrow left block alongside a wider right block; modern-accent thumbnails show a coloured header band filled with the template's `--accent-color` value followed by a line stack; thumbnails for templates whose definitions have not yet loaded render the existing placeholder skeleton

**Given** `EditorPage` renders
**When** the resume data is loaded from `GET /api/v1/resumes/{resumeId}`
**Then** `resume.templateId` is passed as the `templateId` prop to `ResumeCanvas`; when the user applies a different template via `TemplateGallery`, `useResumeStore` is updated and the new `templateId` is re-passed to `ResumeCanvas`, triggering a re-render with the new template

**Given** a section has been hidden by the user via the `SectionsPanel` (`section.visible` is false)
**When** `ResumeCanvas` renders with any `layoutType`
**Then** that section is excluded from the rendered output regardless of its position in `layout.sectionOrder`, `columns.left`, or `columns.right`; section visibility takes precedence over template ordering

**Given** the story is implemented
**When** tests are run
**Then** `TemplateServiceTest.java` includes a test asserting `rem`/`em` CSS units are rejected on update; `ResumeCanvas.test.tsx` verifies: (a) `cssVariables` are applied as inline `style` on the root `<article>`, (b) section render order follows template `sectionOrder`, (c) `templateId: null` applies defaults without making an API call, (d) two-column layout routes sections to correct grid areas; `TemplateGallery.test.tsx` verifies thumbnail layout structure and accent color differ by `layoutType`

---
