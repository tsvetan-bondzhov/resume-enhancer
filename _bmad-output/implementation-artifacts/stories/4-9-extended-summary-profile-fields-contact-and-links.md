# Story 4.9: Extended Summary Profile Fields — Contact & Links

**Status:** done
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-9-extended-summary-profile-fields-contact-and-links
**Dependencies:** Story 3.14 (done), Story 3.15 (done), Story 3.12 (done)

---

## Story

As a user,
I want to add LinkedIn, personal website, blog, email, and location to my profile summary,
So that these contact details are rendered in my resume automatically.

---

## Acceptance Criteria

**AC1 — Flyway migration V13: Add six nullable columns to `profiles`**
**Given** migration `V13__add_profile_contact_fields.sql` is applied
**When** Flyway runs
**Then** six nullable columns are added to the `profiles` table:
- `linked_in_url VARCHAR(500)`
- `personal_page_url VARCHAR(500)`
- `blog_url VARCHAR(500)`
- `contact_email VARCHAR(255)`
- `location_country VARCHAR(100)`
- `location_city VARCHAR(100)`

---

**AC2 — Profile entity: Six new nullable fields**
**Given** the migration has been applied
**When** `Profile` entity is updated
**Then** six new nullable fields are mapped via `@Column`: `linkedInUrl`, `personalPageUrl`, `blogUrl`, `contactEmail`, `locationCountry`, `locationCity`. All use `@Column(name = "linked_in_url")` etc. matching the migration column names.

---

**AC3 — ProfileUpdateRequest & ProfileDto: Six new optional String fields**
**Given** `ProfileUpdateRequest` and `ProfileDto` are updated
**When** a client sends `PUT /api/v1/profile`
**Then** the six new fields are accepted as optional nullable Strings in `ProfileUpdateRequest`. A null value in the request replaces the existing value with null (consistent with the existing PUT-replace strategy). `ProfileDto` returns all six fields (each nullable). `ProfileService.updateProfile()` maps the new fields from request to entity; `ProfileService.toDto()` maps them from entity to DTO.

---

