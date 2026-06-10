# Story 3.14: Profile-to-Resume Mapping Refactor — All Section Types

**Status:** done
**Epic:** 3 — Resume Management & Template Selection
**Story Key:** 3-14-profile-to-resume-mapping-refactor-all-section-types
**Dependencies:** Story 3.12 (done), Story 3.13 (done)

---

## Story

As a user,
I want all sections from my profile — including certifications, languages, projects, volunteering, and summary — to appear in a newly created resume,
so that my resume is pre-populated with my complete professional history without manual re-entry.

---

## Acceptance Criteria

**AC1 — `buildFromProfile()` produces eight typed sections in canonical order**
**Given** `buildFromProfile()` is called on a fully-populated profile
**When** the `ResumeDocument` is returned
**Then** it contains exactly eight sections in the following default order: `SUMMARY`, `WORK_EXPERIENCE`, `EDUCATION`, `SKILLS`, `CERTIFICATIONS`, `PROJECTS`, `LANGUAGES`, `VOLUNTEERING`; each section uses the correct `ResumeSectionType` enum value; each item is the correct typed `ResumeItem` subclass

**AC2 — Field mapping for each entity type**
**Given** `buildFromProfile()` maps each entity type
**When** items are constructed
**Then**:
- `WorkExperienceItem` fields are mapped 1-to-1 from `WorkExperience` entity fields with `LocalDate` values preserved
- `EducationItem` from `Education`
- `SkillItem` from `Skill` (`category` and `proficiency` are null)
- `CertificationItem` from `Certification`
- `LanguageItem` from `Language` — proficiency mapped from `proficiencyLevel.name()`
- `ProjectItem` from `Project`
- `VolunteeringItem` from `Volunteering`
- The `SUMMARY` section contains a single `SummaryItem` whose `text` is `profile.getSummary()`

**AC3 — Empty sections default to `visible: false`**
**Given** a profile section has no items (e.g. no certifications on file)
**When** `buildFromProfile()` constructs that section
**Then** the section is still added to the document with `visible: false` and an empty items list; sections that do have items default to `visible: true`; this ensures `SectionsPanel` can reveal a section later without requiring a re-parse

**AC4 — Null/blank summary section defaults to `visible: false`**
**Given** the profile `summary` field is null or blank
**When** the `SUMMARY` section is constructed
**Then** it is added with `visible: false` and a single `SummaryItem` with an empty string `text`

**AC5 — `TemplateDefinition.DEFAULT` updated to eight sections**
**Given** `TemplateDefinition.DEFAULT` is updated
**When** `getOrderedSections()` is called without a template
**Then** the default section order is `["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]`; the prebuilt template seed SQL (`V6`) is updated so the three existing templates either adopt this expanded order or define explicit overrides via a new Flyway migration

**AC6 — `deepCopyDocument()` handles all eight typed section types**
**Given** `deepCopyDocument()` is called during a clone operation
**When** the document contains all eight section types with typed items
**Then** all typed item subclasses are correctly reconstructed; no `ClassCastException`; no data loss

**AC7 — Unit tests**
**Given** the story is implemented
**When** unit tests are run
**Then** `ResumeServiceTest.java` contains:
- `buildFromProfile_allSections` test with a fully-populated profile fixture asserting: section count is eight, sections appear in the correct order, each item is the correct subclass, and key field values are correctly mapped
- `buildFromProfile_emptySections` test verifying sections with no profile data are added with `visible: false`

---

## Tasks / Subtasks

### Task 1: Expand `ResumeService.buildFromProfile()` to all eight section types (AC: 1, 2, 3, 4)

- [x] Add imports for all new profile entities: `Certification`, `Language`, `Project`, `Volunteering`
- [x] Add imports for all new item types: `CertificationItem`, `LanguageItem`, `ProjectItem`, `VolunteeringItem`, `SummaryItem`
- [x] Reorder sections to: `SUMMARY`, `WORK_EXPERIENCE`, `EDUCATION`, `SKILLS`, `CERTIFICATIONS`, `PROJECTS`, `LANGUAGES`, `VOLUNTEERING`
- [x] Implement SUMMARY section mapping:
  - Single `SummaryItem` with `text = profile.getSummary() != null ? profile.getSummary() : ""`
  - `visible = profile.getSummary() != null && !profile.getSummary().isBlank()`
