# Story 2.3: File Upload Infrastructure & Resume Parsing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the file upload endpoint, MIME/size validation, and PDF/DOCX parsing services implemented,
So that stories 2.4 and future upload flows have a tested, reusable parsing foundation.

## Acceptance Criteria

1. **Given** a file is submitted to `POST /api/v1/upload` **When** `FileValidator` processes it before parsing **Then** it accepts only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` MIME types and rejects files exceeding 10MB — both conditions return HTTP 422 with a `ProblemDetail` body describing the rejection reason.

2. **Given** a valid PDF is submitted to `POST /api/v1/upload` **When** `PdfParser` processes it via PDFBox **Then** extracted text sections (work experience, education, skills) are returned as a structured `ParsedResumeDto`; the call completes without error.

3. **Given** a valid DOCX is submitted to `POST /api/v1/upload` **When** `DocxParser` processes it via Apache POI **Then** extracted text sections are returned as a structured `ParsedResumeDto`.

4. **Given** a malformed or corrupted PDF/DOCX is submitted **When** the parser attempts to process it **Then** `FileValidationException` is thrown; `GlobalExceptionHandler` maps it to HTTP 422 with a descriptive `ProblemDetail`; the application does not crash (NFR13).

5. **Given** the parsing services are implemented **When** unit tests are run **Then** `FileValidatorTest.java` tests both MIME and size rejection paths (no Spring context); `PdfParserTest.java` and `DocxParserTest.java` run against at least two real-world resume sample files each (not synthetic strings) per NFR16.

## Tasks / Subtasks

- [x] Task 1: Define `FileValidationException` in the `common` package (AC: 1, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/FileValidationException.java` — a simple `RuntimeException` subclass with a `String message` constructor.
  - [x] Register it in `GlobalExceptionHandler.java` with a new `@ExceptionHandler(FileValidationException.class)` method that returns `ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage())` with title `"Unprocessable Entity"`.
  - [x] `GlobalExceptionHandler` is at `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — add the handler WITHOUT removing any existing handlers.

- [x] Task 2: Implement `FileValidator` (AC: 1)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/validators/FileValidator.java` — annotate `@Component`.
  - [x] Single public method: `void validate(MultipartFile file)` — throws `FileValidationException` on violation.
  - [x] MIME check: extract MIME via `file.getContentType()`. Accept only `"application/pdf"` and `"application/vnd.openxmlformats-officedocument.wordprocessingml.document"`. On mismatch throw `FileValidationException("Unsupported file type. Only PDF and DOCX files are accepted.")`.
  - [x] Size check: `file.getSize() > 10 * 1024 * 1024` → throw `FileValidationException("File exceeds the 10MB size limit.")`.
  - [x] Order: size check AFTER MIME check (fail-fast on type before reading bytes).
  - [x] NOTE: `spring.servlet.multipart.max-file-size=10MB` is already configured in `application.yml` — `FileValidator` enforces the business-layer rule; the container-level limit is a safety net.

- [x] Task 3: Define `ParsedResumeDto` record (AC: 2, 3)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ParsedResumeDto.java` as a Java record:
    ```java
    package com.tsvetanbondzhov.resumeenhancer.upload.dto;
    import java.util.List;
    public record ParsedResumeDto(
        String rawText,
        List<String> workExperienceLines,
        List<String> educationLines,
        List<String> skillLines
    ) {}
    ```
  - [x] `rawText` — full extracted text for fallback/debugging. The other three lists are best-effort heuristic extractions from section headings. They may be empty if no clear section headings are found — Story 2.4 handles the "nothing extracted" case.
  - [x] All fields non-null (use empty list / empty string as defaults). Never return null collections.

- [x] Task 4: Implement `PdfParser` (AC: 2, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/PdfParser.java` — annotate `@Component`.
  - [x] Dependency: `pdfbox` version `3.0.3` is already in `pom.xml`.
  - [x] Method: `ParsedResumeDto parse(MultipartFile file)`.
  - [x] Use `PDDocument.load(file.getInputStream())` with try-with-resources. Extract text via `PDFTextStripper`.
  - [x] **PDFBox 3.x API change:** `PDDocument.load()` is replaced by `Loader.loadPDF(inputStream)` in PDFBox 3.0+. Use `org.apache.pdfbox.Loader.loadPDF(file.getInputStream())`.
  - [x] After text extraction, call a private `extractSections(String rawText)` method to produce heuristic lists — look for common section heading keywords (case-insensitive): `"experience"`, `"work"`, `"employment"` for work; `"education"`, `"degree"`, `"university"`, `"college"` for education; `"skills"`, `"technologies"`, `"competencies"` for skills.
  - [x] On `IOException` or any PDFBox exception, throw `FileValidationException("Failed to read PDF file. The file may be corrupted or password-protected.")`.
  - [x] Close resources properly: use try-with-resources for `PDDocument`.

