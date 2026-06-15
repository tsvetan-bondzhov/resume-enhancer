# Story 9.2: Resolve Critical Java Issues — String Constants & Empty Test Method

**Status:** review
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-2-java-string-constants-and-empty-test-method
**Dependencies:** Story 9.1 done (same Epic 9; no file overlap)

---

## Story

As a developer,
I want duplicate Java string literals extracted to named constants and the empty test method either implemented or removed,
So that the 7 CRITICAL Java violations (S1192 × 6, S1186 × 1) are eliminated and the codebase follows the DRY principle.

---

## Acceptance Criteria

**AC1 — String constants in `LlmSectionExtractor.java` (S1192)**
**Given** `LlmSectionExtractor.java` contains string literals `"startDate"` and `"endDate"` each appearing 4 times
**When** refactoring is complete
**Then** each is extracted to a `private static final String` constant in `UPPER_SNAKE_CASE` at the top of the class (after the existing `MAX_SECTION_LENGTH` constant); all call sites reference the constant; each string value appears in exactly one place in the file

---

**AC2 — String constants in `TemplateDefinition.java` (S1192)**
**Given** `TemplateDefinition.java` contains the string literal `"0.75in"` appearing 4 times inside the `DEFAULT` constant initializer
**When** refactoring is complete
**Then** `"0.75in"` is extracted to a `private static final String` constant named `DEFAULT_MARGIN` at the top of the record (before the `DEFAULT` field); all four `Map.entry(...)` calls reference `DEFAULT_MARGIN`; the string value appears in exactly one place

---

**AC3 — Empty test method removed or implemented (S1186)**
**Given** `ResumeEnhancerApplicationTests.java` contains `void contextLoads() {}` — an empty method body with no assertion and no explanatory comment (SonarQube S1186)
**When** the fix is applied
**Then** the method body contains at minimum `assertTrue(true)` with a `// TODO:` comment explaining what a meaningful Spring context assertion could verify; OR the method is replaced with a comment block that makes the intent explicit; no empty method body without explanation remains

---

**AC4 — No regressions**
**Given** the story is implemented
**When** `./mvnw test` is run
**Then** all existing tests pass; no behaviour changes occur; SonarQube re-scan shows 0 remaining S1192 violations in the two affected files and 0 S1186 violations

---

## Tasks / Subtasks

### Task 1: Extract string constants in `LlmSectionExtractor.java` (AC1)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`

**Confirmed violations (4 occurrences each):**
- `"startDate"` — lines 199, 209, 227, 236 (passed to `parseDate()`)
- `"endDate"` — lines 200, 210, 228, 237 (passed to `parseDate()`)

**Other repeated keys (3 occurrences each, below S1192 threshold — do NOT extract):**
- `"isCurrent"` (3), `"name"` (3), `"description"` (3)

- [x] Add two constants after the existing `MAX_SECTION_LENGTH` constant at the top of the class:
  ```java
  private static final int MAX_SECTION_LENGTH = 3000;
  private static final String START_DATE = "startDate";
  private static final String END_DATE = "endDate";
  ```

- [x] Replace all 4 occurrences of `"startDate"` with `START_DATE`:
  - Line 199: `parseDate(raw, "startDate")` → `parseDate(raw, START_DATE)`
  - Line 209: `parseDate(raw, "startDate")` → `parseDate(raw, START_DATE)`
  - Line 227: `parseDate(raw, "startDate")` → `parseDate(raw, START_DATE)`
  - Line 236: `parseDate(raw, "startDate")` → `parseDate(raw, START_DATE)`

- [x] Replace all 4 occurrences of `"endDate"` with `END_DATE`:
  - Line 200: `parseDate(raw, "endDate")` → `parseDate(raw, END_DATE)`
  - Line 210: `parseDate(raw, "endDate")` → `parseDate(raw, END_DATE)`
  - Line 228: `parseDate(raw, "endDate")` → `parseDate(raw, END_DATE)`
  - Line 237: `parseDate(raw, "endDate")` → `parseDate(raw, END_DATE)`

- [x] Do NOT touch any other string literal in this file — `"isCurrent"`, `"name"`, `"description"`, etc. are below threshold

- [x] Do NOT change method signatures, logic, or any other code

---

### Task 2: Extract string constant in `TemplateDefinition.java` (AC2)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java`

**Confirmed violations:**
- `"0.75in"` appears 4 times (lines 33–36) in the `DEFAULT` constant initializer:
  ```java
  Map.entry("--page-margin-top", "0.75in"),
  Map.entry("--page-margin-right", "0.75in"),
  Map.entry("--page-margin-bottom", "0.75in"),
  Map.entry("--page-margin-left", "0.75in"),
  ```

