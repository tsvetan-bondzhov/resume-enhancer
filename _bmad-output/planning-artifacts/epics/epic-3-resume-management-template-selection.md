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

### Story 3.11: ResumeSectionType as Core Domain Concept â€” Typed Section Identifiers

As a developer,
I want `ResumeSection` to be identified by a typed `ResumeSectionType` enum instead of a freeform string,
So that section identity is enforced at compile time, section ordering in templates is unambiguous, and the arbitrary UUID / hardcoded-string inconsistency is eliminated.

**Background / Scope:**

`ResumeSectionType` currently lives in `upload.parsers` â€” a parsing utility package â€” despite being a core domain concept used by both the resume domain and the parser. `ResumeSection.id` is today either a random UUID (from `LlmSectionExtractor`) or a hardcoded semantic string like `"experience"` (from `ResumeService.buildFromProfile()`). Template ordering arrays in the database reference those same hardcoded strings. This story promotes `ResumeSectionType` to `resume.domain`, replaces the freeform `id` field with a typed `sectionType` field, and migrates all callers, stored data, and frontend references.

**In scope:** moving `ResumeSectionType`; renaming `ResumeSection.id` â†’ `sectionType`; updating `LlmSectionExtractor`, `ResumeService.buildFromProfile()`, `ResumeDocumentConverter`; Flyway migration for existing JSONB; updating `TemplateDefinition.DEFAULT` and prebuilt template seed JSON; updating all frontend references (`ResumeSectionDto`, `templateUtils.ts`, `ResumeCanvas.tsx`, `SectionsPanel.tsx`, tests).

**Out of scope:** typed item records (Story 3.13), new profile section types (Story 3.12), section-specific renderers (Story 3.15).

**Acceptance Criteria:**

**Given** `ResumeSectionType` is moved to `resume.domain`
**When** the project compiles
**Then** `upload.parsers` imports `ResumeSectionType` from its new location; no other package holds a copy of the enum; no compilation errors

**Given** the `ResumeSection` record is updated
**When** any code constructs or reads a `ResumeSection`
**Then** the record signature is `ResumeSection(ResumeSectionType sectionType, String title, boolean visible, List<ResumeItem> items)`; the `sectionType` field serializes as `"sectionType"` in JSON; the compact constructor rejects a `null` `sectionType` with `NullPointerException` (consistent with the existing `items` guard)

**Given** `ResumeService.buildFromProfile()` is updated
**When** a resume is created from a profile
**Then** the three sections are constructed with `ResumeSectionType.WORK_EXPERIENCE`, `ResumeSectionType.EDUCATION`, and `ResumeSectionType.SKILLS`; no hardcoded string identifiers remain

**Given** `LlmSectionExtractor.extract()` is updated
**When** it processes a raw section
**Then** the already-resolved `ResumeSectionType` (from `fromHeader()`) is used directly as the `sectionType` of the new `ResumeSection`; `UUID.randomUUID().toString()` is no longer used as a section identifier; `UNKNOWN` sections receive `ResumeSectionType.UNKNOWN`

**Given** Flyway migration `V7__migrate_section_ids_to_type.sql` is applied
**When** the application starts against a database with existing resume records
**Then** every section object inside `resumes.resume_content` JSONB has its `"id"` key renamed to `"sectionType"` and its value converted: `"experience"` â†’ `"WORK_EXPERIENCE"`, `"education"` â†’ `"EDUCATION"`, `"skills"` â†’ `"SKILLS"`; any unrecognised string value maps to `"UNKNOWN"`; all other section fields are unchanged; the migration is idempotent (re-running does not corrupt data)

**Given** `TemplateDefinition.DEFAULT` and the prebuilt template seed SQL are updated
**When** `GET /api/v1/resume-templates` is called
**Then** all `sectionOrder` and `columns.left` / `columns.right` arrays in template definitions reference `ResumeSectionType` name strings (e.g. `"WORK_EXPERIENCE"`, `"EDUCATION"`, `"SKILLS"`); `TemplateDefinition.DEFAULT.sectionOrder` equals `["WORK_EXPERIENCE", "EDUCATION", "SKILLS"]`