- [x] Implement CERTIFICATIONS section mapping (1-to-1 from `Certification` fields)
- [x] Implement LANGUAGES section mapping (`proficiency = language.getProficiencyLevel().name()`)
- [x] Implement PROJECTS section mapping (1-to-1 from `Project` fields)
- [x] Implement VOLUNTEERING section mapping (1-to-1 from `Volunteering` fields)
- [x] Apply visibility logic to all sections: `visible = !items.isEmpty()`
- [x] Apply visibility logic to existing sections (WORK_EXPERIENCE, EDUCATION, SKILLS) — currently always `true`; update to `!items.isEmpty()`

### Task 2: Update `TemplateDefinition.DEFAULT` to cover all eight sections (AC: 5)

- [x] In `TemplateDefinition.java`, update `DEFAULT`'s `TemplateLayout` `sectionOrder` list from `["WORK_EXPERIENCE", "EDUCATION", "SKILLS"]` to `["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]`

### Task 3: Create Flyway migration to update prebuilt template section orders (AC: 5)

- [x] Create `V12__update_template_section_orders_all_types.sql`
- [x] Update Minimal (single-column) template `sectionOrder` to: `["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]`
- [x] Update Classic (two-column) template to add the new types: left column `["SKILLS", "LANGUAGES", "CERTIFICATIONS"]` stays the same; right column `["WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]` — add VOLUNTEERING
- [x] Update Modern (modern-accent) template `sectionOrder` to: `["SUMMARY", "WORK_EXPERIENCE", "SKILLS", "EDUCATION", "PROJECTS", "CERTIFICATIONS", "LANGUAGES", "VOLUNTEERING"]`
- [x] Migration must be idempotent (use `jsonb_set` like V9)

### Task 4: Update `ResumeServiceTest.java` with two new tests (AC: 7)

- [x] Add `buildFromProfile_allSections` test:
  - Build a `Profile` with one item in each of: `workExperiences`, `education`, `skills`, `certifications`, `languages`, `projects`, `volunteering`, and a non-blank `summary`
  - Assert `sections().size() == 8`
  - Assert section order: index 0 = SUMMARY, 1 = WORK_EXPERIENCE, 2 = EDUCATION, 3 = SKILLS, 4 = CERTIFICATIONS, 5 = PROJECTS, 6 = LANGUAGES, 7 = VOLUNTEERING
  - Assert each section `visible` is true
  - Assert each section has exactly 1 item of the correct subclass
  - Spot-check key mapped fields (e.g. `CertificationItem.name()`, `LanguageItem.proficiency()`, `SummaryItem.text()`)
- [x] Add `buildFromProfile_emptySections` test:
  - Build a `Profile` with no items in any list and null summary
  - Assert `sections().size() == 8`
  - Assert all sections have `visible: false`
  - Assert all sections have empty items lists
- [x] Update the existing `createResume_withProfile_buildsResumeDocumentFromProfile` test — it currently asserts `sections().size() == 3`; update to `8` (since all sections are now always added)

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` | Expand `buildFromProfile()`, add imports |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java` | Update `DEFAULT.layout.sectionOrder` |
| `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` | Add two new tests + update existing test |

### Files to Create (NEW)

| File | Change |
|------|--------|
| `src/main/resources/db/migration/V12__update_template_section_orders_all_types.sql` | Flyway migration updating all three templates |

### No Frontend Changes

This story is **backend-only**. The frontend already handles `ResumeSectionType` as a discriminated union (done in 3.11 and 3.13). The eight section types are already in the TypeScript `ResumeSectionType` union. No `api.ts` changes needed.

### No New Java Files

All nine typed item records exist in `resume.domain` (done in 3.13). All four new profile entities exist in `profile.domain` (done in 3.12). This story only wires the mapping in `ResumeService`.

---

### Critical Implementation Details

