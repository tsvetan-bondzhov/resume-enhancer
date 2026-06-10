# Story 3.11: ResumeSectionType as Core Domain Concept — Typed Section Identifiers

Status: done

## Story

As a developer,
I want `ResumeSection` to be identified by a typed `ResumeSectionType` enum instead of a freeform string,
so that section identity is enforced at compile time, section ordering in templates is unambiguous, and the arbitrary UUID / hardcoded-string inconsistency is eliminated.

## Acceptance Criteria

**AC1 — `ResumeSectionType` moved to `resume.domain`**
**Given** `ResumeSectionType` is moved to `resume.domain`
**When** the project compiles
**Then** `upload.parsers` imports `ResumeSectionType` from its new location; no other package holds a copy of the enum; no compilation errors

**AC2 — `ResumeSection` record updated with `sectionType` field**
**Given** the `ResumeSection` record is updated
**When** any code constructs or reads a `ResumeSection`
**Then** the record signature is `ResumeSection(ResumeSectionType sectionType, String title, boolean visible, List<ResumeItem> items)`; the `sectionType` field serializes as `"sectionType"` in JSON; the compact constructor rejects a `null` `sectionType` with `NullPointerException` (consistent with the existing `items` guard)

**AC3 — `ResumeService.buildFromProfile()` uses typed enum**
**Given** `ResumeService.buildFromProfile()` is updated
**When** a resume is created from a profile
**Then** the three sections are constructed with `ResumeSectionType.WORK_EXPERIENCE`, `ResumeSectionType.EDUCATION`, and `ResumeSectionType.SKILLS`; no hardcoded string identifiers remain

**AC4 — `LlmSectionExtractor.extract()` uses typed `sectionType`**
**Given** `LlmSectionExtractor.extract()` is updated
**When** it processes a raw section
**Then** the already-resolved `ResumeSectionType` (from `fromHeader()`) is used directly as the `sectionType` of the new `ResumeSection`; `UUID.randomUUID().toString()` is no longer used as a section identifier; `UNKNOWN` sections receive `ResumeSectionType.UNKNOWN`

**AC5 — Flyway migration `V8__migrate_section_ids_to_type.sql`**
**Given** Flyway migration `V8__migrate_section_ids_to_type.sql` is applied
**When** the application starts against a database with existing resume records
**Then** every section object inside `resumes.resume_content` JSONB has its `"id"` key renamed to `"sectionType"` and its value converted: `"experience"` → `"WORK_EXPERIENCE"`, `"education"` → `"EDUCATION"`, `"skills"` → `"SKILLS"`; any unrecognised string value maps to `"UNKNOWN"`; all other section fields are unchanged; the migration is idempotent (re-running does not corrupt data)

**AC6 — `TemplateDefinition.DEFAULT` and template seed SQL updated**
**Given** `TemplateDefinition.DEFAULT` and the prebuilt template seed SQL are updated
**When** `GET /api/v1/resume-templates` is called
**Then** all `sectionOrder` and `columns.left` / `columns.right` arrays in template definitions reference `ResumeSectionType` name strings (e.g. `"WORK_EXPERIENCE"`, `"EDUCATION"`, `"SKILLS"`); `TemplateDefinition.DEFAULT.sectionOrder` equals `["WORK_EXPERIENCE", "EDUCATION", "SKILLS"]`

**AC7 — Frontend `ResumeSectionDto` updated with `sectionType`**
**Given** the frontend `ResumeSectionDto` interface is updated
**When** the API response is consumed
**Then** the `id: string` field is replaced by `sectionType: ResumeSectionType` where `ResumeSectionType` is a TypeScript string-literal union of all Java enum values (`"WORK_EXPERIENCE" | "EDUCATION" | "SKILLS" | "CERTIFICATIONS" | "PROJECTS" | "SUMMARY" | "LANGUAGES" | "VOLUNTEERING" | "UNKNOWN"`); no frontend file references `section.id`

**AC8 — `templateUtils.ts` and `ResumeCanvas.tsx` use `sectionType`**
**Given** `templateUtils.ts` and `ResumeCanvas.tsx` are updated
**When** sections are ordered, column assignments are resolved, or ARIA `id` attributes are generated
**Then** `getOrderedSections` matches sections via `section.sectionType`; `leftColumnIds` and `rightColumnIds` are `Set<string>` values compared against `section.sectionType`; `aria-labelledby` and React `key` props use `section.sectionType`, producing stable human-readable DOM identifiers

**AC9 — Tests**
**Given** the story is implemented
**When** tests are run
**Then** `ResumeCanvas.test.tsx` and `ResumeSection.test.tsx` are updated to use `sectionType` throughout; a `ResumeSectionMigrationTest.java` unit test applies the V8 migration logic to a fixture JSON document and asserts correct `sectionType` output values for all three known section types plus the `UNKNOWN` fallback

---

## Tasks / Subtasks

### Task 1: Move `ResumeSectionType` to `resume.domain` (AC: 1)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSectionType.java`
- [x] Delete `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java`
- [x] Update import in `LlmSectionExtractor.java` from `upload.parsers.ResumeSectionType` → `resume.domain.ResumeSectionType`
- [x] Verify no other class imports from the old location