**Important:** `TemplateDefinition` is a Java **record**, not a class. The constant must be declared as `private static final` inside the record body before the `DEFAULT` field.

- [x] Add constant inside the record body, before the `DEFAULT` field:
  ```java
  public record TemplateDefinition(
          String layoutType,
          Map<String, Object> cssVariables,
          TemplateLayout layout,
          Map<String, Object> metadata
  ) {
      private static final String DEFAULT_MARGIN = "0.75in";

      public static final TemplateDefinition DEFAULT = new TemplateDefinition(
  ```

- [x] Replace all 4 `"0.75in"` values with `DEFAULT_MARGIN`:
  ```java
  Map.entry("--page-margin-top", DEFAULT_MARGIN),
  Map.entry("--page-margin-right", DEFAULT_MARGIN),
  Map.entry("--page-margin-bottom", DEFAULT_MARGIN),
  Map.entry("--page-margin-left", DEFAULT_MARGIN),
  ```

- [x] Do NOT change `"two-column"` or `"modern-accent"` — they each appear only 1–2 times, below threshold

- [x] Do NOT change the Javadoc or any method logic

---

### Task 3: Fix empty test method in `ResumeEnhancerApplicationTests.java` (AC3)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/ResumeEnhancerApplicationTests.java`

**Current state:**
```java
@Test
void contextLoads() {
}
```

This is the S1186 violation: an empty method body. The method exists to verify Spring context startup does not throw.

- [x] Add a minimal assertion with an explanatory comment:
  ```java
  @Test
  void contextLoads() {
      // TODO: Add meaningful Spring context assertions, e.g. verifying that critical beans
      //       (ResumeService, ProfileService, AiService) are present in the application context.
      assertTrue(true); // Context loads without throwing — verified by @SpringBootTest itself
  }
  ```

- [x] Add the `assertTrue` import: `import static org.junit.jupiter.api.Assertions.assertTrue;`

- [x] Do NOT change any other test, annotation, or import in this file

---

### Task 4: Run backend tests (AC4)

- [x] `./mvnw test` — all tests pass (the project currently has 0 backend test failures; do not introduce regressions)
- [x] Verify `LlmSectionExtractorTest` still passes — all 8 existing tests exercise the methods that use `START_DATE`/`END_DATE`
- [x] Verify `ResumeEnhancerApplicationTests` compiles and the `contextLoads` test passes

---

## Dev Notes & Guardrails

### CRITICAL: Pure Structural Change Only

This is a SonarQube **DRY/style** fix, NOT a feature change:
- **No logic changes** — only string literals become constant references and the empty method body gets a placeholder assertion
- **No new functionality** — do not add business logic, new endpoints, or domain behaviour
- **No test renames** — do not rename existing test methods

### File Locations (Exact Paths)

```
src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java
src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java
src/test/java/com/tsvetanbondzhov/resumeenhancer/ResumeEnhancerApplicationTests.java
```

### Java Record Gotcha — Static Fields in Records

`TemplateDefinition` is a `record`, not a class. In Java, `static` fields ARE allowed in records. The constant must be placed inside the record body, between the record components declaration and the `DEFAULT` field:

```java
public record TemplateDefinition(
        String layoutType,
        Map<String, Object> cssVariables,
        TemplateLayout layout,
        Map<String, Object> metadata
) {
    private static final String DEFAULT_MARGIN = "0.75in";  // ← here

    public static final TemplateDefinition DEFAULT = new TemplateDefinition(
        ...
    );
    ...
}
```

### S1192 Threshold

SonarQube S1192 fires when a string literal is duplicated **4 or more** times in the same file. Confirmed violations:
- `LlmSectionExtractor.java`: `"startDate"` (4×), `"endDate"` (4×)
- `TemplateDefinition.java`: `"0.75in"` (4×)

String literals appearing 3 or fewer times (`"isCurrent"`, `"name"`, `"description"`, `"two-column"`, etc.) are **below threshold — do not extract them**.

### S1186 Rule Details

SonarQube S1186 flags empty method bodies with no explanatory comment. The fix options are:
1. (Preferred) Add `assertTrue(true)` with a `// TODO:` comment
2. Delete the method if it has no planned assertion

For `contextLoads()` — the standard Spring Boot smoke test — option 1 is correct. The method is not dead scaffolding; it verifies that `@SpringBootTest` can start the entire Spring context without exceptions.

### Naming Convention

From `project-context.md`: Constants use `UPPER_SNAKE_CASE`. The chosen names:
- `START_DATE` (not `FIELD_START_DATE` or `JSON_START_DATE`) — concise and unambiguous in context
- `END_DATE` (same rationale)
- `DEFAULT_MARGIN` (describes what the value represents, not just its content)