#### Package Location of Item Types (Story 3.13 deviated from spec)

The epic spec says items should live in `resume.domain.items` sub-package. **In reality (after 3.13 was implemented), all nine item types live directly in `resume.domain`** — no sub-package was created. Verify this at start:

```
src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/
├── CertificationItem.java
├── EducationItem.java
├── GenericItem.java
├── LanguageItem.java
├── ProjectItem.java
├── ResumeItem.java          ← sealed interface
├── ResumeSection.java
├── ResumeSectionType.java
├── SkillItem.java
├── SummaryItem.java
├── VolunteeringItem.java
└── WorkExperienceItem.java
```

Imports in `ResumeService.java` must match this actual location. Current imports for `WorkExperienceItem`, `EducationItem`, `SkillItem` already use `com.tsvetanbondzhov.resumeenhancer.resume.domain.*` — follow the same pattern.

#### Existing `ResumeService.java` Import Block (current state)

The file already imports `WorkExperienceItem`, `EducationItem`, `SkillItem` from `resume.domain`. Add the five missing ones:
- `CertificationItem`
- `LanguageItem`
- `ProjectItem`
- `VolunteeringItem`
- `SummaryItem`

Also add profile entity imports:
- `com.tsvetanbondzhov.resumeenhancer.profile.domain.Certification`
- `com.tsvetanbondzhov.resumeenhancer.profile.domain.Language`
- `com.tsvetanbondzhov.resumeenhancer.profile.domain.Project`
- `com.tsvetanbondzhov.resumeenhancer.profile.domain.Volunteering`

#### Visibility Rule

The AC explicitly says: sections with items → `visible: true`; sections with no items → `visible: false`. The **current implementation hardcodes `true`** for WORK_EXPERIENCE, EDUCATION, SKILLS. Update all three existing sections to use the same `!items.isEmpty()` logic for consistency. This is a behavior change — the existing `ResumeServiceTest` test `createResume_withProfile_buildsResumeDocumentFromProfile` must be updated accordingly.

#### Language Proficiency Mapping

`Language` entity has `LanguageProficiencyLevel proficiencyLevel` (an enum). `LanguageItem` expects `String proficiency`. Map via `.getProficiencyLevel().name()` — this produces strings like `"ADVANCED"`, `"NATIVE"`, etc. Guard against null `proficiencyLevel` (entity has `nullable = false` in the DB but defensive coding still applies):

```java
language.getProficiencyLevel() != null
    ? language.getProficiencyLevel().name()
    : null
```

#### `deepCopyDocument()` — No Change Needed

`deepCopyDocument()` iterates `source.sections()` and creates new `ResumeSection` with `List.copyOf(section.items())`. Since all `ResumeItem` subtypes are **immutable Java records**, reference copy is correct and sufficient. This already handles all eight section types without modification. No changes needed.

#### `TemplateDefinition.DEFAULT` — Current `sectionOrder` to Replace

Current value: `List.of("WORK_EXPERIENCE", "EDUCATION", "SKILLS")`
New value: `List.of("SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING")`

Note: `TemplateDefinition.DEFAULT.layout` is constructed as:
```java
new TemplateLayout(
    "name-contact",
    List.of("WORK_EXPERIENCE", "EDUCATION", "SKILLS"),  // ← UPDATE THIS
    null,
    Map.of()
)
```

#### Flyway Migration Version

The next available version is **V12**. Current migrations go up to V11 (`V11__migrate_resume_items_to_typed.sql`). Naming: `V12__update_template_section_orders_all_types.sql`.

#### `Profile.getSummary()` — Field Exists

`Profile.java` already has `@Column(name = "summary") private String summary;` with `@Getter`/`@Setter` from Lombok. Call `profile.getSummary()` directly.

---

### Key Patterns from Previous Stories

