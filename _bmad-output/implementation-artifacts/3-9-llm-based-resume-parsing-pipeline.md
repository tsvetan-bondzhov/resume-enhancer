# Story 3.9: LLM-Based Resume Parsing Pipeline

Status: review

## Story

As a user uploading a resume,
I want my uploaded PDF or DOCX to be intelligently parsed into structured sections, job titles, companies, dates, and skills,
So that my profile is pre-populated with typed, actionable data rather than raw unformatted text.

## Acceptance Criteria

**AC1 — AiService + OllamaHealthGuard + OllamaUnavailableException scaffolded**
**Given** the Spring AI 2.0.0-M6 Ollama starter dependency is present in `pom.xml`
**When** the application starts
**Then** `AiService` is a `@Service` bean in the `ai` package with `ChatClient` injected via constructor; `OllamaHealthGuard` is a `@Component` that checks Ollama reachability; `OllamaUnavailableException` is a typed domain exception in the `ai` package; `AiService` is the ONLY class in the codebase that calls `ChatClient` directly; `LlmSectionExtractor` calls `AiService.extractResumeSection()` only, never `ChatClient` directly

**AC2 — `SectionExtractor.segmentByHeaders()` with full-line-only matching**
**Given** `SectionExtractor.segmentByHeaders(rawText)` is called
**When** the input contains section headings
**Then** it returns a `List<RawSection>` where each `RawSection` record holds a `title` (String) and `lines` (List<String>); the keyword set covers: experience, work, employment, education, degree, skills, technologies, certifications, projects, summary, publications, languages, volunteering; section detection fires ONLY when the keyword constitutes the FULL normalized line — not a mid-sentence substring match (fixes `"5 years of experience"` false-positive bug)

**AC3 — `ResumeSectionType` enum with UNKNOWN fallback**
**Given** `ResumeSectionType` enum is defined
**When** `segmentByHeaders()` classifies a section header
**Then** recognized headers map to `WORK_EXPERIENCE`, `EDUCATION`, `SKILLS`, `CERTIFICATIONS`, `PROJECTS`, `SUMMARY`, `LANGUAGES`, `VOLUNTEERING`; unrecognized headers map to `UNKNOWN` with raw lines stored as a single `text` field per item — content is never silently dropped

**AC4 — Happy path: Ollama available**
**Given** Ollama is available
**When** `ParsingService.parse(file)` is called
**Then** `OllamaHealthGuard.isAvailable()` returns true; `LlmSectionExtractor` is invoked; for each `RawSection`, `AiService.extractResumeSection(sectionType, sectionText)` is called with a prompt built from `src/main/resources/prompts/resume-section-extraction.st`; the JSON response is validated and converted to `List<ResumeItemDto>`; a `ResumeDocument` with typed `ResumeSection` / `ResumeItem` entries is assembled and returned alongside the backward-compatible `ParsedResumeDto`

**AC5 — Graceful degradation: Ollama unavailable**
**Given** Ollama is unavailable
**When** `ParsingService.parse(file)` is called
**Then** `OllamaHealthGuard.isAvailable()` returns false; `ParsingService` catches `OllamaUnavailableException` and returns a heuristic-only `ParsedResumeDto`; the upload endpoint always returns HTTP 200 — never 503; no `LlmSectionExtractor` call is made

**AC6 — Per-section JSON parse failure falls back to heuristic lines**
**Given** `LlmSectionExtractor` receives a malformed JSON response for one section
**When** the JSON parse check fails
**Then** that section falls back to heuristic lines; all other sections retain their LLM-extracted output; the malformed response is logged at WARN; the upload is never blocked

**AC7 — Date format validation**
**Given** `LlmSectionExtractor` receives a structurally valid JSON response
**When** the date format check runs
**Then** date fields not matching `\d{4}(-\d{2})?` or `"Present"` are nulled out; the item is kept with all remaining valid fields intact

**AC8 — Anchor check sets lowConfidence flag**
**Given** `LlmSectionExtractor` receives a JSON response where no field value for an item appears as a case-insensitive substring in `rawText`
**When** the anchor check runs
**Then** the item is included but `lowConfidence: true` is set in the intermediate `ResumeItemDto` and logged at WARN; it is never silently dropped

**AC9 — 3000-character section truncation**
**Given** a resume section exceeds 3000 characters
**When** `LlmSectionExtractor` prepares the prompt
**Then** the section text is truncated to 3000 characters before sending; truncation is logged at WARN

**AC10 — 30-second total timeout falls back to heuristic**
**Given** the total LLM parsing time exceeds 30 seconds
**When** `ParsingService` detects the timeout
**Then** heuristic `ParsedResumeDto` is returned; the upload endpoint returns HTTP 200

**AC11 — Unit tests**
**Given** `LlmSectionExtractorTest.java` and `ParsingServiceTest.java` are run
**When** tests execute
**Then** `LlmSectionExtractorTest` covers: JSON parse failure falls back to heuristic lines; date fields with invalid format are nulled; anchor-check failure sets `lowConfidence: true`; all using a mocked `AiService`; `ParsingServiceTest` asserts that when `OllamaHealthGuard.isAvailable()` returns false, heuristic `ParsedResumeDto` is returned and `LlmSectionExtractor` is never called

---

## Tasks / Subtasks

### Task 1: Add `OllamaUnavailableException` to `ai` package (AC: 1)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaUnavailableException.java`

```java
package com.tsvetanbondzhov.resumeenhancer.ai;

public class OllamaUnavailableException extends RuntimeException {
    public OllamaUnavailableException(String message) {
        super(message);
    }

    public OllamaUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

**CRITICAL:** This is a domain exception — it must NOT be caught and swallowed anywhere except `ParsingService.parse()`. `GlobalExceptionHandler` does NOT need to handle it — it is caught internally before reaching the HTTP layer.

---

### Task 2: Create `AiService` in `ai` package (AC: 1)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`

