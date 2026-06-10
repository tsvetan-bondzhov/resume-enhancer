# Epic 4: Resume Experience Polish & Foundations

> **Migration sequencing note:** Applied migrations are V1–V12. Three stories in this epic require new Flyway migrations. Assign V numbers at implementation time in this order: Story 4.2 (Classic template column SQL update) → Story 4.8 (SkillItem JSONB simplification) → Story 4.9 (Profile contact columns). Story files show approximate V numbers; the implementer must verify the highest existing migration before running each story.

This epic addresses all UX deficiencies, data-layer gaps, and rendering bugs discovered during Epic 3. It ships the polish needed for a professional editing experience before AI features land in Epic 5: realistic dashboard previews, correctly paginated A4 rendering, independent column layouts, item-level CRUD and drag-to-reorder within sections, an overhauled profile page, user settings, a simplified skill domain, extended contact fields on the summary section, and a properly functioning LLM parsing pipeline.

### Story 4.1: Rendering Polish — Sidebar Collapse Content, Active Template Title, Date Formatting & Certification Display

As a user editing a resume,
I want the editor to render dates, certifications, the active template name, and the collapsed sidebar correctly,
So that the UI looks polished and information is never truncated or misleadingly displayed.

**Acceptance Criteria:**

**Given** the left sidebar is collapsed to the 48px icon rail
**When** the sidebar renders in collapsed state
**Then** the `leftSlot` content (SectionsPanel, TemplateGallery, etc.) is not rendered at all — no children mount inside the collapsed sidebar; only the collapse/expand chevron button remains in the rail

**Given** a template is active in the TemplateGallery
**When** the Templates panel is open
**Then** the active template name is displayed in a clearly readable label (e.g., a dedicated "Active template:" line or a prominent badge); the name is never obscured by the thumbnail or cropped by overflow

**Given** a WorkExperienceItem or ProjectItem has `startDate` and/or `endDate` values
**When** the date range is rendered in `WorkExperienceSectionRenderer` or `ProjectsSectionRenderer`
**Then** dates are formatted as `MM/YYYY` (e.g., `"03/2022 — 06/2024"`); when `isCurrent` is true or `endDate` is null the end reads `"Present"`; when both dates are null an empty string is returned; the existing `formatDateRange` utility in `lib/dateUtils.ts` is extended or replaced with a `formatMonthYear` helper

**Given** an EducationItem has `startDate` and/or `endDate` values
**When** the date range is rendered in `EducationSectionRenderer`
**Then** dates are formatted as `YYYY` only (e.g., `"2018 — 2022"`); a `formatYear` helper is added to `lib/dateUtils.ts`

**Given** a CertificationItem has `issueDate` but no `expirationDate`
**When** `CertificationsSectionRenderer` renders that item
**Then** only the `issueDate` is shown with no trailing separator or "No expiry" text; the `?? "No expiry"` fallback is removed

**Given** the story is implemented
**When** tests are run
**Then** `lib/dateUtils.test.ts` adds branches for `formatMonthYear` (both dates, isCurrent, null) and `formatYear` (date present, null); `WorkExperienceSectionRenderer.test.tsx` verifies MM/YYYY format; `CertificationsSectionRenderer.test.tsx` verifies no "No expiry" text when expirationDate is null

### Story 4.2: Classic Template Two-Column Layout Fix

As a user with the Classic template selected,
I want the two resume columns to flow independently,
So that items in the right column are not forced to align row-by-row with items in the left column.

**Acceptance Criteria:**

**Given** the Classic template (`layoutType: "two-column"`) is applied
**When** `ResumeCanvas` renders the two-column layout
**Then** the layout uses two sibling `<div className="flex flex-col">` containers side by side (not CSS Grid `gridTemplateColumns`); items in the left column and right column flow independently — no cross-column row alignment occurs

**Given** the two-column layout is rendered
**When** the right column has fewer items than the left
**Then** right-column items are packed to the top of their column; no empty space pushes them down to align with left-column rows

**Given** the Classic template definition in `V6__backfill_template_definitions.sql`
**When** sections are assigned to columns
**Then** the `SUMMARY` section appears first in the right column's `columns.right` array; the rendered right column shows Summary before any other right-column section

**Given** single-column and modern-accent templates are in use
**When** `ResumeCanvas` renders
**Then** those layouts are unaffected by this change; they continue to use their existing non-grid render path