**Given** the frontend `ResumeSectionDto` interface is updated
**When** the API response is consumed
**Then** the `id: string` field is replaced by `sectionType: ResumeSectionType` where `ResumeSectionType` is a TypeScript string-literal union of all Java enum values (`"WORK_EXPERIENCE" | "EDUCATION" | "SKILLS" | "CERTIFICATIONS" | "PROJECTS" | "SUMMARY" | "LANGUAGES" | "VOLUNTEERING" | "UNKNOWN"`); no frontend file references `section.id`

**Given** `templateUtils.ts` and `ResumeCanvas.tsx` are updated
**When** sections are ordered, column assignments are resolved, or ARIA `id` attributes are generated
**Then** `getOrderedSections` matches sections via `section.sectionType`; `leftColumnIds` and `rightColumnIds` are `Set<string>` values compared against `section.sectionType`; `aria-labelledby` and React `key` props use `section.sectionType`, producing stable human-readable DOM identifiers

**Given** the story is implemented
**When** tests are run
**Then** `ResumeCanvas.test.tsx` and `ResumeSection.test.tsx` are updated to use `sectionType` throughout; a `ResumeSectionMigrationTest.java` unit test applies the V7 migration logic to a fixture JSON document and asserts correct `sectionType` output values for all three known section types plus the `UNKNOWN` fallback

---

### Story 3.12: Extended Profile Domain â€” Certifications, Languages, Projects, Volunteering

As a user,
I want my profile to store certifications, languages, projects, and volunteering experience in addition to work history, education, and skills,
So that my resume can accurately reflect my full professional background across all common section types.

**Background / Scope:**

`Profile` currently persists only `WorkExperience`, `Education`, and `Skill`. The `ResumeSectionType` enum already defines `CERTIFICATIONS`, `LANGUAGES`, `PROJECTS`, and `VOLUNTEERING`, but there are no domain entities, DB tables, DTOs, or service methods to back them. This story fills that gap end-to-end: from database tables through to the profile edit form.

**In scope:** Flyway migration; four new JPA entities; `Profile.java` OneToMany additions; Request/DTO records; `ProfileUpdateRequest`, `ProfileDto`, `ProfileService`, and `ProfileController` updates; frontend `ProfileDto` type and profile edit form additions; unit and integration tests.

**Out of scope:** mapping new entities to resume sections (Story 3.14), typed `ResumeItem` records (Story 3.13).

**Acceptance Criteria:**

**Given** Flyway migration `V8__add_profile_extended_sections.sql` is applied
**When** the application starts
**Then** four new tables exist: `profile_certifications(id UUID PK, profile_id UUID FK NOT NULL, name VARCHAR NOT NULL, issuer VARCHAR, issue_date DATE, expiration_date DATE, created_at, updated_at)`; `profile_languages(id UUID PK, profile_id UUID FK NOT NULL, name VARCHAR NOT NULL, proficiency_level VARCHAR NOT NULL, created_at, updated_at)`; `profile_projects(id UUID PK, profile_id UUID FK NOT NULL, name VARCHAR NOT NULL, description TEXT, technologies VARCHAR, link VARCHAR, start_date DATE, end_date DATE, is_current BOOLEAN NOT NULL DEFAULT false, created_at, updated_at)`; `profile_volunteering(id UUID PK, profile_id UUID FK NOT NULL, role VARCHAR NOT NULL, organization VARCHAR NOT NULL, description TEXT, start_date DATE, end_date DATE, is_current BOOLEAN NOT NULL DEFAULT false, created_at, updated_at)`

**Given** the four new JPA entities are defined in `profile.domain`
**When** Hibernate validates the schema
**Then** `Certification`, `Language`, `Project`, and `Volunteering` each extend `BaseEntity`; each has a `@ManyToOne` to `Profile`; `Language.proficiencyLevel` is stored as `VARCHAR` mapped to a `LanguageProficiencyLevel` enum (`BEGINNER`, `ELEMENTARY`, `INTERMEDIATE`, `UPPER_INTERMEDIATE`, `ADVANCED`, `NATIVE`) using `@Enumerated(EnumType.STRING)`; all nullable columns are reflected as nullable Java fields

**Given** `Profile.java` is updated
**When** profile data is loaded or cascaded
**Then** `Profile` gains `@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)` lists for `certifications`, `languages`, `projects`, and `volunteering`; all four follow the same pattern as the existing `workExperiences`, `education`, and `skills` lists