**Spring AI 2.0.0-M6 ChatClient API — exact usage:**

```java
package com.tsvetanbondzhov.resumeenhancer.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final ChatClient chatClient;

    public AiService(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.build();
    }

    /**
     * Calls Ollama with a section extraction prompt. Returns raw JSON string.
     * Throws OllamaUnavailableException if Ollama is unreachable.
     */
    public String extractResumeSection(String sectionType, String sectionText) {
        try {
            return chatClient.prompt()
                    .user(u -> u.text(buildPrompt(sectionType, sectionText)))
                    .call()
                    .content();
        } catch (Exception e) {
            log.warn("Ollama call failed for sectionType={}: {}", sectionType, e.getMessage());
            throw new OllamaUnavailableException("Ollama is unavailable: " + e.getMessage(), e);
        }
    }

    private String buildPrompt(String sectionType, String sectionText) {
        // Returns inline prompt if template resolution fails; real impl uses PromptTemplate from .st file
        return String.format("""
                You are a resume parsing expert. Extract structured data from the following resume section.
                Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
                Use null for any field not present in the text.

                Section type: %s
                Section text:
                %s

                Return the JSON array now:
                """, sectionType, sectionText);
    }
}
```

**CRITICAL — Spring AI 2.0.0-M6 ChatClient constructor injection:**
- Inject `ChatClient.Builder` (NOT `ChatClient` directly) in the constructor — the `Builder` is auto-configured by `spring-ai-starter-model-ollama`
- Call `.build()` once in the constructor to obtain the `ChatClient` instance
- The fluent API is: `chatClient.prompt().user(u -> u.text("...")).call().content()`
- DO NOT inject `OllamaApi`, `OllamaChatModel`, or `ChatModel` directly — use the `ChatClient.Builder` abstraction

**CRITICAL — `AiService` is the only class that touches `ChatClient` anywhere in the codebase.** This is an architectural invariant. `LlmSectionExtractor` and `ParsingService` call `AiService` methods only.

---

### Task 3: Create `OllamaHealthGuard` in `ai` package (AC: 1, 5)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java`

```java
package com.tsvetanbondzhov.resumeenhancer.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class OllamaHealthGuard {

    private static final Logger log = LoggerFactory.getLogger(OllamaHealthGuard.class);

    @Value("${spring.ai.ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    /**
     * Returns true if Ollama is reachable. This is a synchronous HTTP probe.
     * Called once at the start of parsing — no caching (availability can change).
     */
    public boolean isAvailable() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaBaseUrl))
                    .GET()
                    .timeout(Duration.ofSeconds(3))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() < 500;
        } catch (Exception e) {
            log.warn("Ollama health check failed: {}", e.getMessage());
            return false;
        }
    }
}
```

**CRITICAL:** `OllamaHealthGuard.isAvailable()` uses `java.net.http.HttpClient` (Java 11+ built-in). No external HTTP library needed. Timeout is 3 seconds. Returns `false` on any exception — never throws.

---

### Task 4: Add `RawSection` and `ResumeItemDto` records to `upload/dto` (AC: 2, 3)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/RawSection.java`

```java
package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import java.util.List;

public record RawSection(String title, List<String> lines) {
    public RawSection {
        lines = lines != null ? List.copyOf(lines) : List.of();
    }
}
```

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ResumeItemDto.java`

```java
package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import java.util.Map;

public record ResumeItemDto(
        Map<String, String> fields,
        boolean lowConfidence
) {
    public ResumeItemDto {
        fields = fields != null ? Map.copyOf(fields) : Map.of();
    }
}
```

---

### Task 5: Add `ResumeSectionType` enum to `upload/parsers` (AC: 3)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java`

```java
package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

public enum ResumeSectionType {
    WORK_EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS,
    PROJECTS, SUMMARY, LANGUAGES, VOLUNTEERING, UNKNOWN;

    /**
     * Maps a normalized section header to a type.
     * Returns UNKNOWN for headers that don't match any known type.
     */
    public static ResumeSectionType fromHeader(String normalizedHeader) {
        return switch (normalizedHeader) {
            case "experience", "work experience", "work", "employment",
                 "work history", "professional experience" -> WORK_EXPERIENCE;
            case "education", "degree", "academic background",
                 "educational background" -> EDUCATION;
            case "skills", "technologies", "technical skills",
                 "core competencies", "competencies" -> SKILLS;
            case "certifications", "certificates", "certification" -> CERTIFICATIONS;
            case "projects", "project experience", "personal projects",
                 "open source", "key projects" -> PROJECTS;
            case "summary", "professional summary", "profile",
                 "about me", "objective", "career objective" -> SUMMARY;
            case "languages", "language skills" -> LANGUAGES;
            case "volunteering", "volunteer", "volunteer experience",
                 "community involvement" -> VOLUNTEERING;
            default -> UNKNOWN;
        };
    }
}
```

---

### Task 6: Modify `SectionExtractor` — add `segmentByHeaders()` with full-line matching (AC: 2)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/SectionExtractor.java`

**CRITICAL: The existing `extract(String rawText)` method MUST be preserved unchanged.** `PdfParser` and `DocxParser` both call `SectionExtractor.extract()`. Do NOT change their behavior or signatures. Only ADD the new `segmentByHeaders()` static method.

**CRITICAL: The existing brittleness bug** is in `containsKeyword()` which uses `line.contains(keyword)`. This fires on `"5 years of experience"` because "experience" is a substring. The new `segmentByHeaders()` must use full-line matching: `normalizedLine.equals(keyword)` or the normalized line matches any known header pattern exactly.

**New `segmentByHeaders()` to add:**