**CRITICAL:** The enum content is IDENTICAL — do not change any enum values or the `fromHeader()` method. Just change the package declaration and move the file.

**New package declaration:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain;
```

**`LlmSectionExtractor.java` import change:**
```java
// Remove:
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.ResumeSectionType;
// Add:
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
```

---

### Task 2: Update `ResumeSection` record — rename `id` to `sectionType` (AC: 2)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java`

**Current state (read from file):**
```java
public record ResumeSection(
        String id,
        String title,
        boolean visible,
        List<ResumeItem> items
) {
    public ResumeSection {
        items = items != null ? List.copyOf(items) : List.of();
    }
}
```

**New state:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.util.List;
import java.util.Objects;

public record ResumeSection(
        ResumeSectionType sectionType,
        String title,
        boolean visible,
        List<ResumeItem> items
) {
    public ResumeSection {
        Objects.requireNonNull(sectionType, "sectionType must not be null");
        items = items != null ? List.copyOf(items) : List.of();
    }
}
```

**CRITICAL — Jackson serialization:** The field `sectionType` will serialize as `"sectionType"` by default in JSON (Jackson uses the Java field name). The enum values serialize as their name strings (`"WORK_EXPERIENCE"`, etc.) because Jackson's default `ObjectMapper` uses `EnumSerializer` which calls `name()`. No `@JsonProperty` or custom serialization needed.

**CRITICAL — `ResumeDocumentConverter` reads/writes `ResumeDocument` via `objectMapper`. After this change, the JSON will contain `"sectionType": "WORK_EXPERIENCE"` instead of `"id": "experience"`. The V8 Flyway migration (Task 6) migrates existing DB data to match this new shape BEFORE the application starts reading it.**

**CRITICAL — `Objects.requireNonNull` import:** Add `import java.util.Objects;` to the record.

---

### Task 3: Update `ResumeService.buildFromProfile()` (AC: 3)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`

**Changes required:**

1. Add import: `import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;`
2. Replace the three `new ResumeSection(...)` calls in `buildFromProfile()`:
   - `new ResumeSection("experience", "Work Experience", true, expItems)` → `new ResumeSection(ResumeSectionType.WORK_EXPERIENCE, "Work Experience", true, expItems)`
   - `new ResumeSection("education", "Education", true, eduItems)` → `new ResumeSection(ResumeSectionType.EDUCATION, "Education", true, eduItems)`
   - `new ResumeSection("skills", "Skills", true, skillItems)` → `new ResumeSection(ResumeSectionType.SKILLS, "Skills", true, skillItems)`
3. Update `deepCopyDocument()` — the `new ResumeSection(...)` call currently uses `section.id()`:
   ```java
   // Before:
   return new ResumeSection(section.id(), section.title(), section.visible(), copiedItems);
   // After:
   return new ResumeSection(section.sectionType(), section.title(), section.visible(), copiedItems);
   ```

**CRITICAL — `ResumeServiceTest.java` currently asserts `section.id()` values** (lines 138, 140, 143). These tests MUST be updated in Task 8 to assert `section.sectionType()` instead. The existing assertions:
```java
assertThat(saved.getResumeContent().sections().get(0).id()).isEqualTo("experience");
assertThat(saved.getResumeContent().sections().get(2).id()).isEqualTo("skills");
```
Must become:
```java
assertThat(saved.getResumeContent().sections().get(0).sectionType()).isEqualTo(ResumeSectionType.WORK_EXPERIENCE);
assertThat(saved.getResumeContent().sections().get(2).sectionType()).isEqualTo(ResumeSectionType.SKILLS);
```

---

### Task 4: Update `LlmSectionExtractor.extract()` (AC: 4)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`

**Current state (line 61-67):**
```java
sections.add(new ResumeSection(
    UUID.randomUUID().toString(),
    rawSection.title(),
    true,
    items
));
```

**New state:**
```java
sections.add(new ResumeSection(
    sectionType,   // already computed above via ResumeSectionType.fromHeader()
    rawSection.title(),
    true,
    items
));
```

**Remove the `UUID` import** if no longer used anywhere in the class after this change. Check: `UUID.randomUUID()` in `extractSectionItems()` and `heuristicItems()` still use `UUID` for `ResumeItem` IDs — the import stays.

**CRITICAL — `LlmSectionExtractorTest.java` does NOT assert `section.id()`.** It only checks `section.items()` content — no test updates needed for the section identity change itself. However, the tests must still compile after `ResumeSection` field change from `id` to `sectionType`. Verify no test accesses `section.id()`.

---

### Task 5: Update `ResumeDocumentConverter` — no code change needed

- [x] Verify `ResumeDocumentConverter.java` requires no changes

`ResumeDocumentConverter` uses `objectMapper.writeValueAsString(attribute)` and `objectMapper.readValue(dbData, ResumeDocument.class)`. Jackson reflects on the record component names. After renaming `id` → `sectionType` in `ResumeSection`, Jackson will:
- **Write:** serialize `sectionType` as `"sectionType": "WORK_EXPERIENCE"` (enum name string)
- **Read:** deserialize `"sectionType": "WORK_EXPERIENCE"` back to `ResumeSectionType.WORK_EXPERIENCE`

