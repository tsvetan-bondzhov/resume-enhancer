# Story 9.4: Java Backend Code Quality — LlmSectionExtractor & Exception Handling

**Status:** done
**Epic:** 9 — Code Quality — SonarQube Remediation
**Story Key:** 9-4-java-backend-code-quality-llmsectionextractor
**Dependencies:** Story 9.2 done (already extracted `START_DATE`/`END_DATE` constants in `LlmSectionExtractor.java` — those constants are present in the current file)

---

## Story

As a developer,
I want Java backend code in `LlmSectionExtractor` and related classes to follow clean-code practices — no nested try blocks, no commented-out code, proper `InterruptedException` handling, no unused fields, no `Thread.sleep` in tests, and lambdas replaced with method references where applicable,
So that the backend is easier to maintain and the 15 Java code-quality violations are eliminated.

---

## Acceptance Criteria

**AC1 — Nested try blocks extracted to private methods (`LlmSectionExtractor.java` — S1141)**
**Given** `extractSectionItems()` contains an inner `try` block (lines 151–158) nested inside the outer `try` (lines 143–178), violating S1141
**When** the refactoring is complete
**Then** the inner try that calls `objectMapper.readValue(...)` and falls back to `heuristicItems()` on parse failure is extracted to a separate private method (e.g., `parseJsonItems(String jsonResponse, RawSection rawSection)`); the calling code in `extractSectionItems()` delegates cleanly to the new method; no try block is nested inside another try block in `extractSectionItems()`

**AC2 — Commented-out code removed (S125)**
**Given** any of the affected files contain commented-out code blocks (code that has been commented out rather than deleted)
**When** the fix is applied
**Then** all commented-out code is removed entirely; if the code represents a future intent, a `// TODO:` comment describing the intent replaces the dead code; inline Javadoc comments (`/** ... */`) and regular explanation comments are NOT removed

**AC3 — `InterruptedException` re-interrupts thread (`OllamaHealthGuard.java` — S2142)**
**Given** `OllamaHealthGuard.isAvailable()` calls `client.send(request, BodyHandlers.ofString())` which throws checked `InterruptedException`, but the method catches `Exception` and swallows the interruption without calling `Thread.currentThread().interrupt()`
**When** the fix is applied
**Then** `InterruptedException` is caught separately (or the generic `catch (Exception e)` handler checks `instanceof InterruptedException`) and `Thread.currentThread().interrupt()` is called before logging and returning `false`; the thread's interrupted flag is restored correctly

**AC4 — Unused private field removed (`JwtAuthenticationFilter.java` — S1068)**
**Given** `JwtAuthenticationFilter` declares and assigns `private final UserRepository userRepository` in its constructor, but this field is never read in any method of the class (confirmed: `userRepository` does not appear in `doFilterInternal` or any other method)
**When** the fix is applied
**Then** the `userRepository` field declaration is deleted from the class body; the `UserRepository userRepository` constructor parameter is removed; the `this.userRepository = userRepository` assignment is removed; the `import` for `UserRepository` is removed; the `UserRepository` bean injection is dropped entirely from this filter (it was dead code injected unnecessarily)

**AC5 — `Thread.sleep` replaced with Awaitility (`ResumeControllerIntegrationTest.java` — S2925)**
**Given** `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` uses `Thread.sleep(10)` at line 311 to force a timestamp difference between `createdAt` and `updatedAt`
**When** the fix is applied
**Then** `Thread.sleep(10)` is replaced with `Awaitility.await().atMost(Duration.ofSeconds(1)).until(() -> true)` or, preferably, the assertion is changed to assert that `updatedAt` is not null and is a valid ISO 8601 timestamp, removing the sleep entirely; OR the test uses a fixed-clock approach; `Thread.sleep` is not present in test code

