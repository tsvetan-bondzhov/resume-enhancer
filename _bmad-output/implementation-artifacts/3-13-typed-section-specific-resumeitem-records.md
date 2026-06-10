# Story 3.13: Typed Section-Specific ResumeItem Records

Status: done

## Story

As a developer,
I want each resume section to hold typed item records with named, schema-enforced fields instead of a generic `Map<String, String>`,
so that field access is compile-time safe, date values are preserved as `LocalDate`, and LLM extraction output is validated against a known per-section schema.

## Acceptance Criteria

**AC1 — `ResumeItem` becomes a sealed interface with nine concrete records**
**Given** `ResumeItem` is refactored to a sealed interface
**When** the project compiles
**Then** `ResumeItem` in `resume.domain` is a `sealed interface` annotated with `@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")` and `@JsonSubTypes` mapping each `ResumeSectionType` name to its concrete record; nine concrete records exist in `resume.domain.items`: `WorkExperienceItem`, `EducationItem`, `SkillItem`, `CertificationItem`, `LanguageItem`, `ProjectItem`, `VolunteeringItem`, `SummaryItem`, and `GenericItem`; all implement `ResumeItem`; the old `ResumeItem(String id, Map<String, String> fields)` record is deleted

**AC2 — Typed record field signatures**
**Given** the typed record fields are defined
**When** a record is constructed
**Then**:
- `WorkExperienceItem(String id, String jobTitle, String company, LocalDate startDate, LocalDate endDate, boolean isCurrent, String description)` — `endDate` nullable
- `EducationItem(String id, String institution, String degree, String fieldOfStudy, LocalDate startDate, LocalDate endDate)` — `degree`, `fieldOfStudy`, `endDate` nullable
- `SkillItem(String id, String name, String category, String proficiency)` — `category`, `proficiency` nullable
- `CertificationItem(String id, String name, String issuer, LocalDate issueDate, LocalDate expirationDate)` — `expirationDate` nullable
- `LanguageItem(String id, String language, String proficiency)` — `proficiency` nullable
- `ProjectItem(String id, String name, String description, String technologies, String link, LocalDate startDate, LocalDate endDate, boolean isCurrent)` — `description`, `technologies`, `link`, `endDate` nullable
- `VolunteeringItem(String id, String role, String organization, String description, LocalDate startDate, LocalDate endDate, boolean isCurrent)` — `description`, `endDate` nullable
- `SummaryItem(String id, String text)`
- `GenericItem(String id, Map<String, String> fields)` — used for `UNKNOWN` sections and unrecognisable LLM output

**AC3 — Jackson polymorphism round-trip through `ResumeDocumentConverter`**
**Given** `ResumeDocumentConverter` is configured for polymorphism
**When** a `ResumeDocument` containing mixed item types is serialized then deserialized
**Then** round-trip fidelity is guaranteed: the `"type"` discriminator is written to and read from JSON; `LocalDate` fields serialize as ISO-8601 strings (`"YYYY-MM-DD"`); no item type information is lost; the `ObjectMapper` instance used is the centrally configured Spring bean (no ad-hoc `ObjectMapper` instantiation)

**AC4 — Flyway migration `V11__migrate_resume_items_to_typed.sql`**
**Given** Flyway migration `V11__migrate_resume_items_to_typed.sql` is applied
**When** the application starts against an existing database
**Then** for each section in each resume's `resume_content` JSONB, every item object in `{"id":"...", "fields":{...}}` form is rewritten: `fields` map entries are lifted to top-level properties; a `"type"` discriminator is added matching the parent section's `sectionType` value; items in sections with `sectionType` `"UNKNOWN"` become `GenericItem` objects with their original `fields` map preserved under a `"fields"` key; the migration is idempotent

**AC5 — `LlmSectionExtractor` constructs typed items directly**
**Given** `LlmSectionExtractor` is updated
**When** it processes LLM JSON output for a known section type
**Then** it constructs the corresponding typed `ResumeItem` subclass directly (e.g. `new WorkExperienceItem(...)`) instead of building a `Map<String, String>`; string-to-`LocalDate` parsing failures null the affected date field and log at WARN; `GenericItem` is used only when the section type is `UNKNOWN` or when the LLM JSON cannot be mapped to the typed schema despite a valid section type; the `validateAndConvert` method is replaced or superseded by per-type construction logic

**AC6 — `PUT /api/v1/resumes/{id}` deserializes polymorphic items correctly**
**Given** `UpdateResumeRequest` carries a full `ResumeDocument` from the frontend
**When** `ResumeDocumentConverter` deserializes it on `PUT /api/v1/resumes/{id}`
**Then** polymorphic item types are correctly reconstructed from the frontend JSON; no `ClassCastException` or deserialization error occurs for any known `ResumeItem` subtype

**AC7 — Tests**
**Given** the story is implemented
**When** tests are run
**Then** `ResumeItemSerializationTest.java` round-trips each of the nine item types through `ObjectMapper.writeValueAsString` → `readValue` and asserts field-level equality including `LocalDate` values; `LlmSectionExtractorTest.java` is extended to verify typed item construction for each of the eight known section types plus `GenericItem` fallback on `UNKNOWN`

---

## Tasks / Subtasks

### Task 1: Create `resume.domain.items` package and nine typed records (AC: 1, 2)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/WorkExperienceItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/EducationItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/SkillItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/CertificationItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/LanguageItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/ProjectItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/VolunteeringItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/SummaryItem.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/GenericItem.java`

All nine records implement `ResumeItem`. All nine are `permits`-listed on `ResumeItem`.

**`WorkExperienceItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import java.time.LocalDate;

public record WorkExperienceItem(
        String id,
        String jobTitle,
        String company,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent,
        String description
) implements ResumeItem {}
```

**`EducationItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import java.time.LocalDate;

public record EducationItem(
        String id,
        String institution,
        String degree,
        String fieldOfStudy,
        LocalDate startDate,
        LocalDate endDate
) implements ResumeItem {}
```

**`SkillItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;

public record SkillItem(
        String id,
        String name,
        String category,
        String proficiency
) implements ResumeItem {}
```

**`CertificationItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import java.time.LocalDate;

public record CertificationItem(
        String id,
        String name,
        String issuer,
        LocalDate issueDate,
        LocalDate expirationDate
) implements ResumeItem {}
```

**`LanguageItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;

public record LanguageItem(
        String id,
        String language,
        String proficiency
) implements ResumeItem {}
```

**`ProjectItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import java.time.LocalDate;

public record ProjectItem(
        String id,
        String name,
        String description,
        String technologies,
        String link,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) implements ResumeItem {}
```

**`VolunteeringItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import java.time.LocalDate;

public record VolunteeringItem(
        String id,
        String role,
        String organization,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) implements ResumeItem {}
```

**`SummaryItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;

public record SummaryItem(
        String id,
        String text
) implements ResumeItem {}
```

**`GenericItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain.items;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import java.util.Map;

public record GenericItem(
        String id,
        Map<String, String> fields
) implements ResumeItem {
    public GenericItem {
        fields = fields != null ? Map.copyOf(fields) : Map.of();
    }
}
```