**AC4 — SummaryItem Java record: Six new nullable fields**
**Given** `SummaryItem.java` is updated
**When** a `SummaryItem` is constructed
**Then** the record signature is:
```java
public record SummaryItem(
    String id,
    String text,
    String linkedInUrl,
    String personalPageUrl,
    String blogUrl,
    String contactEmail,
    String locationCountry,
    String locationCity
) implements ResumeItem {}
```
All six new fields are nullable. `SummaryItem` is a `ResumeItem` implementation annotated via the `@JsonSubTypes` on `ResumeItem`. The new fields are additive — existing JSONB rows that lack them will deserialize with null for the missing fields (Jackson's default for nullable types). No data migration SQL is required.

---

**AC5 — `buildFromProfile()` maps new fields to `SummaryItem`**
**Given** `ResumeService.buildFromProfile()` is updated
**When** a resume is built from a profile that has contact fields set
**Then** the `SummaryItem` is constructed with the six profile fields passed directly:
```java
new SummaryItem(
    UUID.randomUUID().toString(),
    summaryText,
    profile.getLinkedInUrl(),
    profile.getPersonalPageUrl(),
    profile.getBlogUrl(),
    profile.getContactEmail(),
    profile.getLocationCountry(),
    profile.getLocationCity()
)
```
Null profile fields produce null `SummaryItem` fields. There is no fallback to the user's auth email in this method.

---

**AC6 — `SummaryItemDto` TypeScript: Six new nullable fields**
**Given** `frontend/src/types/api.ts` is updated
**When** the API returns a `SummaryItemDto`
**Then** the interface is:
```ts
export interface SummaryItemDto {
  type: "SUMMARY"
  id: string
  text: string | null
  linkedInUrl: string | null
  personalPageUrl: string | null
  blogUrl: string | null
  contactEmail: string | null
  locationCountry: string | null
  locationCity: string | null
}
```

---

**AC7 — `SummarySectionRenderer`: Contact row above summary text**
**Given** `SummarySectionRenderer.tsx` is updated
**When** a `SummaryItemDto` has at least one non-null contact field
**Then** a contact row is rendered ABOVE the summary text paragraph. The contact row:
- Shows `contactEmail` as plain text (not a link)
- Shows `linkedInUrl`, `personalPageUrl`, `blogUrl` as `<a href={url} target="_blank" rel="noopener noreferrer">` elements each with a `<ExternalLink className="inline h-3 w-3 ml-0.5" />` lucide-react icon
- Shows location as `"${locationCity}, ${locationCountry}"` when both are non-null, or either alone when only one is non-null
- Omits any field that is null entirely (no placeholder, no empty element)
- When ALL six contact fields are null, the contact row is not rendered at all
- The summary text paragraph `<p className="text-sm">` renders after (below) the contact row as before

---

**AC8 — Profile page Summary step: Contact field inputs**
**Given** `SummaryStep.tsx` is updated
**When** the user reaches the Summary step
**Then** input fields for all six contact fields are rendered below the existing Summary textarea:
- `contactEmail` (type `"email"`, `<Input>`)
- `linkedInUrl` (type `"url"`, `<Input>`, placeholder `"https://linkedin.com/in/..."`)
- `personalPageUrl` (type `"url"`, `<Input>`, placeholder `"https://..."`)
- `blogUrl` (type `"url"`, `<Input>`, placeholder `"https://..."`)
- `locationCity` (`<Input>`, placeholder `"City"`)
- `locationCountry` (`<Input>`, placeholder `"Country"`)

The `contactEmail` field is pre-populated from `useAuthStore((s) => s.user?.email)` if and only if the field is currently null/empty in the loaded profile on first render (i.e. `profile?.contactEmail ?? user?.email ?? ""`). `onSaveAndContinue` is called with all six fields included in the partial `ProfileUpdateRequest`.

---

**AC9 — Tests updated**
**Given** the story is implemented
**When** tests run
**Then**:
- `ResumeServiceTest.java` `buildFromProfile_allSections` is updated: set `profile.setLinkedInUrl("https://linkedin.com/in/test")` and `profile.setContactEmail("user@example.com")`; assert `summaryItem.linkedInUrl()` equals `"https://linkedin.com/in/test"` and `summaryItem.contactEmail()` equals `"user@example.com"`
- `SummarySectionRenderer.test.tsx` is updated:
  - Test: contact fields non-null → contact row rendered above text paragraph
  - Test: `linkedInUrl` non-null → anchor with `href` attribute rendered
  - Test: all contact fields null → no contact row in DOM
  - Test: `locationCity` non-null + `locationCountry` non-null → `"City, Country"` text rendered
  - Existing tests for `text` rendering and edit mode are preserved

---

## Tasks / Subtasks

### Task 1: Flyway migration V13 (AC: 1)

- [x] Create `src/main/resources/db/migration/V15__add_profile_contact_fields.sql` (V13/V14 were taken by prior stories; V15 is the correct next number)
- [x] Add six `ALTER TABLE profiles ADD COLUMN` statements (all nullable, no defaults):
  ```sql
  ALTER TABLE profiles ADD COLUMN linked_in_url    VARCHAR(500);
  ALTER TABLE profiles ADD COLUMN personal_page_url VARCHAR(500);
  ALTER TABLE profiles ADD COLUMN blog_url          VARCHAR(500);
  ALTER TABLE profiles ADD COLUMN contact_email     VARCHAR(255);
  ALTER TABLE profiles ADD COLUMN location_country  VARCHAR(100);
  ALTER TABLE profiles ADD COLUMN location_city     VARCHAR(100);
  ```
- [x] Confirmed V13 = classic template summary column fix, V14 = simplify skill items. V15 is the correct next number.

### Task 2: Update `Profile` entity (AC: 2)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java`
- [x] Add six `@Column` fields after the existing `summary` column field
- [x] Lombok `@Getter`/`@Setter` is already on the class — no explicit accessors needed.

### Task 3: Update `ProfileUpdateRequest` and `ProfileDto` (AC: 3)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java`
- [x] Add six nullable `String` fields after `summary`
- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java`
- [x] Add the same six nullable `String` fields after `summary`
- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java`
- [x] In `updateProfile()`: after `profile.setSummary(request.summary())`, add six setters
- [x] In `toDto(Profile profile)`: updated `ProfileDto` constructor call to include the six new fields
- [x] In `emptyProfileDto()`: pass `null` for all six new fields

### Task 4: Update `SummaryItem` Java record (AC: 4)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/SummaryItem.java`
- [x] Replace the record body with the expanded 8-field signature from AC4
- [x] Verified `ResumeItem.java` — `SummaryItem` already listed in `@JsonSubTypes` with `name = "SUMMARY"`. Existing JSONB rows deserialize missing fields as `null` (Jackson default).
- [x] Confirmed `ResumeDocumentConverter` uses the shared `ObjectMapper` bean

### Task 5: Update `buildFromProfile()` in `ResumeService` (AC: 5)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`
- [x] Updated `SummaryItem` construction in `buildFromProfile()` to pass all six profile contact fields
- [x] Also updated `LlmSectionExtractor.java` SUMMARY case to pass `null` for all six new fields

### Task 6: Update `SummaryItemDto` in `api.ts` (AC: 6)

- [x] Open `frontend/src/types/api.ts`
- [x] Extended `SummaryItemDto` with the six new nullable fields
- [x] Also extended `ProfileDto` TypeScript interface and `ProfileUpdateRequest` interface with the six new nullable fields
- [x] Updated `useResumeUpload.ts` inline `ProfileDto` literal to include all required fields (six new nulls + missing list fields)

### Task 7: Update `SummarySectionRenderer.tsx` (AC: 7)

- [x] Open `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- [x] Added `import { ExternalLink } from "lucide-react"` at the top
- [x] Added contact row with `hasContact` guard, location join logic, and conditional rendering of email, LinkedIn, website, blog, and location fields
- [x] Existing text paragraph rendering (read-only and edit mode) is unchanged

### Task 8: Update `SummaryStep.tsx` (AC: 8)

- [x] Open `frontend/src/components/profile/SummaryStep.tsx`
- [x] Added `import { useAuthStore } from "@/stores/useAuthStore"` and `import { Input } from "@/components/ui/input"`
- [x] Added `const user = useAuthStore((s) => s.user)` inside the component
- [x] Added six new state fields with `contactEmail` pre-populated from `profile?.contactEmail ?? user?.email ?? ""`
- [x] Updated `handleSaveAndFinish()` to pass all six fields (empty string converted to null with `|| null`)
- [x] Rendered six `<Input>` fields with labels below the Summary textarea

### Task 9: Update tests (AC: 9)

- [x] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`
- [x] In `buildFromProfile_allSections()`: added `profile.setLinkedInUrl` and `profile.setContactEmail`; added assertions for `summaryItem.linkedInUrl()` and `summaryItem.contactEmail()`
- [x] Open `frontend/src/components/resume/sections/SummarySectionRenderer.test.tsx`
- [x] Updated `buildItem()` helper to include the six new nullable fields defaulting to `null`
- [x] Added test: contact row renders when `linkedInUrl` is non-null (anchor with href)
- [x] Added test: no contact row when all six fields are null
- [x] Added test: location renders as `"Berlin, Germany"` when both city and country are set
- [x] Added test: contactEmail renders as plain text
- [x] All existing tests continue to pass (185/185 frontend tests green)

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)
| File | Change |
|------|--------|
| `src/main/java/.../profile/domain/Profile.java` | Add 6 nullable `@Column` fields |
| `src/main/java/.../profile/dto/ProfileUpdateRequest.java` | Add 6 nullable String fields |
| `src/main/java/.../profile/dto/ProfileDto.java` | Add 6 nullable String fields |
| `src/main/java/.../profile/ProfileService.java` | Map new fields in `updateProfile()` and `toDto()` |
| `src/main/java/.../resume/domain/SummaryItem.java` | Expand record to 8 fields |
| `src/main/java/.../resume/ResumeService.java` | Pass new fields in `buildFromProfile()` |
| `frontend/src/types/api.ts` | Expand `SummaryItemDto`; expand `ProfileDto` and `ProfileUpdateRequest` interfaces |
| `frontend/src/components/resume/sections/SummarySectionRenderer.tsx` | Add contact row |
| `frontend/src/components/profile/SummaryStep.tsx` | Add contact field inputs |
| `src/test/java/.../resume/ResumeServiceTest.java` | Assert new SummaryItem fields |
| `frontend/src/components/resume/sections/SummarySectionRenderer.test.tsx` | New tests for contact row |