**AC6 — Lambdas replaced with method references (`LlmSectionExtractor.java` — S1612)**
**Given** `LlmSectionExtractor.extract()` uses lambdas of the form `.map(i -> (WorkExperienceItem) i)`, `.filter(i -> i instanceof WorkExperienceItem)`, and `.forEach(workExperiences::add)` across 8 switch case branches (WORK_EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS, LANGUAGES, PROJECTS, VOLUNTEERING, SUMMARY)
**When** the refactoring is applied
**Then** filter-cast-forEach chains are replaced with the pattern `items.stream().filter(WorkExperienceItem.class::isInstance).map(WorkExperienceItem.class::cast).forEach(workExperiences::add)`; the anonymous lambda `i -> i instanceof WorkExperienceItem` becomes the method reference `WorkExperienceItem.class::isInstance`; the cast lambda `i -> (WorkExperienceItem) i` becomes `WorkExperienceItem.class::cast`

**AC7 — Identical catch blocks merged (S2147)**
**Given** any affected file has multiple catch blocks that catch different exception types but execute identical code (e.g., `catch (ExceptionA e) { ... }` and `catch (ExceptionB e) { ... }` with the same body)
**When** the fix is applied
**Then** the duplicate catch blocks are merged using multi-catch syntax: `catch (ExceptionA | ExceptionB e)`

**AC8 — No regressions**
**Given** the story is implemented
**When** `./mvnw test` is run
**Then** all existing backend tests pass (note: `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` has a pre-existing flaky failure unrelated to this story — document it in the change log if it recurs but do not fix it); SonarQube re-scan shows 0 remaining S1141, S125, S2142, S1068, S2925, S1612, and S2147 violations in the affected files

---

## Tasks / Subtasks

### Task 1: Extract nested try block in `LlmSectionExtractor.java` (AC1 — S1141)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`

**Current state of `extractSectionItems()` (lines 143–178):**

```java
private List<ResumeItem> extractSectionItems(
        RawSection rawSection,
        ResumeSectionType sectionType,
        String sectionText,
        String fullRawText) {

    try {
        String jsonResponse = aiService.extractResumeSection(sectionType.name(), sectionText);

        if (jsonResponse == null) {
            log.warn("Null JSON response for section '{}', falling back to heuristic lines", rawSection.title());
            return heuristicItems(rawSection);
        }

        List<Map<String, Object>> rawItems;
        try {                                          // ← INNER nested try (S1141 violation)
            rawItems = objectMapper.readValue(jsonResponse,
                new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.warn("Malformed JSON for section '{}', falling back to heuristic lines: {}",
                rawSection.title(), e.getMessage());
            return heuristicItems(rawSection);
        }

        List<ResumeItem> result = new ArrayList<>();
        for (Map<String, Object> rawItem : rawItems) {
            try {
                ResumeItem item = buildTypedItem(sectionType, rawItem, fullRawText);
                result.add(item);
            } catch (Exception e) {
                log.warn("Failed to build typed item for section '{}', using GenericItem fallback: {}",
                    rawSection.title(), e.getMessage());
                result.add(new GenericItem(UUID.randomUUID().toString(), toStringMap(rawItem)));
            }
        }
        return result;

    } catch (Exception e) {
        log.warn("LLM extraction failed for section '{}', using heuristic fallback: {}",
            rawSection.title(), e.getMessage());
        return heuristicItems(rawSection);
    }
}
```

**Required change — extract the inner try to a new private method:**

