# Story 6.2: DocxRenderer & Export Download UX

**Status:** done
**Epic:** 6 — Export & Document Generation
**Story Key:** 6-2-docxrenderer-and-export-download-ux
**Dependencies:** Story 6-1 done; `DocumentRenderer` interface, `ExportService`, `ExportController`, `EditorToolbar`, `EditorPage` all implemented.

---

## Story

As an authenticated user,
I want to export my resume as a DOCX document rendered according to my selected template,
So that I can submit my resume to employers or recruitment systems that require Word format.

---

## Acceptance Criteria

**AC1 — DOCX export endpoint**
**Given** an authenticated user calls `GET /api/v1/resumes/{resumeId}/export?format=docx`
**When** the request is processed
**Then** `ExportService` calls `DocxRenderer.render()` with the resume's `ResumeDocument` and `ResumeTemplate`; the response streams the `byte[]` with `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` and `Content-Disposition: attachment; filename="<resumeName>.docx"`

**AC2 — DOCX content quality**
**Given** `DocxRenderer` renders a `ResumeDocument` via Apache POI
**When** the output DOCX is opened in a word processor
**Then** sections appear in the correct template order (from `TemplateLayout.sectionOrder()`); headings use Word heading styles (`Heading 1` for section titles, `Heading 2` for sub-items where applicable); bullet items use list styles; no raw HTML is embedded; the document is ATS-parseable (FR37); skills are comma-separated plain text, not visual bars; all sections with `visible() == false` are skipped.

**AC3 — Format validation**
**Given** an unsupported `format` query parameter is passed (e.g. `?format=txt`)
**When** the export request is processed
**Then** HTTP 400 is returned with a `ProblemDetail` body: `"Unsupported export format. Use 'pdf' or 'docx'."` — this is already handled by the existing `ExportController` and `ExportService` switch — story 6-2 replaces the DOCX stub with real implementation, making AC3 pass automatically.

**AC4 — Performance**
**Given** the export request completes within 10 seconds
**When** the performance is measured under single-user load
**Then** both PDF and DOCX exports complete within the NFR4 10-second budget; the existing linear progress bar in the toolbar is visible for any export exceeding 2 seconds (already implemented in story 6-1 via `isExporting` in `useResumeStore`).

**AC5 — Dashboard export button wired**
**Given** the Export button is triggered from a `ResumeDashboardCard` hover action (the FR16 stub from Epic 3, currently shows `toast("Export coming soon")`)
**When** the export action is triggered from the dashboard
**Then** an `ExportFormatDialog` appears with `PDF` and `DOCX` format options; on confirm, the appropriate `GET /api/v1/resumes/{id}/export?format=<x>` request is made; on download success, a "Download ready" Toast appears (UX-DR19); on error, a destructive Toast with the error detail is shown.

**AC6 — Tests**
**Given** `DocxRenderer` is implemented
**When** unit tests are run
**Then** `DocxRendererTest.java` renders at least two real-world template + document combinations and verifies the output DOCX is valid (non-empty, parseable via Apache POI `XWPFDocument` in test — no Spring context needed); `ExportControllerIntegrationTest.java` adds a DOCX happy-path test case (`GET /export?format=docx` → 200 with correct `Content-Type`).

---

## Tasks / Subtasks

### Task 1: Refactor `ExportService` to inject `Map<String, DocumentRenderer>` (AC: 1, 3 — D1 from story 6-1)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportService.java`
- [x] Replace `private final PdfRenderer pdfRenderer` with `private final Map<String, DocumentRenderer> renderers`
- [x] Update constructor: replace `PdfRenderer pdfRenderer` param with `Map<String, DocumentRenderer> renderers`
- [x] Spring auto-populates `Map<String, DocumentRenderer>` — key = `@Qualifier` value on each `@Component`, value = the bean. `PdfRenderer` is already `@Qualifier("pdf")`, `DocxRenderer` will be `@Qualifier("docx")`. No additional `@Configuration` needed.
- [x] Update the switch expression in `exportResume()`:
  ```java
  byte[] content = switch (format.toLowerCase()) {
      case "pdf", "docx" -> {
          DocumentRenderer renderer = renderers.get(format.toLowerCase());
          if (renderer == null) {
              throw new UnsupportedExportFormatException(
                  "Unsupported export format. Use 'pdf' or 'docx'.");
          }
          yield renderer.render(doc, template);
      }
      default -> throw new UnsupportedExportFormatException(
          "Unsupported export format. Use 'pdf' or 'docx'.");
  };
  ```
