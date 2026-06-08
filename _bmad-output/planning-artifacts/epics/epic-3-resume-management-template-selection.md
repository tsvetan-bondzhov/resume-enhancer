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