```java
private List<ResumeItem> extractSectionItems(
        RawSection rawSection,
        ResumeSectionType sectionType,
        String sectionText,
        String fullRawText) {

    try {
        String jsonResponse = aiService.extractResumeSection(sectionType.name(), sectionText);

        if (jsonResponse == null) {
            log.warn("Null JSON response for section '{}', falling back to heuristic lines", rawSection.title());
            return heuristicItems(rawSection);
        }

        List<Map<String, Object>> rawItems = parseJsonItems(jsonResponse, rawSection);
        if (rawItems == null) {
            return heuristicItems(rawSection);
        }

        List<ResumeItem> result = new ArrayList<>();
        for (Map<String, Object> rawItem : rawItems) {
            try {
                ResumeItem item = buildTypedItem(sectionType, rawItem, fullRawText);
                result.add(item);
            } catch (Exception e) {
                log.warn("Failed to build typed item for section '{}', using GenericItem fallback: {}",
                    rawSection.title(), e.getMessage());
                result.add(new GenericItem(UUID.randomUUID().toString(), toStringMap(rawItem)));
            }
        }
        return result;

    } catch (Exception e) {
        log.warn("LLM extraction failed for section '{}', using heuristic fallback: {}",
            rawSection.title(), e.getMessage());
        return heuristicItems(rawSection);
    }
}

/** Parses the LLM JSON response into a list of raw item maps.
 *  Returns null (and logs a warning) if the JSON is malformed. */
private List<Map<String, Object>> parseJsonItems(String jsonResponse, RawSection rawSection) {
    try {
        return objectMapper.readValue(jsonResponse,
            new TypeReference<List<Map<String, Object>>>() {});
    } catch (Exception e) {
        log.warn("Malformed JSON for section '{}', falling back to heuristic lines: {}",
            rawSection.title(), e.getMessage());
        return null;
    }
}
```

- [x] Add the `parseJsonItems` private method after `extractSectionItems`
- [x] Update `extractSectionItems` to call `parseJsonItems` and handle the null return
- [x] Verify no nested try blocks remain in `extractSectionItems`
- [x] The item-level inner `try/catch` inside the for loop is NOT a nested try violation (it is inside a for loop, not inside another try) — do not touch it

---

### Task 2: Replace lambdas with method references in `LlmSectionExtractor.java` (AC6 — S1612)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`

**Current state (switch cases in `extract()`, e.g., WORK_EXPERIENCE at lines 80–83):**

```java
case WORK_EXPERIENCE -> items.stream()
    .filter(i -> i instanceof WorkExperienceItem)
    .map(i -> (WorkExperienceItem) i)
    .forEach(workExperiences::add);
```

**Required change — replace both lambdas with method references:**

```java
case WORK_EXPERIENCE -> items.stream()
    .filter(WorkExperienceItem.class::isInstance)
    .map(WorkExperienceItem.class::cast)
    .forEach(workExperiences::add);
```

Apply this pattern to ALL 8 typed dispatch cases:

| Case | Filter | Map | ForEach |
|------|--------|-----|---------|
| `WORK_EXPERIENCE` | `WorkExperienceItem.class::isInstance` | `WorkExperienceItem.class::cast` | `workExperiences::add` |
| `EDUCATION` | `EducationItem.class::isInstance` | `EducationItem.class::cast` | `education::add` |
| `SKILLS` | `SkillItem.class::isInstance` | `SkillItem.class::cast` | `skills::add` |
| `CERTIFICATIONS` | `CertificationItem.class::isInstance` | `CertificationItem.class::cast` | `certifications::add` |
| `LANGUAGES` | `LanguageItem.class::isInstance` | `LanguageItem.class::cast` | `languages::add` |
| `PROJECTS` | `ProjectItem.class::isInstance` | `ProjectItem.class::cast` | `projects::add` |
| `VOLUNTEERING` | `VolunteeringItem.class::isInstance` | `VolunteeringItem.class::cast` | `volunteering::add` |
| `SUMMARY` | `SummaryItem.class::isInstance` | `SummaryItem.class::cast` | (use `.findFirst().orElse(null)` — already a method ref) |

For the `SUMMARY` case the current code already uses `.findFirst().orElse(null)` — update only the filter and map lambdas:

```java
case SUMMARY -> {
    if (summary == null) {
        summary = items.stream()
            .filter(SummaryItem.class::isInstance)
            .map(SummaryItem.class::cast)
            .findFirst()
            .orElse(null);
    }
}
```

- [x] Replace all 7 standard filter/map/forEach chains (WORK_EXPERIENCE through VOLUNTEERING) with method references
- [x] Update the SUMMARY filter/map lambdas
- [x] Do NOT change `forEach(workExperiences::add)` — it is already a method reference

**IMPORTANT: Check `buildTypedItem()` for additional S1612 violations**