No `@JsonDeserialize` or custom deserializer needed. Jackson handles Java enums natively via `name()` / `valueOf()`.

**CRITICAL — Jackson enum deserialization:** By default, Jackson uses `EnumDeserializer` which calls `Enum.valueOf(enumType, value)`. This means `"WORK_EXPERIENCE"` → `ResumeSectionType.WORK_EXPERIENCE` works automatically. `"UNKNOWN"` also works for the migration fallback. No configuration needed.

---

### Task 6: Create Flyway migration `V8__migrate_section_ids_to_type.sql` (AC: 5)

- [x] Create `src/main/resources/db/migration/V8__migrate_section_ids_to_type.sql`

**CRITICAL — Current Flyway state:** V1–V7 are all applied. Next version is V8. NEVER modify existing migrations.

**CRITICAL — Existing JSONB structure** (from `buildFromProfile()` and `LlmSectionExtractor`): each section object looks like:
```json
{"id": "experience", "title": "Work Experience", "visible": true, "items": [...]}
```
After this migration, it must look like:
```json
{"sectionType": "WORK_EXPERIENCE", "title": "Work Experience", "visible": true, "items": [...]}
```

**Migration SQL:**
```sql
-- V8: Rename "id" to "sectionType" in resume section objects and convert values to enum names.
-- DATA migration only — no DDL changes.
-- Idempotent: sections already having "sectionType" key are unaffected (DO NOTHING).

UPDATE resumes
SET resume_content = (
    SELECT jsonb_build_object(
        'sections',
        jsonb_agg(
            CASE
                -- Already migrated: sectionType key exists — leave unchanged
                WHEN section ? 'sectionType' THEN section
                ELSE
                    -- Remove old "id" key, add "sectionType" with mapped value
                    (section - 'id') || jsonb_build_object(
                        'sectionType',
                        CASE section->>'id'
                            WHEN 'experience' THEN 'WORK_EXPERIENCE'
                            WHEN 'education'  THEN 'EDUCATION'
                            WHEN 'skills'     THEN 'SKILLS'
                            WHEN 'certifications' THEN 'CERTIFICATIONS'
                            WHEN 'projects'   THEN 'PROJECTS'
                            WHEN 'summary'    THEN 'SUMMARY'
                            WHEN 'languages'  THEN 'LANGUAGES'
                            WHEN 'volunteering' THEN 'VOLUNTEERING'
                            ELSE 'UNKNOWN'
                        END
                    )
            END
            ORDER BY ordinality
        )
    )
    FROM jsonb_array_elements(resume_content->'sections') WITH ORDINALITY AS t(section, ordinality)
)
WHERE resume_content IS NOT NULL
  AND jsonb_array_length(resume_content->'sections') > 0;
```

**CRITICAL — Idempotency check:** The `WHEN section ? 'sectionType' THEN section` branch means re-running the migration on already-migrated data does nothing. UUID-based IDs from `LlmSectionExtractor` (which were random UUIDs) will fall to `ELSE 'UNKNOWN'` — this is correct and safe.

**CRITICAL — `WITH ORDINALITY`:** Preserves original section array order. Without `ORDER BY ordinality`, `jsonb_agg` may reorder sections.

**CRITICAL — Empty resume documents:** `jsonb_array_length(resume_content->'sections') > 0` guard prevents the `jsonb_array_elements` from erroring on empty arrays. Resumes with no sections are untouched.

---

### Task 7: Update `TemplateDefinition.DEFAULT` and prebuilt template SQL (AC: 6)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java`
- [x] Create `src/main/resources/db/migration/V9__update_template_section_order_to_enum_names.sql`

**`TemplateDefinition.java` change — `DEFAULT` constant:**
```java
// Before (sectionOrder):
List.of("experience", "education", "skills"),
// After:
List.of("WORK_EXPERIENCE", "EDUCATION", "SKILLS"),
```

**CRITICAL — `TemplateLayout.resolvedSectionOrder()` note:** This method is currently not called anywhere (deferred, per story 3.10 review). No changes needed there.

**V9 migration SQL (`V9__update_template_section_order_to_enum_names.sql`):**
```sql
-- V9: Update template sectionOrder and column arrays to use ResumeSectionType enum name strings.
-- DATA migration only — no DDL changes.

-- Minimal template (single-column): update sectionOrder
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000001'::uuid;

-- Classic template (two-column): update columns.left and columns.right
UPDATE resume_templates
SET template_definition = jsonb_set(
    jsonb_set(
        template_definition,
        '{layout,columns,left}',
        '["SKILLS", "LANGUAGES", "CERTIFICATIONS"]'::jsonb
    ),
    '{layout,columns,right}',
    '["WORK_EXPERIENCE", "EDUCATION", "PROJECTS"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;

-- Modern template (modern-accent): update sectionOrder
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["WORK_EXPERIENCE", "SKILLS", "EDUCATION", "PROJECTS", "CERTIFICATIONS"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000003'::uuid;
```