**Null-safe list iteration (3.13 pattern):**
```java
List<ResumeItem> certItems = (profile.getCertifications() != null
        ? profile.getCertifications() : List.<Certification>of()).stream()
        .<ResumeItem>map(cert -> new CertificationItem(
                UUID.randomUUID().toString(),
                cert.getName(),
                cert.getIssuer(),
                cert.getIssueDate(),
                cert.getExpirationDate()
        ))
        .toList();
```
Note the explicit `.<ResumeItem>` type witness on `.stream()` — this is required because the stream maps to a subtype but the list type is `List<ResumeItem>`. Follow the same pattern as the existing WORK_EXPERIENCE, EDUCATION, SKILLS sections.

**Section construction with visibility logic:**
```java
boolean visible = !certItems.isEmpty();
sections.add(new ResumeSection(ResumeSectionType.CERTIFICATIONS, "Certifications", visible, certItems));
```

**SUMMARY section — add first:**
```java
String summaryText = profile.getSummary() != null ? profile.getSummary() : "";
boolean summaryVisible = profile.getSummary() != null && !profile.getSummary().isBlank();
List<ResumeItem> summaryItems = List.of(new SummaryItem(UUID.randomUUID().toString(), summaryText));
sections.add(new ResumeSection(ResumeSectionType.SUMMARY, "Summary", summaryVisible, summaryItems));
```

---

### Test Patterns

**Building profile entities in tests (existing pattern in `ResumeServiceTest.java`):**
```java
Certification cert = new Certification();
cert.setName("AWS Solutions Architect");
cert.setIssuer("Amazon");
cert.setIssueDate(LocalDate.of(2023, 6, 1));
profile.getCertifications().add(cert);
```

**Language entity requires non-null `proficiencyLevel`:**
```java
Language lang = new Language();
lang.setName("Spanish");
lang.setProficiencyLevel(LanguageProficiencyLevel.ADVANCED);
profile.getLanguages().add(lang);
```

**Asserting item subclass with field access:**
```java
assertThat(saved.getResumeContent().sections().get(0).sectionType())
        .isEqualTo(ResumeSectionType.SUMMARY);
SummaryItem summaryItem = (SummaryItem) saved.getResumeContent().sections().get(0).items().get(0);
assertThat(summaryItem.text()).isEqualTo("Experienced Java developer");

assertThat(saved.getResumeContent().sections().get(4).sectionType())
        .isEqualTo(ResumeSectionType.CERTIFICATIONS);
CertificationItem certItem = (CertificationItem) saved.getResumeContent().sections().get(4).items().get(0);
assertThat(certItem.name()).isEqualTo("AWS Solutions Architect");

assertThat(saved.getResumeContent().sections().get(6).sectionType())
        .isEqualTo(ResumeSectionType.LANGUAGES);
LanguageItem langItem = (LanguageItem) saved.getResumeContent().sections().get(6).items().get(0);
assertThat(langItem.proficiency()).isEqualTo("ADVANCED");
```

---

### Existing Test to Update

`ResumeServiceTest.java` line 137: `assertThat(saved.getResumeContent().sections()).hasSize(3);`

This test (`createResume_withProfile_buildsResumeDocumentFromProfile`) will fail after the change because `buildFromProfile()` now always produces 8 sections. Update the assertion:

```java
assertThat(saved.getResumeContent().sections()).hasSize(8);
```

The test's profile fixture only populates `workExperiences` and `skills`, so EDUCATION, CERTIFICATIONS, PROJECTS, LANGUAGES, VOLUNTEERING, SUMMARY will all be `visible: false` with empty item lists. The test's assertions about WORK_EXPERIENCE (index 0) and SKILLS (index 2) must be updated to use the new indexes: WORK_EXPERIENCE is now index 1, SKILLS is now index 3.

Updated assertions:
```java
// SUMMARY at index 0 — visible: false (no summary set)
assertThat(saved.getResumeContent().sections().get(0).sectionType())
        .isEqualTo(ResumeSectionType.SUMMARY);
assertThat(saved.getResumeContent().sections().get(0).visible()).isFalse();

// WORK_EXPERIENCE at index 1
assertThat(saved.getResumeContent().sections().get(1).sectionType())
        .isEqualTo(ResumeSectionType.WORK_EXPERIENCE);
assertThat(saved.getResumeContent().sections().get(1).items()).hasSize(1);

// SKILLS at index 3
assertThat(saved.getResumeContent().sections().get(3).sectionType())
        .isEqualTo(ResumeSectionType.SKILLS);
assertThat(saved.getResumeContent().sections().get(3).items()).hasSize(1);
```