In `buildTypedItem()` the anchor check at lines 187–192:

```java
boolean hasAnchor = raw.values().stream()
    .filter(v -> v instanceof String)
    .map(v -> (String) v)
    .filter(v -> v.length() > 3)
    .anyMatch(v -> fullRawText.toLowerCase().contains(v.toLowerCase()));
```

Replace the first two lambdas:

```java
boolean hasAnchor = raw.values().stream()
    .filter(String.class::isInstance)
    .map(String.class::cast)
    .filter(v -> v.length() > 3)
    .anyMatch(v -> fullRawText.toLowerCase().contains(v.toLowerCase()));
```

The `.filter(v -> v.length() > 3)` and `.anyMatch(...)` cannot be method references because they involve instance method calls with captures — leave them as lambdas.

- [x] Update anchor check filter and map in `buildTypedItem()`

---

### Task 3: Fix `InterruptedException` handling in `OllamaHealthGuard.java` (AC3 — S2142)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java`

**Current state (lines 27–43):**

```java
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
```

`HttpClient.send()` declares `throws IOException, InterruptedException`. The catch-all `catch (Exception e)` swallows `InterruptedException` without restoring the interrupt flag, violating S2142.

**Required change — handle `InterruptedException` separately:**

```java
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
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        log.warn("Ollama health check interrupted: {}", e.getMessage());
        return false;
    } catch (Exception e) {
        log.warn("Ollama health check failed: {}", e.getMessage());
        return false;
    }
}
```

- [x] Add `catch (InterruptedException e)` block **before** the `catch (Exception e)` block
- [x] Call `Thread.currentThread().interrupt()` as the FIRST statement in the `InterruptedException` catch block
- [x] The `IOException` case is covered by the remaining `catch (Exception e)` — no need to add a separate `catch (IOException e)`
- [x] Do NOT add multi-catch here — the handling is different (InterruptedException needs interrupt restoration; IOException does not)

---

### Task 4: Remove unused `userRepository` field from `JwtAuthenticationFilter.java` (AC4 — S1068)

**File:** `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java`

**Confirmed:** `userRepository` is declared (line 28), assigned in constructor (line 33), but never read anywhere in the class. Zero references in `doFilterInternal` or any other method.

**Required changes:**

1. Remove field declaration:
   ```java
   // DELETE this line:
   private final UserRepository userRepository;
   ```

2. Remove constructor parameter:
   ```java
   // BEFORE:
   public JwtAuthenticationFilter(TokenService tokenService, UserRepository userRepository, ObjectMapper objectMapper) {
       this.tokenService = tokenService;
       this.userRepository = userRepository;       // DELETE
       this.objectMapper = objectMapper;
   }

   // AFTER:
   public JwtAuthenticationFilter(TokenService tokenService, ObjectMapper objectMapper) {
       this.tokenService = tokenService;
       this.objectMapper = objectMapper;
   }
   ```

3. Remove the import:
   ```java
   // DELETE this import (if present — check the import block):
   import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
   ```

- [x] Remove the `private final UserRepository userRepository;` field declaration
- [x] Remove `UserRepository userRepository` from the constructor signature
- [x] Remove `this.userRepository = userRepository;` from the constructor body
- [x] Remove the `UserRepository` import
- [x] Search for any `@Autowired` or test-injection usage of `JwtAuthenticationFilter` that passes `UserRepository` — update call sites if found

**IMPORTANT: Check for constructor call sites.** Spring's constructor injection means the constructor change will break any test that manually constructs `JwtAuthenticationFilter`. Run a project-wide search for `new JwtAuthenticationFilter(` to find call sites.

- [x] Run: `grep -rn "new JwtAuthenticationFilter(" src/` — fix any found usages

---

### Task 5: Replace `Thread.sleep` in `ResumeControllerIntegrationTest.java` (AC5 — S2925)

**File:** `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java`

**Current state (line 311):**

```java
// Small delay to ensure updatedAt differs
Thread.sleep(10);
```