**Given** Request and DTO records are defined in `profile.dto`
**When** a caller uses them
**Then** `CertificationRequest(@NotBlank String name, String issuer, LocalDate issueDate, LocalDate expirationDate)`; `LanguageRequest(@NotBlank String name, @NotNull LanguageProficiencyLevel proficiencyLevel)`; `ProjectRequest(@NotBlank String name, String description, String technologies, String link, LocalDate startDate, LocalDate endDate, boolean isCurrent)`; `VolunteeringRequest(@NotBlank String role, @NotBlank String organization, String description, LocalDate startDate, LocalDate endDate, boolean isCurrent)`; corresponding `*Dto` records mirror the same fields without validation annotations

**Given** `ProfileUpdateRequest` and `ProfileDto` are updated
**When** `PUT /api/v1/profile` is called
**Then** `ProfileUpdateRequest` gains optional `List<CertificationRequest> certifications`, `List<LanguageRequest> languages`, `List<ProjectRequest> projects`, `List<VolunteeringRequest> volunteering` fields; `ProfileDto` gains the four corresponding list fields; null request lists are treated as empty lists (PUT-replace strategy unchanged)

**Given** `ProfileService.updateProfile()` is updated
**When** a profile update is persisted
**Then** the same clear-and-repopulate strategy is applied to all four new lists; `toDto()` includes all four new lists; existing behaviour for `workExperiences`, `education`, and `skills` is unchanged

**Given** the frontend `ProfileDto` TypeScript interface is updated
**When** the API response is parsed
**Then** `ProfileDto` gains `certifications: CertificationDto[]`, `languages: LanguageDto[]`, `projects: ProjectDto[]`, `volunteering: VolunteeringDto[]`; all four default to empty arrays when absent (backward-compatible with older API responses)

**Given** the profile edit form is updated
**When** the user opens the profile page
**Then** collapsible subsections for Certifications, Languages, Projects, and Volunteering are rendered below the existing Skills section; each subsection supports adding, inline editing, and deleting individual items using the same UX pattern as work experiences and education

**Given** the story is implemented
**When** tests are run
**Then** `ProfileServiceTest.java` covers create, update, and clear for each of the four new entity lists; `ProfileControllerIntegrationTest.java` verifies a round-trip `PUT /api/v1/profile` with all four new lists persists correctly and is returned by `GET /api/v1/profile`

---

### Story 3.13: Typed Section-Specific ResumeItem Records

As a developer,
I want each resume section to hold typed item records with named, schema-enforced fields instead of a generic `Map<String, String>`,
So that field access is compile-time safe, date values are preserved as `LocalDate`, and LLM extraction output is validated against a known per-section schema.

**Background / Scope:**

`ResumeItem(String id, Map<String, String> fields)` cannot enforce which fields exist, conflates structured data (dates, booleans) with raw strings, and makes renderer code brittle. This story replaces it with a sealed interface hierarchy of typed records, wires Jackson polymorphism for JSONB round-trips, migrates existing stored data, and updates `LlmSectionExtractor` to construct typed items.

**In scope:** `ResumeItem` sealed interface; nine typed record implementations in `resume.domain.items`; Jackson `@JsonTypeInfo` / `@JsonSubTypes` configuration; `ResumeDocumentConverter` Jackson configuration; Flyway migration; `LlmSectionExtractor` typed construction; frontend `ResumeItemDto` discriminated union.

**Out of scope:** frontend renderers (Story 3.15), full profile â†’ resume mapping for new section types (Story 3.14).

**Dependencies:** Story 3.11 must be complete (`ResumeSectionType` is in `resume.domain` and `sectionType` is present on sections for the data migration).

**Acceptance Criteria:**

**Given** `ResumeItem` is refactored to a sealed interface
**When** the project compiles
**Then** `ResumeItem` in `resume.domain` is a `sealed interface` annotated with `@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")` and `@JsonSubTypes` mapping each `ResumeSectionType` name to its concrete record; nine concrete records exist in `resume.domain.items`: `WorkExperienceItem`, `EducationItem`, `SkillItem`, `CertificationItem`, `LanguageItem`, `ProjectItem`, `VolunteeringItem`, `SummaryItem`, and `GenericItem`; all implement `ResumeItem`; the old `ResumeItem(String id, Map<String, String> fields)` record is deleted

