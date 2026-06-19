# Story 6.1: DocumentRenderer Interface & PdfRenderer

**Status:** done
**Epic:** 6 — Export & Document Generation
**Story Key:** 6-1-documentrenderer-interface-and-pdfrenderer
**Dependencies:** Epic 5 all done; `ResumeDocument` hierarchy (story 3-13/3-14) stable; `TemplateDefinition`/`TemplateLayout`/`TemplateColumns`/`SectionStyle` records already exist in `export/` package

---

## Story

As an authenticated user,
I want to export my resume as a PDF rendered according to my selected template,
So that I have a professionally formatted, ATS-compatible document ready to submit.

---

## Acceptance Criteria

**AC1 — DocumentRenderer interface contract**
**Given** the `DocumentRenderer` interface is defined in the `export` package
**When** any renderer is inspected
**Then** the interface contract is `render(ResumeDocument doc, ResumeTemplate template) → byte[]`; `PdfRenderer` and `DocxRenderer` implement it independently with no shared mutable state

**AC2 — Export endpoint**
**Given** an authenticated user calls `GET /api/v1/resumes/{resumeId}/export?format=pdf`
**When** the request is processed
**Then** `OllamaHealthGuard` is NOT consulted (export has no AI dependency); `ExportService` calls `PdfRenderer.render()` with the resume's `ResumeDocument` and its associated `ResumeTemplate`; the response streams the `byte[]` with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="<resumeName>.pdf"`

**AC3 — PDF layout matches template**
**Given** `PdfRenderer` renders a `ResumeDocument` via iText 8
**When** the output PDF is inspected
**Then** the layout matches the selected template (sections in correct order per `TemplateLayout.sectionOrder`, correct typography from `cssVariables`); the document is ATS-compatible: single-column, semantic text, no graphics or skill-bar images, all text selectable (NFR4, FR37)

**AC4 — Progress bar for long exports (≥2s)**
**Given** the export takes longer than 2 seconds
**When** the UI monitors the export request
**Then** a linear progress bar appears in the editor toolbar (`isExporting` flag in `useResumeStore`); the progress bar clears when the download is triggered (UX-DR19)

**AC5 — "Download ready" Toast**
**Given** the export completes successfully
**When** the file download begins
**Then** a "Download ready" `Toast` appears bottom-right with 4s auto-dismiss; the progress bar is removed (UX-DR19)

**AC6 — Unit and integration tests**
**Given** `PdfRenderer` is implemented
**When** unit tests are run
**Then** `PdfRendererTest.java` uses no Spring context (`@ExtendWith(MockitoExtension.class)` only); at least two real-world template + document combinations are rendered and the output `byte[]` is verified non-empty and valid (readable by PDFBox in test); an `ExportControllerIntegrationTest.java` covers the happy-path `GET /export?format=pdf` against Testcontainers PostgreSQL

**AC7 — Unpublished template fallback**
**Given** a resume is associated with a template that has been unpublished by an admin
**When** the user attempts to export
**Then** `ExportService` falls back to `TemplateDefinition.DEFAULT` rather than failing; export succeeds with HTTP 200

---

## Tasks / Subtasks

### Task 1: Define `DocumentRenderer` interface (AC: 1)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/DocumentRenderer.java`
  ```java
  package com.tsvetanbondzhov.resumeenhancer.export;

  import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
  import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;

  public interface DocumentRenderer {
      byte[] render(ResumeDocument doc, ResumeTemplate template);
  }
  ```
- [x] No Spring annotations on the interface — renderers are stateless `@Component` beans

---

### Task 2: Implement `PdfRenderer` using iText 8 (AC: 1, 3, 6)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/PdfRenderer.java`
- [x] Annotate with `@Component` — Spring-managed, `@Qualifier("pdf")` on bean declaration so `ExportService` can inject it by name
- [x] Implement `DocumentRenderer` — `render(ResumeDocument doc, ResumeTemplate template) → byte[]`
- [x] **iText 8 imports** — use `com.itextpdf.kernel.pdf.*`, `com.itextpdf.layout.*`, `com.itextpdf.layout.element.*`, `com.itextpdf.layout.properties.*`. The project uses `com.itextpdf:itext-core:8.0.5` (BOM-type POM dependency). Key classes: `PdfDocument`, `PdfWriter`, `Document`, `Paragraph`, `List` (iText List), `Text`, `Cell`, `Table`.
- [x] **Template deserialization**: call `TemplateDefinitionService.resolve(template)` (new helper, see Task 3) to get a typed `TemplateDefinition` from the `Map<String, Object> templateDefinition` on `ResumeTemplate`
- [x] **PDF generation logic**:
  1. Create `ByteArrayOutputStream baos = new ByteArrayOutputStream()`
  2. `PdfWriter writer = new PdfWriter(baos)` → `PdfDocument pdfDoc = new PdfDocument(writer)` → `Document document = new Document(pdfDoc, PageSize.A4)`
  3. Set margins from `cssVariables` keys `--page-margin-top`, `--page-margin-right`, `--page-margin-bottom`, `--page-margin-left` (values are strings like `"0.75in"` — parse via `parseMargin(String)` helper)
  4. Render header: candidate name (from `SummaryItem.contactEmail` / `linkedInUrl`). **IMPORTANT**: Header content is the `SummaryItem` text and contact fields. Render full name placeholder if no SUMMARY section — do not throw.
  5. Render sections in `templateDef.layout().sectionOrder()` order, skipping sections where `ResumeSection.visible() == false`
  6. For each visible section: render section title as heading, then render items by type (pattern match on `ResumeItem` sealed subtypes)
  7. After all content: `document.close()` → `return baos.toByteArray()`