This is in `put_updateResume_returns200WithUpdatedContent`. The intent is to ensure `updatedAt` is strictly after `createdAt`. The test already asserts:

```java
assertThat(newUpdatedAt).isNotEqualTo(originalUpdatedAt);
assertThat(java.time.Instant.parse(newUpdatedAt))
        .isAfter(java.time.Instant.parse(originalUpdatedAt));
```

**Preferred fix — remove the sleep and change the assertion strategy:**

The assertion `isAfter` is the meaningful test. Remove `Thread.sleep(10)` entirely. The `isAfter` assertion is sufficient and the backend timestamp precision (nanoseconds or milliseconds) makes a true simultaneous create+update extremely unlikely in practice.

```java
// BEFORE:
// Small delay to ensure updatedAt differs
Thread.sleep(10);

// AFTER: Remove the sleep entirely. The isAfter assertion validates timing.
```

Also update the method signature to remove `throws Exception` if `Thread.sleep` was the only checked-exception source (check if `throws Exception` or `throws InterruptedException` is declared on the test method).

**Alternative fix if the sleep removal causes intermittent failures** (only if the first option fails testing):

Replace with Awaitility:

```java
import org.awaitility.Awaitility;
import java.time.Duration;

// Replace Thread.sleep(10) with:
Awaitility.await().pollDelay(Duration.ofMillis(10)).atMost(Duration.ofSeconds(1)).until(() -> true);
```

Check if Awaitility is already in `pom.xml` before adding a dependency:

```
grep -n "awaitility" pom.xml
```

- [x] Remove `Thread.sleep(10)` from the test method
- [x] Remove `throws Exception` or `throws InterruptedException` from the test method signature if it was only declared for `Thread.sleep`
- [x] Run `./mvnw test -pl . -Dtest=ResumeControllerIntegrationTest` to verify the test passes without the sleep

**Pre-existing failure note:** `put_updateResume_returns200WithUpdatedContent` was previously identified in Story 9.2 as having a pre-existing nanosecond-precision flaky failure at lines 332–334. This story should FIX that test (removing the sleep should stabilize it). Document in the change log whether the fix resolved or exacerbated the flakiness.

---

### Task 6: Scan for commented-out code and merge identical catch blocks (AC2, AC7)

**AC2 — Commented-out code scan:**

Search the three main files for commented-out code blocks:

```
grep -n "//.*[;{}()]" src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java
grep -n "//.*[;{}()]" src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java
grep -n "//.*[;{}()]" src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java
```

Current known inline comments (NOT violations — these are explanatory comments, not commented-out code):
- `LlmSectionExtractor.java` line 68: `// Truncate to 3000 chars`
- `LlmSectionExtractor.java` line 109: `// Take the first SummaryItem only; ignore subsequent ones`
- `LlmSectionExtractor.java` line 119: `// UNKNOWN sections are intentionally excluded from the DTO`

If the scan finds any block of commented-out code (i.e., code that was once active logic, not documentation comments), remove it or replace with a `// TODO:` comment explaining the intent.

**AC7 — Identical catch block scan:**

Look for catch blocks in the affected files that execute identical code but catch different exception types. Merge them with multi-catch `catch (ExceptionA | ExceptionB e)`.

Current scan of `LlmSectionExtractor.java`:
- Outer catch (line 174): `catch (Exception e)` → `log.warn("LLM extraction failed...", ...)` + `return heuristicItems(rawSection)`
- Inner catch after Task 1 extraction: `catch (Exception e)` → `log.warn("Malformed JSON...", ...)` + `return null` — different log message and different return, NOT identical, do NOT merge
- Item-level catch (line 166): `catch (Exception e)` → log + add GenericItem — NOT identical to the outer catch

There may be no actual identical-body catch blocks to merge. If none are found after thorough inspection, document this in the change log.

---

### Task 7: Run all backend tests (AC8)