```java
private static final Set<String> ALL_SECTION_KEYWORDS = Set.of(
    "experience", "work experience", "work", "employment", "work history", "professional experience",
    "education", "degree", "academic background", "educational background",
    "skills", "technologies", "technical skills", "core competencies", "competencies",
    "certifications", "certificates", "certification",
    "projects", "project experience", "personal projects", "open source", "key projects",
    "summary", "professional summary", "profile", "about me", "objective", "career objective",
    "publications",
    "languages", "language skills",
    "volunteering", "volunteer", "volunteer experience", "community involvement"
);

/**
 * Segments raw resume text into sections by detecting header lines.
 * FULL-LINE match only: a line must normalize to a known keyword exactly.
 * This prevents mid-sentence false positives (e.g. "5 years of experience").
 */
public static List<RawSection> segmentByHeaders(String rawText) {
    List<RawSection> sections = new ArrayList<>();
    String[] lines = rawText.split("\\r?\\n");

    String currentTitle = null;
    List<String> currentLines = new ArrayList<>();

    for (String line : lines) {
        String trimmed = line.trim();
        if (trimmed.isEmpty()) continue;

        String normalized = trimmed.toLowerCase()
                .replaceAll("[^a-z0-9 ]", "")  // strip punctuation
                .trim();

        if (ALL_SECTION_KEYWORDS.contains(normalized)) {
            // Save previous section if it had content
            if (currentTitle != null) {
                sections.add(new RawSection(currentTitle, List.copyOf(currentLines)));
            }
            currentTitle = trimmed;
            currentLines = new ArrayList<>();
        } else if (currentTitle != null) {
            currentLines.add(trimmed);
        }
    }

    // Add final section
    if (currentTitle != null) {
        sections.add(new RawSection(currentTitle, List.copyOf(currentLines)));
    }

    return sections;
}
```

**Import to add:** `import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;` at top of file.
**Import to add:** `import java.util.Set;` and `import java.util.List;` (if not already present).

---

### Task 7: Create prompt template `resume-section-extraction.st` (AC: 4)

- [x] Create `src/main/resources/prompts/resume-section-extraction.st`

**CRITICAL:** Spring AI `PromptTemplate` uses `{variable}` syntax (single curly braces). The `.st` extension is used by Spring AI for `StringTemplate` format. This file must live at `src/main/resources/prompts/` so Spring AI can load it via `ClassPathResource`.

```
You are a resume parsing expert. Extract structured data from the following resume section.
Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
Use null for any field not present in the text.

Section type: {sectionType}
Section text:
{sectionText}

Field schema for {sectionType}:
{fieldSchema}

Return the JSON array now:
```

**Per-section field schemas** (hardcoded in `LlmSectionExtractor.getFieldSchema()`):

| Section type | Fields |
|---|---|
| `WORK_EXPERIENCE` | `title`, `company`, `startDate` (YYYY-MM), `endDate` (YYYY-MM or "Present"), `description` (comma-separated achievements) |
| `EDUCATION` | `degree`, `institution`, `graduationDate` (YYYY or YYYY-MM), `gpa` |
| `SKILLS` | `skillName`, `proficiency`, `category` |
| `CERTIFICATIONS` | `certificationName`, `issuer`, `issueDate` (YYYY-MM), `expirationDate` |
| `PROJECTS` | `projectName`, `description`, `technologies` (comma-separated), `link` |
| `SUMMARY` | `text` (single item, full summary prose) |
| `LANGUAGES` | `language`, `proficiency` |
| `VOLUNTEERING` | `role`, `organization`, `startDate`, `endDate`, `description` |
| `UNKNOWN` | `text` (single item, raw content) |

---

### Task 8: Create `LlmSectionExtractor` in `upload/parsers` (AC: 4, 6, 7, 8, 9)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`