### Files to Create (NEW)
| File | Notes |
|------|-------|
| `src/main/resources/db/migration/V13__add_profile_contact_fields.sql` | Six `ALTER TABLE` statements; DDL only |

### Critical Implementation Details

**Migration number:** V10 = extended section tables, V11 = typed items data migration, V12 = template section order update. **V13** is the correct next number for this story.

**No JSONB data migration needed:** `SummaryItem` fields are stored in the `resumes.resume_content` JSONB column. Existing rows that predate this story simply lack the six new keys. Jackson deserializes missing JSON object keys as `null` for nullable record components — this is standard behavior and requires no `@JsonIgnoreProperties` annotation. The `ResumeDocumentConverter` uses the shared Spring `ObjectMapper` bean (configured in `JacksonConfig`), which inherits this behavior automatically.

**SummaryItem record constructor order matters:** All call sites that directly construct `new SummaryItem(id, text)` must be updated. There are two: `ResumeService.buildFromProfile()` and `LlmSectionExtractor.buildTypedItem()` (`case SUMMARY`). Both must pass the six new fields. For `LlmSectionExtractor`, the LLM response for SUMMARY sections won't include contact fields — pass `null` for all six in that `case SUMMARY` branch.

**`ProfileDto` TypeScript interface and `ProfileUpdateRequest`:** Both must be expanded in `api.ts`. `useResumeUpload.ts` constructs a `ProfileDto` inline in `handleFileChange()` — that object literal must also include the six new keys (all `null`) to satisfy TypeScript strict mode.