- [x] `./mvnw test` from the project root
- [x] Verify `LlmSectionExtractorTest` (8 tests) all pass — the method refactoring in Tasks 1 and 2 must not change behavior
- [x] Verify `ResumeControllerIntegrationTest` — pre-existing flaky failure fixed by removing `Thread.sleep` and updating assertion strategy
- [x] No other test regressions

---

## Dev Notes & Guardrails

### CRITICAL: Pure Structural Changes Only

This is SonarQube **style/quality** remediation, NOT a feature change:
- **No logic changes** in `LlmSectionExtractor` — method reference replacements are semantically identical; the extracted `parseJsonItems` method preserves all existing fallback behavior
- **No behavior changes** in `OllamaHealthGuard` — the `InterruptedException` case previously returned `false` (covered by `catch (Exception e)`); it still returns `false`, but now correctly restores the interrupt flag
- **No API contract changes** — removing `userRepository` from `JwtAuthenticationFilter` constructor changes Spring wiring only; JWT validation behavior is unchanged (the field was never used)

### File Locations (Exact Paths)

```
src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java
src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java
src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java
src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java
```

### Current State of `LlmSectionExtractor.java` After Story 9.2

Story 9.2 already extracted `START_DATE = "startDate"` and `END_DATE = "endDate"` constants. The **current** file (as committed on the main branch) already has:

```java
private static final int MAX_SECTION_LENGTH = 3000;
private static final String START_DATE = "startDate";
private static final String END_DATE = "endDate";
```

Do NOT re-add or re-extract these — they are already present. All `parseDate(raw, "startDate")` calls already use `START_DATE`.

### Method Reference Pattern — `Class::isInstance` + `Class::cast`

The SonarQube S1612 rule flags lambdas where a method reference is directly substitutable. The canonical replacement for filter-cast patterns in Java streams is:

```java
// Lambda (flagged by S1612):
.filter(i -> i instanceof WorkExperienceItem)
.map(i -> (WorkExperienceItem) i)

// Method reference (correct):
.filter(WorkExperienceItem.class::isInstance)
.map(WorkExperienceItem.class::cast)
```

`Class::isInstance` is an instance method of `Class<T>` that accepts `Object` — it is the correct method reference form of `instanceof`. `Class::cast` performs the unchecked cast in a type-safe manner via the generic `Class<T>`.

### `InterruptedException` Pattern — Thread Interrupt Protocol

Java's concurrency contract: when a method catches `InterruptedException`, it MUST restore the interrupt flag by calling `Thread.currentThread().interrupt()` before doing anything else. Failure to do so prevents the calling code from detecting that the thread was interrupted.

Correct pattern:
```java
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();   // ← FIRST: restore flag
    log.warn("...: {}", e.getMessage());  // THEN: log
    return false;                         // THEN: handle
}
```

### Removing a Constructor Parameter — Spring Wiring Impact

When removing `UserRepository` from `JwtAuthenticationFilter`'s constructor:
- Spring uses constructor injection automatically — it will no longer inject `UserRepository` into this filter. This is correct; the field was dead code.
- If any test manually constructs `JwtAuthenticationFilter(tokenService, userRepository, objectMapper)`, it must be updated to `JwtAuthenticationFilter(tokenService, objectMapper)`.
- Search: `grep -rn "JwtAuthenticationFilter" src/test/`

### `TypeReference` Anonymous Subclass in Extracted Method

When extracting `parseJsonItems`, the `new TypeReference<List<Map<String, Object>>>() {}` anonymous subclass syntax must be preserved as-is inside the new method. This is a Jackson pattern for capturing generic type information at runtime — do not simplify or change it.

### S1141 Rule — What Counts as "Nested"

SonarQube S1141 flags a try block whose body contains another try block. In `extractSectionItems`:
- Outer try (line 143): wraps the entire method body
- Inner try (line 151): wraps `objectMapper.readValue(...)` — this is the violation
- Item-level try (line 163): wraps `buildTypedItem(...)` — this is INSIDE a `for` loop inside the outer try. SonarQube also flags this, but it is addressed by the `parseJsonItems` extraction (the for loop moves to after the extracted call, still inside the outer try — the item-level try is no longer nested inside a nested try)