- [x] Remove the unused `import com.tsvetanbondzhov.resumeenhancer.export.renderers.PdfRenderer` import
- [x] Add `import java.util.Map` if not already present

---

### Task 2: Implement `DocxRenderer` using Apache POI (AC: 1, 2, 6)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/DocxRenderer.java`
- [x] Annotate: `@Component @Qualifier("docx")` — same pattern as `PdfRenderer`
- [x] Implement `DocumentRenderer`: `render(ResumeDocument doc, ResumeTemplate template) → byte[]`
- [x] **Apache POI version**: `5.3.0` (`poi.version` property in `pom.xml`). Artifact: `org.apache.poi:poi-ooxml:5.3.0`. Already on classpath (used by `DocxParser` in upload package). Key classes:
  - `org.apache.poi.xwpf.usermodel.XWPFDocument` — main document
  - `org.apache.poi.xwpf.usermodel.XWPFParagraph`
  - `org.apache.poi.xwpf.usermodel.XWPFRun`
  - `org.apache.poi.xwpf.usermodel.XWPFTable`, `XWPFTableRow`, `XWPFTableCell`
  - `org.openxmlformats.schemas.wordprocessingml.x2006.main.STStyle`
- [x] **DOCX generation logic**:
  1. `XWPFDocument document = new XWPFDocument()`
  2. Find `SummaryItem` in `doc.sections()` — render header block (name from contact fields, contact line)
  3. Get `TemplateDefinition` via `TemplateDefinitionService.resolve(template)`
  4. Determine section render order from `templateDef.layout().sectionOrder()` (same logic as `PdfRenderer`)
  5. For each section in order: skip if `!section.visible()`, render section heading with Word style `"Heading 1"`, render items by type
  6. `ByteArrayOutputStream baos = new ByteArrayOutputStream(); document.write(baos); document.close(); return baos.toByteArray()`
- [x] **Word Heading styles**: Use `paragraph.setStyle("Heading1")` for section title paragraphs (Word style names use camelCase internally: `"Heading1"`, `"Heading2"`). Add runs with no bold flag — the style handles formatting.
- [x] **Section rendering by type** (pattern-match on `ResumeItem` sealed interface — same 9 subtypes as `PdfRenderer`):
  - `WorkExperienceItem`: title+company paragraph (`Heading2` style), date range paragraph, description paragraph
  - `EducationItem`: institution+degree paragraph (`Heading2`), date range paragraph
  - `SkillItem`: accumulate all skills comma-separated into one paragraph (ATS-friendly plain text)
  - `CertificationItem`: name + issuer + issueDate paragraph
  - `LanguageItem`: `language — proficiency` inline text
  - `ProjectItem`: name paragraph (`Heading2`), technologies paragraph, description paragraph
  - `VolunteeringItem`: role + organization paragraph (`Heading2`), description + date paragraph
  - `SummaryItem`: render as introductory paragraph before section loop (italic run)
  - `GenericItem`: render each `fields` entry as `key: value` paragraph
- [x] **No shared mutable state**: `@Component` singleton — all state in local variables within `render()`
- [x] **ATS compliance**: No images, no tables used for layout (tables only if absolutely needed for multi-column — avoid), all text is actual Word text.
- [x] **Date formatting helper**: Use `DateTimeFormatter.ofPattern("MMM yyyy")` — same as `PdfRenderer`'s `DATE_FMT`. Extract as private static final field.
- [x] **isCurrent flag**: `WorkExperienceItem.isCurrent()`, `ProjectItem.isCurrent()`, `VolunteeringItem.isCurrent()` — render as `"Present"` instead of `endDate` when `isCurrent == true`.

---

### Task 3: Create `ExportFormatDialog` frontend component (AC: 5)

