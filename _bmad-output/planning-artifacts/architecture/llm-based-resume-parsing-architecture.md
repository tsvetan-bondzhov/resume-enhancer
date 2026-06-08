# LLM-Based Resume Parsing Architecture

_Added: 2026-06-08. Replaces the heuristic-only approach with a hybrid LLM pipeline. Decisions confirmed: sync upload (2-5s acceptable), heuristic fallback when Ollama is down, validation phase included, fixed section schema for v1._

### Current Approach and Its Limitations

The existing parser (`SectionExtractor`) is a line-by-line keyword scanner that splits raw text into three flat `List<String>` buckets (`workExperienceLines`, `educationLines`, `skillLines`). `ParsedResumeDto` cannot carry the structured data the domain model requires - no job titles, companies, dates, or entry-level structure is extracted.

Fundamental limitations that cannot be solved by extending the heuristic:
- **Domain model mismatch**: The system requires `ResumeDocument -> ResumeSection -> ResumeItem -> Map<String,String> fields`; the parser produces only raw text lists with no path to typed conversion
- **Section detection brittleness**: Keyword match fires on any line containing the word - e.g., `"5 years of experience in backend development"` flips the section pointer mid-document
- **Only 3 sections hardcoded**: No certifications, projects, summary, publications, languages, or volunteering
- **No field extraction**: `"Developed backend services at Acme Corp (2022-2024)"` is stored as a single opaque string; title, company, and dates are irrecoverable downstream

### Recommended Approach: Hybrid Pre-segmentation + LLM Field Extraction

**Why hybrid, not pure LLM:**
- Heuristics handle section boundary detection cheaply and deterministically - the easy part, no LLM tokens needed for it
- LLM handles per-section field extraction - the semantically hard part
- If Ollama is unavailable, the heuristic layer still produces partial structure (better than raw text only)
- Per-section chunking bounds token count per call and naturally supports future parallelisation

### Parsing Pipeline

```
File upload (PDF or DOCX)
  |
  v FileValidator (MIME + size -- unchanged)
  v PdfParser (PDFBox) / DocxParser (Apache POI)  [unchanged]
    Output: rawText: String
  |
  v SectionExtractor.segmentByHeaders(rawText)    [MODIFIED]
    Output: List<RawSection(title, lines)>
    Expanded keyword set: experience, education, skills,
    certifications, projects, summary, publications,
    languages, volunteering
  |
  v OllamaHealthGuard.isAvailable()
      |                          |
   UP |                     DOWN |
      |                          v
      |              Heuristic fallback:
      |              return ParsedResumeDto(rawText,
      |                heuristic workLines, educationLines, skillLines)
      |              HTTP 200 with partial structure
      |
      v LlmSectionExtractor.extract(List<RawSection>)  [NEW]
        For each section:
          -> build typed prompt (section-type-specific field schema)
          -> AiService.extractResumeSection(sectionType, sectionText)
          -> parse JSON array response -> List<ResumeItemDto>
          -> run validation phase (JSON check, date format, anchor check)
        Output: List<ResumeSection> with typed ResumeItem entries
      |
      v Assemble ResumeDocument(sections)
      v ParsingService returns ParsedResumeDto + ResumeDocument
      v UploadController HTTP 200
```

**Sync vs. async:** Upload remains synchronous. LLM adds ~2-5 seconds for a typical resume. Per-section chunking supports future async parallelisation (virtual thread pool) without redesign.

### Prompt Engineering Strategy

Prompts live in `src/main/resources/prompts/resume-section-extraction.st` (Spring AI `PromptTemplate`).

**Core prompt pattern:**
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

**Per-section field schemas:**