**Given** the typed record fields are defined
**When** a record is constructed
**Then** `WorkExperienceItem(String id, String jobTitle, String company, LocalDate startDate, LocalDate endDate, boolean isCurrent, String description)` â€” `endDate` nullable; `EducationItem(String id, String institution, String degree, String fieldOfStudy, LocalDate startDate, LocalDate endDate)` â€” `degree`, `fieldOfStudy`, `endDate` nullable; `SkillItem(String id, String name, String category, String proficiency)` â€” `category`, `proficiency` nullable; `CertificationItem(String id, String name, String issuer, LocalDate issueDate, LocalDate expirationDate)` â€” `expirationDate` nullable; `LanguageItem(String id, String language, String proficiency)` â€” `proficiency` nullable; `ProjectItem(String id, String name, String description, String technologies, String link, LocalDate startDate, LocalDate endDate, boolean isCurrent)` â€” `description`, `technologies`, `link`, `endDate` nullable; `VolunteeringItem(String id, String role, String organization, String description, LocalDate startDate, LocalDate endDate, boolean isCurrent)` â€” `description`, `endDate` nullable; `SummaryItem(String id, String text)`; `GenericItem(String id, Map<String, String> fields)` â€” used for `UNKNOWN` sections and unrecognisable LLM output

**Given** `ResumeDocumentConverter` is configured for polymorphism
**When** a `ResumeDocument` containing mixed item types is serialized then deserialized
**Then** round-trip fidelity is guaranteed: the `"type"` discriminator is written to and read from JSON; `LocalDate` fields serialize as ISO-8601 strings (`"YYYY-MM-DD"`); no item type information is lost; the `ObjectMapper` instance used is the centrally configured Spring bean (no ad-hoc `ObjectMapper` instantiation)

**Given** Flyway migration `V9__migrate_resume_items_to_typed.sql` is applied
**When** the application starts against an existing database
**Then** for each section in each resume's `resume_content` JSONB, every item object in `{"id":"...", "fields":{...}}` form is rewritten: `fields` map entries are lifted to top-level properties; a `"type"` discriminator is added matching the parent section's `sectionType` value; items in sections with `sectionType` `"UNKNOWN"` become `GenericItem` objects with their original `fields` map preserved under a `"fields"` key; the migration is idempotent

**Given** `LlmSectionExtractor` is updated
**When** it processes LLM JSON output for a known section type
**Then** it constructs the corresponding typed `ResumeItem` subclass directly (e.g. `new WorkExperienceItem(...)`) instead of building a `Map<String, String>`; string-to-`LocalDate` parsing failures null the affected date field and log at WARN; `GenericItem` is used only when the section type is `UNKNOWN` or when the LLM JSON cannot be mapped to the typed schema despite a valid section type; the `validateAndConvert` method is replaced or superseded by per-type construction logic

**Given** `UpdateResumeRequest` carries a full `ResumeDocument` from the frontend
**When** `ResumeDocumentConverter` deserializes it on `PUT /api/v1/resumes/{id}`
**Then** polymorphic item types are correctly reconstructed from the frontend JSON; no `ClassCastException` or deserialization error occurs for any known `ResumeItem` subtype

**Given** the story is implemented
**When** tests are run
**Then** `ResumeItemSerializationTest.java` round-trips each of the nine item types through `ObjectMapper.writeValueAsString` â†’ `readValue` and asserts field-level equality including `LocalDate` values; `LlmSectionExtractorTest.java` is extended to verify typed item construction for each of the eight known section types plus `GenericItem` fallback on `UNKNOWN`

---

### Story 3.14: Profile-to-Resume Mapping Refactor â€” All Section Types

As a user,
I want all sections from my profile â€” including certifications, languages, projects, volunteering, and summary â€” to appear in a newly created resume,
So that my resume is pre-populated with my complete professional history without manual re-entry.

**Background / Scope:**

`ResumeService.buildFromProfile()` currently maps only `WorkExperience`, `Education`, and `Skill`. After Stories 3.12 and 3.13 are complete, four new profile entities and eight typed `ResumeItem` subclasses exist but are not yet connected. This story wires the full mapping and expands `TemplateDefinition.DEFAULT` to cover all section types.

**In scope:** `ResumeService.buildFromProfile()` expansion to all eight non-`UNKNOWN` section types; typed item construction per section; default visibility rules for empty sections; `TemplateDefinition.DEFAULT` sectionOrder update; unit tests.

**Out of scope:** frontend renderers (Story 3.15), API changes.