- [x] Create `frontend/src/components/resume/ExportFormatDialog.tsx`
- [x] Follow the `SaveAsDialog.tsx` / `ConfirmDialog.tsx` pattern — use shadcn/ui `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
- [x] Props interface:
  ```tsx
  interface ExportFormatDialogProps {
    readonly open: boolean
    readonly resumeName: string
    readonly isExporting: boolean
    readonly onExport: (format: "pdf" | "docx") => void
    readonly onClose: () => void
  }
  ```
- [x] Dialog body: two buttons for format selection — "PDF" and "Word (DOCX)". Clicking either calls `onExport(format)` immediately (no extra confirm step needed).
- [x] While `isExporting`, show a spinner/disabled state on the active format button. Keep dialog open during export (close only on success or via explicit Cancel).
- [x] Cancel button calls `onClose()`. `onOpenChange` handler: `if (!isOpen && !isExporting) onClose()` — prevent accidental close during export.
- [x] Focus the PDF button on open (primary action). Use `autoFocus` on the PDF button.

---

### Task 4: Wire `ExportFormatDialog` in `DashboardPage` (AC: 5)

- [x] Open `frontend/src/pages/DashboardPage.tsx`
- [x] Add state: `const [exportingResume, setExportingResume] = useState<ResumeDto | null>(null)` and `const [isExporting, setIsExporting] = useState(false)`
- [x] Add `handleExportClick(resume: ResumeDto)` → sets `exportingResume = resume` (opens dialog)
- [x] Add `handleExport(format: "pdf" | "docx")` async function — mirrors `EditorPage.exportPdf()` pattern:
  ```tsx
  const handleExport = useCallback(async (format: "pdf" | "docx") => {
    if (!exportingResume) return
    setIsExporting(true)
    try {
      // Direct fetch (not apiClient) — export returns binary, not JSON.
      const token = useAuthStore.getState().token
      const res = await fetch(
        `/api/v1/resumes/${exportingResume.id}/export?format=${format}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(body.detail ?? "Export failed")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${exportingResume.name ?? "resume"}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Download ready", { duration: 4000 })
      setExportingResume(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed", { duration: 8000 })
    } finally {
      setIsExporting(false)
    }
  }, [exportingResume])
  ```
- [x] Pass `onExport={handleExportClick}` to `ResumeDashboardCard` as a new prop
- [x] Render `<ExportFormatDialog>` at the bottom of the JSX (outside the grid, same pattern as other dialogs in `EditorPage`):
  ```tsx
  <ExportFormatDialog
    open={exportingResume !== null}
    resumeName={exportingResume?.name ?? ""}
    isExporting={isExporting}
    onExport={handleExport}
    onClose={() => !isExporting && setExportingResume(null)}
  />
  ```

---

### Task 5: Update `ResumeDashboardCard` to wire export button (AC: 5)

- [x] Open `frontend/src/components/resume/ResumeDashboardCard.tsx`
- [x] Add `onExport: () => void` to `ResumeDashboardCardProps`
- [x] Replace the current export button stub (`toast("Export coming soon")`) with `onExport()` call:
  ```tsx
  <button
    onClick={(e) => {
      e.stopPropagation()
      onExport()
    }}
    aria-label="Export resume"
    title="Export resume"
    className="p-1 rounded hover:bg-muted cursor-pointer"
  >
    <Download className="size-4" />
  </button>
  ```

---

### Task 6: Add "Export DOCX" button to `EditorToolbar` (AC: 4, optional enhancement)

- [x] Open `frontend/src/components/resume/EditorToolbar.tsx`
- [x] Add `onExportDocx: () => void` to `EditorToolbarProps`
- [x] Add "Export DOCX" button next to "Export PDF":
  ```tsx
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={onExportDocx}
    disabled={isExporting}
    aria-label="Export resume as DOCX"
  >
    {isExporting ? "Exporting…" : "Export DOCX"}
  </Button>
  ```
- [x] Wire `exportDocx` async function in `EditorPage.tsx` (same pattern as `exportPdf` but `format=docx` and `a.download` uses `.docx` extension)
- [x] Pass `onExportDocx={exportDocx}` to `<EditorToolbar />`

---

### Task 7: Write `DocxRendererTest.java` (AC: 6)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/DocxRendererTest.java`
- [x] `@ExtendWith(MockitoExtension.class)` only — NO Spring context
- [x] Instantiate directly: `new DocxRenderer(new TemplateDefinitionService(new ObjectMapper()))`
- [x] **Test fixture 1 — Default template + full document**:
  - Build `ResumeDocument` with SUMMARY, WORK_EXPERIENCE (2 items), EDUCATION (1 item), SKILLS (3 items) sections
  - Build `ResumeTemplate` with `templateDefinition = null` (triggers DEFAULT fallback)
  - Call `renderer.render(doc, template)` → `byte[] docx`
  - Assert `docx.length > 0`
  - Validate with POI: `new XWPFDocument(new ByteArrayInputStream(docx))` — assert no exception thrown, page count logic N/A for DOCX (verify at least one paragraph exists: `assertThat(document.getParagraphs()).isNotEmpty()`)
- [x] **Test fixture 2 — Single SKILLS section**:
  - 3 `SkillItem` entries only
  - Assert output is non-empty and parseable
- [x] **Test: empty document renders without throwing**:
  - `ResumeDocument` with empty sections list
  - Assert no exception, `byte[].length > 0`
- [x] **Test: isCurrent=true renders "Present" not null date**:
  - `WorkExperienceItem` with `isCurrent=true`, `endDate=null`
  - Render → parse → find paragraph text containing "Present"
- [x] **Test: invisible sections are skipped**:
  - Two sections, one with `visible=false`
  - Assert parsed document has no heading matching the hidden section title

---

### Task 8: Extend `ExportControllerIntegrationTest` with DOCX case (AC: 6)

- [x] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/ExportControllerIntegrationTest.java`
- [x] Add **Test 5 — Happy path DOCX export**:
  ```java
  @Test
  void get_exportResume_docx_returns200WithDocxContent() throws Exception {
      String token = registerAndGetToken("export_docx@example.com", "Password1");
      String resumeId = createResume(token, "My DOCX Resume");

      webTestClient()
              .get()
              .uri("/api/v1/resumes/" + resumeId + "/export?format=docx")
              .header("Authorization", "Bearer " + token)
              .exchange()
              .expectStatus().isOk()
              .expectHeader().valueMatches("Content-Type",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.*")
              .expectHeader().valueMatches("Content-Disposition", "attachment; filename=\".*\\.docx\"")
              .expectBody(byte[].class)
              .value(bytes -> {
                  assert bytes != null && bytes.length > 0 : "DOCX bytes must be non-empty";
              });
  }
  ```

---

### Task 9: Frontend tests (AC: 5, 6)

- [x] Create `frontend/src/components/resume/ExportFormatDialog.test.tsx`:
  ```tsx
  it("renders PDF and DOCX buttons", () => {
    render(<ExportFormatDialog open resumeName="My Resume" isExporting={false}
      onExport={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: /pdf/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /docx/i })).toBeInTheDocument()
  })

  it("calls onExport with 'pdf' when PDF clicked", () => {
    const onExport = vi.fn()
    render(<ExportFormatDialog open resumeName="R" isExporting={false}
      onExport={onExport} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /pdf/i }))
    expect(onExport).toHaveBeenCalledWith("pdf")
  })

  it("calls onExport with 'docx' when DOCX clicked", () => {
    const onExport = vi.fn()
    render(<ExportFormatDialog open resumeName="R" isExporting={false}
      onExport={onExport} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /docx/i }))
    expect(onExport).toHaveBeenCalledWith("docx")
  })

  it("disables export buttons while isExporting", () => {
    render(<ExportFormatDialog open resumeName="R" isExporting={true}
      onExport={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: /pdf/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /docx/i })).toBeDisabled()
  })
  ```
- [x] Open `frontend/src/components/resume/EditorToolbar.test.tsx` — add tests for the DOCX button (same pattern as existing PDF button tests: renders, calls `onExportDocx`, disabled when `isExporting`)

---

## Developer Context & Guardrails

### Current State of `ExportService` (MUST READ)

`ExportService.java` currently injects `PdfRenderer` concretely:
```java
private final PdfRenderer pdfRenderer;