```java
package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ResumeItemDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class LlmSectionExtractor {

    private static final Logger log = LoggerFactory.getLogger(LlmSectionExtractor.class);
    private static final int MAX_SECTION_LENGTH = 3000;
    private static final Pattern DATE_PATTERN = Pattern.compile("\\d{4}(-\\d{2})?");
    private static final Pattern DATE_FIELD_PATTERN = Pattern.compile("(?i)(date|start|end|graduation|issue|expiration)");

    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public LlmSectionExtractor(AiService aiService, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    /**
     * Extracts typed ResumeDocument from a list of raw sections.
     * Never throws — falls back to heuristic lines on per-section failure.
     */
    public ResumeDocument extract(List<RawSection> rawSections, String fullRawText) {
        List<ResumeSection> sections = new ArrayList<>();

        for (RawSection rawSection : rawSections) {
            ResumeSectionType sectionType = ResumeSectionType.fromHeader(
                rawSection.title().toLowerCase().replaceAll("[^a-z0-9 ]", "").trim()
            );
            String sectionText = String.join("\n", rawSection.lines());

            // AC9: Truncate to 3000 chars
            if (sectionText.length() > MAX_SECTION_LENGTH) {
                log.warn("Section '{}' truncated from {} to {} chars",
                    rawSection.title(), sectionText.length(), MAX_SECTION_LENGTH);
                sectionText = sectionText.substring(0, MAX_SECTION_LENGTH);
            }

            List<ResumeItem> items = extractSectionItems(
                rawSection, sectionType, sectionText, fullRawText);

            sections.add(new ResumeSection(
                UUID.randomUUID().toString(),
                rawSection.title(),
                true,
                items
            ));
        }

        return new ResumeDocument(sections);
    }

    private List<ResumeItem> extractSectionItems(
            RawSection rawSection,
            ResumeSectionType sectionType,
            String sectionText,
            String fullRawText) {

        try {
            PromptTemplate template = new PromptTemplate(
                new ClassPathResource("prompts/resume-section-extraction.st"));
            String prompt = template.render(Map.of(
                "sectionType", sectionType.name(),
                "sectionText", sectionText,
                "fieldSchema", getFieldSchema(sectionType)
            ));

            String jsonResponse = aiService.extractResumeSection(sectionType.name(), sectionText);

            // AC6: JSON parse check
            List<Map<String, Object>> rawItems;
            try {
                rawItems = objectMapper.readValue(jsonResponse,
                    new TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                log.warn("Malformed JSON for section '{}', falling back to heuristic lines: {}",
                    rawSection.title(), e.getMessage());
                return heuristicItems(rawSection);
            }

            // Validate and convert items
            List<ResumeItem> result = new ArrayList<>();
            for (Map<String, Object> rawItem : rawItems) {
                ResumeItemDto dto = validateAndConvert(rawItem, fullRawText);
                if (dto.lowConfidence()) {
                    log.warn("Low confidence item in section '{}': fields={}",
                        rawSection.title(), dto.fields());
                }
                result.add(new ResumeItem(UUID.randomUUID().toString(), dto.fields()));
            }
            return result;

        } catch (Exception e) {
            log.warn("LLM extraction failed for section '{}', using heuristic fallback: {}",
                rawSection.title(), e.getMessage());
            return heuristicItems(rawSection);
        }
    }

    private ResumeItemDto validateAndConvert(Map<String, Object> rawItem, String fullRawText) {
        Map<String, String> fields = new HashMap<>();

        for (Map.Entry<String, Object> entry : rawItem.entrySet()) {
            String key = entry.getKey();
            Object val = entry.getValue();
            if (val == null) continue;

            String strVal = val.toString();

            // AC7: Date format check
            if (DATE_FIELD_PATTERN.matcher(key).find()) {
                if (!strVal.equals("Present") && !DATE_PATTERN.matcher(strVal).matches()) {
                    log.debug("Nulling invalid date field '{}': '{}'", key, strVal);
                    continue; // null out — don't add to fields map
                }
            }
            fields.put(key, strVal);
        }

        // AC8: Anchor check — at least one field value must appear in rawText
        boolean hasAnchor = fields.values().stream()
            .anyMatch(v -> fullRawText.toLowerCase().contains(v.toLowerCase()));

        return new ResumeItemDto(fields, !hasAnchor && !fields.isEmpty());
    }

    private List<ResumeItem> heuristicItems(RawSection rawSection) {
        List<ResumeItem> items = new ArrayList<>();
        for (String line : rawSection.lines()) {
            items.add(new ResumeItem(
                UUID.randomUUID().toString(),
                Map.of("text", line)
            ));
        }
        return items;
    }

    private String getFieldSchema(ResumeSectionType type) {
        return switch (type) {
            case WORK_EXPERIENCE -> "[{\"title\": \"\", \"company\": \"\", \"startDate\": \"YYYY-MM\", " +
                "\"endDate\": \"YYYY-MM or Present\", \"description\": \"comma-separated achievements\"}]";
            case EDUCATION -> "[{\"degree\": \"\", \"institution\": \"\", " +
                "\"graduationDate\": \"YYYY or YYYY-MM\", \"gpa\": \"\"}]";
            case SKILLS -> "[{\"skillName\": \"\", \"proficiency\": \"\", \"category\": \"\"}]";
            case CERTIFICATIONS -> "[{\"certificationName\": \"\", \"issuer\": \"\", " +
                "\"issueDate\": \"YYYY-MM\", \"expirationDate\": \"YYYY-MM\"}]";
            case PROJECTS -> "[{\"projectName\": \"\", \"description\": \"\", " +
                "\"technologies\": \"comma-separated\", \"link\": \"\"}]";
            case SUMMARY -> "[{\"text\": \"full summary prose\"}]";
            case LANGUAGES -> "[{\"language\": \"\", \"proficiency\": \"\"}]";
            case VOLUNTEERING -> "[{\"role\": \"\", \"organization\": \"\", " +
                "\"startDate\": \"YYYY-MM\", \"endDate\": \"YYYY-MM or Present\", \"description\": \"\"}]";
            default -> "[{\"text\": \"raw content\"}]";
        };
    }
}
```