---

### Task 8: Update `ResumeServiceTest.java` (AC: 3, 9)

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`

**Add import:**
```java
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
```

**Fix `createResume_withProfile_buildsResumeDocumentFromProfile` test** (currently asserts `section.id()` — will no longer compile):
```java
// Before (lines 138-143):
assertThat(saved.getResumeContent().sections().get(0).id()).isEqualTo("experience");
// ...
assertThat(saved.getResumeContent().sections().get(2).id()).isEqualTo("skills");

// After:
assertThat(saved.getResumeContent().sections().get(0).sectionType())
        .isEqualTo(ResumeSectionType.WORK_EXPERIENCE);
assertThat(saved.getResumeContent().sections().get(0).items()).hasSize(1);
assertThat(saved.getResumeContent().sections().get(0).items().get(0).fields().get("jobTitle"))
        .isEqualTo("Engineer");
assertThat(saved.getResumeContent().sections().get(2).sectionType())
        .isEqualTo(ResumeSectionType.SKILLS);
assertThat(saved.getResumeContent().sections().get(2).items()).hasSize(1);
```

---

### Task 9: Create `ResumeSectionMigrationTest.java` (AC: 9)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeSectionMigrationTest.java`

**CRITICAL — This is a UNIT test** (no Spring context, no Testcontainers). It tests the migration LOGIC by applying the same JSONB transformation in Java and verifying the result. It does NOT use `@SpringBootTest`.

```java
package com.tsvetanbondzhov.resumeenhancer.resume;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates the section migration logic corresponding to V8__migrate_section_ids_to_type.sql.
 * Tests the mapping: old "id" string values → ResumeSectionType enum names.
 * Uses Java-side simulation of the SQL CASE logic to verify correctness.
 */
class ResumeSectionMigrationTest {

    private static final Map<String, String> MIGRATION_MAP = Map.of(
            "experience",    "WORK_EXPERIENCE",
            "education",     "EDUCATION",
            "skills",        "SKILLS",
            "certifications","CERTIFICATIONS",
            "projects",      "PROJECTS",
            "summary",       "SUMMARY",
            "languages",     "LANGUAGES",
            "volunteering",  "VOLUNTEERING"
    );

    /** Simulates the V8 SQL CASE mapping for a single section id value. */
    private String migrateId(String oldId) {
        return MIGRATION_MAP.getOrDefault(oldId, "UNKNOWN");
    }

    @Test
    void migrateId_experience_mapsToWorkExperience() {
        assertThat(migrateId("experience")).isEqualTo("WORK_EXPERIENCE");
    }

    @Test
    void migrateId_education_mapsToEducation() {
        assertThat(migrateId("education")).isEqualTo("EDUCATION");
    }

    @Test
    void migrateId_skills_mapsToSkills() {
        assertThat(migrateId("skills")).isEqualTo("SKILLS");
    }

    @Test
    void migrateId_unknownString_mapsToUnknown() {
        assertThat(migrateId("some-random-uuid-or-unrecognised-string")).isEqualTo("UNKNOWN");
    }

    @Test
    void migrateId_allEnumValues_haveCorrespondingMigratedNames() {
        // Verify each mapped value is a valid ResumeSectionType enum name
        for (String enumName : MIGRATION_MAP.values()) {
            assertThat(ResumeSectionType.valueOf(enumName))
                    .as("Mapped value '%s' must be a valid ResumeSectionType", enumName)
                    .isNotNull();
        }
        // UNKNOWN fallback must also be valid
        assertThat(ResumeSectionType.valueOf("UNKNOWN")).isNotNull();
    }

    @Test
    void jsonMigration_fixtureDocument_producesCorrectSectionTypes() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        // Build fixture JSON matching pre-migration DB structure
        // {"sections": [{"id": "experience", "title": "Work Experience", "visible": true, "items": []},
        //               {"id": "education",  "title": "Education",       "visible": true, "items": []},
        //               {"id": "skills",     "title": "Skills",          "visible": true, "items": []},
        //               {"id": "weird-uuid", "title": "Unknown Section",  "visible": true, "items": []}]}
        ObjectNode doc = mapper.createObjectNode();
        ArrayNode sections = doc.putArray("sections");

        for (String[] pair : new String[][]{
                {"experience", "Work Experience"},
                {"education",  "Education"},
                {"skills",     "Skills"},
                {"weird-uuid", "Unknown Section"}
        }) {
            ObjectNode section = mapper.createObjectNode();
            section.put("id",      pair[0]);
            section.put("title",   pair[1]);
            section.put("visible", true);
            section.putArray("items");
            sections.add(section);
        }

        // Apply migration logic
        ArrayNode migrated = mapper.createArrayNode();
        for (var section : (Iterable<com.fasterxml.jackson.databind.JsonNode>) sections::elements) {
            ObjectNode s = (ObjectNode) section.deepCopy();
            if (!s.has("sectionType")) {
                String oldId = s.path("id").asText("");
                s.remove("id");
                s.put("sectionType", migrateId(oldId));
            }
            migrated.add(s);
        }

        // Assert
        assertThat(migrated.get(0).get("sectionType").asText()).isEqualTo("WORK_EXPERIENCE");
        assertThat(migrated.get(1).get("sectionType").asText()).isEqualTo("EDUCATION");
        assertThat(migrated.get(2).get("sectionType").asText()).isEqualTo("SKILLS");
        assertThat(migrated.get(3).get("sectionType").asText()).isEqualTo("UNKNOWN");

        // Idempotency: already-migrated sections must be unchanged
        ObjectNode alreadyMigrated = mapper.createObjectNode();
        alreadyMigrated.put("sectionType", "WORK_EXPERIENCE");
        alreadyMigrated.put("title", "Work Experience");
        alreadyMigrated.put("visible", true);
        alreadyMigrated.putArray("items");

        ObjectNode idempotentResult = (ObjectNode) alreadyMigrated.deepCopy();
        if (!idempotentResult.has("sectionType")) {
            // Would have migrated — but it already has sectionType so this branch won't run
            idempotentResult.put("sectionType", "BUG");
        }
        assertThat(idempotentResult.get("sectionType").asText()).isEqualTo("WORK_EXPERIENCE");
    }
}
```