- [x] Task 5: Implement `DocxParser` (AC: 3, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/DocxParser.java` — annotate `@Component`.
  - [x] Dependency: `poi-ooxml` version `5.3.0` is already in `pom.xml`.
  - [x] Method: `ParsedResumeDto parse(MultipartFile file)`.
  - [x] Use `XWPFDocument(file.getInputStream())` with try-with-resources. Extract text by iterating `document.getParagraphs()` and calling `paragraph.getText()`. Join all paragraph texts with `"\n"`.
  - [x] Call the same `extractSections` logic (extract as a shared utility, or replicate — both parsers are standalone `@Component` beans, no shared base class needed for this story).
  - [x] On any exception, throw `FileValidationException("Failed to read DOCX file. The file may be corrupted or invalid.")`.

- [x] Task 6: Implement `ParsingService` (AC: 2, 3, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java` — annotate `@Service`.
  - [x] Constructor-inject `FileValidator`, `PdfParser`, `DocxParser`.
  - [x] Method: `ParsedResumeDto parse(MultipartFile file)`.
  - [x] Call `fileValidator.validate(file)` first (throws `FileValidationException` on rejection).
  - [x] Dispatch to parser by MIME type: `"application/pdf"` → `pdfParser.parse(file)`, DOCX MIME → `docxParser.parse(file)`. Throw `FileValidationException` if MIME is unrecognized (defensive — validator already blocks this).
  - [x] No AI, no profile mapping — this service is a pure parsing layer. Story 2.4 does the profile population.

- [x] Task 7: Implement `UploadController` (AC: 1, 2, 3, 4)
  - [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/UploadController.java`.
  - [x] Annotate `@RestController @RequestMapping("/api/v1/upload")`.
  - [x] Constructor-inject `ParsingService`.
  - [x] Endpoint: `@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` → `public ResponseEntity<ParsedResumeDto> upload(@RequestParam("file") MultipartFile file, Authentication authentication)`.
  - [x] Call `parsingService.parse(file)` and return `ResponseEntity.ok(result)`.
  - [x] `FileValidationException` is handled globally by `GlobalExceptionHandler` — no try/catch in the controller.
  - [x] Endpoint is JWT-protected automatically (no permit-all needed — `SecurityConfig.anyRequest().authenticated()` covers it).
  - [x] No `@PreAuthorize` needed — any authenticated user may upload.

- [x] Task 8: Add `FileValidatorTest.java` — unit test, no Spring context (AC: 5)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/FileValidatorTest.java`.
  - [x] `@ExtendWith(MockitoExtension.class)` only — no `@SpringBootTest`.
  - [x] Use `MockMultipartFile` from `org.springframework.mock.web.MockMultipartFile`.
  - [x] Test 1: valid PDF MIME + size under 10MB → `validate()` completes without exception.
  - [x] Test 2: valid DOCX MIME + size under 10MB → `validate()` completes without exception.
  - [x] Test 3: invalid MIME (`"text/plain"`) → throws `FileValidationException` with message containing "Unsupported file type".
  - [x] Test 4: valid MIME but size = 11MB (11 * 1024 * 1024 bytes) → throws `FileValidationException` with message containing "10MB".
  - [x] Test 5: null content type → throws `FileValidationException`.

- [x] Task 9: Add sample resume files for parser tests (AC: 5 / NFR16)
  - [x] Create directory `src/test/resources/samples/`.
  - [x] Add at least two real-world-style PDF resume files: `resume-sample-1.pdf`, `resume-sample-2.pdf`.
  - [x] Add at least two real-world-style DOCX resume files: `resume-sample-1.docx`, `resume-sample-2.docx`.
  - [x] Files must contain recognizable section headings (Experience, Education, Skills) for the heuristic extraction to have something to find.
  - [x] If no real-world files are available, create minimal but realistic synthetic files using PDFBox and Apache POI programmatically within the test class setup (`@BeforeAll`), writing them to a temp directory. This is acceptable per NFR16 intent — the key is that real parsing code runs against real binary file formats, not string mocks.

- [x] Task 10: Add `PdfParserTest.java` — unit test, no Spring context (AC: 5 / NFR16)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/PdfParserTest.java`.
  - [x] `@ExtendWith(MockitoExtension.class)` — instantiate `PdfParser` directly (no Spring context).
  - [x] Test 1: `resume-sample-1.pdf` → `parse()` returns `ParsedResumeDto` with non-null, non-empty `rawText`.
  - [x] Test 2: `resume-sample-2.pdf` → same assertion.
  - [x] Test 3: A deliberately corrupted/empty byte array wrapped in `MockMultipartFile` → throws `FileValidationException`.
  - [x] Load sample files via `getClass().getResourceAsStream("/samples/resume-sample-1.pdf")`.

- [x] Task 11: Add `DocxParserTest.java` — unit test, no Spring context (AC: 5 / NFR16)
  - [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/DocxParserTest.java`.
  - [x] Same structure as `PdfParserTest` but for DOCX samples and `DocxParser`.
  - [x] Test 1 & 2: two DOCX samples → non-null, non-empty `rawText`.
  - [x] Test 3: corrupted bytes → throws `FileValidationException`.

## Dev Notes

### Package structure for `upload/` domain

Exact file locations per architecture:
```
src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/
  UploadController.java         ← @RestController POST /api/v1/upload
  ParsingService.java           ← @Service; orchestrates validation + dispatch
  validators/
    FileValidator.java          ← @Component; MIME + size check
  parsers/
    PdfParser.java              ← @Component; PDFBox
    DocxParser.java             ← @Component; Apache POI
  dto/
    ParsedResumeDto.java        ← Java record

src/main/java/com/tsvetanbondzhov/resumeenhancer/common/
  FileValidationException.java  ← NEW; RuntimeException subclass
  GlobalExceptionHandler.java   ← MODIFY; add FileValidationException handler

src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/
  FileValidatorTest.java
  PdfParserTest.java
  DocxParserTest.java

src/test/resources/samples/
  resume-sample-1.pdf
  resume-sample-2.pdf
  resume-sample-1.docx
  resume-sample-2.docx
```

### CRITICAL: No upload/ package exists yet — create from scratch

The `upload/` package has zero existing files. All classes are NEW. Do NOT create any file outside this package except the two changes to `common/`.

### CRITICAL: PDFBox 3.x API — use `Loader.loadPDF()` not `PDDocument.load()`

PDFBox 3.0+ (project uses `3.0.3`) changed the document loading API:
- **WRONG (PDFBox 2.x):** `PDDocument doc = PDDocument.load(inputStream)`
- **CORRECT (PDFBox 3.x):** `PDDocument doc = Loader.loadPDF(inputStream)` — import `org.apache.pdfbox.Loader`

Also note: `PDFTextStripper` API is unchanged between 2.x and 3.x.

### CRITICAL: iText version is 8.0.5 (not 7)

The pom.xml has `<itext.version>8.0.5</itext.version>` with artifact `com.itextpdf:itext-core`. This is iText 8, not iText 7. The project-context mentions "iText 7" but pom.xml is authoritative — use iText 8. This story does NOT use iText (that's for PDF export in Story 5.1) — but document the discrepancy so future stories are not tripped up.

### GlobalExceptionHandler extension — do not break existing handlers

`GlobalExceptionHandler` currently handles: `DomainAuthException` (401), `DomainConflictException` (409), `MethodArgumentNotValidException` (400), and generic `Exception` (500). Add the `FileValidationException` handler BEFORE the generic `Exception` handler. Map it to HTTP 422 (`HttpStatus.UNPROCESSABLE_ENTITY`).

```java
@ExceptionHandler(FileValidationException.class)
public ProblemDetail handleFileValidation(FileValidationException ex) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            ex.getMessage()
    );
    problem.setTitle("Unprocessable Entity");
    return problem;
}
```

### SecurityConfig — no changes required

`SecurityConfig` uses `.anyRequest().authenticated()` — `POST /api/v1/upload` is automatically JWT-protected. No permit-all exclusion needed. Do NOT modify `SecurityConfig`.

### multipart config already in application.yml

`spring.servlet.multipart.max-file-size=10MB` and `max-request-size=10MB` are set in `src/main/resources/application.yml`. The container will reject requests over 10MB before they reach `FileValidator`. The `FileValidator` 10MB check is the business-layer rule (defense-in-depth). No yml changes needed.

### ParsedResumeDto heuristic extraction — keep it simple

This story is infrastructure, not AI. The heuristic section extraction is deliberately simple:
- Split raw text into lines.
- When a line contains a section keyword (case-insensitive), start capturing subsequent non-blank lines into that section's list until the next section keyword or end of text.
- If no section headings are found, all three lists are empty — this is acceptable. Story 2.4 handles the "nothing extracted" fallback.
- Do NOT attempt NLP, regex-heavy parsing, or AI in this story.

### Test pattern — no Spring context for parsers

Per project rules (`DocumentPatchService` and `FileValidator` are pure domain logic — test with `@ExtendWith(MockitoExtension.class)` only). Parser tests also use no Spring context. Use `MockMultipartFile` from `spring-test` (already on classpath via `spring-boot-starter-test`).

```java
// MockMultipartFile for a real file loaded from resources:
byte[] bytes = getClass().getResourceAsStream("/samples/resume-sample-1.pdf").readAllBytes();
MockMultipartFile file = new MockMultipartFile("file", "resume.pdf", "application/pdf", bytes);
ParsedResumeDto result = pdfParser.parse(file);
assertThat(result.rawText()).isNotBlank();
```

### Integration test — NOT required for this story

The ACs require unit tests only. An `UploadControllerIntegrationTest.java` is NOT required here (epics AC5 explicitly names only the three unit test files). Do not create one. Story 2.4 can add an integration test when it uses the upload endpoint end-to-end.

### No Flyway migrations needed

This story adds no new database tables. The upload endpoint parses and returns `ParsedResumeDto` — it does not persist anything. Story 2.4 reads the returned DTO and populates the profile (which uses existing V2 tables via `ProfileService`).

### No frontend work in this story

This is a pure backend story. The upload UI trigger (`ProfilePage` "Upload existing resume" button) is Story 2.4.

### Previous story patterns (2.2 learnings)

- Exception handling: throw typed domain exceptions, never catch-and-swallow. `GlobalExceptionHandler` is the sole mapping point.
- Test isolation: unit tests use `@ExtendWith(MockitoExtension.class)` with no Spring context.
- Test data: `MockMultipartFile` is the standard approach for file testing in this project.
- Package pattern: `common/` for shared infrastructure (`BaseEntity`, `GlobalExceptionHandler`, domain exceptions); domain-specific code under the domain package (`upload/`).

### References

- Story ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3 (lines 434–461)]
- Upload package structure: [Source: _bmad-output/planning-artifacts/architecture.md#Backend Package Structure (lines 513–520)]
- FileValidator requirement: [Source: _bmad-output/planning-artifacts/architecture.md#File Upload Security (lines 200–202)]
- GlobalExceptionHandler existing handlers: [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java]
- SecurityConfig anyRequest().authenticated(): [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/config/SecurityConfig.java line 36]
- Multipart config: [Source: src/main/resources/application.yml lines 20–22]
- PDFBox version 3.0.3: [Source: pom.xml line 34]
- Apache POI version 5.3.0: [Source: pom.xml line 33]
- Test pattern (no Spring context): [Source: _bmad-output/project-context.md#Testing Rules (lines 99–103)]
- NFR13 malformed files: [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements (line 77)]
- NFR16 real-world sample tests: [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements (line 79)]
- Existing test integration test pattern: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileControllerIntegrationTest.java]
- TestcontainersConfiguration: [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/TestcontainersConfiguration.java]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Implemented full `upload/` domain from scratch: `FileValidationException`, `FileValidator`, `ParsedResumeDto`, `PdfParser`, `DocxParser`, `ParsingService`, `UploadController`.
- Used `Loader.loadPDF(bytes)` (PDFBox 3.x API) — not deprecated `PDDocument.load(inputStream)`.
- `PdfParser` reads `file.getBytes()` rather than `file.getInputStream()` to avoid stream-already-consumed issues on retries; `Loader.loadPDF(byte[])` overload used.
- Sample PDF/DOCX files generated programmatically via `SampleFileGenerator` in `@BeforeAll` — both formats contain real binary data with Work Experience / Education / Skills headings.
- All 11 new unit tests pass; full suite (37 tests) green with zero regressions.
- No Spring context loaded in any of the three unit test classes.
- `GlobalExceptionHandler` extended with `FileValidationException` handler (HTTP 422) inserted before the catch-all `Exception` handler.
- iText 8 discrepancy documented in Dev Notes (story uses iText 8.0.5, not iText 7 as stated in project-context.md) — no iText used in this story; relevant for Story 5.1.
- ✅ Resolved review finding [Patch]: Extracted shared `SectionExtractor` utility class to `upload/parsers/SectionExtractor.java`; both `PdfParser` and `DocxParser` now delegate to it, eliminating ~40 lines of duplication.
- ✅ Resolved review finding [Patch]: Removed unused `Authentication authentication` parameter from `UploadController.upload()` — endpoint is JWT-protected by `SecurityConfig.anyRequest().authenticated()`.
- ✅ Resolved review finding [Patch]: Removed empty `src/test/resources/samples/` directory — `SampleFileGenerator` approach is explicitly permitted by spec and generates real binary files at test runtime.
- Full suite 37/37 tests green after all fixes.

### File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/FileValidationException.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` (modified — added FileValidationException handler)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/validators/FileValidator.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ParsedResumeDto.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/SectionExtractor.java` (new — shared heuristic extractor)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/PdfParser.java` (modified — delegates to SectionExtractor)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/DocxParser.java` (modified — delegates to SectionExtractor)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java` (new)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/UploadController.java` (new)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/FileValidatorTest.java` (new)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/PdfParserTest.java` (new)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/DocxParserTest.java` (new)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/SampleFileGenerator.java` (new)
- `src/test/resources/samples/` (removed empty directory — SampleFileGenerator generates files programmatically at test runtime)

### Review Findings

- [x] [Review][Patch] extractSections/isSectionHeading duplicated across PdfParser and DocxParser — Identical ~40 lines of private methods copy-pasted. Extract to shared utility to prevent divergence. [PdfParser.java:35-75, DocxParser.java:32-72]
- [x] [Review][Patch] Unused `Authentication authentication` parameter in UploadController.upload() — Dead parameter; remove or suppress. [UploadController.java:25-26]
- [x] [Review][Patch] src/test/resources/samples/ directory is empty — Task 9 marked done but directory contains no files. Either add the 4 sample files or remove the empty directory (SampleFileGenerator approach is explicitly permitted by spec). [src/test/resources/samples/]
- [x] [Review][Defer] Broad catch(Exception) after catch(IOException) in PdfParser and DocxParser [PdfParser.java:30-32, DocxParser.java:27-29] — deferred, pre-existing; AC-4 satisfied, tighten in future refactor
- [x] [Review][Defer] MIME constants duplicated in FileValidator and ParsingService [FileValidator.java:10-11, ParsingService.java:14-15] — deferred, pre-existing; constants are consistent, Story 2.4 won't change them

## Change Log

- 2026-05-29: Story implemented. Created upload domain from scratch: FileValidationException, FileValidator, ParsedResumeDto, PdfParser (PDFBox 3.x), DocxParser (POI), ParsingService, UploadController. Added GlobalExceptionHandler handler for HTTP 422. Added 11 unit tests (FileValidatorTest x5, PdfParserTest x3, DocxParserTest x3) + SampleFileGenerator utility. Full suite 37/37 tests green. Status → review.
- 2026-05-29: Addressed code review findings — 3 patch items resolved: (1) extracted SectionExtractor shared utility (eliminates PdfParser/DocxParser duplication), (2) removed unused Authentication parameter from UploadController, (3) removed empty samples/ directory. Full suite 37/37 tests green. Status → review.