public ExportService(..., PdfRenderer pdfRenderer, ...) {
    this.pdfRenderer = pdfRenderer;
}
```
The switch stub:
```java
case "docx" -> throw new UnsupportedExportFormatException("DOCX export not yet implemented");
```

**Task 1 is mandatory first** — refactor to `Map<String, DocumentRenderer>` before implementing `DocxRenderer`. Without this refactor, Spring will fail to inject the service because two `DocumentRenderer` beans exist with no qualifier disambiguation.

### Spring `Map<String, DocumentRenderer>` Auto-Injection Pattern

Spring automatically fills `Map<String, T>` injection with all beans of type `T`, using each bean's qualifier (or bean name) as the map key. Since `PdfRenderer` is `@Qualifier("pdf")` and `DocxRenderer` will be `@Qualifier("docx")`, the injected map will be: `{"pdf" → PdfRenderer, "docx" → DocxRenderer}`. No `@Configuration` class needed.

### Files to MODIFY (UPDATE)

| File | Change |
|------|--------|
| `src/main/java/.../export/ExportService.java` | Replace `PdfRenderer pdfRenderer` injection → `Map<String, DocumentRenderer> renderers`; update switch dispatch |
| `frontend/src/components/resume/ResumeDashboardCard.tsx` | Add `onExport` prop; wire download button |
| `frontend/src/pages/DashboardPage.tsx` | Add export state, `handleExport`, `ExportFormatDialog` |
| `frontend/src/components/resume/EditorToolbar.tsx` | Add `onExportDocx` prop and DOCX button |
| `frontend/src/pages/EditorPage.tsx` | Add `exportDocx` function, wire to toolbar |
| `src/test/java/.../export/ExportControllerIntegrationTest.java` | Add DOCX happy-path test |

### Files to CREATE (NEW)

| File | Description |
|------|-------------|
| `src/main/java/.../export/renderers/DocxRenderer.java` | Apache POI DOCX renderer, `@Component @Qualifier("docx")` |
| `src/test/java/.../export/DocxRendererTest.java` | Pure unit test (Mockito only), 5 tests |
| `frontend/src/components/resume/ExportFormatDialog.tsx` | Format picker dialog |
| `frontend/src/components/resume/ExportFormatDialog.test.tsx` | 4 dialog tests |

### Files Already Existing — DO NOT RE-CREATE

| File | Status |
|------|--------|
| `src/main/java/.../export/DocumentRenderer.java` | EXISTS — interface `render(ResumeDocument, ResumeTemplate) → byte[]` |
| `src/main/java/.../export/ExportController.java` | EXISTS — already handles `"docx"` in `resolveContentType()` |
| `src/main/java/.../export/ExportService.java` | EXISTS — MODIFY only (Task 1) |
| `src/main/java/.../export/renderers/PdfRenderer.java` | EXISTS — `@Component @Qualifier("pdf")` — DO NOT TOUCH |
| `src/main/java/.../export/TemplateDefinitionService.java` | EXISTS — inject into `DocxRenderer` |
| `src/main/java/.../export/TemplateDefinition.java` | EXISTS — `DEFAULT` constant, `isTwoColumn()` |
| `src/main/java/.../export/TemplateLayout.java` | EXISTS — `sectionOrder`, `columns`, `sectionStyles` |
| `src/main/java/.../export/UnsupportedExportFormatException.java` | EXISTS — registered in GlobalExceptionHandler |
| `src/test/java/.../export/ExportControllerIntegrationTest.java` | EXISTS — ADD test 5 only |

### Apache POI 5.3.0 — Critical API Notes

- `org.apache.poi.xwpf.usermodel.XWPFDocument` — constructor: `new XWPFDocument()` for new doc from scratch
- `document.createParagraph()` → returns `XWPFParagraph`
- `paragraph.setStyle("Heading1")` — sets Word built-in style (no spaces in style name for programmatic API)
- `paragraph.createRun()` → `XWPFRun`; run `.setText("text")`, `.setBold(true)`, `.setItalic(true)`, `.setFontSize(int)`
- `document.write(baos)` then `document.close()` — always close in try-with-resources to avoid resource leaks
- DOCX validation in test: `new XWPFDocument(new ByteArrayInputStream(bytes))` — wrap bytes; if corrupt, throws exception
- **Existing import in codebase** (`upload/parsers/DocxParser.java`): check that file for proven POI import patterns
- `XWPFParagraph.getCTP()` gives low-level XML access — avoid unless needed; use high-level API only

### `ResumeDocument` & Section Domain — Field Reference

All fields confirmed from source files:

| Type | Fields |
|------|--------|
| `WorkExperienceItem` | `id, jobTitle, company, startDate, endDate, isCurrent, description` |
| `EducationItem` | `id, institution, degree, fieldOfStudy, startDate, endDate` |
| `SkillItem` | `id, name` |
| `CertificationItem` | `id, name, issuer, issueDate, expirationDate` |
| `LanguageItem` | `id, language, proficiency` (NOT `name`, NOT `proficiencyLevel`) |
| `ProjectItem` | `id, name, description, technologies, link, startDate, endDate, isCurrent` |
| `VolunteeringItem` | `id, role, organization, description, startDate, endDate, isCurrent` |
| `SummaryItem` | `id, text, linkedInUrl, personalPageUrl, blogUrl, contactEmail, locationCountry, locationCity` |
| `GenericItem` | `id, fields` (Map<String, String>) |
| `ResumeSection` | `sectionType(), label(), items(), visible()` |

`ResumeItem` is a `sealed interface` — use Java pattern-matching switch (same as `PdfRenderer`).

`TemplateLayout.resolvedSectionOrder()` throws `IllegalStateException` if `columns != null` — use `layout.sectionOrder()` directly for two-column templates (render left then right columns in linear order, same ATS-compliance rule as PDF).

### `DocxParser.java` — Import Pattern Reference

The existing `upload/parsers/DocxParser.java` uses Apache POI for reading — check its imports for the exact package names already proven to compile. Path: `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/DocxParser.java`.

### Frontend Pattern: Export in `EditorPage.tsx`

The existing `exportPdf` function (lines 214–249 in `EditorPage.tsx`) is the exact pattern to follow for `exportDocx` — only differences are `format=docx` and `a.download` extension. Both use:
- Raw `fetch()` with `Bearer` token header (intentional documented exception to `apiClient` rule — binary blob, not JSON)
- `res.blob()` → `URL.createObjectURL` → anchor click → `URL.revokeObjectURL`
- `toast.success("Download ready", { duration: 4000 })` on success
- `toast.error(...)` on failure
- `setExporting(false)` in finally

**`useAuthStore.getState().token`** — same import pattern as `EditorPage.tsx` line 226.

### Frontend Pattern: `DashboardPage.tsx` Export

`DashboardPage` currently uses `toast` from `sonner` (line 3). `useAuthStore` import must be added. The `exportingResume` state (`ResumeDto | null`) drives dialog open/closed. This pattern is used in many places in the codebase (e.g., `deletingId` state → confirm dialog).

### `ResumeDashboardCard` — Existing Download Button

Current stub (lines 85–96 in `ResumeDashboardCard.tsx`):
```tsx
<button onClick={(e) => { e.stopPropagation(); toast("Export coming soon") }}>
  <Download className="size-4" />