- [x] **Section rendering by type** (pattern-match on `ResumeItem` sealed interface):
  - `WorkExperienceItem`: jobTitle + company + date range + description paragraph
  - `EducationItem`: institution + degree + fieldOfStudy + date range
  - `SkillItem`: name (render all skills comma-separated in one paragraph — ATS friendly)
  - `CertificationItem`: name + issuer + issueDate
  - `LanguageItem`: language + proficiency
  - `ProjectItem`: name + technologies + description
  - `VolunteeringItem`: role + organization + description + date range
  - `SummaryItem`: render as italic introductory paragraph above all sections
  - `GenericItem`: render as plain text paragraph
- [x] **ATS compliance constraints** (NFR4, FR37):
  - No `Image` elements, no graphics, no decorative shapes
  - Skills are plain comma-separated text, not visual bars
  - All text must be actual PDF text (not images of text)
  - Single-column layout even if template is `two-column` (two-column is a frontend CSS concern only; PDF must be ATS-single-column)
- [x] **Font**: use iText 8's built-in standard fonts only (e.g. `PdfFontFactory.createFont(StandardFonts.HELVETICA)`) — do not load external font files. Apply font size from `--font-size-base` cssVariable (default `"11px"`, convert px → pt: multiply by 0.75).
- [x] **No shared mutable state**: renderer is `@Component` (singleton) — all state lives in local variables within `render()`

---

### Task 3: Add `TemplateDefinitionService` helper (AC: 2, 7)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinitionService.java`
- [x] `@Component` — injectable utility for deserializing `Map<String, Object>` → `TemplateDefinition`
- [x] Uses Jackson `ObjectMapper` for deserialization:
  ```java
  @Component
  public class TemplateDefinitionService {
      private final ObjectMapper objectMapper;
      
      public TemplateDefinitionService(ObjectMapper objectMapper) {
          this.objectMapper = objectMapper;
      }
      
      public TemplateDefinition resolve(ResumeTemplate template) {
          if (template == null || template.getTemplateDefinition() == null) {
              return TemplateDefinition.DEFAULT;
          }
          try {
              return objectMapper.convertValue(template.getTemplateDefinition(), TemplateDefinition.class);
          } catch (Exception e) {
              return TemplateDefinition.DEFAULT;  // AC7: never throw on bad definition
          }
      }
  }
  ```
- [x] **Jackson `convertValue` note**: `TemplateDefinition` is a Java record — Jackson handles record deserialization natively in Jackson 2.12+. The project's Jackson is managed by Spring Boot 4.x — records are supported.

---

### Task 4: Create `ExportService` (AC: 2, 7)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportService.java`
- [x] `@Service` — orchestrates export pipeline
- [x] Dependencies: `ResumeRepository`, `TemplateRepository`, `TemplateDefinitionService`, and the `DocumentRenderer` implementations
- [x] **Method signature**:
  ```java
  public byte[] exportResume(String userEmail, UUID resumeId, String format)
  ```
- [x] **Logic**:
  1. Load `Resume` by `resumeId` — verify ownership (same pattern as `ResumeService.getResume`). Throw `ResumeAccessDeniedException` if not found/not owned.
  2. Get `ResumeDocument doc = resume.getResumeContent()`
  3. Load template: if `resume.getTemplateId() != null`, try `templateRepository.findByIdAndIsPublishedTrue(templateId)`. If empty (unpublished), fall back to a synthetic `ResumeTemplate` with `templateDefinition = TemplateDefinition.DEFAULT` serialized to Map. (AC7)
  4. Dispatch to renderer by format string (lowercase):
     - `"pdf"` → `PdfRenderer`
     - `"docx"` → `DocxRenderer` (story 6-2; not wired yet — throw `UnsupportedExportFormatException` for now with message `"DOCX export not yet implemented"` — story 6-2 will wire it)
     - anything else → throw `UnsupportedExportFormatException("Unsupported export format. Use 'pdf' or 'docx'.")`
  5. Return the `byte[]` from the renderer
- [x] **IMPORTANT — Template fallback for AC7**: When `templateId` is null OR the template is unpublished, use `TemplateDefinition.DEFAULT` rather than failing. To pass a fallback `ResumeTemplate` to `PdfRenderer.render()`, create a helper method in `ExportService` that builds a minimal `ResumeTemplate` POJO with `templateDefinition` set to the Jackson-serialized DEFAULT map.
- [x] **No `OllamaHealthGuard` call** — export has zero AI dependency (AC2).

---

### Task 5: Create `UnsupportedExportFormatException` (AC: 2)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/UnsupportedExportFormatException.java`
  ```java
  package com.tsvetanbondzhov.resumeenhancer.export;

  public class UnsupportedExportFormatException extends RuntimeException {
      public UnsupportedExportFormatException(String message) {
          super(message);
      }
  }
  ```