### Constant Placement Pattern

From `project-context.md` and existing code: Constants are placed at the top of the class/record body, after `Logger` declarations if present.

- `LlmSectionExtractor.java` already has `private static final Logger log` and `private static final int MAX_SECTION_LENGTH`. Place `START_DATE` and `END_DATE` **after** `MAX_SECTION_LENGTH`.
- `TemplateDefinition.java` has no existing constants. Place `DEFAULT_MARGIN` as the **first** member of the record body.

### SonarQube Rules Being Fixed

| Rule | Name | Count | Files |
|------|------|-------|-------|
| `java:S1192` | String literal duplicated ≥ 4 times | 6 CRITICAL | `LlmSectionExtractor.java` (4+4), `TemplateDefinition.java` (4) → 3 violations |
| `java:S1186` | Empty method body | 1 CRITICAL | `ResumeEnhancerApplicationTests.java` |

**Note:** The epic counts 7 CRITICAL issues total — 6 string literal instances across the 3 string constants + 1 empty method.

### What NOT to Change

- `MAX_SECTION_LENGTH` constant in `LlmSectionExtractor.java` — already compliant
- The `heuristicItems` method's `Map.of("text", line)` — `"text"` appears only once here; not a violation
- `isTwoColumn()` and `isModernAccent()` methods in `TemplateDefinition.java` — their string literals are unique
- Any test class other than `ResumeEnhancerApplicationTests.java`
- `LlmSectionExtractorTest.java` — the 8 existing tests use string literals in JSON blobs; those are test data, not production constants

### Previous Story Intelligence (9.1)

From Story 9.1 learnings:
- Backend tests run via `./mvnw test` from the project root — this is a Maven project
- 9.1 was TypeScript-only; this story is Java-only. No frontend files are touched.
- The pattern for SonarQube remediation in this project: pure structural changes, zero logic changes, all existing tests must pass unchanged.

---

## Story Completion Status

**Analysis completed:** 2026-06-11
**Files analyzed:** `LlmSectionExtractor.java`, `TemplateDefinition.java`, `ResumeEnhancerApplicationTests.java`, `LlmSectionExtractorTest.java`, story 9.1
**Violations confirmed:**
- `"startDate"` — 4× in `LlmSectionExtractor.java` → extract to `START_DATE`
- `"endDate"` — 4× in `LlmSectionExtractor.java` → extract to `END_DATE`
- `"0.75in"` — 4× in `TemplateDefinition.java` → extract to `DEFAULT_MARGIN`
- `contextLoads()` empty body — `ResumeEnhancerApplicationTests.java` → add placeholder assertion
**Approach confirmed:** Extract 3 string constants + add 1 placeholder assertion. Zero logic changes.
**Test impact:** `LlmSectionExtractorTest` (8 tests) still exercises the fixed methods; `contextLoads()` gains a `assertTrue(true)` placeholder.

---

## Dev Agent Record

### Implementation Plan

Pure structural SonarQube remediation: 3 string constants extracted, 1 empty method body fixed. Zero logic changes.

### Completion Notes

- AC1: `START_DATE = "startDate"` and `END_DATE = "endDate"` added to `LlmSectionExtractor` after `MAX_SECTION_LENGTH`. All 4 `parseDate(raw, "startDate")` and 4 `parseDate(raw, "endDate")` call sites updated to use constants.
- AC2: `DEFAULT_MARGIN = "0.75in"` added as first member of `TemplateDefinition` record body. All 4 margin `Map.entry` calls updated.
- AC3: `contextLoads()` given `assertTrue(true)` with TODO comment; `import static org.junit.jupiter.api.Assertions.assertTrue` added.
- AC4: `./mvnw test` run — 110 tests, 109 pass. The 1 failure (`ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent`) is a pre-existing timing/nanosecond precision issue confirmed present on the baseline branch before any story changes.

### Debug Log

- Pre-existing test failure confirmed via `git stash` + rerun: `ResumeControllerIntegrationTest` line 332/334 timestamp assertion flaky — unrelated to this story.

## Change Log

- 2026-06-11: Extracted `START_DATE`, `END_DATE` constants in `LlmSectionExtractor.java` (AC1); extracted `DEFAULT_MARGIN` in `TemplateDefinition.java` (AC2); added `assertTrue(true)` placeholder to `contextLoads()` in `ResumeEnhancerApplicationTests.java` (AC3). All 109/110 tests pass; 1 pre-existing failure unrelated to this story.

## File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` — modified (START_DATE, END_DATE constants added; 8 call sites updated)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java` — modified (DEFAULT_MARGIN constant added; 4 map entries updated)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ResumeEnhancerApplicationTests.java` — modified (assertTrue placeholder + import added)