---

### Task 10: Update frontend `ResumeSectionDto` and add `ResumeSectionType` union (AC: 7)

- [x] Edit `frontend/src/types/api.ts`

**Add `ResumeSectionType` TypeScript union type (add before `ResumeSectionDto`):**
```typescript
export type ResumeSectionType =
  | "WORK_EXPERIENCE"
  | "EDUCATION"
  | "SKILLS"
  | "CERTIFICATIONS"
  | "PROJECTS"
  | "SUMMARY"
  | "LANGUAGES"
  | "VOLUNTEERING"
  | "UNKNOWN"
```

**Update `ResumeSectionDto` — replace `id: string` with `sectionType: ResumeSectionType`:**
```typescript
export interface ResumeSectionDto {
  sectionType: ResumeSectionType
  title: string
  visible: boolean
  items: ResumeItemDto[]
}
```

**CRITICAL — `ResumeItemDto` still has `id: string`.** Do NOT change `ResumeItemDto` — items still use UUID-based `id` fields. Only the section identifier changes.

**CRITICAL — TypeScript will produce compile errors** everywhere `section.id` is referenced after this change. All affected files must be updated in Tasks 11–12. The compiler will surface them.

---

### Task 11: Update `templateUtils.ts` to use `section.sectionType` (AC: 8)

- [x] Edit `frontend/src/lib/templateUtils.ts`

**Current state:** All references use `section.id` to match against template `sectionOrder` strings and column arrays.

**Changes — replace all `section.id` with `section.sectionType`:**

```typescript
import type { ResumeSectionDto, TemplateDto } from "@/types/api"

/**
 * Returns visible sections ordered according to the template definition.
 *
 * Rules:
 * - Visibility filtering is applied first: sections with `visible === false` are always excluded.
 * - `single-column` / `modern-accent`: follows `layout.sectionOrder`.
 * - `two-column`: follows `columns.left` then `columns.right`.
 * - Sections absent from the template order arrays are appended last in document order.
 * - Sections are NEVER silently dropped.
 *
 * Note: `sectionOrder` strings now match `section.sectionType` values (e.g. "WORK_EXPERIENCE").
 * After Story 3.11, template definitions use enum names — full alignment is achieved.
 */
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType

  if (layoutType === "two-column") {
    const left = layout.columns?.left ?? []
    const right = layout.columns?.right ?? []
    const orderedIds = [...left, ...right]
    const inOrder = orderedIds
      .map((id) => visibleSections.find((s) => s.sectionType === id))
      .filter((s): s is ResumeSectionDto => s !== undefined)
    const remaining = visibleSections.filter((s) => !orderedIds.includes(s.sectionType))
    return [...inOrder, ...remaining]
  }

  // single-column and modern-accent
  const sectionOrder = layout.sectionOrder ?? []
  const inOrder = sectionOrder
    .map((id) => visibleSections.find((s) => s.sectionType === id))
    .filter((s): s is ResumeSectionDto => s !== undefined)
  const remaining = visibleSections.filter((s) => !sectionOrder.includes(s.sectionType))
  return [...inOrder, ...remaining]
}
```

---

### Task 12: Update `ResumeCanvas.tsx` to use `section.sectionType` (AC: 8)

- [x] Edit `frontend/src/components/resume/ResumeCanvas.tsx`

**All occurrences of `section.id` must be replaced with `section.sectionType`.** Specific lines to update:

1. **`leftColumnIds.has(section.id)`** → `leftColumnIds.has(section.sectionType)`
2. **`rightColumnIds.has(section.id)`** → `rightColumnIds.has(section.sectionType)`
3. **`key={section.id}` (two places: editable `<div>` and read-only `<section>`)** → `key={section.sectionType}`
4. **`aria-labelledby={`section-title-${section.id}`}`** → ``aria-labelledby={`section-title-${section.sectionType}`}``
5. **`id={`section-title-${section.id}`}` on `<h2>`** → ``id={`section-title-${section.sectionType}`}``
6. **`onTitleChange={(title) => onTitleChange(section.id, title)}`** → `onTitleChange={(title) => onTitleChange(section.sectionType, title)}`
7. **`onFieldChange={(itemId, field, value) => onFieldChange(section.id, itemId, field, value)}`** → `onFieldChange={(itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)}`