**Dependencies:** Story 3.12 (new profile entities must exist), Story 3.13 (typed item records must exist).

**Acceptance Criteria:**

**Given** `buildFromProfile()` is called on a fully-populated profile
**When** the `ResumeDocument` is returned
**Then** it contains exactly eight sections in the following default order: `SUMMARY`, `WORK_EXPERIENCE`, `EDUCATION`, `SKILLS`, `CERTIFICATIONS`, `PROJECTS`, `LANGUAGES`, `VOLUNTEERING`; each section uses the correct `ResumeSectionType` enum value; each item is the correct typed `ResumeItem` subclass

**Given** `buildFromProfile()` maps each entity type
**When** items are constructed
**Then** `WorkExperienceItem` fields are mapped 1-to-1 from `WorkExperience` entity fields with `LocalDate` values preserved; `EducationItem` from `Education`; `SkillItem` from `Skill` (`category` and `proficiency` are null); `CertificationItem` from `Certification`; `LanguageItem` from `Language` (proficiency from `proficiencyLevel.name()`); `ProjectItem` from `Project`; `VolunteeringItem` from `Volunteering`; the `SUMMARY` section contains a single `SummaryItem` whose `text` is `profile.getSummary()`

**Given** a profile section has no items (e.g. no certifications on file)
**When** `buildFromProfile()` constructs that section
**Then** the section is still added to the document with `visible: false` and an empty items list; sections that do have items default to `visible: true`; this ensures `SectionsPanel` can reveal a section later without requiring a re-parse

**Given** the profile `summary` field is null or blank
**When** the `SUMMARY` section is constructed
**Then** it is added with `visible: false` and a single `SummaryItem` with an empty string `text`

**Given** `TemplateDefinition.DEFAULT` is updated
**When** `getOrderedSections()` is called without a template
**Then** the default section order is `["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]`; the prebuilt template seed SQL (`V6`) is updated so the three existing templates either adopt this expanded order or define explicit overrides

**Given** `deepCopyDocument()` is called during a clone operation
**When** the document contains all eight section types with typed items
**Then** all typed item subclasses are correctly reconstructed; no `ClassCastException`; no data loss

**Given** the story is implemented
**When** unit tests are run
**Then** `ResumeServiceTest.java` contains a `buildFromProfile_allSections` test with a fully-populated profile fixture asserting: section count is eight, sections appear in the correct order, each item is the correct subclass, and key field values are correctly mapped; a second `buildFromProfile_emptySections` test verifies sections with no profile data are added with `visible: false`

---

### Story 3.15: Section-Specific Frontend Resume Renderers

As a user editing or previewing a resume,
I want each section to render with a layout and typography appropriate to its content type (e.g. date ranges in muted italic, skill chips, project links),
So that the resume canvas looks like a polished, structured resume rather than a uniform list of raw field values.

**Background / Scope:**

`ResumeSection.tsx` iterates `Object.entries(item.fields)` and renders each value as an unstyled span. `ResumeCanvas.tsx` duplicates this logic in a separate read-only branch. After Stories 3.11 and 3.13 are complete, sections carry a typed `sectionType` and items are discriminated-union DTOs â€” this story builds section-specific renderer components, consolidates the two `ResumeCanvas` render paths, and adds a date formatting utility.

**In scope:** `lib/dateUtils.ts`; frontend `ResumeItemDto` discriminated union; nine renderer components in `components/resume/sections/`; `ResumeSection.tsx` refactor as a routing component; `ResumeCanvas.tsx` consolidation; tests.

**Out of scope:** export rendering (Epic 5), template-driven per-section style overrides from `TemplateSectionStyle` (Epic 5).

**Dependencies:** Story 3.11 (`sectionType` on `ResumeSectionDto`), Story 3.13 (typed `ResumeItemDto`), Story 3.14 (all section types present in resume documents).

**Acceptance Criteria:**

**Given** `lib/dateUtils.ts` is added
**When** `formatDateRange(startDate, endDate, isCurrent)` is called
**Then** it returns a human-readable range formatted as `"MMM YYYY â€“ MMM YYYY"` (e.g. `"Jan 2020 â€“ Jun 2023"`); when `isCurrent` is `true` or `endDate` is `null` it returns `"MMM YYYY â€“ Present"`; when both `startDate` and `endDate` are `null` it returns an empty string; month abbreviations are derived from `Intl.DateTimeFormat` using the user's locale

