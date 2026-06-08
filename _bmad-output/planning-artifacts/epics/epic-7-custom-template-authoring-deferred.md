# Epic 7: Custom Template Authoring (Deferred)

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