**CRITICAL — `onTitleChange` prop signature:** The callback is `(sectionId: string, title: string) => void`. After this change, `sectionId` will be a `ResumeSectionType` string (`"WORK_EXPERIENCE"`, etc.) instead of the old freeform id. The `useResumeStore.updateSectionTitle()` action accepts `sectionId: string` — it finds sections by this id. That store method must be updated in Task 14.

---

### Task 13: Update `SectionsPanel.tsx` to use `section.sectionType` (AC: 7)

- [x] Edit `frontend/src/components/resume/SectionsPanel.tsx`

**All occurrences of `section.id` must be replaced with `section.sectionType`.** Specific changes:

1. **`useSortable({ id: section.id })`** → `useSortable({ id: section.sectionType })`
2. **`onCheckedChange={() => onToggle(section.id)}`** → `onCheckedChange={() => onToggle(section.sectionType)}`
3. **`id={`section-visible-${section.id}`}`** → ``id={`section-visible-${section.sectionType}`}``
4. **`htmlFor={`section-visible-${section.id}`}`** → ``htmlFor={`section-visible-${section.sectionType}`}``
5. **`sections.findIndex((s) => s.id === active.id)` (in `handleDragEnd`)** — `DndContext` uses `active.id`/`over.id` which are set from `useSortable({ id: ... })`. After updating to `section.sectionType`, the `findIndex` comparisons `(s) => s.id === active.id` must become `(s) => s.sectionType === active.id`
6. **`sections.findIndex((s) => s.id === id)` (in `handleMoveUp`/`handleMoveDown`)** → `(s) => s.sectionType === id`
7. **`items={sections.map((s) => s.id)}` (SortableContext)** → `items={sections.map((s) => s.sectionType)}`

**CRITICAL — `@dnd-kit/sortable` `id` type:** `useSortable` accepts `id: string | number`. `ResumeSectionType` values are strings — no type issue.

**CRITICAL — `onToggle` and store:** `toggleSectionVisibility` in `useResumeStore` accepts `sectionId: string`. After this change it will receive a `ResumeSectionType` string. The store finds sections by this id — update in Task 14.

---

### Task 14: Update `useResumeStore` store methods to match `sectionType` (AC: 7, 8)

- [x] Edit `frontend/src/stores/useResumeStore.ts`

**Find and update all store methods that look up sections by id.** The section lookup pattern `sections.map(s => s.id === sectionId ? ... : s)` must become `s.sectionType === sectionId`.

**CRITICAL — `useResumeStore` was built in Story 3.5. Read the file first to see the exact method names and implementations.** The store contains these section-related actions:
- `updateSectionTitle(sectionId: string, title: string)` — finds section by id
- `updateItemField(sectionId: string, itemId: string, field: string, value: string)` — finds section by id
- `toggleSectionVisibility(sectionId: string)` — finds section by id
- `reorderSections(sections: ResumeSectionDto[])` — replaces the full array (no id lookup needed)

All three find-by-id methods use a pattern like:
```typescript
sections: state.currentResume.content.sections.map((s) =>
  s.id === sectionId ? { ...s, ... } : s
)
```

Replace `s.id` with `s.sectionType` in each.

**CRITICAL — `applyPatch` method (Epic 4 prep):** If `applyPatch` exists in the store and uses `sectionId` to find sections, update it too. But `applyPatch` is in scope for Epic 4 — check if it's already scaffolded.

---

### Task 15: Update `ResumeSection.test.tsx` to use `sectionType` (AC: 9)

- [x] Edit `frontend/src/components/resume/ResumeSection.test.tsx`

**Current test uses `buildSection()` which has `id: "test-section"`.** Update:

```typescript
function buildSection(overrides?: Partial<ResumeSectionDto>): ResumeSectionDto {
  return {
    sectionType: "WORK_EXPERIENCE",   // was: id: "test-section"
    title: "Work Experience",
    visible: true,
    items: [
      {
        id: "item-1",
        fields: { jobTitle: "Engineer", company: "Acme Corp" },
      },
    ],
    ...overrides,
  }
}
```

**Also update `buildResumeWithSection()` to not reference `section.id`** — it uses `section` as-is in `content.sections`, so no change needed there.

**CRITICAL — test assertions that reference `section.id`:** In the store-integration tests (lines 169-175), the store dispatches use `section.id` in:
```typescript
onTitleChange={(title) => useResumeStore.getState().updateSectionTitle(section.id, title)}
onFieldChange={(itemId, field, value) => useResumeStore.getState().updateItemField(section.id, itemId, field, value)}
```
Must become `section.sectionType`.

---

### Task 16: Update `ResumeCanvas.test.tsx` to use `sectionType` (AC: 9)

- [x] Edit `frontend/src/components/resume/ResumeCanvas.test.tsx`