**Given** the story is implemented
**When** tests are run
**Then** `ResumeCanvas.test.tsx` verifies: two-column layout renders two sibling flex containers (not a CSS grid element); sections in `columns.right` appear inside the right container; Summary renders first in the right container for the Classic template fixture

### Story 4.3: Dashboard Resume Card Live Preview

As a user on the dashboard,
I want each resume card to show a scaled-down visual preview of the actual resume content,
So that I can identify my resumes at a glance without needing to open them.

**Acceptance Criteria:**

**Given** the dashboard renders a user's resumes
**When** `ResumeDashboardCard` mounts
**Then** the existing gray placeholder area is replaced with a scaled-down read-only `ResumeCanvas` rendering the resume's actual content and template styles

**Given** the resume has a `templateId`
**When** the preview renders
**Then** `ResumeCanvas` receives the `templateId` and applies template CSS variables and layout; the preview reflects the real template appearance

**Given** `ResumeCanvas` is rendered inside the card preview area
**When** the preview scales down to fit the card
**Then** a CSS `transform: scale(N)` with `transform-origin: top left` and a fixed-size outer clip container is used; the aspect ratio remains A4 (1:1.414); the preview is non-interactive (no `onTitleChange` or `onFieldChange` props passed)

**Given** the dashboard card preview is visible
**When** the user interacts with the card (hover, click)
**Then** the preview does not respond to interaction; hover actions (Open, Duplicate, Delete, Export) overlay the preview as before; the resume name and metadata badges remain below the preview

**Given** the story is implemented
**When** tests are run
**Then** `ResumeDashboardCard.test.tsx` verifies a `ResumeCanvas` component is rendered inside the preview area with the resume's content and without edit callbacks

### Story 4.4: Section Item Add, Delete & Drag-to-Reorder

As a user editing a resume,
I want to add new items, delete existing items, and reorder items within any section by dragging,
So that I have full control over every entry in my resume without leaving the editor.

**Acceptance Criteria:**

**Given** the user hovers over any item in any section renderer (edit mode only)
**When** the hover state activates
**Then** a delete icon (trash icon from `lucide-react`) appears on the item; clicking it removes the item from the section immediately (optimistic update) and triggers autosave

**Given** the user hovers over a section in edit mode
**When** the hover state activates on the section container
**Then** add-item affordances (a `+` icon button) appear: one before the first item, one after the last item, and one between each pair of adjacent items; clicking any add affordance inserts a new empty item at that position and triggers autosave

**Given** a new empty item is inserted
**When** it appears in the section
**Then** the item is created with a new `UUID` as its `id`, all fields set to empty strings or null; the new item's first editable field receives focus automatically

**Given** edit mode is active on a section with multiple items
**When** the user drags an item using `@dnd-kit/sortable`
**Then** items within the section reorder in real time during drag; on drop, the new order is committed to `useResumeStore` and autosave is triggered; items do not cross section boundaries

**Given** `useResumeStore` is updated
**When** add, delete, or reorder actions are dispatched
**Then** three new store actions exist: `addItem(sectionType, item, position)`, `deleteItem(sectionType, itemId)`, `reorderItems(sectionType, newItems)`; all state updates follow the immutable `set(state => ...)` pattern

**Given** the story is implemented
**When** tests are run
**Then** `useResumeStore.test.ts` covers `addItem` (inserts at correct position), `deleteItem` (removes by id), `reorderItems` (updates section items array immutably); at least one section renderer test verifies the delete icon appears and calls `onDeleteItem`

### Story 4.5: Section Order Override in Resume Canvas

As a user,
I want the section order I set in the Sections sidebar to be reflected in the resume canvas,
So that I can control the relative position of sections within each column without the template overriding my preference.

**Acceptance Criteria:**