| Section type | Fields |
|---|---|
| `WORK_EXPERIENCE` | `title`, `company`, `startDate` (YYYY-MM), `endDate` (YYYY-MM or "Present"), `description` (comma-separated achievements) |
| `EDUCATION` | `degree`, `institution`, `graduationDate` (YYYY or YYYY-MM), `gpa` |
| `SKILLS` | `skillName`, `proficiency`, `category` |
| `CERTIFICATIONS` | `certificationName`, `issuer`, `issueDate` (YYYY-MM), `expirationDate` |
| `PROJECTS` | `projectName`, `description`, `technologies` (comma-separated), `link` |
| `SUMMARY` | `text` (single item, full summary prose) |

Dates requested as `YYYY-MM` or `YYYY` only - unambiguous, trivial to parse. Multi-value fields returned as comma-separated strings - keeps `ResumeItem.fields` as `Map<String, String>` with no schema change.

### Validation Phase

After each LLM call, `LlmSectionExtractor` runs three checks before accepting output:

1. **JSON parse check** - if response is not valid JSON, discard that section and fall back to heuristic lines for it (log malformed response at WARN)
2. **Date format check** - dates not matching `\d{4}(-\d{2})?` or `"Present"` are nulled out; the item is kept
3. **Anchor check** - at least one field value per item must appear as a case-insensitive substring in `rawText`. Items where no field matches are included but flagged `lowConfidence: true` in the intermediate DTO and logged. This catches hallucinated company names and fabricated dates without a second LLM call.

### Graceful Degradation

| Ollama state | Output | UX behaviour |
|---|---|---|
| Available | `ParsedResumeDto` + typed `ResumeDocument` | Resume opens fully structured |
| Unavailable | `ParsedResumeDto` only (heuristic) | Resume opens with partial structure; user can manually organise |
| Malformed JSON for a section | That section falls back to heuristic lines; other sections use LLM output | Per-section degradation; upload never fails |

`ParsingService` catches `OllamaUnavailableException` and returns heuristic `ParsedResumeDto` - never propagates a 503. Upload endpoint always returns HTTP 200.

### Package Structure

```
upload/
    ParsingService.java              [MODIFIED] orchestrates heuristic + LLM paths
    parsers/
        PdfParser.java               [unchanged]
        DocxParser.java              [unchanged]
        SectionExtractor.java        [MODIFIED] adds segmentByHeaders(), expanded keyword set
        LlmSectionExtractor.java     [NEW] calls AiService, validates output
    dto/
        ParsedResumeDto.java         [unchanged - backward compat]
        RawSection.java              [NEW] record(String title, List<String> lines)
        ResumeItemDto.java           [NEW] intermediate DTO for LLM JSON response
```

**`AiService` new method:**
```java
/** Calls Ollama with a section extraction prompt. Returns raw JSON string.
 *  Throws OllamaUnavailableException if Ollama is unreachable. */
public String extractResumeSection(String sectionType, String sectionText);
```

`AiService` remains the sole class touching `ChatClient`. `LlmSectionExtractor` calls `AiService.extractResumeSection()`, never `ChatClient` directly - architectural invariant preserved.

### Fixed Section Schema (v1)

Supported section types:

```java
enum ResumeSectionType {
    WORK_EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS,
    PROJECTS, SUMMARY, LANGUAGES, VOLUNTEERING
}
```

Unrecognised section headers (not matching any type) are captured as `UNKNOWN` with raw lines stored as a single `text` field per item. Content is preserved rather than silently discarded.

### Risks

1. **LLM hallucination** - mitigated by anchor check; flagged items are included but logged. Never silently corrupt data.
2. **JSON parse failures** - malformed response falls back to heuristic lines per section; upload never blocked.
3. **Token overflow on very long sections** - `LlmSectionExtractor` enforces a 3000-character cap per section before sending; truncation is logged at WARN.
4. **Latency variance** - `ParsingService` enforces a 30-second total timeout; on timeout, returns heuristic `ParsedResumeDto`.
5. **Spring AI 2.0.0-M6 milestone instability** - `AiService.extractResumeSection()` must be prototyped and validated against the pinned milestone version early in the sprint before depending on it in the parsing pipeline.