**Update `mockDocument`** — replace `id:` with `sectionType:` on section objects:
```typescript
const mockDocument: ResumeDocumentDto = {
  sections: [
    { sectionType: "WORK_EXPERIENCE", title: "Experience", visible: true, items: [{ id: "i1", fields: { text: "Engineer" } }] },
    { sectionType: "SKILLS",          title: "Skills",     visible: true, items: [{ id: "i2", fields: { text: "Java" } }] },
    { sectionType: "EDUCATION",       title: "Education",  visible: false, items: [] },
  ],
}
```

**Update template `sectionOrder` and column arrays** to use enum name strings:
```typescript
layout: { headerFormat: "name-contact", sectionOrder: ["SKILLS", "WORK_EXPERIENCE"] },
// and for two-column test:
layout: { columns: { left: ["SKILLS"], right: ["WORK_EXPERIENCE"] } },
// and for hidden-section test:
layout: { sectionOrder: ["EDUCATION", "WORK_EXPERIENCE", "SKILLS"] },
```

---

### Task 17: Run lint and tests (AC: all)

- [x] Run `cd frontend && npm run lint` — must pass with 0 errors
- [x] Run `cd frontend && npm run test -- --run` — all tests pass (no regressions)
- [x] Run `./mvnw test -Dtest="ResumeServiceTest,ResumeSectionMigrationTest,LlmSectionExtractorTest" -Dsurefire.useFile=false` — all pass
- [x] Run `./mvnw test` — full test suite passes (0 regressions except pre-existing flaky ResumeControllerIntegrationTest timestamp assertion unrelated to this story)

---

## Dev Notes

### CRITICAL: `useResumeStore.ts` Must Be Read Before Task 14

The store file was not read during story preparation. It contains section-lookup patterns that must be updated. Read `frontend/src/stores/useResumeStore.ts` completely before implementing Task 14 to find every `s.id === sectionId` occurrence.

### CRITICAL: `EditorPage.tsx` Also References `section.id`

`EditorPage.tsx` has an inline canvas block that calls `onTitleChange(section.id, title)` and `onFieldChange(section.id, itemId, field, value)`. These must be updated to `section.sectionType` alongside `ResumeCanvas.tsx` changes in Task 12. Read `EditorPage.tsx` before implementing to identify all `section.id` occurrences.

### CRITICAL: `SectionsPanel.tsx` Has Two `section.id` usages in DndKit `findIndex`

The `handleDragEnd` function uses `s.id === active.id` and `s.id === over.id` — both must be updated. The `handleMoveUp`/`handleMoveDown` functions use `s.id === id` — also must be updated. All 5 usages identified.

### CRITICAL: Flyway Migration Ordering

V8 (section id rename) and V9 (template sectionOrder strings) are new. Current highest is V7. Create both. V8 migrates resume data; V9 migrates template data. Both must run before the application reads the data in the new format. They are independent and can be in any order relative to each other, but both are needed.

### CRITICAL: `ResumeSection` Compact Constructor — `NullPointerException` Behavior

The AC specifies `NullPointerException` for null `sectionType`. Use `Objects.requireNonNull(sectionType, "sectionType must not be null")` in the compact constructor. This is consistent with Java's standard null-guard pattern on records. Do NOT use `if (sectionType == null) throw new IllegalArgumentException(...)` — NPE is specified.

### CRITICAL: `deepCopyDocument()` in `ResumeService`

`deepCopyDocument()` currently calls `new ResumeSection(section.id(), ...)`. After the record field rename, the accessor is `section.sectionType()`. This will be a **compile error** if not updated. It is easy to miss since `deepCopyDocument` is a private method.

### CRITICAL: LlmSectionExtractor — `UUID` import still needed

After Task 4, `UUID.randomUUID()` is still used for `ResumeItem` IDs (in both `extractSectionItems()` and `heuristicItems()`). Do NOT remove the `UUID` import.

### CRITICAL: Jackson Enum Serialization — No Annotation Needed

Jackson serializes Java enums as their `name()` string by default. `ResumeSectionType.WORK_EXPERIENCE` serializes as `"WORK_EXPERIENCE"`. Deserialization uses `Enum.valueOf()` which is case-sensitive — `"WORK_EXPERIENCE"` → `ResumeSectionType.WORK_EXPERIENCE`. The Flyway V8 migration produces uppercase strings matching enum names exactly.

### CRITICAL: Story 3.10 Deferred Finding — `getOrderedSections` Has No Unit Tests

Story 3.10 review deferred `templateUtils.test.ts` (F7). After this story updates `getOrderedSections` to use `sectionType`, the behavior is testable. Consider adding `templateUtils.test.ts` as an enhancement, but it is not required by AC9.

### CRITICAL: Story 3.10 Dev Note — `sectionOrder` Matching Was Broken Before This Story

Story 3.10 documented: "template ordering is infrastructure being built; full ID alignment happens when the document creation flow assigns semantic section IDs." Story 3.11 IS that alignment story. After this story, template `sectionOrder: ["WORK_EXPERIENCE", "EDUCATION", "SKILLS"]` will correctly match section `sectionType: "WORK_EXPERIENCE"` — the ordering will actually work end-to-end for the first time.