- [x] Register in `GlobalExceptionHandler.java` — add handler returning `ProblemDetail` with `HttpStatus.BAD_REQUEST` and the exception message. Follow the existing `@ExceptionHandler` pattern in that class.

---

### Task 6: Create `ExportController` (AC: 2)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportController.java`
- [x] `@RestController`, `@RequestMapping("/api/v1/resumes")`, `@Tag(name = "Export")`
- [ ] **Endpoint**:
  ```java
  @GetMapping("/{resumeId}/export")
  public ResponseEntity<byte[]> exportResume(
          Authentication authentication,
          @PathVariable UUID resumeId,
          @RequestParam String format) {
      byte[] content = exportService.exportResume(authentication.getName(), resumeId, format.toLowerCase());
      String filename = exportService.getResumeName(authentication.getName(), resumeId)
              .replaceAll("[^a-zA-Z0-9\\-_ ]", "") + "." + format.toLowerCase();
      return ResponseEntity.ok()
              .header(HttpHeaders.CONTENT_TYPE, resolveContentType(format))
              .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
              .body(content);
  }
  ```
- [x] `resolveContentType(String format)` private helper: `"pdf"` → `"application/pdf"`, `"docx"` → `"application/vnd.openxmlformats-officedocument.wordprocessingml.document"`, else throw `UnsupportedExportFormatException`
- [x] `ExportService.getResumeName()` — add a convenience method to `ExportService` that fetches just the resume name for the filename. Or inline the resume name fetch inside `exportResume()` and return a DTO-like record internally. Keep controller thin.
- [x] **No `OllamaHealthGuard` call** — export has zero AI dependency (AC2)
- [x] **Security**: endpoint is under `/api/v1/**` → JWT-protected by `SecurityConfig` (no changes to `SecurityConfig` needed)

---

### Task 7: Add export action to `EditorToolbar` (AC: 4, 5)

- [x] Open `frontend/src/components/resume/EditorToolbar.tsx`
- [x] Add `isExporting: boolean` and `onExportPdf: () => void` to `EditorToolbarProps` interface
- [x] Add "Export PDF" button in the toolbar next to "Save As":
  ```tsx
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={onExportPdf}
    disabled={isExporting}
    aria-label="Export resume as PDF"
  >
    {isExporting ? "Exporting…" : "Export PDF"}
  </Button>
  ```
- [x] Add progress bar below the toolbar (or inside it) that is visible only when `isExporting`:
  ```tsx
  {isExporting && (
    <div
      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 animate-[indeterminate_1.5s_ease-in-out_infinite]"
      role="progressbar"
      aria-label="Exporting…"
    />
  )}
  ```
  Note: Use a simple CSS animation via Tailwind `animate-pulse` or a custom animation; the UX spec says "linear progress bar" — an indeterminate animation is acceptable since export duration is variable.

---

### Task 8: Wire export in `EditorPage` with Toast (AC: 4, 5)

- [x] Open `frontend/src/pages/EditorPage.tsx`
- [x] Import `useResumeStore` and destructure `isExporting`, `setExporting` (already exists in store)
- [x] Import `useToast` from `@/components/ui/use-toast` (shadcn/ui toast hook — already used in the project)
- [x] Add `exportPdf` async function:
  ```tsx
  const exportPdf = async () => {
    if (!resumeId) return
    setExporting(true)
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`/api/v1/resumes/${resumeId}/export?format=pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? "Export failed")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${currentResume?.name ?? "resume"}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ description: "Download ready", duration: 4000 })
    } catch (err) {
      toast({ description: err instanceof Error ? err.detail ?? err.message : "Export failed", variant: "destructive", duration: 8000 })
    } finally {
      setExporting(false)
    }
  }
  ```
- [x] **Why raw `fetch` instead of `apiClient`**: `apiClient.get<T>()` calls `res.json()` which is wrong for a binary PDF blob. The export endpoint returns binary data, so a direct `fetch` that reads `res.blob()` is necessary. This is an intentional exception to the "no raw fetch" rule — document it with a comment in the file.
- [x] Pass `isExporting` and `onExportPdf={exportPdf}` to `<EditorToolbar />`

---

### Task 9: Write `PdfRendererTest.java` (AC: 6)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/PdfRendererTest.java`
- [x] `@ExtendWith(MockitoExtension.class)` only — NO Spring context
- [x] Inject `PdfRenderer` directly: `new PdfRenderer(new TemplateDefinitionService(new ObjectMapper()))`
- [x] **Test fixture 1 — Default single-column template + full document**:
  - Build a `ResumeDocument` with SUMMARY, WORK_EXPERIENCE, EDUCATION, SKILLS sections (2-3 items each)
  - Build a `ResumeTemplate` with `templateDefinition = null` (triggers DEFAULT fallback)
  - Call `renderer.render(doc, template)` → assert `byte[].length > 0`
  - Verify the PDF is a valid PDF: load via PDFBox `PDDocument.load(bytes)` → assert page count ≥ 1
  - `PDDocument.load()` is from `org.apache.pdfbox:pdfbox:3.0.3` which is already on the classpath (used for upload parsing)
- [x] **Test fixture 2 — Single section document**:
  - Build a `ResumeDocument` with only SKILLS section (3 skills)
  - Build a `ResumeTemplate` with a valid `templateDefinition` JSON map (use `TemplateDefinition.DEFAULT` serialized via Jackson)
  - Assert `byte[].length > 0` and valid PDF (PDFBox load)