**`SummaryStep` email pre-population:** Only pre-populate `contactEmail` from `user?.email` if `profile?.contactEmail` is null or empty. Never overwrite an already-saved email. The condition `profile?.contactEmail ?? user?.email ?? ""` achieves this with nullish coalescing.

---

## Dev Notes

The JSONB backward-compatibility assumption was verified by reading `ResumeDocumentConverter.java`: it uses `objectMapper.readValue(dbData, ResumeDocument.class)` with the shared Spring `ObjectMapper`. Jackson's default deserialization for Java records treats missing JSON properties as `null` for nullable reference types. No `FAIL_ON_UNKNOWN_PROPERTIES` is set to `true` in `JacksonConfig.java` — the default is `false`. This confirms no V14 data migration is needed for existing `SummaryItem` JSONB rows.

---

## File List

### To Create
- `src/main/resources/db/migration/V13__add_profile_contact_fields.sql`

### To Modify
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/SummaryItem.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java` (SUMMARY case)
- `frontend/src/types/api.ts`
- `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- `frontend/src/components/profile/SummaryStep.tsx`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`
- `frontend/src/components/resume/sections/SummarySectionRenderer.test.tsx`

---

## Dev Agent Record

### Completion Notes

Implemented all 9 tasks covering AC1–AC9. Key decisions:
- Migration used V15 (not V13 as the story assumed) because V13 and V14 were added by earlier stories in epic 4.
- `SummaryStep.tsx` contact row input fields are placed after the summary textarea, matching AC8 spec.
- `useResumeUpload.ts` seeded ProfileDto literal was also updated to include all required fields (6 new nulls + the 4 existing list fields that were previously missing from the literal — fixing a latent TS issue).
- The pre-existing flaky test `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` fails due to a timestamp precision race condition unrelated to this story (confirmed by running it against main before my changes).

---

## File List

### Created
- `src/main/resources/db/migration/V15__add_profile_contact_fields.sql`

### Modified
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/SummaryItem.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/upload/parsers/LlmSectionExtractor.java`
- `frontend/src/types/api.ts`
- `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- `frontend/src/components/profile/SummaryStep.tsx`
- `frontend/src/hooks/useResumeUpload.ts`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeItemSerializationTest.java`
- `frontend/src/components/resume/sections/SummarySectionRenderer.test.tsx`

---

## Change Log
- 2026-06-10: Story created
- 2026-06-11: Implemented all tasks (AC1–AC9); 185/185 frontend tests pass; 0 TS errors; 0 ESLint errors