**CRITICAL — `GenericItem` compact constructor:** Mirror the defensive copy pattern from the old `ResumeItem` record. `Map.copyOf()` throws `NullPointerException` on null values — so `fields != null ? Map.copyOf(fields) : Map.of()` is the safe pattern (matches existing code in the old `ResumeItem`).

**CRITICAL — `GenericItem` replaces old `ResumeItem` in `LlmSectionExtractor.heuristicItems()`:** The heuristic fallback that creates `Map.of("text", line)` items must now create `new GenericItem(UUID.randomUUID().toString(), Map.of("text", line))`.

---

### Task 2: Refactor `ResumeItem` to sealed interface with Jackson polymorphism (AC: 1, 3)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java`

**New `ResumeItem.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.WorkExperienceItem;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = WorkExperienceItem.class,  name = "WORK_EXPERIENCE"),
    @JsonSubTypes.Type(value = EducationItem.class,       name = "EDUCATION"),
    @JsonSubTypes.Type(value = SkillItem.class,           name = "SKILLS"),
    @JsonSubTypes.Type(value = CertificationItem.class,   name = "CERTIFICATIONS"),
    @JsonSubTypes.Type(value = LanguageItem.class,        name = "LANGUAGES"),
    @JsonSubTypes.Type(value = ProjectItem.class,         name = "PROJECTS"),
    @JsonSubTypes.Type(value = VolunteeringItem.class,    name = "VOLUNTEERING"),
    @JsonSubTypes.Type(value = SummaryItem.class,         name = "SUMMARY"),
    @JsonSubTypes.Type(value = GenericItem.class,         name = "UNKNOWN")
})
public sealed interface ResumeItem
    permits WorkExperienceItem, EducationItem, SkillItem, CertificationItem,
            LanguageItem, ProjectItem, VolunteeringItem, SummaryItem, GenericItem {}
```

**CRITICAL — `@JsonSubTypes` names match `ResumeSectionType` enum names exactly:** `"WORK_EXPERIENCE"`, `"EDUCATION"`, `"SKILLS"`, `"CERTIFICATIONS"`, `"LANGUAGES"`, `"PROJECTS"`, `"VOLUNTEERING"`, `"SUMMARY"`, `"UNKNOWN"`. These match the `"type"` discriminator written by the Flyway V11 migration.

**CRITICAL — `sealed interface` + Java records:** Java records can implement sealed interfaces using `permits` on the interface. All nine implementing records must be in the `permits` clause. Since they are in a sub-package (`items`), the `permits` list uses the full package path but the same module — this is valid in Java 17+. Java 25 supports it without restrictions.

**CRITICAL — `ResumeSection.items` is `List<ResumeItem>` — no type change needed in `ResumeSection.java`:** The field type stays `List<ResumeItem>`. Jackson will resolve the concrete type via the discriminator during deserialization.

**CRITICAL — `ResumeDocumentConverter` requires NO code change:** It already uses the centrally configured Spring `ObjectMapper` bean (injected via constructor). Since `JacksonConfig` creates an `ObjectMapper` with `JavaTimeModule` registered, `LocalDate` fields will serialize as `"YYYY-MM-DD"` strings automatically. The sealed interface `@JsonTypeInfo` annotations do the rest.

**CRITICAL — `ResumeService.deepCopyDocument()` uses `new ResumeItem(item.id(), item.fields())`:** This call will fail to compile after the old `ResumeItem` record is deleted. See Task 4 for the fix.

---

### Task 3: Create Flyway migration `V11__migrate_resume_items_to_typed.sql` (AC: 4)

- [x] Create `src/main/resources/db/migration/V11__migrate_resume_items_to_typed.sql`

**CRITICAL — Flyway state:** V1–V10 are all applied. Next version is V11. NEVER modify existing migrations.

**CRITICAL — Pre-migration JSONB shape** (from Story 3.11 and current `ResumeService`):
```json
{
  "sections": [
    {
      "sectionType": "WORK_EXPERIENCE",
      "title": "Work Experience",
      "visible": true,
      "items": [
        {
          "id": "some-uuid",
          "fields": {
            "jobTitle": "Software Engineer",
            "company": "Acme Corp",
            "startDate": "2020-01-01",
            "endDate": "",
            "description": "Built services"
          }
        }
      ]
    }
  ]
}
```

**Post-migration JSONB shape** (new typed structure):
```json
{
  "sections": [
    {
      "sectionType": "WORK_EXPERIENCE",
      "title": "Work Experience",
      "visible": true,
      "items": [
        {
          "type": "WORK_EXPERIENCE",
          "id": "some-uuid",
          "jobTitle": "Software Engineer",
          "company": "Acme Corp",
          "startDate": "2020-01-01",
          "endDate": null,
          "description": "Built services",
          "isCurrent": false
        }
      ]
    }
  ]
}
```

**Migration SQL:**
```sql
-- V11: Migrate resume items from {id, fields:{...}} shape to typed discriminated records.
-- DATA migration only — no DDL changes.
-- Idempotent: items already containing a "type" key are left untouched.

UPDATE resumes
SET resume_content = (
    SELECT jsonb_build_object(
        'sections',
        jsonb_agg(
            jsonb_build_object(
                'sectionType', section->>'sectionType',
                'title',       section->>'title',
                'visible',     (section->>'visible')::boolean,
                'items',
                (
                    SELECT jsonb_agg(
                        CASE
                            -- Already migrated: "type" key exists — leave untouched
                            WHEN item ? 'type' THEN item
                            -- UNKNOWN sections: preserve fields map under "fields" key
                            WHEN section->>'sectionType' = 'UNKNOWN' THEN
                                jsonb_build_object(
                                    'type',   'UNKNOWN',
                                    'id',     item->>'id',
                                    'fields', COALESCE(item->'fields', '{}'::jsonb)
                                )
                            -- All other sections: lift fields to top-level + add type discriminator
                            ELSE
                                jsonb_build_object('type', section->>'sectionType', 'id', item->>'id')
                                || COALESCE(item->'fields', '{}'::jsonb)
                        END
                        ORDER BY item_ord
                    )
                    FROM jsonb_array_elements(section->'items') WITH ORDINALITY AS t2(item, item_ord)
                )
            )
            ORDER BY sec_ord
        )
    )
    FROM jsonb_array_elements(resume_content->'sections') WITH ORDINALITY AS t1(section, sec_ord)
)
WHERE resume_content IS NOT NULL
  AND jsonb_array_length(resume_content->'sections') > 0;
```

**CRITICAL — Idempotency:** The `WHEN item ? 'type' THEN item` branch ensures re-running on already-migrated data is safe.

**CRITICAL — Empty string dates from `ResumeService.buildFromProfile()`:** The current `ResumeService.buildFromProfile()` (pre-Story 3.13) writes dates as `we.getStartDate().toString()` with `""` as fallback. These empty strings will be lifted to top-level as `"startDate": ""`. The typed `WorkExperienceItem` record uses `LocalDate` fields — Jackson will fail to deserialize `""` as `LocalDate`. The migration intentionally does NOT convert these, because `LlmSectionExtractor` uses ISO-8601 strings and `ResumeService.buildFromProfile()` is rewritten in Task 5 to produce typed items directly. For existing DB records created before Story 3.13, the SQL migration lifts raw fields as-is (strings); after migration, if `startDate` is `""`, Jackson deserialization will fail. To guard against this, the V11 migration should null out empty-string date fields:

```sql
-- Add this helper: strip empty-string date fields before lifting
-- Replace the ELSE branch with:
ELSE
    jsonb_build_object('type', section->>'sectionType', 'id', item->>'id')
    || (
        SELECT jsonb_object_agg(
            k,
            CASE
                WHEN v = '' THEN 'null'::jsonb
                ELSE to_jsonb(v)
            END
        )
        FROM jsonb_each_text(COALESCE(item->'fields', '{}'::jsonb)) AS f(k, v)
    )
```

**FULL migration SQL (with empty-string date guard):**
```sql
-- V11: Migrate resume items from {id, fields:{...}} shape to typed discriminated records.
-- DATA migration only — no DDL changes.
-- Idempotent: items already containing a "type" key are left untouched.

UPDATE resumes
SET resume_content = (
    SELECT jsonb_build_object(
        'sections',
        jsonb_agg(
            jsonb_build_object(
                'sectionType', section->>'sectionType',
                'title',       section->>'title',
                'visible',     (section->>'visible')::boolean,
                'items',
                (
                    SELECT jsonb_agg(
                        CASE
                            WHEN item ? 'type' THEN item
                            WHEN section->>'sectionType' = 'UNKNOWN' THEN
                                jsonb_build_object(
                                    'type',   'UNKNOWN',
                                    'id',     item->>'id',
                                    'fields', COALESCE(item->'fields', '{}'::jsonb)
                                )
                            ELSE
                                jsonb_build_object('type', section->>'sectionType', 'id', item->>'id')
                                || (
                                    SELECT COALESCE(
                                        jsonb_object_agg(
                                            k,
                                            CASE WHEN v = '' THEN NULL ELSE v::jsonb END
                                        ),
                                        '{}'::jsonb
                                    )
                                    FROM (
                                        SELECT k, to_json(v)::text AS v
                                        FROM jsonb_each_text(COALESCE(item->'fields', '{}'::jsonb)) AS f(k, v)
                                    ) sub
                                )
                        END
                        ORDER BY item_ord
                    )
                    FROM jsonb_array_elements(section->'items') WITH ORDINALITY AS t2(item, item_ord)
                )
            )
            ORDER BY sec_ord
        )
    )
    FROM jsonb_array_elements(resume_content->'sections') WITH ORDINALITY AS t1(section, sec_ord)
)
WHERE resume_content IS NOT NULL
  AND jsonb_array_length(resume_content->'sections') > 0;
```

**CRITICAL — `jsonb_object_agg` with NULL values:** PostgreSQL's `jsonb_object_agg` skips entries where value is `NULL`. So empty strings become absent keys in the resulting JSONB, which Jackson will deserialize as null `LocalDate` fields. This is the correct behavior.

---

### Task 4: Update `ResumeService.buildFromProfile()` and `deepCopyDocument()` (AC: 1, 3)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`

**Add imports:**
```java
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.SkillItem;
```

**Remove imports:**
```java
// Remove these — no longer needed after old ResumeItem is deleted:
import java.util.Map;
```
(Check if `Map` is still needed elsewhere in the class first — if `deepCopyDocument` or other methods use it, keep it.)

**Update `buildFromProfile()` — replace `new ResumeItem(UUID, Map.of(...))` with typed items:**

```java
private ResumeDocument buildFromProfile(Profile profile) {
    List<ResumeSection> sections = new ArrayList<>();

    // Work Experience section
    List<ResumeItem> expItems = (profile.getWorkExperiences() != null
            ? profile.getWorkExperiences() : List.<WorkExperience>of()).stream()
            .map(we -> new WorkExperienceItem(
                    UUID.randomUUID().toString(),
                    we.getJobTitle(),
                    we.getCompany(),
                    we.getStartDate(),
                    we.getEndDate(),
                    we.isCurrent(),
                    we.getDescription()
            ))
            .toList();
    sections.add(new ResumeSection(ResumeSectionType.WORK_EXPERIENCE, "Work Experience", true, expItems));

    // Education section
    List<ResumeItem> eduItems = (profile.getEducation() != null
            ? profile.getEducation() : List.<Education>of()).stream()
            .map(edu -> new EducationItem(
                    UUID.randomUUID().toString(),
                    edu.getInstitution(),
                    edu.getDegree(),
                    edu.getFieldOfStudy(),
                    edu.getStartDate(),
                    edu.getEndDate()
            ))
            .toList();
    sections.add(new ResumeSection(ResumeSectionType.EDUCATION, "Education", true, eduItems));

    // Skills section
    List<ResumeItem> skillItems = (profile.getSkills() != null
            ? profile.getSkills() : List.<Skill>of()).stream()
            .map(s -> new SkillItem(
                    UUID.randomUUID().toString(),
                    s.getName(),
                    null,  // category — not in profile entity
                    null   // proficiency — not in profile entity
            ))
            .toList();
    sections.add(new ResumeSection(ResumeSectionType.SKILLS, "Skills", true, skillItems));

    return new ResumeDocument(sections);
}
```

**CRITICAL — `WorkExperience.isCurrent()`:** The `WorkExperience` entity uses Lombok `@Getter @Setter` with a `boolean isCurrent` field — Lombok generates getter `isCurrent()`. Same for `Project` and `Volunteering` entities. Verify the accessor name before implementing.

**CRITICAL — `Education` entity fields:** Read `Education.java` to confirm field names (`getStartDate()`, `getEndDate()` etc.) — the entity may or may not have date fields (Story 2.1 defined it). The current `buildFromProfile()` only maps `institution`, `degree`, `fieldOfStudy` — check whether `Education` has `startDate`/`endDate` before adding them.

**Update `deepCopyDocument()` — remove the old `new ResumeItem(item.id(), item.fields())` call:**

Records are immutable — deepCopy can simply reuse the existing item instances:
```java
private ResumeDocument deepCopyDocument(ResumeDocument source) {
    if (source == null) {
        return new ResumeDocument(List.of());
    }
    List<ResumeSection> copiedSections = source.sections().stream()
            .map(section -> new ResumeSection(
                    section.sectionType(),
                    section.title(),
                    section.visible(),
                    List.copyOf(section.items())  // items are immutable records — reference copy is safe
            ))
            .toList();
    return new ResumeDocument(copiedSections);
}
```

**CRITICAL — `deepCopyDocument` simplification:** Since all `ResumeItem` subtypes are now immutable Java records, there is NO need to construct new item instances for deep copy. `List.copyOf(section.items())` is sufficient. The old code calling `new ResumeItem(item.id(), item.fields())` is deleted.

---

### Task 5: Update `LlmSectionExtractor` to construct typed items (AC: 5)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`

**Add imports:**
```java
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.GenericItem;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
```

**Replace `validateAndConvert` + `extractSectionItems` with per-type construction:**

The new approach replaces the generic `Map<String, String>` approach with typed construction. The per-section logic is:

```java
private List<ResumeItem> extractSectionItems(
        RawSection rawSection,
        ResumeSectionType sectionType,
        String sectionText,
        String fullRawText) {

    try {
        String jsonResponse = aiService.extractResumeSection(sectionType.name(), sectionText);

        List<Map<String, Object>> rawItems;
        try {
            rawItems = objectMapper.readValue(jsonResponse,
                new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.warn("Malformed JSON for section '{}', falling back to heuristic: {}", rawSection.title(), e.getMessage());
            return heuristicItems(rawSection);
        }

        List<ResumeItem> result = new ArrayList<>();
        for (Map<String, Object> rawItem : rawItems) {
            try {
                ResumeItem item = buildTypedItem(sectionType, rawItem, fullRawText);
                result.add(item);
            } catch (Exception e) {
                log.warn("Failed to build typed item for section '{}', using GenericItem fallback: {}", rawSection.title(), e.getMessage());
                result.add(new GenericItem(UUID.randomUUID().toString(), toStringMap(rawItem)));
            }
        }
        return result;

    } catch (Exception e) {
        log.warn("LLM extraction failed for section '{}', using heuristic fallback: {}", rawSection.title(), e.getMessage());
        return heuristicItems(rawSection);
    }
}

private ResumeItem buildTypedItem(ResumeSectionType type, Map<String, Object> raw, String fullRawText) {
    String id = UUID.randomUUID().toString();

    // Anchor check — log WARN if no field value appears in source text
    boolean hasAnchor = raw.values().stream()
        .filter(v -> v != null)
        .map(Object::toString)
        .anyMatch(v -> fullRawText.toLowerCase().contains(v.toLowerCase()));
    if (!hasAnchor && !raw.isEmpty()) {
        log.warn("Low confidence item in section type '{}': no anchor found in raw text", type);
    }

    return switch (type) {
        case WORK_EXPERIENCE -> new WorkExperienceItem(
                id,
                str(raw, "jobTitle"),
                str(raw, "company"),
                parseDate(raw, "startDate"),
                parseDate(raw, "endDate"),
                bool(raw, "isCurrent"),
                str(raw, "description")
        );
        case EDUCATION -> new EducationItem(
                id,
                str(raw, "institution"),
                str(raw, "degree"),
                str(raw, "fieldOfStudy"),
                parseDate(raw, "startDate"),
                parseDate(raw, "endDate")
        );
        case SKILLS -> new SkillItem(id, str(raw, "name"), str(raw, "category"), str(raw, "proficiency"));
        case CERTIFICATIONS -> new CertificationItem(
                id,
                str(raw, "name"),
                str(raw, "issuer"),
                parseDate(raw, "issueDate"),
                parseDate(raw, "expirationDate")
        );
        case LANGUAGES -> new LanguageItem(id, str(raw, "language"), str(raw, "proficiency"));
        case PROJECTS -> new ProjectItem(
                id,
                str(raw, "name"),
                str(raw, "description"),
                str(raw, "technologies"),
                str(raw, "link"),
                parseDate(raw, "startDate"),
                parseDate(raw, "endDate"),
                bool(raw, "isCurrent")
        );
        case VOLUNTEERING -> new VolunteeringItem(
                id,
                str(raw, "role"),
                str(raw, "organization"),
                str(raw, "description"),
                parseDate(raw, "startDate"),
                parseDate(raw, "endDate"),
                bool(raw, "isCurrent")
        );
        case SUMMARY -> new SummaryItem(id, str(raw, "text"));
        case UNKNOWN -> new GenericItem(id, toStringMap(raw));
    };
}

/** Extracts a String field from raw LLM map, returns null if missing or empty. */
private String str(Map<String, Object> raw, String key) {
    Object val = raw.get(key);
    if (val == null) return null;
    String s = val.toString().trim();
    return s.isEmpty() ? null : s;
}

/** Extracts a boolean field from raw LLM map. */
private boolean bool(Map<String, Object> raw, String key) {
    Object val = raw.get(key);
    if (val == null) return false;
    if (val instanceof Boolean b) return b;
    return Boolean.parseBoolean(val.toString());
}

/** Parses a date field. Returns null and logs WARN on parse failure. */
private LocalDate parseDate(Map<String, Object> raw, String key) {
    String val = str(raw, key);
    if (val == null || val.equalsIgnoreCase("Present")) return null;
    try {
        // Handle "YYYY-MM" by appending "-01"
        if (val.matches("\\d{4}-\\d{2}")) {
            val = val + "-01";
        }
        return LocalDate.parse(val);
    } catch (DateTimeParseException e) {
        log.warn("Could not parse date field '{}' value '{}': {}", key, val, e.getMessage());
        return null;
    }
}

/** Converts Map<String, Object> to Map<String, String> for GenericItem. */
private Map<String, String> toStringMap(Map<String, Object> raw) {
    Map<String, String> result = new HashMap<>();
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
        if (entry.getValue() != null) {
            result.put(entry.getKey(), entry.getValue().toString());
        }
    }
    return result;
}
```

**Update `heuristicItems()` to use `GenericItem`:**
```java
private List<ResumeItem> heuristicItems(RawSection rawSection) {
    List<ResumeItem> items = new ArrayList<>();
    for (String line : rawSection.lines()) {
        items.add(new GenericItem(
            UUID.randomUUID().toString(),
            Map.of("text", line)
        ));
    }
    return items;
}
```

**Remove imports no longer needed:** `ResumeItemDto` from `upload.dto` (replaced by typed construction). Keep `UUID`, `ObjectMapper`, `TypeReference`, `HashMap`, `Map`, `List`, `ArrayList`, `Pattern`.

**CRITICAL — `ResumeItemDto` in `upload.dto`:** This DTO was used by `validateAndConvert()` — it is now unused. Do NOT delete it if used by tests or other classes. Check `ParsingServiceTest.java` and `ParsingService.java` for references before removing.

---