- [x] **Test: empty document renders without throwing**:
  - `ResumeDocument` with empty sections list
  - Assert no exception thrown; `byte[].length > 0`
- [x] **Test: null templateDefinition falls back to DEFAULT**:
  - Template with `null` `templateDefinition` → renders successfully (AC7)

---

### Task 10: Write `ExportControllerIntegrationTest.java` (AC: 6)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/ExportControllerIntegrationTest.java`
- [x] Follow `ResumeControllerIntegrationTest` exactly for setup pattern:
  - `@SpringBootTest(webEnvironment = RANDOM_PORT)`, `@ActiveProfiles("test")`
  - Inline `@TestConfiguration` with `@ServiceConnection PostgreSQLContainer` (postgres:16)
  - `WebTestClient` for HTTP calls
- [x] `@BeforeEach`: clean `resumeRepository`, `userRepository`, `templateRepository`
- [x] **Helper**: `signup(email, password)` → JWT token string; `createResume(token, templateId)` → resume UUID
- [x] **Test 1 — Happy path PDF export**:
  ```
  Given authenticated user with a resume
  When GET /api/v1/resumes/{id}/export?format=pdf
  Then 200, Content-Type: application/pdf, Content-Disposition: attachment; filename=*.pdf
  And body.length > 0
  ```
- [x] **Test 2 — Unauthenticated request**:
  ```
  Given no Authorization header
  When GET /api/v1/resumes/{id}/export?format=pdf
  Then 401
  ```
- [x] **Test 3 — Resume not owned by user**:
  ```
  Given user B authenticated, resume owned by user A
  When GET /api/v1/resumes/{resumeAId}/export?format=pdf
  Then 403 or 404 (ResumeAccessDeniedException → 404 per GlobalExceptionHandler pattern)
  ```
- [x] **Test 4 — Unsupported format**:
  ```
  When GET /api/v1/resumes/{id}/export?format=txt
  Then 400 ProblemDetail with detail containing "Unsupported export format"
  ```
- [x] **NOTE on Ollama**: Integration test must NOT start Ollama container — the export endpoint has no AI dependency. The `TestcontainersConfiguration` in the root test package includes Ollama; use the isolated inline `ContainersConfig` pattern (PostgreSQL only) as in `ResumeControllerIntegrationTest`.

---

### Task 11: Frontend unit test for EditorToolbar export button (AC: 4, 5)

- [x] Open `frontend/src/components/resume/EditorToolbar.test.tsx` (or create if missing)
- [x] Add test: `renders Export PDF button`:
  ```tsx
  it("renders Export PDF button and calls onExportPdf on click", () => {
    const onExportPdf = vi.fn()
    render(<EditorToolbar {...defaultProps} isExporting={false} onExportPdf={onExportPdf} />)
    const btn = screen.getByRole("button", { name: /export pdf/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onExportPdf).toHaveBeenCalledOnce()
  })
  ```
- [x] Add test: `shows Exporting… and disables button while exporting`:
  ```tsx
  it("shows 'Exporting…' and disables button when isExporting is true", () => {
    render(<EditorToolbar {...defaultProps} isExporting={true} onExportPdf={vi.fn()} />)
    const btn = screen.getByRole("button", { name: /export pdf/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent("Exporting…")
  })
  ```

---

## Developer Context & Guardrails

### Files to CREATE (NEW)

| File | Description |
|------|-------------|
| `src/main/java/.../export/DocumentRenderer.java` | Interface: `render(ResumeDocument, ResumeTemplate) → byte[]` |
| `src/main/java/.../export/renderers/PdfRenderer.java` | iText 8 PDF renderer, `@Component` |
| `src/main/java/.../export/TemplateDefinitionService.java` | Jackson deserialization helper for `Map<String,Object>` → `TemplateDefinition` |
| `src/main/java/.../export/ExportService.java` | Orchestrates renderer dispatch, fallback logic |
| `src/main/java/.../export/ExportController.java` | `GET /api/v1/resumes/{id}/export?format=` |
| `src/main/java/.../export/UnsupportedExportFormatException.java` | Domain exception for unknown format |
| `src/test/java/.../export/PdfRendererTest.java` | Pure unit test (Mockito only) |
| `src/test/java/.../export/ExportControllerIntegrationTest.java` | Testcontainers PostgreSQL integration test |

### Files to MODIFY (UPDATE)

| File | Change |
|------|--------|
| `src/main/java/.../common/GlobalExceptionHandler.java` | Add `@ExceptionHandler(UnsupportedExportFormatException.class)` → HTTP 400 ProblemDetail |
| `frontend/src/components/resume/EditorToolbar.tsx` | Add `isExporting`, `onExportPdf` props; Export PDF button; progress bar |
| `frontend/src/pages/EditorPage.tsx` | Wire `exportPdf()` function, pass to `EditorToolbar` |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | 6-1 status → ready-for-dev; epic-6 → in-progress |

### Files Already Existing in `export/` Package (DO NOT RE-CREATE)

These files exist and must be imported/used, not re-created:

| File | Status |
|------|--------|
| `src/main/java/.../export/TemplateDefinition.java` | EXISTS — record with `DEFAULT` constant, `isTwoColumn()`, `isModernAccent()` |
| `src/main/java/.../export/TemplateLayout.java` | EXISTS — record with `sectionOrder`, `columns`, `sectionStyles` |
| `src/main/java/.../export/TemplateColumns.java` | EXISTS — record with `left`/`right` lists |
| `src/main/java/.../export/SectionStyle.java` | EXISTS — record with `titleFormat`, `itemSeparator`, `showDates`, `showDescriptions` |
| `src/test/java/.../export/TemplateDefinitionTest.java` | EXISTS — do not touch |
| `src/test/java/.../export/TemplateLayoutTest.java` | EXISTS — do not touch |
| `src/test/java/.../export/TemplateColumnsTest.java` | EXISTS — do not touch |

### Critical Architecture Facts

**iText Version**: The project uses **iText 8.0.5** (NOT iText 7). The artifact is `com.itextpdf:itext-core:8.0.5` (BOM-style POM dependency). Key API differences from iText 7:
- `PdfWriter` constructor still accepts `OutputStream`
- `Document` still wraps `PdfDocument`
- `com.itextpdf.layout.element.List` → use `com.itextpdf.layout.element.List` for bullet lists (not `java.util.List`)
- Font: `PdfFontFactory.createFont(StandardFonts.HELVETICA)` — same as iText 7
- `PageSize.A4` — in `com.itextpdf.kernel.geom.PageSize`
- `Document.setMargins(float top, float right, float bottom, float left)` in points (not inches)
- iText 8 requires `AGPL-3.0` or commercial license; this is a portfolio/demo project — AGPL is acceptable.

**ResumeTemplate's `templateDefinition` field**: `Map<String, Object>` (JSONB). The `TemplateDefinitionService` uses `ObjectMapper.convertValue()` to convert it to a typed `TemplateDefinition` record. Jackson deserialization of records: ensure the Jackson version (Spring Boot 4.x ships Jackson 2.18.x) supports record deserialization — it does natively.

**`ResumeSection.visible()`**: Only render sections where `visible() == true`. The export must respect visibility toggles the user configured in the editor.

**Section order**: Determined by `templateDef.layout().sectionOrder()` (a `List<String>` of `ResumeSectionType` names). Sections in the document not present in `sectionOrder` should be appended at the end (or skipped — the safer choice for ATS is to skip). Match using `section.sectionType().name()`.

**Two-column templates and ATS**: Even if `templateDef.isTwoColumn() == true`, the PDF must render as **single-column** (ATS requirement, NFR4). The two-column layout is a frontend CSS concern. In the PDF, render left-column sections first, then right-column sections (from `TemplateColumns.left()` then `TemplateColumns.right()`), all in a single linear flow.

**`LanguageItem` field name**: The record has `language` (not `name`) and `proficiency` (not `proficiencyLevel`) — match exactly.

**`SummaryItem`**: Render as a special introductory block. Fields: `text`, `contactEmail`, `linkedInUrl`, `personalPageUrl`, `blogUrl`, `locationCountry`, `locationCity`. Render contact info in header, text as opening paragraph.

**`useResumeStore.setExporting`**: Already implemented in the store (`isExporting: false`, `setExporting: (isExporting) => set((state) => ({ ...state, isExporting }))`). Do NOT re-declare it.

**`apiClient` binary exception**: `apiClient.get<T>()` calls `res.json()` — wrong for PDF bytes. Use a direct `fetch()` call with `res.blob()` for the export action in `EditorPage.tsx`. Add a comment: `// Direct fetch (not apiClient) — export returns binary PDF, not JSON`. This is an explicit exception to the "all HTTP calls via apiClient" rule.

**Toast in EditorPage**: Check how other pages use `useToast`. Import from `@/hooks/use-toast` (shadcn/ui hook). Usage: `const { toast } = useToast()`.

**ExportController filename sanitization**: The resume name from DB may contain special characters. Sanitize: `filename.replaceAll("[^a-zA-Z0-9\\-_ .]", "_")`. Include the `.pdf` extension.

**`@ActiveProfiles("test")`**: Required on the integration test to disable Swagger and other prod-only config. Follow `ResumeControllerIntegrationTest` exactly.

**No Ollama in ExportController**: The export endpoint must NOT call `OllamaHealthGuard`. This means the test does not need to start an Ollama container (performance benefit — integration test will be fast).

**GlobalExceptionHandler — where to insert**: Add the new handler after the existing `handleTemplateNotFound` handler. Follow the exact existing format:
```java
@ExceptionHandler(UnsupportedExportFormatException.class)
public ProblemDetail handleUnsupportedExportFormat(UnsupportedExportFormatException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    problem.setTitle("Bad Request");
    return problem;
}
```

**Package structure for renderers**: Architecture doc specifies `export/renderers/` sub-package (same as `upload/parsers/` and `upload/validators/`). `PdfRenderer` goes in `com.tsvetanbondzhov.resumeenhancer.export.renderers`.

### Anti-Patterns to Avoid

