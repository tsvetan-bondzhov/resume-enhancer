# Epic 5: Export & Document Generation

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