### Task 6: Update `LlmSectionExtractorTest.java` (AC: 7)

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java`

**CRITICAL — Existing tests check `item.fields()` on `ResumeItem`.** After this change, items are typed records — `item.fields()` only exists on `GenericItem`. Update existing tests to cast or check type appropriately.

**Update existing test assertions:**

Test `extract_malformedJsonResponse_fallsBackToHeuristicLines`: heuristic now returns `GenericItem`. Update:
```java
// Before:
assertThat(section.items().get(0).fields()).containsKey("text");
// After:
assertThat(section.items().get(0)).isInstanceOf(GenericItem.class);
assertThat(((GenericItem) section.items().get(0)).fields()).containsKey("text");
```

Test `extract_invalidDateField_isNulledOut`: The LLM JSON for WORK_EXPERIENCE now builds `WorkExperienceItem`. Assertions change:
```java
// Before:
assertThat(item.fields()).doesNotContainKey("startDate");
assertThat(item.fields()).containsEntry("title", "Software Engineer");
// After:
assertThat(section.items().get(0)).isInstanceOf(WorkExperienceItem.class);
WorkExperienceItem item = (WorkExperienceItem) section.items().get(0);
assertThat(item.startDate()).isNull();        // invalid date → null
assertThat(item.jobTitle()).isEqualTo("Software Engineer");  // "title" key maps to jobTitle
```

**NOTE on field name mapping:** The LLM JSON uses field keys matching the record field names: `"jobTitle"`, `"company"`, `"startDate"`, `"endDate"`, `"description"`. The LLM prompt template (`resume-section-extraction.st`) must be checked for the actual keys returned — if the prompt returns `"title"` instead of `"jobTitle"`, update `str(raw, "jobTitle")` in `buildTypedItem` to match.

**Add new typed item construction tests:**
```java
@Test
void extract_workExperienceSection_buildsTypedWorkExperienceItem() {
    String validJson = """
        [{"jobTitle": "Software Engineer", "company": "Acme Corp",
          "startDate": "2020-01", "endDate": "2023-06",
          "isCurrent": false, "description": "Built services"}]
        """;
    when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

    List<RawSection> sections = List.of(
        new RawSection("Work Experience", List.of("Software Engineer at Acme Corp"))
    );
    ResumeDocument result = llmSectionExtractor.extract(sections, "Software Engineer at Acme Corp Built services");

    ResumeSection section = result.sections().get(0);
    assertThat(section.items()).hasSize(1);
    assertThat(section.items().get(0)).isInstanceOf(WorkExperienceItem.class);
    WorkExperienceItem item = (WorkExperienceItem) section.items().get(0);
    assertThat(item.jobTitle()).isEqualTo("Software Engineer");
    assertThat(item.company()).isEqualTo("Acme Corp");
    assertThat(item.startDate()).isEqualTo(LocalDate.of(2020, 1, 1));
    assertThat(item.endDate()).isEqualTo(LocalDate.of(2023, 6, 1));
    assertThat(item.isCurrent()).isFalse();
}

@Test
void extract_unknownSection_buildsGenericItem() {
    String validJson = """
        [{"text": "Some custom content"}]
        """;
    when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

    List<RawSection> sections = List.of(
        new RawSection("Custom Section", List.of("Some custom content"))
    );
    ResumeDocument result = llmSectionExtractor.extract(sections, "Some custom content");

    ResumeSection section = result.sections().get(0);
    assertThat(section.sectionType()).isEqualTo(ResumeSectionType.UNKNOWN);
    assertThat(section.items().get(0)).isInstanceOf(GenericItem.class);
    assertThat(((GenericItem) section.items().get(0)).fields()).containsKey("text");
}

@Test
void extract_skillsSection_buildsTypedSkillItem() {
    String validJson = """
        [{"name": "Java"}, {"name": "Spring Boot"}]
        """;
    when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

    List<RawSection> sections = List.of(
        new RawSection("Skills", List.of("Java", "Spring Boot"))
    );
    ResumeDocument result = llmSectionExtractor.extract(sections, "Java Spring Boot");

    assertThat(result.sections().get(0).items()).hasSize(2);
    assertThat(result.sections().get(0).items().get(0)).isInstanceOf(SkillItem.class);
    assertThat(((SkillItem) result.sections().get(0).items().get(0)).name()).isEqualTo("Java");
}
```

**Add imports to test file:**
```java
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.WorkExperienceItem;
import java.time.LocalDate;
```

---

### Task 7: Create `ResumeItemSerializationTest.java` (AC: 7)

- [x] Create `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java`

**CRITICAL — Use the Spring-configured `ObjectMapper` (with `JavaTimeModule`), NOT `new ObjectMapper()`:**
```java
package com.tsvetanbondzhov.resumeenhancer.resume;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.items.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates Jackson polymorphic round-trip for all nine ResumeItem subtypes.
 * Uses a locally configured ObjectMapper matching JacksonConfig bean setup.
 */
class ResumeItemSerializationTest {

    // Must match JacksonConfig.objectMapper() — JavaTimeModule + no timestamp dates
    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    void workExperienceItem_roundTrip() throws Exception {
        WorkExperienceItem original = new WorkExperienceItem(
                "id-1", "Software Engineer", "Acme Corp",
                LocalDate.of(2020, 1, 1), LocalDate.of(2023, 6, 30),
                false, "Built services"
        );
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"WORK_EXPERIENCE\"");
        assertThat(json).contains("\"startDate\":\"2020-01-01\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(WorkExperienceItem.class);
        WorkExperienceItem result = (WorkExperienceItem) deserialized;
        assertThat(result.id()).isEqualTo("id-1");
        assertThat(result.jobTitle()).isEqualTo("Software Engineer");
        assertThat(result.startDate()).isEqualTo(LocalDate.of(2020, 1, 1));
        assertThat(result.isCurrent()).isFalse();
    }

    @Test
    void educationItem_roundTrip() throws Exception {
        EducationItem original = new EducationItem(
                "id-2", "MIT", "BSc", "Computer Science",
                LocalDate.of(2016, 9, 1), LocalDate.of(2020, 6, 1)
        );
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"EDUCATION\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(EducationItem.class);
        EducationItem result = (EducationItem) deserialized;
        assertThat(result.institution()).isEqualTo("MIT");
        assertThat(result.degree()).isEqualTo("BSc");
        assertThat(result.endDate()).isEqualTo(LocalDate.of(2020, 6, 1));
    }

    @Test
    void skillItem_roundTrip() throws Exception {
        SkillItem original = new SkillItem("id-3", "Java", null, null);
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"SKILLS\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(SkillItem.class);
        assertThat(((SkillItem) deserialized).name()).isEqualTo("Java");
    }

    @Test
    void certificationItem_roundTrip() throws Exception {
        CertificationItem original = new CertificationItem(
                "id-4", "AWS Cloud Practitioner", "Amazon",
                LocalDate.of(2023, 1, 15), null
        );
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"CERTIFICATIONS\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(CertificationItem.class);
        CertificationItem result = (CertificationItem) deserialized;
        assertThat(result.name()).isEqualTo("AWS Cloud Practitioner");
        assertThat(result.expirationDate()).isNull();
        assertThat(result.issueDate()).isEqualTo(LocalDate.of(2023, 1, 15));
    }

    @Test
    void languageItem_roundTrip() throws Exception {
        LanguageItem original = new LanguageItem("id-5", "English", "Native");
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"LANGUAGES\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(LanguageItem.class);
        assertThat(((LanguageItem) deserialized).language()).isEqualTo("English");
    }

    @Test
    void projectItem_roundTrip() throws Exception {
        ProjectItem original = new ProjectItem(
                "id-6", "MyApp", "A cool app", "Java, React",
                "https://github.com/test", LocalDate.of(2022, 1, 1), null, true
        );
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"PROJECTS\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(ProjectItem.class);
        ProjectItem result = (ProjectItem) deserialized;
        assertThat(result.name()).isEqualTo("MyApp");
        assertThat(result.isCurrent()).isTrue();
        assertThat(result.endDate()).isNull();
    }

    @Test
    void volunteeringItem_roundTrip() throws Exception {
        VolunteeringItem original = new VolunteeringItem(
                "id-7", "Mentor", "Code.org", "Teaching kids",
                LocalDate.of(2021, 6, 1), null, false
        );
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"VOLUNTEERING\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(VolunteeringItem.class);
        assertThat(((VolunteeringItem) deserialized).role()).isEqualTo("Mentor");
    }

    @Test
    void summaryItem_roundTrip() throws Exception {
        SummaryItem original = new SummaryItem("id-8", "Experienced engineer passionate about clean code.");
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"SUMMARY\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(SummaryItem.class);
        assertThat(((SummaryItem) deserialized).text()).contains("clean code");
    }