**Given** the user reorders sections in `SectionsPanel`
**When** `ResumeCanvas` renders a single-column or modern-accent template
**Then** sections appear in the order defined by `currentResume.content.sections` (user's order), not the template's `sectionOrder` array; visible sections come first in user order, hidden sections are excluded

**Given** the user reorders sections in `SectionsPanel` with a two-column template active
**When** `ResumeCanvas` renders the two-column layout
**Then** each section still renders in its template-assigned column (left or right per `columns.left` / `columns.right`); within each column, sections appear in the relative order they occupy in `currentResume.content.sections`; the template column arrays no longer control intra-column ordering

**Given** `getOrderedSections` in `lib/templateUtils.ts` is updated
**When** it is called
**Then** the function no longer applies `template.sectionOrder` or `columns.left/right` arrays as ordering keys; instead it uses the `sections` array order from the document and only uses template column arrays for column assignment (two-column) or as a visibility fallback (no template)

**Given** a section exists in the document but is not listed in any template column array
**When** `ResumeCanvas` renders in two-column mode
**Then** the unassigned section appends to the right column (existing fallback); this behaviour is unchanged

**Given** the story is implemented
**When** tests are run
**Then** `templateUtils.test.ts` (or `ResumeCanvas.test.tsx`) verifies: user reorder to put SKILLS before WORK_EXPERIENCE in a single-column template renders in that order; user reorder within a two-column template respects intra-column ordering while column assignment stays correct

### Story 4.6: Profile Page Navigation & First Entry Deletion

As a user filling in my profile,
I want to freely jump between any section and delete any entry — including the first one in each section,
So that I can edit my profile non-linearly and keep only the information that is relevant to me.

**Acceptance Criteria:**

**Given** the profile page step navigator is visible
**When** the user clicks any step name
**Then** the profile page navigates to that step immediately regardless of whether earlier steps are complete; no validation gate prevents navigation

**Given** steps in the profile progress indicator
**When** a step has been previously visited or saved
**Then** completed steps are NOT shown with `line-through` CSS or a `✓` prefix; instead they are visually distinguished by a different color (e.g., a filled indicator dot in `blue-600`) or a subtle completed state; the current step remains highlighted as before

**Given** the user is on any profile section step (Experience, Education, Skills, Certifications, Languages, Projects, Volunteering)
**When** the section has one or more items
**Then** a delete button is visible on all items including the first one; clicking delete removes that item; if all items are deleted the section is left empty (no mandatory minimum)

**Given** all items in a section are deleted
**When** the user saves the profile
**Then** `PUT /api/v1/profile` is called with an empty list for that section; the server persists the empty list; no validation error is raised for an empty section

**Given** the story is implemented
**When** tests are run
**Then** `ProfilePage.test.tsx` verifies: clicking step 3 from step 1 navigates to step 3; completed steps have no `line-through` class and no `✓` text; a delete button exists on the first item of a non-empty section

### Story 4.7: Settings Page with Password Change

As an authenticated user,
I want a dedicated settings page where I can change my password,
So that I can manage my account security without contacting support.

**Acceptance Criteria:**

**Given** an authenticated user navigates to `/settings`
**When** the page renders
**Then** `SettingsPage.tsx` is shown within `AppShell`; the page has a "Security" card containing a password change form; the layout is structured as extensible cards so additional setting categories can be added later without redesign

**Given** the password change form is rendered
**When** the user interacts with it
**Then** three fields are shown: "Current password", "New password", "Confirm new password"; all are `<input type="password">`; a "Change Password" submit button is present

**Given** the user submits the password change form
**When** new password and confirm password do not match
**Then** an inline validation error "Passwords do not match" is shown client-side; no API call is made

**Given** the user submits the password change form with matching passwords
**When** `PUT /api/v1/users/me/password` is called
**Then** the backend validates the current password; if correct and new password meets constraints (min 8 characters), the `password_hash` is updated in the `users` table and HTTP 204 is returned; a "Password changed successfully" Toast is shown on the frontend

**Given** the current password provided is incorrect
**When** `PUT /api/v1/users/me/password` is processed
**Then** HTTP 400 is returned with `ProblemDetail` detail "Current password is incorrect"; the frontend shows this message below the "Current password" field

**Given** the app shell navigation is updated
**When** any authenticated user views the app
**Then** a "Settings" link in the app shell header or user menu navigates to `/settings`

**Given** `UserController` (or `AuthController`) is updated with the password change endpoint
**When** unit and integration tests are run
**Then** `AuthServiceTest.java` (or a new `UserServiceTest.java`) covers: correct current password → hash updated; incorrect current password → `InvalidCredentialsException`; new password too short → validation error; `SettingsPage.test.tsx` verifies form submission, mismatch error display, and success Toast

### Story 4.8: SkillItem Domain Simplification

As a developer,
I want `SkillItem` to hold only `id` and `name`, with `category` and `proficiency` removed,
So that the skill domain is not burdened by unused fields that add no value to the current rendering or editing experience.

**Acceptance Criteria:**

**Given** `SkillItem` Java record is updated
**When** the project compiles
**Then** `SkillItem(String id, String name)` is the only constructor; `category` and `proficiency` fields no longer exist; all call sites compile without error

**Given** Flyway migration is applied
**When** the application starts against an existing database
**Then** `category` and `proficiency` keys are removed from every `SkillItem` object in all `resumes.resume_content` JSONB documents; items in `SKILLS` sections retain their `id` and `name` fields; no data loss for the `name` field

**Given** `LlmSectionExtractor` constructs `SkillItem`
**When** it processes an LLM-extracted skills section
**Then** only `id` (UUID) and `name` (extracted skill name) are set; no `category` or `proficiency` mapping logic remains

**Given** `ResumeService.buildFromProfile()` maps `Skill` entities to `SkillItem`
**When** the mapping runs
**Then** `new SkillItem(UUID.randomUUID().toString(), skill.getName())` — no category or proficiency mapping

**Given** `SkillItemDto` TypeScript interface is updated
**When** the frontend consumes it
**Then** `SkillItemDto` has fields `type: "SKILLS"`, `id: string`, `name: string | null` only; `category` and `proficiency` are removed; TypeScript strict mode produces no errors

**Given** `SkillsSectionRenderer` is updated
**When** it renders a skills section
**Then** skills are always rendered as a flat list of `name` chips; all category grouping logic is removed; the component is simpler and has no conditional category-grouping branch

**Given** the story is implemented
**When** tests are run
**Then** `ResumeItemSerializationTest.java` round-trips the simplified `SkillItem` with only `id` and `name`; `SkillsSectionRenderer.test.tsx` verifies flat chip rendering with no category label

### Story 4.9: Extended Summary Profile Fields — Contact & Links

As a user,
I want to add LinkedIn, personal website, blog, email, and location to my profile summary,
So that these contact details are rendered in my resume header automatically.

**Acceptance Criteria:**

**Given** Flyway migration is applied
**When** the application starts
**Then** the `profiles` table gains six nullable columns: `linked_in_url VARCHAR`, `personal_page_url VARCHAR`, `blog_url VARCHAR`, `contact_email VARCHAR`, `location_country VARCHAR`, `location_city VARCHAR`

**Given** `Profile` entity is updated
**When** profile data is loaded
**Then** `Profile` has fields `linkedInUrl`, `personalPageUrl`, `blogUrl`, `contactEmail`, `locationCountry`, `locationCity` mapped to the new columns; all are nullable

**Given** `ProfileUpdateRequest` and `ProfileDto` are updated
**When** `PUT /api/v1/profile` is called
**Then** the six new fields are accepted in the request body and returned in `ProfileDto`; null values in the request leave existing values unchanged (consistent with existing PUT-replace strategy for scalar fields)

**Given** the profile page Summary step is updated
**When** the user opens the Summary step
**Then** input fields for all six new fields are shown; the `contact_email` field is pre-populated with the signed-in user's email address on first load if the field is empty; all fields are optional

**Given** `SummaryItem` Java record and `SummaryItemDto` TypeScript interface are updated
**When** profile-to-resume mapping runs
**Then** `SummaryItem` gains nullable fields `linkedInUrl`, `personalPageUrl`, `blogUrl`, `contactEmail`, `locationCountry`, `locationCity` mapped from the Profile entity; `SummaryItemDto` gains the same fields as `string | null`

**Given** `SummarySectionRenderer` is updated
**When** a `SummaryItem` with non-null contact fields is rendered
**Then** a contact row renders above the summary text with only non-null fields shown: email as plain text, LinkedIn/personalPage/blog as anchor links with appropriate icons (from `lucide-react`), location as "City, Country" text; null fields are omitted entirely

**Given** `buildFromProfile()` is updated
**When** a resume is created from a profile
**Then** the six new fields are mapped from `Profile` to `SummaryItem`; a null `profile.contactEmail` does NOT fall back to the user's login email (only the profile page pre-populates it; backend mapping is a direct null pass-through)

**Given** the story is implemented
**When** tests are run
**Then** `ResumeServiceTest.java` `buildFromProfile_allSections` test is updated to assert the six new fields are mapped; `SummarySectionRenderer.test.tsx` verifies non-null fields render and null fields are omitted; a Flyway migration test asserts existing profiles are unaffected (new columns default to null)

### Story 4.10: Parsing Service & ParsedResumeDto Refactor

As a user uploading a resume,
I want the LLM extraction result to be returned when Ollama is available,
So that my profile is seeded with structured, typed data rather than flat lines of text.

**Acceptance Criteria:**

**Given** `ParsedResumeDto` is refactored
**When** any code constructs or reads it
**Then** `ParsedResumeDto` is a record with typed section lists: `workExperiences: List<WorkExperienceItem>`, `education: List<EducationItem>`, `skills: List<SkillItem>`, `certifications: List<CertificationItem>`, `languages: List<LanguageItem>`, `projects: List<ProjectItem>`, `volunteering: List<VolunteeringItem>`, `summary: SummaryItem | null`, `rawText: String`; the old flat `workExperienceLines`, `educationLines`, `skillLines` fields are removed

**Given** `LlmSectionExtractor.extract()` is updated
**When** it processes raw sections
**Then** the return type is `ParsedResumeDto` (not `ResumeDocument`); the method maps each extracted `ResumeSection` and its typed items to the corresponding `ParsedResumeDto` list; sections not recognized (UNKNOWN) are ignored in the DTO (raw text still present via `rawText`)

**Given** Ollama is available when `ParsingService.parse()` is called
**When** LLM extraction succeeds
**Then** the `ParsedResumeDto` returned by `LlmSectionExtractor.extract()` is returned to the caller; `heuristicResult` is no longer returned when LLM succeeds

**Given** Ollama is unavailable or LLM extraction throws or times out
**When** `ParsingService.parse()` handles the failure
**Then** a heuristic-derived `ParsedResumeDto` is returned; the heuristic path constructs the new DTO shape from the existing flat line lists (work experience lines → `WorkExperienceItem` objects with only `description` populated, etc.); the upload endpoint always returns HTTP 200

**Given** the frontend `useResumeUpload.ts` mapper is updated
**When** the upload response arrives
**Then** the mapper reads typed section arrays from `ParsedResumeDto` and maps them to the profile form state; e.g., `workExperiences` maps to `ProfileUpdateRequest.workExperiences` using item fields directly instead of parsing raw strings; the mapper handles null/empty lists gracefully

**Given** the story is implemented
**When** tests are run
**Then** `ParsingServiceTest.java` is updated to assert: when Ollama is available, `LlmSectionExtractor.extract()` result is returned; when unavailable, heuristic DTO is returned; `LlmSectionExtractorTest.java` verifies the new `ParsedResumeDto` return type; frontend `useResumeUpload.test.ts` verifies structured field mapping for at least `workExperiences` and `skills`

### Story 4.11: Multi-Page A4 Resume Rendering

As a user previewing or editing a resume,
I want the resume canvas to display content across multiple A4-sized pages instead of stretching indefinitely,
So that I can accurately see how my resume will look when exported or printed.

**Acceptance Criteria:**

**Given** a resume has content that exceeds a single A4 page height
**When** `ResumeCanvas` renders the resume
**Then** the content is split across multiple A4-page containers; each page container has a fixed height of `297mm` (at 1:1 scale, adjusted by the canvas scale factor); pages are stacked vertically with a visible gap between them

**Given** multiple pages are rendered
**When** the user views the canvas
**Then** each page has its own shadow and white background, matching the existing single-page appearance; there is a clearly visible gap (e.g., `bg-zinc-200` background between pages) that communicates the page boundary

**Given** the canvas scale factor changes (responsive layout)
**When** the page height is calculated
**Then** the `297mm` base height is multiplied by the current scale factor consistently; pages do not overflow their containers at any supported viewport width

**Given** a section item would be split across two pages
**When** the pagination renders
**Then** `break-inside: avoid` CSS is applied to each item wrapper so individual items are not split mid-render; sections that are taller than a full page still render in full (they are not truncated)

**Given** the resume has content that fits on a single page
**When** the canvas renders
**Then** only one page container is rendered; no empty second page appears; existing rendering and styling are unchanged for single-page content

**Given** the story is implemented
**When** tests are run
**Then** `ResumeCanvas.test.tsx` verifies: a fixture with long content renders more than one page container; a short fixture renders exactly one page container; page containers have the correct height class/style

---