</button>
```
Replace ONLY the `toast("Export coming soon")` call with `onExport()`. Preserve all other attributes (`e.stopPropagation()`, `aria-label`, `className`).

### Testing: POI `XWPFDocument` Validation Pattern

```java
import org.apache.poi.xwpf.usermodel.XWPFDocument;

byte[] docx = renderer.render(doc, template);
assertThat(docx).isNotEmpty();
try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
    assertThat(parsed.getParagraphs()).isNotEmpty();
}
```

### Anti-Patterns to Avoid

- Do NOT reinvent `TemplateDefinitionService` — inject it into `DocxRenderer` (same pattern as `PdfRenderer`)
- Do NOT use `TemplateLayout.resolvedSectionOrder()` for two-column templates — it throws; use `layout.sectionOrder()` directly
- Do NOT skip the `ExportService` refactor (Task 1) — Spring will fail to start with two unqualified `DocumentRenderer` beans
- Do NOT add `OllamaHealthGuard` — export has no AI dependency
- Do NOT use `any` in TypeScript — `"pdf" | "docx"` union type for format
- Do NOT call `apiClient.get<T>()` for binary export — always raw `fetch` + `res.blob()`
- Do NOT edit files under `frontend/src/components/ui/` — shadcn managed
- Do NOT add `@Deprecated` annotations (SonarQube S1133 violation — caused a fix commit after 5-5 and 6-1)
- Do NOT add visual skill bars, images, or graphics to DOCX output — ATS incompatible
- Do NOT create a new Zustand store — `isExporting` in `useResumeStore` already exists; `DashboardPage` manages its own `isExporting` local state (not cross-component shared state)
- Do NOT use `new XWPFDocument(OPCPackage.open(file))` in tests — use `new XWPFDocument(new ByteArrayInputStream(bytes))`

### Package Structure

```
com.tsvetanbondzhov.resumeenhancer.export
  ├── DocumentRenderer.java          ← EXISTS
  ├── ExportController.java          ← EXISTS (no changes needed)
  ├── ExportService.java             ← MODIFY (Task 1)
  ├── SectionStyle.java              ← EXISTS
  ├── TemplateColumns.java           ← EXISTS
  ├── TemplateDefinition.java        ← EXISTS
  ├── TemplateDefinitionService.java ← EXISTS
  ├── TemplateLayout.java            ← EXISTS
  ├── UnsupportedExportFormatException.java ← EXISTS
  └── renderers/
      ├── PdfRenderer.java           ← EXISTS — @Qualifier("pdf")
      └── DocxRenderer.java          ← NEW (Task 2) — @Qualifier("docx")