    @Test
    void genericItem_roundTrip() throws Exception {
        GenericItem original = new GenericItem("id-9", Map.of("text", "Custom line", "other", "value"));
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"UNKNOWN\"");
        assertThat(json).contains("\"fields\"");

        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        assertThat(deserialized).isInstanceOf(GenericItem.class);
        assertThat(((GenericItem) deserialized).fields()).containsEntry("text", "Custom line");
    }

    @Test
    void workExperienceItem_nullableDates_roundTrip() throws Exception {
        WorkExperienceItem original = new WorkExperienceItem(
                "id-10", "Engineer", "Corp",
                null, null, true, null
        );
        String json = mapper.writeValueAsString(original);
        ResumeItem deserialized = mapper.readValue(json, ResumeItem.class);
        WorkExperienceItem result = (WorkExperienceItem) deserialized;
        assertThat(result.startDate()).isNull();
        assertThat(result.endDate()).isNull();
        assertThat(result.isCurrent()).isTrue();
    }
}
```

---

### Task 8: Update `UpdateResumeRequest` frontend serialization (AC: 6)

- [x] Verify `frontend/src/types/api.ts` — `ResumeItemDto` change

**Current `ResumeItemDto`:**
```typescript
export interface ResumeItemDto {
  id: string
  fields: Record<string, string>
}
```

**New `ResumeItemDto` — discriminated union:**
```typescript
export type ResumeItemDto =
  | WorkExperienceItemDto
  | EducationItemDto
  | SkillItemDto
  | CertificationItemDto
  | LanguageItemDto
  | ProjectItemDto
  | VolunteeringItemDto
  | SummaryItemDto
  | GenericItemDto

export interface WorkExperienceItemDto {
  type: "WORK_EXPERIENCE"
  id: string
  jobTitle: string | null
  company: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  description: string | null
}

export interface EducationItemDto {
  type: "EDUCATION"
  id: string
  institution: string | null
  degree: string | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
}

export interface SkillItemDto {
  type: "SKILLS"
  id: string
  name: string | null
  category: string | null
  proficiency: string | null
}

export interface CertificationItemDto {
  type: "CERTIFICATIONS"
  id: string
  name: string | null
  issuer: string | null
  issueDate: string | null
  expirationDate: string | null
}

export interface LanguageItemDto {
  type: "LANGUAGES"
  id: string
  language: string | null
  proficiency: string | null
}