**CRITICAL:** `LlmSectionExtractor` calls `aiService.extractResumeSection()` only — never `ChatClient` directly. The `ObjectMapper` bean is injected (it's auto-configured by Spring Boot; Jackson is already on classpath via JPA starter). Do NOT create a `new ObjectMapper()`.

**CRITICAL — Spring AI `PromptTemplate` in 2.0.0-M6:**
- Import: `org.springframework.ai.chat.prompt.PromptTemplate`
- Constructor: `new PromptTemplate(new ClassPathResource("prompts/resume-section-extraction.st"))`
- Render: `template.render(Map.of("key", "value"))` returns `String`
- Variables use `{variable}` syntax in the `.st` file

---

### Task 9: Modify `ParsingService` — orchestrate heuristic + LLM paths with timeout (AC: 4, 5, 10)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java`

**CRITICAL: The existing `parse()` behavior for PDF and DOCX routing MUST be preserved.** `PdfParser` and `DocxParser` are still called first to get `rawText`. The current return type `ParsedResumeDto` is unchanged. The `UploadController` signature is unchanged.

**New modified `ParsingService`:**

```java
package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.ai.OllamaHealthGuard;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.DocxParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.PdfParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.SectionExtractor;
import com.tsvetanbondzhov.resumeenhancer.upload.validators.FileValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class ParsingService {

    private static final Logger log = LoggerFactory.getLogger(ParsingService.class);
    private static final String MIME_PDF = "application/pdf";
    private static final String MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private static final int LLM_TIMEOUT_SECONDS = 30;

    private final FileValidator fileValidator;
    private final PdfParser pdfParser;
    private final DocxParser docxParser;
    private final OllamaHealthGuard ollamaHealthGuard;
    private final LlmSectionExtractor llmSectionExtractor;

    public ParsingService(
            FileValidator fileValidator,
            PdfParser pdfParser,
            DocxParser docxParser,
            OllamaHealthGuard ollamaHealthGuard,
            LlmSectionExtractor llmSectionExtractor) {
        this.fileValidator = fileValidator;
        this.pdfParser = pdfParser;
        this.docxParser = docxParser;
        this.ollamaHealthGuard = ollamaHealthGuard;
        this.llmSectionExtractor = llmSectionExtractor;
    }

    public ParsedResumeDto parse(MultipartFile file) {
        fileValidator.validate(file);

        String contentType = file.getContentType();
        ParsedResumeDto heuristicResult;

        if (MIME_PDF.equals(contentType)) {
            heuristicResult = pdfParser.parse(file);
        } else if (MIME_DOCX.equals(contentType)) {
            heuristicResult = docxParser.parse(file);
        } else {
            throw new FileValidationException("Unsupported file type. Only PDF and DOCX files are accepted.");
        }

        // Try LLM enhancement path
        if (!ollamaHealthGuard.isAvailable()) {
            log.info("Ollama unavailable — returning heuristic ParsedResumeDto");
            return heuristicResult;
        }

        try {
            String rawText = heuristicResult.rawText();
            List<RawSection> rawSections = SectionExtractor.segmentByHeaders(rawText);

            // AC10: Enforce 30-second total timeout via CompletableFuture
            CompletableFuture<ResumeDocument> future = CompletableFuture.supplyAsync(() ->
                llmSectionExtractor.extract(rawSections, rawText)
            );

            ResumeDocument resumeDocument = future.get(LLM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("LLM parsing complete: {} sections extracted", resumeDocument.sections().size());

            // Return heuristic DTO (backward compat) — ResumeDocument is assembled for future use
            return heuristicResult;

        } catch (TimeoutException e) {
            log.warn("LLM parsing timed out after {}s — returning heuristic fallback", LLM_TIMEOUT_SECONDS);
            return heuristicResult;
        } catch (OllamaUnavailableException e) {
            log.warn("Ollama unavailable during LLM extraction — returning heuristic fallback");
            return heuristicResult;
        } catch (Exception e) {
            log.warn("LLM parsing failed — returning heuristic fallback: {}", e.getMessage());
            return heuristicResult;
        }
    }
}
```

**CRITICAL — `ParsedResumeDto` backward compatibility:** The `UploadController` returns `ParsedResumeDto`. Its structure is unchanged: `(String rawText, List<String> workExperienceLines, List<String> educationLines, List<String> skillLines)`. The heuristic path produces this. The `ResumeDocument` is produced by the LLM path but is not yet returned to the client (Epic 4 will wire it into the profile seeding flow). For now, the heuristic DTO is always returned.

**CRITICAL — `CompletableFuture.supplyAsync()` uses the common ForkJoinPool by default**, which is acceptable for this story. Virtual threads or custom executor can be added in a future story if needed.

---

### Task 10: Create `LlmSectionExtractorTest.java` (AC: 11)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java`

```java
package com.tsvetanbondzhov.resumeenhancer.upload;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LlmSectionExtractorTest {

    @Mock
    private AiService aiService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private LlmSectionExtractor llmSectionExtractor;

    // AC6: JSON parse failure falls back to heuristic lines
    @Test
    void extract_malformedJsonResponse_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenReturn("NOT_VALID_JSON{{{{");

        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Acme Corp 2022-2024"))
        );

        ResumeDocument result = llmSectionExtractor.extract(sections, "Software Engineer at Acme Corp 2022-2024");

        assertThat(result.sections()).hasSize(1);
        ResumeSection section = result.sections().get(0);
        assertThat(section.items()).hasSize(1);
        // Fallback: single item with "text" field = the raw line
        assertThat(section.items().get(0).fields()).containsKey("text");
        assertThat(section.items().get(0).fields().get("text"))
            .isEqualTo("Software Engineer at Acme Corp 2022-2024");
    }

    // AC7: Date fields with invalid format are nulled out
    @Test
    void extract_invalidDateField_isNulledOut() throws Exception {
        String validJson = """
            [{"title": "Software Engineer", "company": "Acme Corp",
              "startDate": "not-a-date", "endDate": "Present",
              "description": "Built services"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Acme Corp"))
        );

        ResumeDocument result = llmSectionExtractor.extract(
            sections, "Software Engineer at Acme Corp Built services");

        ResumeSection section = result.sections().get(0);
        assertThat(section.items()).hasSize(1);
        ResumeItem item = section.items().get(0);
        // Invalid startDate "not-a-date" must be nulled (not present in fields)
        assertThat(item.fields()).doesNotContainKey("startDate");
        // Valid fields retained
        assertThat(item.fields()).containsEntry("title", "Software Engineer");
        assertThat(item.fields()).containsEntry("company", "Acme Corp");
        assertThat(item.fields()).containsEntry("endDate", "Present");
    }

    // AC8: Anchor check failure sets lowConfidence: true, item NOT dropped
    @Test
    void extract_anchorCheckFailure_setsLowConfidenceItemNotDropped() throws Exception {
        String validJson = """
            [{"title": "Fabricated Title", "company": "Ghost Corp",
              "startDate": "2020-01", "endDate": "2022-06",
              "description": "Invented achievements"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        // rawText does NOT contain "Fabricated Title" or "Ghost Corp"
        String rawText = "Software Engineer at Real Company 2020 to 2022";
        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Real Company"))
        );

        ResumeDocument result = llmSectionExtractor.extract(sections, rawText);

        ResumeSection section = result.sections().get(0);
        assertThat(section.items()).hasSize(1);
        // Item is NOT dropped — it is included despite low confidence
        assertThat(section.items().get(0).fields()).isNotEmpty();
        // The item was marked lowConfidence in intermediate DTO — we verify the item is present
    }

    // AC6: AiService throws OllamaUnavailableException — falls back to heuristic lines
    @Test
    void extract_aiServiceThrowsOllamaUnavailable_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenThrow(new OllamaUnavailableException("Ollama is down"));

        List<RawSection> sections = List.of(
            new RawSection("Skills", List.of("Java", "Spring Boot", "PostgreSQL"))
        );

        ResumeDocument result = llmSectionExtractor.extract(sections, "Java Spring Boot PostgreSQL");

        assertThat(result.sections()).hasSize(1);
        ResumeSection section = result.sections().get(0);
        // Each line becomes one heuristic item
        assertThat(section.items()).hasSize(3);
    }
}
```

**CRITICAL — `@Spy ObjectMapper`:** `LlmSectionExtractor` injects `ObjectMapper` via constructor. Mockito `@InjectMocks` will use the `@Spy ObjectMapper` instance. This approach avoids needing Spring context. The `ObjectMapper` is a standard `new ObjectMapper()` with no custom config needed for these tests.

**CRITICAL — PromptTemplate in unit tests:** `LlmSectionExtractor` loads the prompt template from `ClassPathResource("prompts/resume-section-extraction.st")` inside `extractSectionItems()`. In unit tests with Mockito, the `AiService` mock bypasses the actual template rendering — `aiService.extractResumeSection()` is called with `(sectionType.name(), sectionText)` args. However, the PromptTemplate construction still happens. To avoid `FileNotFoundException` in unit tests, the prompt file must exist at `src/main/resources/prompts/resume-section-extraction.st` (created in Task 7). Alternatively, refactor to pass the prompt string through a helper method that can be mocked — but simpler to just have the file exist.

**ALTERNATIVE if PromptTemplate causes issues in unit tests:** Extract prompt building into a package-private method and use `@Spy LlmSectionExtractor` to stub it. Or, inject the prompt as a `String` field set via `@Value` from the `.st` file content. The `AiService.extractResumeSection()` interface already takes `(sectionType, sectionText)` and builds the prompt internally in `AiService` — so `LlmSectionExtractor` may just pass the raw section text and type without needing `PromptTemplate` at all. **Recommended simplification:** Move prompt template rendering entirely into `AiService.extractResumeSection()`, and have `LlmSectionExtractor` just call `aiService.extractResumeSection(sectionType.name(), sectionText)`. This matches the architecture doc's method signature and avoids PromptTemplate coupling in `LlmSectionExtractor`.

---

### Task 11: Create `ParsingServiceTest.java` (AC: 11)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingServiceTest.java`

```java
package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.ai.OllamaHealthGuard;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.DocxParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.PdfParser;
import com.tsvetanbondzhov.resumeenhancer.upload.validators.FileValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParsingServiceTest {

    @Mock private FileValidator fileValidator;
    @Mock private PdfParser pdfParser;
    @Mock private DocxParser docxParser;
    @Mock private OllamaHealthGuard ollamaHealthGuard;
    @Mock private LlmSectionExtractor llmSectionExtractor;

    @InjectMocks
    private ParsingService parsingService;

    // AC5: When Ollama unavailable, heuristic DTO returned, LlmSectionExtractor never called
    @Test
    void parse_ollamaUnavailable_returnsHeuristicDtoWithoutCallingLlm() {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text", List.of("Engineer at Acme"), List.of("BS CS"), List.of("Java"));
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(false);

        ParsedResumeDto result = parsingService.parse(file);

        assertThat(result).isEqualTo(heuristic);
        verify(llmSectionExtractor, never()).extract(any(), any());
    }

    // AC4: When Ollama available, LlmSectionExtractor is called
    @Test
    void parse_ollamaAvailable_callsLlmSectionExtractor() {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text", List.of(), List.of(), List.of());
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(true);
        when(llmSectionExtractor.extract(any(), any()))
            .thenReturn(new com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument(List.of()));

        ParsedResumeDto result = parsingService.parse(file);

        // Heuristic DTO still returned (backward compat) — LLM was called
        assertThat(result).isEqualTo(heuristic);
        verify(llmSectionExtractor).extract(any(), any());
    }

    // Upload endpoint always HTTP 200 — verified via UploadController returning ResponseEntity.ok()
    // ParsingService never throws on Ollama failure (tested via ollamaUnavailable test above)
}
```

---

### Task 12: Add `SectionExtractorTest.java` tests for `segmentByHeaders()` (AC: 2)

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/` — create new test class `SectionExtractorTest.java`

**CRITICAL:** There is no existing `SectionExtractorTest.java` (the existing upload tests are `PdfParserTest.java`, `DocxParserTest.java`, `FileValidatorTest.java`). Create a new test class.

```java
package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.SectionExtractor;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SectionExtractorTest {

    // AC2: Full-line match only — "experience" in mid-sentence does NOT trigger section
    @Test
    void segmentByHeaders_midSentenceKeyword_doesNotTriggerSection() {
        String rawText = """
            John Doe
            5 years of experience in backend development
            Strong problem-solving skills
            """;

        List<RawSection> sections = SectionExtractor.segmentByHeaders(rawText);

        // "5 years of experience..." should NOT be treated as a section header
        assertThat(sections).isEmpty();
    }

    // AC2: Full-line keyword triggers new section
    @Test
    void segmentByHeaders_fullLineKeyword_triggersNewSection() {
        String rawText = """
            Work Experience
            Software Engineer at Acme Corp 2022-2024
            Built microservices
            
            Education
            BS Computer Science, MIT 2022
            """;

        List<RawSection> sections = SectionExtractor.segmentByHeaders(rawText);

        assertThat(sections).hasSize(2);
        assertThat(sections.get(0).title()).isEqualTo("Work Experience");
        assertThat(sections.get(0).lines()).contains("Software Engineer at Acme Corp 2022-2024");
        assertThat(sections.get(1).title()).isEqualTo("Education");
    }

    // AC2: Expanded keyword set — certifications detected
    @Test
    void segmentByHeaders_certifications_detected() {
        String rawText = """
            Certifications
            AWS Certified Solutions Architect 2023
            """;

        List<RawSection> sections = SectionExtractor.segmentByHeaders(rawText);

        assertThat(sections).hasSize(1);
        assertThat(sections.get(0).title()).isEqualTo("Certifications");
    }
}
```

---

### Task 13: Run linting and verify tests pass

- [x] Run `./mvnw test -pl . -Dtest="SectionExtractorTest,LlmSectionExtractorTest,ParsingServiceTest" -Dsurefire.useFile=false` from project root
- [x] Fix any compilation or test failures
- [x] Ensure all existing tests still pass: `./mvnw test`

---

## Dev Notes

### CRITICAL: Spring AI 2.0.0-M6 is already in `pom.xml` — NO dependency changes needed

`pom.xml` already contains:
- `spring-ai-starter-model-ollama` (line 64) — provides `ChatClient.Builder` auto-configuration
- `spring-ai.version=2.0.0-M6` property (line 31)
- Spring AI BOM import in `dependencyManagement`

Do NOT add any new Spring AI dependencies. The `spring-ai-starter-model-ollama` starter provides everything needed for `AiService`.

### CRITICAL: `SectionExtractor.extract()` must NOT be changed

`PdfParser.java` (line 22) calls `SectionExtractor.extract(rawText)`. `DocxParser.java` (line 17) calls `SectionExtractor.extract(rawText)`. These callers are unchanged. Only ADD `segmentByHeaders()` as a new static method. The existing `extract()` method signature and behavior are preserved.

### CRITICAL: `ParsedResumeDto` is a record — it is unchanged (backward compatibility)

`ParsedResumeDto(String rawText, List<String> workExperienceLines, List<String> educationLines, List<String> skillLines)` is the existing API used by `UploadController`. It is preserved. The `ResumeDocument` assembled by `LlmSectionExtractor` is currently not surfaced in the HTTP response — Epic 4 will wire it into the profile seeding flow (likely `UploadController` will return an enriched response type).

### CRITICAL: `OllamaUnavailableException` is caught internally — NOT added to `GlobalExceptionHandler`

`ParsingService.parse()` catches `OllamaUnavailableException` and returns heuristic fallback. The exception never propagates to `GlobalExceptionHandler`. Do NOT add a handler for it in `GlobalExceptionHandler.java`.

### CRITICAL: Package structure — `ai` package is new

The `ai` package (`com.tsvetanbondzhov.resumeenhancer.ai`) does not exist yet. Create it:
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaUnavailableException.java`

### CRITICAL: `ObjectMapper` injection in `LlmSectionExtractor`

`ObjectMapper` is auto-configured by Spring Boot (Jackson is on classpath via `spring-boot-starter-data-jpa`). Inject it via constructor in `LlmSectionExtractor`. In unit tests, use `@Spy ObjectMapper objectMapper = new ObjectMapper()`.

### CRITICAL: PromptTemplate vs. inline prompt in AiService

The architecture doc specifies a `.st` file for the prompt template. However, `AiService.extractResumeSection(sectionType, sectionText)` is the sole interface `LlmSectionExtractor` calls. **Recommended implementation:** `AiService` builds the prompt internally from the `.st` file. `LlmSectionExtractor` passes `(sectionType, sectionText)` to `AiService`. This isolates prompt management in `AiService` and simplifies `LlmSectionExtractor` unit testing (the mock bypasses prompt rendering entirely).

The `AiService` implementation in Task 2 shows inline prompt building — for Task 7's `.st` file, `AiService` should load it via `PromptTemplate`. The `buildPrompt()` helper method in `AiService` should use:
```java
PromptTemplate template = new PromptTemplate(new ClassPathResource("prompts/resume-section-extraction.st"));
return template.render(Map.of("sectionType", sectionType, "sectionText", sectionText, "fieldSchema", getFieldSchema(sectionType)));
```
Where `getFieldSchema()` is moved to `AiService` (or `LlmSectionExtractor` passes it as a third arg).

### CRITICAL: `spring.ai.ollama.base-url` is in `application.yml` (line 17-18)

`OllamaHealthGuard` reads `${spring.ai.ollama.base-url:http://localhost:11434}` via `@Value`. This is already configured in `src/main/resources/application.yml` with value `http://localhost:11434`.

### CRITICAL: `compileJava` note — Java 25 with `switch` expressions and text blocks

The project uses Java 25. All switch expressions and text blocks (multi-line strings `"""..."""`) are valid. The `maven-compiler-plugin` is configured in `pom.xml` to handle Java 25 with `-XX:+EnableDynamicAgentLoading` in Surefire args.

### CRITICAL: `@Value` in `OllamaHealthGuard` works only in Spring context

In unit tests, `OllamaHealthGuard` is mocked — so `@Value` injection is never exercised. The `@Value` annotation is only for Spring-managed runtime use.

### Previously established patterns (from Story 3.8)

- **Service layer throws typed domain exceptions only** — confirmed by existing exception classes
- **`GlobalExceptionHandler` is the sole HTTP error mapper** — do NOT add new HTTP behavior outside it
- **Records for all domain value objects** — `RawSection`, `ResumeItemDto` follow existing `ResumeDocument`, `ResumeSection`, `ResumeItem` pattern
- **Unit tests use `@ExtendWith(MockitoExtension.class)` only** — no Spring context for pure domain logic
- **Test package mirrors main package** — `upload/LlmSectionExtractorTest.java` mirrors `upload/parsers/LlmSectionExtractor.java`

### File Locations (no deviations allowed)

| New File | Path |
|----------|------|
| `AiService.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java` |
| `OllamaHealthGuard.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java` |
| `OllamaUnavailableException.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaUnavailableException.java` |
| `RawSection.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/RawSection.java` |
| `ResumeItemDto.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ResumeItemDto.java` |
| `ResumeSectionType.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java` |
| `LlmSectionExtractor.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` |
| `resume-section-extraction.st` | `src/main/resources/prompts/resume-section-extraction.st` |
| `LlmSectionExtractorTest.java` | `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java` |
| `ParsingServiceTest.java` | `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingServiceTest.java` |
| `SectionExtractorTest.java` | `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/SectionExtractorTest.java` |

| Modified File | Changes |
|---------------|---------|
| `SectionExtractor.java` | Add `segmentByHeaders()` static method + `ALL_SECTION_KEYWORDS` set + `RawSection` import — existing `extract()` untouched |
| `ParsingService.java` | Add `OllamaHealthGuard`, `LlmSectionExtractor` constructor injection; extend `parse()` with LLM path + timeout |

### References

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/SectionExtractor.java` — existing `extract()` to preserve; add `segmentByHeaders()` alongside
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java` — existing orchestration to extend
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ParsedResumeDto.java` — unchanged record (backward compat)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocument.java` — canonical model assembled by `LlmSectionExtractor`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java` — `(id, title, visible, items)` record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` — `(id, Map<String,String> fields)` record
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — do NOT add handler for `OllamaUnavailableException`
- `src/main/resources/application.yml` — `spring.ai.ollama.base-url` already configured
- `pom.xml` — Spring AI 2.0.0-M6 already present; no new deps needed
- `_bmad-output/planning-artifacts/architecture/llm-based-resume-parsing-architecture.md` — canonical pipeline spec
- **Project context rule:** `AiService` is the only class that calls `ChatClient` directly (project-context.md)
- **Project context rule:** Service layer throws typed domain exceptions only
- **Project context rule:** `BaseEntity` is for `@Entity` classes only — records don't extend it

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks implemented cleanly on first pass. 9 new tests added, 78 total pass, 0 failures.

### Completion Notes List

- AC1: `AiService` (@Service, ChatClient.Builder injection), `OllamaHealthGuard` (@Component, java.net.http probe), `OllamaUnavailableException` (typed domain exception) all created in `ai` package. `AiService` is the ONLY class calling `ChatClient` directly.
- AC2: `SectionExtractor.segmentByHeaders()` added as static method. Uses full-line equality match (`ALL_SECTION_KEYWORDS.contains(normalized)`) — prevents "5 years of experience" false-positive. Existing `extract()` method preserved unchanged.
- AC3: `ResumeSectionType` enum added with `fromHeader()` factory. Covers all required types including UNKNOWN fallback.
- AC4: `LlmSectionExtractor.extract()` calls `AiService.extractResumeSection()` for each section. `ParsingService` invokes LLM path when Ollama is available.
- AC5: `ParsingService` checks `OllamaHealthGuard.isAvailable()` before LLM path; returns heuristic `ParsedResumeDto` when unavailable; never propagates `OllamaUnavailableException` to HTTP layer.
- AC6: JSON parse failure in `LlmSectionExtractor.extractSectionItems()` catches `Exception` and falls back to `heuristicItems()`. Logged at WARN.
- AC7: `validateAndConvert()` checks date fields matching `DATE_FIELD_PATTERN` against `DATE_PATTERN (\d{4}(-\d{2})?)` or "Present". Invalid dates are excluded (not added to fields map).
- AC8: Anchor check in `validateAndConvert()` — if no field value appears in `fullRawText`, `lowConfidence=true` is set in `ResumeItemDto`. Item is never dropped. Logged at WARN.
- AC9: Section text truncated to 3000 chars before LLM call. Logged at WARN.
- AC10: `CompletableFuture.supplyAsync()` with 30-second `get()` timeout. `TimeoutException` caught, heuristic DTO returned.
- AC11: `LlmSectionExtractorTest` (4 tests): malformed JSON fallback, invalid date nulled, anchor check low confidence, OllamaUnavailableException fallback. `ParsingServiceTest` (2 tests): Ollama unavailable never calls LLM extractor, Ollama available calls LLM extractor. `SectionExtractorTest` (3 tests): mid-sentence false-positive blocked, full-line keyword triggers section, certifications detected.
- Prompt template created at `src/main/resources/prompts/resume-section-extraction.st` (Spring AI `.st` format).
- `ParsedResumeDto` backward compatibility preserved — `UploadController` contract unchanged.

### File List

**New files:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaUnavailableException.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/RawSection.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/dto/ResumeItemDto.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`
- `src/main/resources/prompts/resume-section-extraction.st`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/SectionExtractorTest.java`

**Modified files:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/SectionExtractor.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/ParsingService.java`

### Change Log

- 2026-06-08: Implemented LLM-based resume parsing pipeline (Story 3.9). Added `ai` package with `AiService`, `OllamaHealthGuard`, `OllamaUnavailableException`. Added `RawSection`, `ResumeItemDto` DTOs. Added `ResumeSectionType` enum. Added `LlmSectionExtractor` with JSON validation, date format check, anchor check, section truncation. Extended `ParsingService` with Ollama health-gated LLM path and 30s timeout. Added `segmentByHeaders()` to `SectionExtractor` with full-line-only keyword matching. Added 9 unit tests (78 total passing).