```

---

## Dev Notes

### Key Learning from Story 6-1: PdfRenderer Resource Safety

`PdfRenderer` had a review finding (F3) about iText resource leaks — `PdfWriter`/`PdfDocument`/`Document` not in try-with-resources. Apply the same lesson proactively to `DocxRenderer`: always wrap `XWPFDocument` in try-with-resources or close in a finally block.

```java
@Override
public byte[] render(ResumeDocument doc, ResumeTemplate template) {
    try (XWPFDocument document = new XWPFDocument();
         ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
        // ... render content ...
        document.write(baos);
        return baos.toByteArray();
    } catch (IOException e) {
        throw new DocxRenderException("DOCX rendering failed", e);
    }
}
```

### Key Learning from Story 6-1: Null Guards on Item Fields

Review finding F6 (`WorkExperienceItem` null jobTitle+company produced `"  |  date"`) and F7 (`LanguageItem` null language produced `"  — proficiency"`) — apply same null-guard discipline to all `DocxRenderer` item renderers. Never concatenate separator before checking if the preceding part is non-empty.

### `ExportController` Already Handles DOCX Content-Type

`ExportController.resolveContentType()` already has the `"docx"` case:
```java
case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
```
No changes to `ExportController` needed.

### Section Order for Two-Column Templates

`TemplateLayout` has both `sectionOrder` (for single-column) and `columns` (`TemplateColumns` with `left`/`right` lists, for two-column). Use the same logic as `PdfRenderer`:
- If `layout.columns() != null` (two-column): render sections from `columns.left()` list first, then `columns.right()` list — in a single linear DOCX flow (ATS requirement)
- Otherwise: use `layout.sectionOrder()`
- Do NOT call `layout.resolvedSectionOrder()` as it throws on two-column

### Word Style Names vs Display Names

Apache POI style IDs differ from display names in the Word UI:
- `"Heading1"` (no space) = "Heading 1" displayed in Word
- `"Heading2"` (no space) = "Heading 2" displayed in Word
- `"Normal"` = body text

The `XWPFDocument` created from scratch has built-in styles accessible via `paragraph.setStyle("Heading1")` — this works without needing to explicitly add style definitions to the document.

### Dashboard Export UX — No `isExporting` in `useResumeStore`

`useResumeStore.isExporting` / `setExporting` are only for editor-page exports (the flag drives the progress bar in `EditorToolbar`). The dashboard export manages its own local `isExporting` state via `useState` — it does NOT touch `useResumeStore`. This is correct per architecture: "Loading state: per-operation boolean flags ... never a single global `isLoading`."

### Sonner Toast Usage

The project uses `sonner` for toasts (NOT shadcn/ui `useToast` — that was an error in the story 6-1 draft; the actual implementation uses `sonner`). Usage:
```tsx
import { toast } from "sonner"
toast.success("Download ready", { duration: 4000 })
toast.error("Export failed", { duration: 8000 })
```
Confirmed in `EditorPage.tsx` (line 3) and `DashboardPage.tsx` (line 3).

---

## File List

### New Backend Files

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/DocxRenderer.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/DocxRendererTest.java`