**Given** `types/api.ts` is updated
**When** the frontend consumes `ResumeSectionDto.items`
**Then** `ResumeItemDto` is a TypeScript discriminated union keyed on `type: ResumeSectionType` with nine members â€” `WorkExperienceItemDto`, `EducationItemDto`, `SkillItemDto`, `CertificationItemDto`, `LanguageItemDto`, `ProjectItemDto`, `VolunteeringItemDto`, `SummaryItemDto`, `GenericItemDto` â€” each with fields matching the corresponding Java record from Story 3.13; `ResumeSectionDto.items` is typed as `ResumeItemDto[]`; TypeScript exhaustiveness checking (`never` default branch) is enforced wherever the union is switched on

**Given** section renderer components are created in `components/resume/sections/`
**When** they receive their typed items
**Then** the following nine components render correct structure:
- `WorkExperienceSectionRenderer.tsx`: per-item block â€” job title (`font-semibold`), company + formatted date range on one line (`text-muted-foreground italic`), description as body text below
- `EducationSectionRenderer.tsx`: per-item block â€” degree + field of study (`font-semibold`), institution + date range (`text-muted-foreground italic`)
- `SkillsSectionRenderer.tsx`: skills as inline `<span>` chips; when `category` is present, skills are grouped under a category label
- `CertificationsSectionRenderer.tsx`: per-item line â€” certification name (`font-medium`), issuer (`text-muted-foreground`), issue date and expiration date (or "No expiry")
- `LanguagesSectionRenderer.tsx`: per-item line â€” language name and proficiency level badge
- `ProjectsSectionRenderer.tsx`: per-item block â€” project name (`font-semibold`), technology chips, description, external link icon when `link` is present
- `VolunteeringSectionRenderer.tsx`: per-item block â€” role (`font-semibold`), organization + date range (`text-muted-foreground italic`), description below
- `SummarySectionRenderer.tsx`: single `<p>` element with prose text; no list wrapper
- `GenericSectionRenderer.tsx`: fallback â€” renders `Object.entries(fields).filter(([, v]) => Boolean(v))` as an unstyled list, preserving current behaviour for `UNKNOWN` sections

**Given** edit mode is active (callbacks are defined)
**When** a user clicks any editable text field in any section renderer
**Then** `contentEditable`, `suppressContentEditableWarning`, and `onBlur` â†’ `onFieldChange(itemId, fieldName, value)` are applied to every leaf text node mapping to a named item field; the `fieldName` passed to `onFieldChange` matches the typed record field name (e.g. `"jobTitle"`, `"company"`), not an arbitrary map key; date fields are rendered and edited as plain `YYYY-MM-DD` strings

**Given** `ResumeSection.tsx` is refactored as a routing component
**When** it renders a section
**Then** it reads `section.sectionType` and delegates to the matching renderer from `components/resume/sections/`; the `<section>` wrapper and editable `<h2>` title remain in `ResumeSection.tsx` and are not duplicated inside individual renderers; the prop interface `{ section: ResumeSectionDto; onTitleChange: (title: string) => void; onFieldChange: (itemId: string, field: string, value: string) => void }` is unchanged

**Given** `ResumeCanvas.tsx` is updated
**When** it renders in either editable or read-only mode
**Then** the duplicated inline read-only `<section>` / `<ul>` / `<li>` render path inside `ResumeCanvas.tsx` is removed; `ResumeCanvas` always renders `<ResumeSection>` components regardless of whether edit callbacks are passed; read-only behaviour is handled inside each section renderer by the absence of `onFieldChange`; the `isEditable` variable in `ResumeCanvas.tsx` is deleted

**Given** the story is implemented
**When** tests are run
**Then** `WorkExperienceSectionRenderer.test.tsx` verifies date range formatting, `font-semibold` job title, and `onFieldChange` callback on blur; `EducationSectionRenderer.test.tsx` verifies the same patterns; `SummarySectionRenderer.test.tsx` verifies a single `<p>` is rendered; `GenericSectionRenderer.test.tsx` verifies fallback field rendering; `ResumeSection.test.tsx` verifies `sectionType`-based routing dispatches to the correct renderer component; `lib/dateUtils.test.ts` covers all `formatDateRange` branches (both dates present, `isCurrent` true, both null)