---

### Architecture References

- `project-context.md` — Java rules: records for domain objects, `UUID.randomUUID().toString()` for item IDs, immutable patterns
- `implementation-patterns-consistency-rules.md` — service layer patterns
- Flyway: `V12__*.sql` naming, `jsonb_set` for data-only migrations, idempotency required
- No `@Transactional` change needed — `buildFromProfile()` is a private helper called within the already-`@Transactional` `createResume()` method

---

### Scope Boundary — What NOT to Do

- **No frontend changes** — `ResumeSection.tsx`, `ResumeCanvas.tsx`, `api.ts`, `useResumeStore.ts` are all out of scope
- **No new API endpoints** — no `ProfileController` or `ResumeController` changes
- **No `LlmSectionExtractor` changes** — out of scope
- **No `ResumeDocumentConverter` changes** — polymorphic serialization already works for all types (done in 3.13)
- **No `deepCopyDocument()` changes** — already works correctly for all item types
- **Do not create a `resume.domain.items` sub-package** — all item types are in `resume.domain` directly (as implemented in 3.13)

---

## Dev Notes

Implementation followed the story spec exactly. Key observations:
- `LanguageItem` uses field name `language` (not `name`) — mapped from `Language.getName()` correctly.
- `TemplateDefinition` was updated; linter auto-reverted once but `git stash pop` restored it — final state is correct.
- Pre-existing flaky test `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` fails intermittently on timestamp nanosecond precision; confirmed pre-existing (fails without story changes too).

---

## Dev Agent Record

### Implementation Notes

All four tasks implemented in sequence per story spec. No deviations from scope.

- Task 1: `ResumeService.buildFromProfile()` expanded: 5 new imports (profile entities), 5 new imports (item types), 8-section canonical order, visibility logic applied to all sections.
- Task 2: `TemplateDefinition.DEFAULT` sectionOrder updated from 3 to 8 entries.
- Task 3: `V12__update_template_section_orders_all_types.sql` created — idempotent via `jsonb_set`.
- Task 4: Two new unit tests added; existing test updated for 8-section count and correct indexes.

### Completion Notes

- 14/14 `ResumeServiceTest` tests pass (12 existing + 2 new)
- 105/106 total tests pass; 1 pre-existing flaky integration test (timestamp precision, unrelated to this story)
- Frontend lint: 0 errors, 2 pre-existing warnings

---

## File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` (modified)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java` (modified)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` (modified)
- `src/main/resources/db/migration/V12__update_template_section_orders_all_types.sql` (created)

---

## Change Log

- 2026-06-10: Implemented story 3-14 — expanded `buildFromProfile()` to 8 sections, updated `TemplateDefinition.DEFAULT`, created V12 Flyway migration, added `buildFromProfile_allSections` and `buildFromProfile_emptySections` unit tests.

---

### Review Findings

- [x] [Review][Patch] Missing `EducationItem` import in `ResumeServiceTest` — test uses FQCN `com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem.class` at line 254 because the import was not added with the other item imports in the diff. Add `import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;` to the import block. [`src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java:254`]

---

## Completion Checklist

- [x] All AC acceptance criteria satisfied
- [x] `ResumeService.buildFromProfile()` produces 8 sections in canonical order
- [x] Visibility logic applied (items present → visible:true, empty → visible:false)
- [x] `TemplateDefinition.DEFAULT` sectionOrder updated to 8 types
- [x] `V12__update_template_section_orders_all_types.sql` created and idempotent
- [x] `ResumeServiceTest.java` has `buildFromProfile_allSections` and `buildFromProfile_emptySections` tests
- [x] Existing `createResume_withProfile_buildsResumeDocumentFromProfile` test updated for 8 sections
- [x] All tests pass (no compilation errors, no test failures)
- [x] Frontend lint passes (`cd frontend && npm run lint`) — no frontend changes so should be clean