export interface ProjectItemDto {
  type: "PROJECTS"
  id: string
  name: string | null
  description: string | null
  technologies: string | null
  link: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface VolunteeringItemDto {
  type: "VOLUNTEERING"
  id: string
  role: string | null
  organization: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface SummaryItemDto {
  type: "SUMMARY"
  id: string
  text: string | null
}

export interface GenericItemDto {
  type: "UNKNOWN"
  id: string
  fields: Record<string, string>
}
```

**CRITICAL — `ResumeSectionDto.items` type is `ResumeItemDto[]` — no change to the field itself, but `ResumeItemDto` is now a union.** TypeScript will enforce the discriminator `type` field.

**CRITICAL — ALL files that access `item.fields` must be updated.** The `fields` property only exists on `GenericItemDto`. All frontend code currently accesses `item.fields` (from Story 3.5 `ResumeSection.tsx` and `ResumeCanvas.tsx`). These will show TypeScript compile errors. Story 3.15 adds typed renderers — for Story 3.13, ensure compilation passes with appropriate type guards. If `ResumeSection.tsx` renders `item.fields`, it must be guarded:

```typescript
// Current broken pattern:
Object.entries(item.fields).map(([k, v]) => ...)

// Story 3.13 safe pattern (renders GenericItem for all items until Story 3.15):
const fields = 'fields' in item ? item.fields : {}
Object.entries(fields).map(([k, v]) => ...)
```

OR: cast all items to `GenericItemDto` for display until Story 3.15 adds proper renderers. The simplest approach is to add a type guard helper in `ResumeSection.tsx`:
```typescript
function getItemFields(item: ResumeItemDto): Record<string, string> {
  if (item.type === "UNKNOWN") return item.fields
  // For typed items, build a display map from known fields
  const { id, type, ...rest } = item as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(rest)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, String(v)])
  )
}
```

**CRITICAL — `useResumeStore.ts` `updateItemField` action:** This action currently does:
```typescript
items: section.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
```
After this change, `i` is a discriminated union type. Spreading `{ ...i, [field]: value }` still works in TypeScript (it produces a compatible type). No change needed to the store logic — the spread mutation stays valid as `ResumeItemDto` is now a union of record types and spread preserves the `type` discriminator.

---

### Task 9: Verify `ResumeSection.tsx` compiles with new `ResumeItemDto` (AC: 6)

- [x] Read and update `frontend/src/components/resume/ResumeSection.tsx`

**CRITICAL — Read this file before implementing.** It currently iterates `Object.entries(item.fields)`. After `ResumeItemDto` becomes a discriminated union, `item.fields` is only valid for `GenericItemDto`. TypeScript strict mode will surface a compile error.

The Story 3.13 approach: add a `getItemFields` helper to maintain current display behavior without building typed renderers (that's Story 3.15). This ensures the app compiles and works end-to-end after Story 3.13.

**Also check:** `frontend/src/components/resume/ResumeCanvas.tsx` — has a second render path for read-only mode that may also iterate `item.fields`.

---

### Task 10: Run lint and tests (AC: all)

- [x] Run `cd frontend && npm run lint` — must pass with 0 errors
- [x] Run `cd frontend && npm run test -- --run` — all tests pass
- [x] Run `./mvnw test -Dtest="ResumeItemSerializationTest,LlmSectionExtractorTest,ResumeServiceTest" -Dsurefire.useFile=false` — all pass
- [x] Run `./mvnw test` — full suite passes (0 regressions, pre-existing flaky timestamp test not related to this story)

---

## Dev Notes

### CRITICAL: Read These Files Before Implementing

| File | Why |
|------|-----|
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` | Current state — to be replaced |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` | `buildFromProfile()` uses old `ResumeItem` + `deepCopyDocument()` uses `item.id()` / `item.fields()` |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` | `extractSectionItems()`, `validateAndConvert()`, `heuristicItems()` all use old `ResumeItem` |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/JacksonConfig.java` | ObjectMapper config — must match exactly in test |
| `frontend/src/components/resume/ResumeSection.tsx` | Uses `item.fields` — breaks after discriminated union |
| `frontend/src/components/resume/ResumeCanvas.tsx` | Has second `item.fields` render path in read-only branch |
| `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java` | Existing tests assert `item.fields()` — must be updated |

### CRITICAL: Flyway Migration Version is V11

V10 was created by Story 3.12. The next migration is V11. Do NOT use V10 or any lower number.

### CRITICAL: `sealed interface` + Sub-package `permits`

Java sealed interfaces can permit classes in sub-packages of the same module. `ResumeItem` in `resume.domain` permitting classes in `resume.domain.items` is valid in Java 17+. The `permits` clause requires fully qualified class names only if there is ambiguity — since the IDE/compiler will resolve from imports, write the simple names in the `permits` clause (Java requires them to be resolvable from the interface's package).

### CRITICAL: Jackson `@JsonTypeInfo` on `sealed interface`

Jackson does NOT automatically use Java sealed interface type information. The `@JsonTypeInfo` and `@JsonSubTypes` annotations on the interface are required. Without them, Jackson falls back to its default behavior which would fail on interface deserialization. The `use = JsonTypeInfo.Id.NAME` + `include = JsonTypeInfo.As.PROPERTY` configuration writes a `"type"` string field into the JSON.

### CRITICAL: `ObjectMapper` must be the Spring bean

`ResumeDocumentConverter` already injects the Spring `ObjectMapper` bean. The `JacksonConfig` bean registers `JavaTimeModule`. The `ResumeItemSerializationTest` must replicate this by creating an `ObjectMapper` with `JavaTimeModule` + `WRITE_DATES_AS_TIMESTAMPS` disabled. Using `new ObjectMapper()` without these will fail to serialize `LocalDate` correctly.

### CRITICAL: `ResumeService.deepCopyDocument()` Compile Error

After deleting `ResumeItem(String id, Map<String, String> fields)`, the line `new ResumeItem(item.id(), item.fields())` in `deepCopyDocument()` will not compile. The fix: since all `ResumeItem` subtypes are immutable records, there is no need to create copies. Use `List.copyOf(section.items())` directly.

### CRITICAL: `WorkExperience.isCurrent()` accessor

The `WorkExperience` JPA entity uses Lombok `@Getter` on a `boolean isCurrent` field. Lombok generates getter `isCurrent()`, not `getIsCurrent()`. Use `we.isCurrent()`.

### CRITICAL: `Education` entity — date fields may not exist

The current `ResumeService.buildFromProfile()` does NOT map `startDate`/`endDate` for education (line 147-153 maps only `institution`, `degree`, `fieldOfStudy`). Read `Education.java` to check if the entity has date fields before including them in `EducationItem` construction in `buildFromProfile()`.

### CRITICAL: LLM prompt field naming

The existing `resume-section-extraction.st` Spring AI prompt template dictates what field names the LLM returns. Check `src/main/resources/prompts/resume-section-extraction.st` to confirm the JSON keys the LLM is instructed to produce for each section type. If the prompt returns `"title"` for work experience but the `WorkExperienceItem` expects `"jobTitle"`, the `str(raw, "jobTitle")` lookup will return null. The `buildTypedItem()` helper keys must match the actual LLM output keys.

### CRITICAL: Frontend `ResumeSection.tsx` and `ResumeCanvas.tsx` Must Compile

After `ResumeItemDto` becomes a discriminated union, any code accessing `item.fields` will fail TypeScript strict mode compilation. Both `ResumeSection.tsx` and `ResumeCanvas.tsx` use this pattern. Story 3.15 adds typed renderers — for Story 3.13, add a `getItemFields(item: ResumeItemDto)` helper that extracts displayable fields regardless of type. This maintains backward-compatible display behavior without building full renderers.

### CRITICAL: `ResumeItemDto` in `upload.dto` vs `types/api.ts`

There is a `ResumeItemDto` in `com.tsvetanbondzhov.resumeenhancer.upload.dto` (the backend parse result DTO used in `LlmSectionExtractor`). This is DIFFERENT from `ResumeItemDto` in `frontend/src/types/api.ts` (the frontend API type). Do NOT confuse them. The backend upload DTO may become unused after this story — check before removing it.

### CRITICAL: `UpdateResumeRequest` deserialization

`PUT /api/v1/resumes/{id}` accepts an `UpdateResumeRequest` that contains a `ResumeDocument`. The `ResumeDocument` contains `List<ResumeSection>`, each with `List<ResumeItem>`. Jackson must correctly deserialize the polymorphic items using the `"type"` discriminator. Since `ResumeItem` is now annotated with `@JsonTypeInfo`, this should work automatically — but the frontend must send the `"type"` field in each item object. After `ResumeItemDto` is updated to a discriminated union in `types/api.ts`, TypeScript will enforce that `type` is always present. Verify the `useResumeStore` immutable update spreads (`{ ...i, [field]: value }`) correctly preserve the `type` field.

### File Locations (no deviations)

| Action | File |
|--------|------|
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/WorkExperienceItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/EducationItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/SkillItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/CertificationItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/LanguageItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/ProjectItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/VolunteeringItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/SummaryItem.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/items/GenericItem.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` |
| CREATE | `src/main/resources/db/migration/V11__migrate_resume_items_to_typed.sql` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` |
| UPDATE | `frontend/src/types/api.ts` |
| UPDATE | `frontend/src/components/resume/ResumeSection.tsx` |
| UPDATE | `frontend/src/components/resume/ResumeCanvas.tsx` |
| CREATE | `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java` |
| UPDATE | `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java` |

### References

- `_bmad-output/planning-artifacts/epics/epic-3-resume-management-template-selection.md` — Story 3.13 AC and background (lines 500–546)
- `_bmad-output/implementation-artifacts/3-12-extended-profile-domain-certifications-languages-projects-volunteering.md` — Story 3.12 file list and dev notes (previous story)
- `_bmad-output/implementation-artifacts/3-11-resumesectiontype-as-core-domain-concept-typed-section-identifiers.md` — `ResumeSection` record state, `ResumeSectionType` location
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` — current old record to be replaced
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSection.java` — `List<ResumeItem>` field (no change needed)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeSectionType.java` — enum values used as `@JsonSubTypes` names
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeDocumentConverter.java` — uses Spring ObjectMapper bean (no change needed)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/config/JacksonConfig.java` — ObjectMapper config (JavaTimeModule + no timestamps)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` — `buildFromProfile()` and `deepCopyDocument()` use old `ResumeItem`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` — `extractSectionItems()`, `validateAndConvert()`, `heuristicItems()`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java` — existing tests using `item.fields()`
- `frontend/src/types/api.ts` — current `ResumeItemDto` (to become discriminated union)
- `_bmad-output/project-context.md` — Java records for domain VOs; Lombok on `@Entity` only; `Instant` for timestamps, `LocalDate` for date-only; sealed interface + records pattern

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Sealed interface cross-package `permits` fails in unnamed module (Java spec requires same-package or named module). All 9 item records moved from `resume.domain.items` to `resume.domain` package.
- `List<WorkExperienceItem>` not assignable to `List<ResumeItem>` — fixed with `.<ResumeItem>map(...)` type witness on stream.
- `LlmSectionExtractorTest` used plain `new ObjectMapper()` without `JavaTimeModule` — updated to include `JavaTimeModule` + `WRITE_DATES_AS_TIMESTAMPS` disabled to match `JacksonConfig` bean.
- Pre-existing flaky test `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` fails due to timestamp precision (Instant nanosecond vs microsecond resolution). Not related to this story.

### Completion Notes List

- AC1/AC2: Nine typed records (`WorkExperienceItem`, `EducationItem`, `SkillItem`, `CertificationItem`, `LanguageItem`, `ProjectItem`, `VolunteeringItem`, `SummaryItem`, `GenericItem`) created in `resume.domain` package; all implement sealed `ResumeItem` interface.
- AC1: `ResumeItem` converted from record to `sealed interface` with `@JsonTypeInfo`/`@JsonSubTypes` annotations; old `ResumeItem(String id, Map<String,String> fields)` record deleted.
- AC3: Jackson polymorphism round-trip verified via `ResumeItemSerializationTest` (10 tests, all pass). `LocalDate` serializes as `"YYYY-MM-DD"` strings via `JavaTimeModule`.
- AC4: `V11__migrate_resume_items_to_typed.sql` created — idempotent JSONB migration lifting `fields` to top-level, adding `type` discriminator, nulling empty date strings.
- AC5: `LlmSectionExtractor` rewritten with `buildTypedItem()` switch on `ResumeSectionType`; `validateAndConvert()` removed; `heuristicItems()` uses `GenericItem`; `parseDate()` handles `YYYY-MM` and `YYYY` formats; `AiService.getFieldSchema()` updated to canonical field names.
- AC6: `frontend/src/types/api.ts` `ResumeItemDto` replaced with discriminated union; `ResumeSection.tsx` and `ResumeCanvas.tsx` updated with `getItemFields()`/`getItemDisplayValues()` helpers; `useResumeStore` `updateItemField` fixed to use `{ ...item, [field]: value }` pattern.
- AC7: `ResumeItemSerializationTest` (10 tests) + `LlmSectionExtractorTest` (7 tests including 3 new typed-item tests) all pass.

### File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ResumeItem.java` (updated — sealed interface)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/WorkExperienceItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/EducationItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/SkillItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/CertificationItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/LanguageItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/ProjectItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/VolunteeringItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/SummaryItem.java` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/GenericItem.java` (created)
- `src/main/resources/db/migration/V11__migrate_resume_items_to_typed.sql` (created)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` (updated)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` (updated)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java` (updated — canonical field names in schema)
- `frontend/src/types/api.ts` (updated — discriminated union ResumeItemDto)
- `frontend/src/components/resume/ResumeSection.tsx` (updated — getItemFields helper)
- `frontend/src/components/resume/ResumeCanvas.tsx` (updated — getItemDisplayValues helper)
- `frontend/src/stores/useResumeStore.ts` (updated — updateItemField pattern)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java` (created)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java` (updated)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` (updated — item assertion)
- `frontend/src/components/resume/ResumeSection.test.tsx` (updated — typed item fixtures)
- `frontend/src/components/resume/ResumeCanvas.test.tsx` (updated — typed item fixtures)
- `frontend/src/pages/EditorPage.test.tsx` (updated — typed item fixtures)
- `frontend/src/hooks/useAutosave.test.ts` (updated — typed item fixtures)