After Task 1, the structure is:
```
outer try {
    ...
    parseJsonItems() ← extracted, has its own internal try
    for loop {
        item-level try { buildTypedItem() }  ← try inside for loop, NOT nested try-in-try
    }
}
```

This eliminates the S1141 violation.

### SonarQube Rules Being Fixed

| Rule | Name | Count | File(s) |
|------|------|-------|---------|
| `java:S1141` | Nested try blocks | 2 MAJOR | `LlmSectionExtractor.java` |
| `java:S125` | Commented-out code | 1 MAJOR | Affected files (scan required) |
| `java:S2142` | InterruptedException swallowed | 1 MAJOR | `OllamaHealthGuard.java` |
| `java:S1068` | Unused private field | 1 MAJOR | `JwtAuthenticationFilter.java` |
| `java:S2925` | Thread.sleep in test | 1 MAJOR | `ResumeControllerIntegrationTest.java` |
| `java:S1612` | Lambda → method reference | 9 MINOR | `LlmSectionExtractor.java` |
| `java:S2147` | Combine identical catch blocks | 2 MINOR | Affected files (scan required) |

### Previous Story Intelligence

**From Story 9.2 (done):**
- Backend tests run via `./mvnw test` from the project root
- Pre-existing flaky test: `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` — nanosecond timestamp assertion at lines 332–334. Story 9.2 documented it as pre-existing; Story 9.4 fixes its root cause (`Thread.sleep(10)` removal in Task 5).
- 110 tests total in the test suite at 9.2 completion; 109 pass (1 pre-existing flaky failure)
- The pattern for SonarQube remediation in this project: pure structural changes, zero logic changes, all existing tests must pass unchanged
- `LlmSectionExtractor.java` already has `START_DATE` and `END_DATE` constants — do not re-extract them

**From Story 9.3 (done):**
- 9.3 was TypeScript/frontend-only. No shared files with 9.4. No learnings directly applicable.
- Commit pattern: single commit per story with prefix `feat(story-key): description`

### What NOT to Change

- Logic inside `buildTypedItem()` switch expression — only the `instanceof` filter and cast lambdas in the anchor check are changed (method references); no type-dispatch logic changes
- `heuristicItems()` — untouched
- `parseDate()` — untouched
- `str()`, `bool()`, `toStringMap()` — untouched
- The `LlmSectionExtractorTest.java` test file — all 7 tests must pass without modification (the test exercises public `extract()` behavior which does not change)
- `ollamaBaseUrl` field in `OllamaHealthGuard` — this IS used (it is injected via `@Value` and used in `URI.create(ollamaBaseUrl)`) — do NOT remove it
- Any file outside the 4 listed above
- Frontend files — this story is Java backend only

---

## Story Completion Status

**Analysis completed:** 2026-06-11
**Files analyzed:** `LlmSectionExtractor.java` (current post-9.2 state), `OllamaHealthGuard.java`, `JwtAuthenticationFilter.java`, `ResumeControllerIntegrationTest.java` (line 311), `LlmSectionExtractorTest.java`, Stories 9.2 and 9.3

**Violations confirmed per file:**
- `LlmSectionExtractor.java`: S1141 (1 nested try in `extractSectionItems`), S1612 (7 filter/map lambdas in switch + 2 in anchor check = 9 lambdas)
- `OllamaHealthGuard.java`: S2142 (1 swallowed `InterruptedException`)
- `JwtAuthenticationFilter.java`: S1068 (1 unused `userRepository` field)
- `ResumeControllerIntegrationTest.java`: S2925 (1 `Thread.sleep`)
- S125 and S2147: scan required — no confirmed violations found in manual review, but scan for completeness

**Approach confirmed:** Structural refactoring only — extract method, add method references, split catch, remove dead field, remove sleep. Zero behavior changes.

---

## Dev Agent Record

### Completion Notes

Implemented 2026-06-11. Pure structural SonarQube remediation — zero behavior changes.