- Do NOT use `itext7` APIs — the project uses iText **8** (groupId `com.itextpdf`, artifact `itext-core`). iText 7 had a different package `com.itextpdf.text` (older) — use `com.itextpdf.kernel` and `com.itextpdf.layout` packages.
- Do NOT add `OllamaHealthGuard` injection to `ExportController` or `ExportService`
- Do NOT use raw `ResponseEntity<Map<String, Object>>` in `ExportController` — use typed `ResponseEntity<byte[]>`
- Do NOT add `@SpringBootTest` to `PdfRendererTest.java` — pure unit test with Mockito only
- Do NOT include Ollama or Grafana containers in `ExportControllerIntegrationTest` — PostgreSQL only
- Do NOT call `apiClient.get<T>()` for binary PDF download in frontend — use raw `fetch()` + `res.blob()`
- Do NOT edit files under `frontend/src/components/ui/` — shadcn managed
- Do NOT implement `DocxRenderer` in this story — stub is acceptable (throw `UnsupportedExportFormatException`)
- Do NOT render skill bars, progress bars, or image-based graphics in the PDF — ATS incompatible
- Do NOT create a new Zustand store — use existing `useResumeStore.setExporting()`
- Do NOT add `@Deprecated` annotations (SonarQube S1133 was a previous violation — avoid)
- Do NOT use `rem` or `em` CSS units in template definitions — only `px` and `in` are accepted (TemplateService.updateTemplate already validates this)

### Package Naming Reference

```
com.tsvetanbondzhov.resumeenhancer.export
  ├── DocumentRenderer.java          ← NEW interface
  ├── ExportController.java          ← NEW
  ├── ExportService.java             ← NEW
  ├── SectionStyle.java              ← EXISTS
  ├── TemplateColumns.java           ← EXISTS
  ├── TemplateDefinition.java        ← EXISTS
  ├── TemplateDefinitionService.java ← NEW
  ├── TemplateLayout.java            ← EXISTS
  ├── UnsupportedExportFormatException.java ← NEW
  └── renderers/
      ├── PdfRenderer.java           ← NEW (this story)
      └── DocxRenderer.java          ← FUTURE (story 6-2)
```

---

## Dev Notes

### iText 8 vs iText 7 — Key Differences

The epic brief says "iText 7" but `pom.xml` declares `com.itextpdf:itext-core:8.0.5`. iText 8 maintains a very similar API to iText 7, but:
- Package names are the same (`com.itextpdf.kernel`, `com.itextpdf.layout`) in the Community edition
- `itext-core` in version 8 is a BOM that includes `kernel`, `layout`, `io`, `commons` submodules
- No separate `html2pdf` module needed for basic text PDF generation
- `PdfFont` creation: `PdfFontFactory.createFont(StandardFonts.HELVETICA)` — identical to iText 7
- `Document.add(IBlockElement)` — identical API
- License: AGPL-3.0 (Community edition) — fine for portfolio projects

### Margin Conversion: CSS Inches to iText Points

iText uses points (1 point = 1/72 inch). The `TemplateDefinition.DEFAULT` uses `"0.75in"`:
```java
private float parseMargin(String cssValue) {
    if (cssValue == null) return 54f; // 0.75in default
    if (cssValue.endsWith("in")) {
        return Float.parseFloat(cssValue.replace("in", "").trim()) * 72f;
    }
    if (cssValue.endsWith("px")) {
        return Float.parseFloat(cssValue.replace("px", "").trim()) * 0.75f;
    }
    return 54f; // fallback
}
```

### Font Size Conversion: CSS px to iText Points

`--font-size-base: "11px"` → 11 × 0.75 = 8.25pt. Use `8.25f` as the base font size for body text. Section headings: `+3pt` above base. Candidate name: `+8pt` above base.

### `TemplateDefinition.DEFAULT` Section Order

The DEFAULT template has `sectionOrder`:
```
["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]
```
Respect this order when rendering. Skip sections not in the document (no NPE).

### Template Fallback for AC7

When a resume's `templateId` points to an unpublished template, `TemplateRepository.findByIdAndIsPublishedTrue()` returns empty. The `ExportService` must not throw — create a minimal fallback:
```java
private ResumeTemplate buildFallbackTemplate() {
    ResumeTemplate t = new ResumeTemplate();
    t.setTemplateDefinition(objectMapper.convertValue(TemplateDefinition.DEFAULT, new TypeReference<Map<String, Object>>() {}));
    return t;
}
```

### Integration Test: `signup` + `login` Helper Pattern

Follow `ResumeControllerIntegrationTest` for the auth setup. The test needs to:
1. `POST /api/v1/auth/signup` → 201
2. `POST /api/v1/auth/login` → JWT in `AuthResponse.token`
3. Use JWT as `Authorization: Bearer <token>` header on all resume/export calls

### Frontend: `EditorPage.tsx` Current Return Structure

The current return (from story 5-7 context) is:
```tsx
return (
  <>
    <a href="#resume-canvas" className="sr-only ...">Skip to resume canvas</a>
    <SplitPaneLayout ... />
    <SaveAsDialog ... />
  </>
)
```
Add the `exportPdf` async function and pass `isExporting` / `onExportPdf` down to `EditorToolbar` via `SplitPaneLayout` → `EditorToolbar` props chain (or directly if `EditorToolbar` is rendered inside `EditorPage`).

### Testing PDF Validity with PDFBox

PDFBox 3.0.3 is on the classpath (used by `PdfParser.java` in the upload package). In tests:
```java
import org.apache.pdfbox.pdmodel.PDDocument;

byte[] pdf = renderer.render(doc, template);
assertThat(pdf).isNotEmpty();
try (PDDocument loaded = PDDocument.load(pdf)) {
    assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
}
```
This validates that iText produced a well-formed PDF.