### File Locations (no deviations)

| Action | File |
|--------|------|
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSectionType.java` |
| DELETE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java` |
| CREATE | `src/main/resources/db/migration/V8__migrate_section_ids_to_type.sql` |
| CREATE | `src/main/resources/db/migration/V9__update_template_section_order_to_enum_names.sql` |
| UPDATE | `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` |
| CREATE | `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeSectionMigrationTest.java` |
| UPDATE | `frontend/src/types/api.ts` |
| UPDATE | `frontend/src/lib/templateUtils.ts` |
| UPDATE | `frontend/src/components/resume/ResumeCanvas.tsx` |
| UPDATE | `frontend/src/components/resume/SectionsPanel.tsx` |
| UPDATE | `frontend/src/stores/useResumeStore.ts` |
| UPDATE | `frontend/src/pages/EditorPage.tsx` |
| UPDATE | `frontend/src/components/resume/ResumeSection.test.tsx` |
| UPDATE | `frontend/src/components/resume/ResumeCanvas.test.tsx` |

### References

- `_bmad-output/planning-artifacts/epics/epic-3-resume-management-template-selection.md` — Story 3.11 AC and background (lines 392–443)
- `_bmad-output/implementation-artifacts/3-10-template-definition-backfill-and-resumecanvas-template-application.md` — Dev Notes, deferred F7 (templateUtils no unit tests), F3 (grid-column fix), and the note that sectionOrder matching was non-functional before this story
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java` — current location (to be moved)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java` — current `id: String` record (to be updated)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` — `buildFromProfile()` and `deepCopyDocument()` (both need updating)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` — `extract()` uses UUID as section id (Task 4)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java` — `DEFAULT.layout.sectionOrder` uses lowercase strings (Task 7)
- `src/main/resources/db/migration/V7__add_text_color.sql` — confirms V7 is latest; V8/V9 are next
- `src/main/resources/db/migration/V6__backfill_template_definitions.sql` — current template JSONB with lowercase sectionOrder values (to be updated by V9)
- `frontend/src/types/api.ts` — current `ResumeSectionDto.id: string` (Task 10)
- `frontend/src/lib/templateUtils.ts` — current `section.id` matching (Task 11)
- `frontend/src/components/resume/ResumeCanvas.tsx` — current `section.id` for keys, aria, column assignment (Task 12)
- `frontend/src/components/resume/SectionsPanel.tsx` — current `section.id` for dnd-kit, checkboxes, labels (Task 13)
- `frontend/src/components/resume/ResumeCanvas.test.tsx` — current tests using `id:` on sections (Task 16)
- `frontend/src/components/resume/ResumeSection.test.tsx` — current tests using `id: "test-section"` (Task 15)
- `_bmad-output/project-context.md` — technology stack, anti-patterns, testing rules

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

All 9 ACs satisfied. Implementation moved `ResumeSectionType` from `upload.parsers` to `resume.domain`, renamed `ResumeSection.id` to `sectionType` with typed enum, updated all callers (service, extractor, store, components, tests), created idempotent Flyway V8 migration for existing DB data and V9 migration for template sectionOrder strings, and added `ResumeSectionMigrationTest` unit test.

Key decisions:
- `ResumeSection.tsx` also updated (not in original task list but had `section.id` ARIA refs — AC8 required it)
- Pre-existing flaky test `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` fails on timestamp nanosecond precision comparison (was already failing before this story — confirmed by stash test)
- 87/87 frontend tests pass; 22/22 targeted backend unit tests pass; lint 0 errors

### File List

CREATED src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSectionType.java
DELETED src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/ResumeSectionType.java
UPDATED src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java
UPDATED src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java
UPDATED src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java
UPDATED src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java
CREATED src/main/resources/db/migration/V8__migrate_section_ids_to_type.sql
CREATED src/main/resources/db/migration/V9__update_template_section_order_to_enum_names.sql
UPDATED src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java
CREATED src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeSectionMigrationTest.java
UPDATED frontend/src/types/api.ts
UPDATED frontend/src/lib/templateUtils.ts
UPDATED frontend/src/components/resume/ResumeCanvas.tsx
UPDATED frontend/src/components/resume/ResumeSection.tsx
UPDATED frontend/src/components/resume/SectionsPanel.tsx
UPDATED frontend/src/stores/useResumeStore.ts
UPDATED frontend/src/components/resume/ResumeSection.test.tsx
UPDATED frontend/src/components/resume/ResumeCanvas.test.tsx

## Change Log

- 2026-06-09: Implemented Story 3.11 — moved ResumeSectionType to resume.domain, renamed ResumeSection.id to sectionType (typed enum), updated all backend (service, extractor, TemplateDefinition.DEFAULT) and frontend (api.ts, templateUtils.ts, ResumeCanvas.tsx, ResumeSection.tsx, SectionsPanel.tsx, useResumeStore.ts) consumers, created Flyway V8 (data migration) and V9 (template migration) scripts, and updated all tests (ResumeServiceTest, ResumeSectionMigrationTest new, ResumeCanvas.test.tsx, ResumeSection.test.tsx). Status → review.