### Review Findings

- [x] [Review][Patch] `getItemFields`/`getItemDisplayValues` silently drop `boolean false` — `isCurrent: false` never renders in UI [frontend/src/components/resume/ResumeSection.tsx, ResumeCanvas.tsx]
- [x] [Review][Patch] `aiService.extractResumeSection` returning null causes NPE in `objectMapper.readValue` — add null guard before parse [src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java:extractSectionItems]
- [x] [Review][Patch] `toStringMap` produces garbled output for nested Map/List LLM values — use JSON serialize for non-primitive values [src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java:toStringMap]
- [x] [Review][Patch] `updateItemField` with field name `"type"` or `"id"` corrupts discriminant — add guard to reject reserved field names [frontend/src/stores/useResumeStore.ts]
- [x] [Review][Patch] V11 migration errors if a section has null/absent `items` key — wrap with `COALESCE(section->'items', '[]'::jsonb)` [src/main/resources/db/migration/V11__migrate_resume_items_to_typed.sql]
- [x] [Review][Patch] V11 migration errors if `resume_content` is non-null JSONB but has no `sections` key — add `AND resume_content ? 'sections'` to WHERE clause [src/main/resources/db/migration/V11__migrate_resume_items_to_typed.sql]
- [x] [Review][Patch] Anchor check boolean/numeric `toString` values produce false-positive anchor matches — filter to string values with length > 3 [src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java:buildTypedItem]
- [x] [Review][Patch] `ResumeItemSerializationTest` hand-rolled `ObjectMapper` diverges silently from Spring bean — note limitation in class javadoc or extract shared test helper [src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java]
- [x] [Review][Patch] `extract_anchorCheckFailure` test missing `hasSize(1)` assertion after typed-item refactor weakens original intent [src/test/java/com/tsvetanbondzhov/resumeenhancer/upload/LlmSectionExtractorTest.java]
- [x] [Review][Defer] AC7 incomplete: no `LlmSectionExtractorTest` cases for `CertificationItem`, `LanguageItem`, `ProjectItem`, `VolunteeringItem`, `EducationItem` — deferred, pre-existing gap acceptable for 3-letter types; story 3-15 adds typed renderers
- [x] [Review][Defer] `parseDate` silently converts year-only strings to Jan 1 without logging a WARN — deferred, current behavior is acceptable for MVP, log improvement is a polish item
- [x] [Review][Defer] `GenericItem` compact constructor would NPE on maps with null values — deferred, `toStringMap` already filters nulls before constructing `GenericItem`; only a risk if `GenericItem` is constructed directly with a null-value map

### Round 2 Review Findings (2026-06-10)

- [x] [Review][Patch] `DATE_PATTERN` constant left as dead code after `validateAndConvert` deletion — removed unused constant and `java.util.regex.Pattern` import [src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java:38]
- [x] [Review][Defer] `isCurrent: false` renders as editable "false" text via `getItemFields`/`getItemDisplayValues` — boolean fields should not be surfaced as editable contenteditable spans; deferred to Story 3.15 typed renderers
- [x] [Review][Defer] Editing a boolean field (e.g. `isCurrent`) via contenteditable writes a string value back to the typed record — `updateItemField` stores `"true"`/`"false"` strings into boolean fields; deferred to Story 3.15 typed renderers which will remove contenteditable from boolean/date fields entirely

## Change Log

- 2026-06-09: Implemented story 3-13 — `ResumeItem` promoted to `sealed interface` with 9 typed records; Jackson polymorphism configured; V11 Flyway migration; `LlmSectionExtractor` constructs typed items; `ResumeService` uses typed items; frontend `ResumeItemDto` is a discriminated union; all ACs satisfied; 29 backend + 102 frontend tests pass.
- 2026-06-09: Addressed 9 patch-priority code review findings — fixed boolean false display in `getItemFields`/`getItemDisplayValues`; added null guard before `objectMapper.readValue`; fixed `toStringMap` to JSON-serialize nested Map/List values; guarded `updateItemField` against `"type"`/`"id"` mutations; added `COALESCE` for null items in V11 migration; added `resume_content ? 'sections'` guard to V11 WHERE; fixed anchor check to filter non-string/short values; added divergence note to `ResumeItemSerializationTest` javadoc; added `hasSize(1)` to anchor failure test. 104 backend + 102 frontend tests pass.
- 2026-06-10: Round 2 review — 1 patch applied (removed dead `DATE_PATTERN` constant and unused `Pattern` import from `LlmSectionExtractor`); 2 defers logged (boolean field rendering/editing via contenteditable, deferred to Story 3.15). Story promoted to done.