### Previous Story Learnings (from Epic 5 / Story 5-7)

- **`@Deprecated` removal**: Story 9 SonarQube work removed `@Deprecated` from `AiService` overloads (S1133). Do not add `@Deprecated` to any new method.
- **`tabIndex` on containers**: AC from 5-7 added `tabIndex={-1}` to `div#resume-canvas`. No similar change needed for export — the export button is a natural `<button>`.
- **Toast pattern**: Already used in the project. Import from `@/hooks/use-toast`.
- **GlobalExceptionHandler pattern**: Always add `problem.setTitle(...)` line after `ProblemDetail.forStatusAndDetail(...)`.
- **Test isolation**: Integration tests must declare their own PostgreSQL container inline (not the root `TestcontainersConfiguration` which also starts Ollama and Grafana).

---

## File List

### New Backend Files

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/DocumentRenderer.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/PdfRenderer.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinitionService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/UnsupportedExportFormatException.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/PdfRendererTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/ExportControllerIntegrationTest.java`

### Modified Backend Files

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`

### New Frontend Files

_(none — only modifications to existing files)_

### Modified Frontend Files

- `frontend/src/components/resume/EditorToolbar.tsx`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/components/resume/EditorToolbar.test.tsx` _(or create if it doesn't exist)_

### Existing Export Files (DO NOT MODIFY OR RECREATE)

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayout.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumns.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/SectionStyle.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinitionTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayoutTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumnsTest.java`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: `DocumentRenderer` interface created in `export/` package; no Spring annotations on the interface itself.
- AC1/AC3: `PdfRenderer` implemented with iText 8 (`com.itextpdf:itext-core:8.0.5`). All 9 `ResumeItem` sealed subtypes handled via Java 21 pattern-matching switch. ATS-compliance enforced: single-column only, no images, skills rendered as comma-separated plain text, all text via `Paragraph` elements.
- AC2/AC7: `ExportService` dispatches by format; PDF renders via `PdfRenderer`, DOCX throws `UnsupportedExportFormatException` (story 6-2). Template fallback via `buildFallbackTemplate()` using `TemplateDefinition.DEFAULT` serialized to Map — no OllamaHealthGuard call.
- AC2: `ExportController` wired at `GET /api/v1/resumes/{resumeId}/export?format=`; JWT-protected by SecurityConfig; correct Content-Type and Content-Disposition headers; filename sanitized.
- AC5/Task3: `TemplateDefinitionService` wraps Jackson `convertValue`; catches all exceptions and returns DEFAULT (AC7).
- AC4/AC5: `EditorToolbar` extended with `isExporting` + `onExportPdf` props; "Export PDF" button with `aria-label="Export resume as PDF"`; `animate-pulse` progress bar shown when `isExporting`.
- AC4/AC5: `EditorPage` wires `exportPdf()` using raw `fetch` (intentional documented exception — binary blob, not JSON). Toast via `sonner` on success/error. `useResumeStore.setExporting()` called correctly.
- AC6: `PdfRendererTest` (5 tests, no Spring context, PDFBox 3 `Loader.loadPDF()` for validation) — all pass.
- AC6: `ExportControllerIntegrationTest` (4 tests, PostgreSQL-only Testcontainer, no Ollama) — all pass.
- AC6: `EditorToolbar.test.tsx` extended with 2 export button tests — all 665 frontend tests pass.
- PDFBox API note: `PDDocument.load(byte[])` removed in PDFBox 3.x; replaced with `Loader.loadPDF(byte[])`.
- No new lint errors introduced; 6 pre-existing errors in EditorPage confirmed identical before/after changes.

### Review Findings

#### Decision-Needed

- [x] [Review][Decision] D1 — `ExportService` injects `PdfRenderer` by concrete type, not `DocumentRenderer` interface — AC1 establishes the `DocumentRenderer` abstraction, but `ExportService.java:37,50` declares `private final PdfRenderer pdfRenderer`. Story 6-2 (DocxRenderer) will require a code change to the switch dispatch. Decision: keep concrete injection now and fix in 6-2 when DocxRenderer is wired, OR refactor to use `Map<String, DocumentRenderer>` keyed by format string now. `ExportService.java:37` **→ Deferred to 6-2**
- [x] [Review][Decision] D2 — Progress bar is `animate-pulse` indeterminate, not "linear" per UX-DR19 — `EditorToolbar.tsx:168–174` renders a pulsing static strip. The `role="progressbar"` ARIA element is also missing `aria-valuenow`, `aria-valuemin`, `aria-valuemax` (required when determinate; optional when indeterminate). Decision: accept current indeterminate bar (export duration is variable, linear is impractical) OR switch to an advancing Tailwind animation. `EditorToolbar.tsx:168` **→ Accepted as-is**
- [x] [Review][Decision] D3 — Export button active when resume load fails → blank PDF downloaded — `EditorPage.tsx:341–353` renders `EditorToolbar` unconditionally outside the error-state branch. When `error !== null`, the export button still fires, the server returns a PDF of an empty `ResumeDocument`, and the user gets a blank download with no context. Decision: disable the export button when `error !== null`, or add a guard in `exportPdf`. `EditorPage.tsx:341` **→ Guard added in `exportPdf()`: null check on `currentResume` before `setExporting(true)`, shows toast "Resume not loaded — please refresh"**

