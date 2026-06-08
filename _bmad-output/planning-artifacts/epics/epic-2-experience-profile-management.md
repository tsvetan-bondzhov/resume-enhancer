# Epic 2: Experience Profile Management

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