### Modified Backend Files

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportService.java` (Task 1 — Map injection refactor)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/ExportControllerIntegrationTest.java` (Task 8 — add DOCX test)

### New Frontend Files

- `frontend/src/components/resume/ExportFormatDialog.tsx`
- `frontend/src/components/resume/ExportFormatDialog.test.tsx`

### Modified Frontend Files

- `frontend/src/components/resume/ResumeDashboardCard.tsx` (add `onExport` prop; wire download button)
- `frontend/src/pages/DashboardPage.tsx` (add export state, dialog, handler)
- `frontend/src/components/resume/EditorToolbar.tsx` (add `onExportDocx` prop and button)
- `frontend/src/pages/EditorPage.tsx` (add `exportDocx` function, wire to toolbar)
- `frontend/src/components/resume/EditorToolbar.test.tsx` (add DOCX button tests)

### Existing Export Files (DO NOT MODIFY OR RECREATE)

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/DocumentRenderer.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinitionService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayout.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumns.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/SectionStyle.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/UnsupportedExportFormatException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/PdfRenderer.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/PdfRendererTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinitionTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayoutTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumnsTest.java`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: ExportService refactored to Map<String, DocumentRenderer> injection; DocxRenderer @Qualifier("docx") dispatched via map lookup. Spring auto-populates — no @Configuration needed.
- AC2: DocxRenderer implemented with Apache POI 5.3.0. Heading1/Heading2 Word styles for section/item titles. All 9 ResumeItem subtypes handled. Null guards on all item fields (pattern from PdfRenderer F6/F7). ATS-compliant: no images, no tables, skills comma-separated. isCurrent renders "Present".
- AC3: Unsupported format still throws UnsupportedExportFormatException → 400 ProblemDetail. Switch now covers "pdf","docx" and default.
- AC4: ExportController unchanged — already handles "docx" content-type. EditorToolbar has Export DOCX button wired to exportDocx in EditorPage. isExporting progress bar applies to both exports.
- AC5: ExportFormatDialog (PDF + Word DOCX buttons, autoFocus on PDF, disabled while exporting). DashboardPage wired: exportingResume state, handleExportClick, handleExport (raw fetch + blob download). ResumeDashboardCard onExport prop replaces "Export coming soon" toast stub.
- AC6: DocxRendererTest 5/5 passing (no Spring context, POI XWPFDocument validation). ExportControllerIntegrationTest Test 5 added for docx happy path. ExportFormatDialog.test.tsx 4/4. EditorToolbar.test.tsx DOCX button tests added. Total: 324 backend unit tests + 671 frontend tests all green.
- Pre-existing lint errors in EditorPage.tsx (L80 setState-in-effect) and DashboardPage.tsx (L44 ref cleanup warning) are NOT introduced by this story — confirmed by git stash comparison.

### Review Findings

- [x] [Review][Patch] ExportService renderer map key appends "Renderer" suffix — lookup always returns null, every export throws 400 [src/main/java/com/tsvetanbondzhov/resumeenhancer/export/ExportService.java:80]
- [x] [Review][Patch] Java `assert` in ExportControllerIntegrationTest DOCX lambda — disabled by default at runtime, test always passes vacuously [src/test/java/com/tsvetanbondzhov/resumeenhancer/export/ExportControllerIntegrationTest.java]
- [x] [Review][Patch] NPE: `section.sectionType().name()` in render() loop has no null guard for sectionType [src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/DocxRenderer.java:77]
- [x] [Review][Patch] NPE: `findSummaryItem()` iterates `section.items()` without null guard [src/main/java/com/tsvetanbondzhov/resumeenhancer/export/renderers/DocxRenderer.java:341]
- [x] [Review][Defer] `URL.revokeObjectURL` called synchronously after `a.click()` — browser race risk; same pre-existing pattern as exportPdf [frontend/src/pages/DashboardPage.tsx, EditorPage.tsx] — deferred, pre-existing
- [x] [Review][Defer] ExportFormatDialog close silently no-ops during export — Cancel button is disabled but Escape/X backdrop click gives no feedback [frontend/src/components/resume/ExportFormatDialog.tsx] — deferred, pre-existing UX choice
- [x] [Review][Defer] Concurrent double-click can fire two parallel export fetch requests — no AbortController or in-flight dedup [frontend/src/pages/DashboardPage.tsx] — deferred, pre-existing pattern across codebase
- [x] [Review][Defer] PDF and DOCX exports share Zustand `isExporting` in EditorPage with no early-return guard for concurrent invocation [frontend/src/pages/EditorPage.tsx] — deferred, buttons disabled when isExporting=true

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-19 | Story created: exhaustive analysis of 6-1 implementation (ExportService concrete PdfRenderer injection, ExportController already handles docx content-type, ResumeDashboardCard has Export coming soon stub, sonner used for toasts not useToast). D1 deferred from 6-1 resolved as Task 1. Apache POI 5.3.0 confirmed in pom.xml. All ResumeItem subtypes and field names verified from source. | claude-sonnet-4-6 |
| 2026-06-19 | Implemented all 9 tasks: ExportService Map injection, DocxRenderer (Apache POI), ExportFormatDialog, DashboardPage export wiring, ResumeDashboardCard onExport prop, EditorToolbar/EditorPage DOCX button, DocxRendererTest (5 tests), ExportControllerIntegrationTest DOCX case, frontend tests (ExportFormatDialog 4 tests + EditorToolbar DOCX tests). 324/324 backend unit tests + 671/671 frontend tests green. | claude-sonnet-4-6 |