#### Patches

- [x] [Review][Patch] F1 — Double DB round-trip in export: `getResumeName` fetches resume a second time, creating a race window where concurrent delete causes 403 after PDF is already rendered — consolidate `getResumeName` into `exportResume` return value. `ExportController.java:43`, `ExportService.java:84` **→ Fixed: introduced `ExportService.ExportResult` record; `exportResume` returns both content+name in single DB fetch; `getResumeName` method removed**
- [x] [Review][Patch] F2 — `rawName.replaceAll(...)` NPE if `resume.getName()` returns null — add null guard: `rawName != null ? rawName.replaceAll(...) : "resume"`. `ExportController.java:44` **→ Fixed: `result.name() != null ? result.name() : "resume"` guard added**
- [x] [Review][Patch] F3 — iText resource leak: `PdfWriter`/`PdfDocument` not closed on exception — wrap `PdfWriter`, `PdfDocument`, `Document` in try-with-resources or use a finally block around `document.close()`. `PdfRenderer.java:86–120` **→ Fixed: `PdfWriter`, `PdfDocument`, `Document` now in try-with-resources block**
- [x] [Review][Patch] F4 — Misleading `IOException` catch message: `"Failed to create PDF font"` is used for all rendering failures — update message to `"PDF rendering failed"`. `PdfRenderer.java:116–118` **→ Fixed: message changed to `"PDF rendering failed"`**
- [x] [Review][Patch] F5 — `Content-Disposition` header injection: filename sanitization regex `[^a-zA-Z0-9\\-_ .]` permits `"`, which breaks the quoted filename parameter — add `"` to the exclusion set. `ExportController.java:44` **→ Fixed: secondary `.replaceAll("\"", "_")` applied after primary regex**
- [x] [Review][Patch] F6 — Leading separator rendered when `jobTitle` and `company` are both null: `WorkExperienceItem` with null title+company and non-null dates renders `"  |  Jan 2020"` — only append the date separator if `line` is non-empty. `PdfRenderer.java:253` **→ Fixed: date separator guarded with `line.isEmpty() ? "" : "  |  "` ternary**
- [x] [Review][Patch] F7 — Leading separator in `renderLanguage` when `language` is null: produces `"  —  C2"` — guard separator with `!line.isEmpty()` check. `PdfRenderer.java:303` **→ Fixed: `langPart`/`profPart` split; separator only prepended when `langPart` is non-empty**

#### Deferred

- [x] [Review][Defer] `PdfRenderException` not registered in `GlobalExceptionHandler` → generic 500 [PdfRenderer.java:475] — deferred, pre-existing catch-all pattern; no retry signal but acceptable for v1
- [x] [Review][Defer] NPE risk in `findSummaryItem` if Jackson bypasses record compact constructor [PdfRenderer.java:423] — deferred, requires investigation of Jackson record deserialization behavior with JSONB; not triggered by any current code path
- [x] [Review][Defer] Two-column template with `columns: null` in DB silently drops all sections [PdfRenderer.java:404] — deferred, DB constraint should prevent this; TemplateService validates definitions on write
- [x] [Review][Defer] `parseFontSize`/`parseMargin` silently ignore `rem`, `em`, `pt` CSS units [PdfRenderer.java:460] — deferred, TemplateService already validates only `px`/`in` units on template creation
- [x] [Review][Defer] `buildFallbackTemplate` creates bare `ResumeTemplate` with no `id`/`name` — latent JPA risk [ExportService.java:110] — deferred, no current code path triggers it; add note for story 6-2
- [x] [Review][Defer] `URL.revokeObjectURL` called synchronously after `a.click()` — browser race [EditorPage.tsx:236] — deferred, common download pattern used across ecosystem; browser implementations handle this safely in practice

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-19 | Story created: exhaustive analysis of existing export package (TemplateDefinition/Layout/Columns/SectionStyle already present), iText 8.0.5 confirmed in pom.xml (not iText 7 as epic brief states), ResumeDocument hierarchy fully documented with all 9 sealed subtypes, isExporting already in useResumeStore, AC7 fallback pattern designed. Ready for dev. | claude-sonnet-4-6 |
| 2026-06-19 | Story implemented: DocumentRenderer interface + PdfRenderer (iText 8, ATS-compliant, 9 item types), TemplateDefinitionService, ExportService (with DOCX stub + AC7 fallback), ExportController, UnsupportedExportFormatException + GlobalExceptionHandler registration, EditorToolbar export button + progress bar, EditorPage exportPdf wiring. 322 backend unit tests pass, 4 integration tests pass, 665 frontend tests pass. | claude-sonnet-4-6 |
| 2026-06-19 | Code review fix cycle: 7 patches applied (F1 ExportResult record eliminates double DB fetch, F2 null guard on resume name, F3 iText try-with-resources resource safety, F4 accurate PdfRenderException message, F5 quote char excluded from Content-Disposition filename, F6 work experience date separator guard, F7 language separator guard); D1 deferred to 6-2; D2 accepted as-is; D3 currentResume null guard added in exportPdf(). 358 backend tests pass, 665 frontend tests pass, 0 new lint errors. | claude-sonnet-4-6 |