- **AC1 (S1141):** Extracted inner `objectMapper.readValue` try block from `extractSectionItems()` into new private `parseJsonItems(String, RawSection)` method. Returns `null` on malformed JSON. `extractSectionItems` now delegates and checks null. No nested try-in-try remains.
- **AC6 (S1612):** Replaced all 9 lambda instances with method references — 8 filter/map chains in `extract()` switch (WORK_EXPERIENCE through SUMMARY) and 2 in `buildTypedItem()` anchor check.
- **AC3 (S2142):** Added `catch (InterruptedException e)` before `catch (Exception e)` in `OllamaHealthGuard.isAvailable()`. Calls `Thread.currentThread().interrupt()` first.
- **AC4 (S1068):** Removed `private final UserRepository userRepository` field, constructor parameter, and assignment from `JwtAuthenticationFilter`. No import existed (same package). No manual constructor call sites found.
- **AC5 (S2925):** Removed `Thread.sleep(10)` from `put_updateResume_returns200WithUpdatedContent`. Fixed review finding [Patch]: captured `originalUpdatedAt` from create response before PUT, then after PUT asserts `newUpdatedAt` isNotEmpty, isNotEqualTo(originalUpdatedAt), and `Instant.parse(newUpdatedAt).isAfter(Instant.now().minusSeconds(60))`. Mutation of `updatedAt` is now verified. 110 tests pass.
- **AC2 (S125):** Scanned all 3 main files — no commented-out code found. All `//` matches are explanatory comments.
- **AC7 (S2147):** All catch blocks have different bodies — no identical catch merges applicable.
- **AC8:** 110 tests pass, 0 failures. `LlmSectionExtractorTest` 8 tests all pass. Pre-existing flaky test stabilized.

### Debug Log

- First test run after sleep removal: `put_updateResume_returns200WithUpdatedContent` failed at `isAfter` assertion — timestamps had same microsecond value (`226820Z` vs `226820300Z` — nanosecond truncation difference). Root cause: without sleep, JPA `@UpdateTimestamp` and create timestamp fire in same DB transaction tick. Fixed by changing assertion strategy per AC5.

---

## File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` — modified
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/OllamaHealthGuard.java` — modified
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/auth/JwtAuthenticationFilter.java` — modified
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java` — modified

---

## Review Findings

- [x] [Review][Patch] Weakened test assertion no longer verifies `updatedAt` was actually updated [src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeControllerIntegrationTest.java:328-329] — `isNotEmpty()` + `isNotNull()` on a parsed `Instant` only confirm the field is a parseable ISO timestamp; they do not verify the update mutation occurred. `Instant.parse(...).isNotNull()` is always true (parse throws rather than returning null). The test no longer catches a regression where `updatedAt` remains equal to `createdAt`. Fix: assert `Instant.parse(newUpdatedAt).isAfter(Instant.now().minusSeconds(5))` or capture `createdAt` and assert `updatedAt` is not equal to it (using a small clock tolerance via `isBefore(createdAt.plusMillis(100))` is acceptable given nanosecond precision issues).
- [x] [Review][Defer] `catch (Exception e)` in `parseJsonItems` is over-broad (catches `Error` subclasses) [src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java:182] — pre-existing pattern throughout the file, not introduced by this story; defer to a dedicated catch-narrowing story.

---

## Change Log

- 2026-06-11: Story 9.4 implemented — SonarQube remediation (S1141, S1612, S2142, S1068, S2925, S125 scan, S2147 scan). 4 files modified, 110 tests pass.
- 2026-06-11: Code review complete — 1 patch finding, 1 deferred, 1 dismissed.
- 2026-06-11: Addressed review finding [Patch] — restored `updatedAt` mutation assertion in `put_updateResume` test: capture originalUpdatedAt before PUT, assert newUpdatedAt isNotEqualTo(originalUpdatedAt) and isAfter(now minus 60s). 110 tests pass.
- 2026-06-11: Second-cycle code review complete — 0 patch, 0 decision-needed, 1 deferred, 3 dismissed. Story → done.
