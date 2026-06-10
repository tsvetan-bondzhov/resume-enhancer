# Story 4.9: Extended Summary Profile Fields — Contact & Links

**Status:** backlog
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

- [ ] Create `src/main/resources/db/migration/V13__add_profile_contact_fields.sql`
- [ ] Add six `ALTER TABLE profiles ADD COLUMN` statements (all nullable, no defaults):
  ```sql
  ALTER TABLE profiles ADD COLUMN linked_in_url    VARCHAR(500);
  ALTER TABLE profiles ADD COLUMN personal_page_url VARCHAR(500);
  ALTER TABLE profiles ADD COLUMN blog_url          VARCHAR(500);
  ALTER TABLE profiles ADD COLUMN contact_email     VARCHAR(255);
  ALTER TABLE profiles ADD COLUMN location_country  VARCHAR(100);
  ALTER TABLE profiles ADD COLUMN location_city     VARCHAR(100);
  ```
- [ ] Confirm V10 = extended sections, V11 = typed items migration, V12 = template section orders. V13 is the correct next number.

### Task 2: Update `Profile` entity (AC: 2)

- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java`
- [ ] Add six `@Column` fields after the existing `summary` column field:
  ```java
  @Column(name = "linked_in_url")
  private String linkedInUrl;

  @Column(name = "personal_page_url")
  private String personalPageUrl;

  @Column(name = "blog_url")
  private String blogUrl;

  @Column(name = "contact_email")
  private String contactEmail;

  @Column(name = "location_country")
  private String locationCountry;

  @Column(name = "location_city")
  private String locationCity;
  ```
- [ ] Lombok `@Getter`/`@Setter` is already on the class — no explicit accessors needed.

### Task 3: Update `ProfileUpdateRequest` and `ProfileDto` (AC: 3)

- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java`
- [ ] Add six nullable `String` fields after `summary`:
  ```java
  String linkedInUrl,
  String personalPageUrl,
  String blogUrl,
  String contactEmail,
  String locationCountry,
  String locationCity,
  ```
- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java`
- [ ] Add the same six nullable `String` fields after `summary`.
- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java`
- [ ] In `updateProfile()`: after `profile.setSummary(request.summary())`, add:
  ```java
  profile.setLinkedInUrl(request.linkedInUrl());
  profile.setPersonalPageUrl(request.personalPageUrl());
  profile.setBlogUrl(request.blogUrl());
  profile.setContactEmail(request.contactEmail());
  profile.setLocationCountry(request.locationCountry());
  profile.setLocationCity(request.locationCity());
  ```
- [ ] In `toDto(Profile profile)`: update the `ProfileDto` constructor call to include the six new fields.
- [ ] In `emptyProfileDto()`: pass `null` for all six new fields.

### Task 4: Update `SummaryItem` Java record (AC: 4)

- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/domain/SummaryItem.java`
- [ ] Replace the record body with the expanded signature from AC4.
- [ ] Verify `ResumeItem.java` — `SummaryItem` is already listed in `@JsonSubTypes` with `name = "SUMMARY"`. The new fields serialize as standard JSON properties and will deserialize from existing JSONB blobs as `null` (Jackson default). No `@JsonIgnoreProperties` needed since the `ObjectMapper` in `JacksonConfig` uses `MapperFeature.DEFAULT_VIEW_INCLUSION` defaults.
- [ ] Confirm `ResumeDocumentConverter` uses the shared `ObjectMapper` bean — it will pick up the updated record automatically.

### Task 5: Update `buildFromProfile()` in `ResumeService` (AC: 5)

- [ ] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java`
- [ ] Locate the `SummaryItem` construction in `buildFromProfile()` (line ~142)
- [ ] Replace:
  ```java
  List<ResumeItem> summaryItems = List.of(new SummaryItem(UUID.randomUUID().toString(), summaryText));
  ```
  with:
  ```java
  List<ResumeItem> summaryItems = List.of(new SummaryItem(
      UUID.randomUUID().toString(),
      summaryText,
      profile.getLinkedInUrl(),
      profile.getPersonalPageUrl(),
      profile.getBlogUrl(),
      profile.getContactEmail(),
      profile.getLocationCountry(),
      profile.getLocationCity()
  ));
  ```

### Task 6: Update `SummaryItemDto` in `api.ts` (AC: 6)

- [ ] Open `frontend/src/types/api.ts`
- [ ] Extend `SummaryItemDto` with the six new nullable fields (see AC6 snippet).

### Task 7: Update `SummarySectionRenderer.tsx` (AC: 7)

- [ ] Open `frontend/src/components/resume/sections/SummarySectionRenderer.tsx`
- [ ] Add `import { ExternalLink } from "lucide-react"` at the top.
- [ ] Inside the `items.map()`, before the text `<p>`, add a contact row:
  ```tsx
  const hasContact =
    item.contactEmail != null ||
    item.linkedInUrl != null ||
    item.personalPageUrl != null ||
    item.blogUrl != null ||
    item.locationCountry != null ||
    item.locationCity != null

  const location = [item.locationCity, item.locationCountry]
    .filter(Boolean)
    .join(", ")
  ```
  Then render:
  ```tsx
  {hasContact && (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1">
      {item.contactEmail != null && <span>{item.contactEmail}</span>}
      {item.linkedInUrl != null && (
        <a href={item.linkedInUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
          LinkedIn<ExternalLink className="inline h-3 w-3 ml-0.5" />
        </a>
      )}
      {item.personalPageUrl != null && (
        <a href={item.personalPageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
          Website<ExternalLink className="inline h-3 w-3 ml-0.5" />
        </a>
      )}
      {item.blogUrl != null && (
        <a href={item.blogUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
          Blog<ExternalLink className="inline h-3 w-3 ml-0.5" />
        </a>
      )}
      {location.length > 0 && <span>{location}</span>}
    </div>
  )}
  ```
- [ ] The existing text paragraph rendering (read-only and edit mode) is unchanged.

### Task 8: Update `SummaryStep.tsx` (AC: 8)

- [ ] Open `frontend/src/components/profile/SummaryStep.tsx`
- [ ] Add `import { useAuthStore } from "@/stores/useAuthStore"` and `import { Input } from "@/components/ui/input"`.
- [ ] Add `const user = useAuthStore((s) => s.user)` inside the component.
- [ ] Add six new state fields. For `contactEmail`, initialize from profile or fall back to authenticated user email:
  ```ts
  const [contactEmail, setContactEmail] = useState(
    profile?.contactEmail ?? user?.email ?? ""
  )
  const [linkedInUrl, setLinkedInUrl] = useState(profile?.linkedInUrl ?? "")
  const [personalPageUrl, setPersonalPageUrl] = useState(profile?.personalPageUrl ?? "")
  const [blogUrl, setBlogUrl] = useState(profile?.blogUrl ?? "")
  const [locationCity, setLocationCity] = useState(profile?.locationCity ?? "")
  const [locationCountry, setLocationCountry] = useState(profile?.locationCountry ?? "")
  ```
- [ ] Update `handleSaveAndFinish()` to pass all six (convert empty string to null with `|| null`):
  ```ts
  await onSaveAndContinue({
    summary: summary || null,
    contactEmail: contactEmail || null,
    linkedInUrl: linkedInUrl || null,
    personalPageUrl: personalPageUrl || null,
    blogUrl: blogUrl || null,
    locationCity: locationCity || null,
    locationCountry: locationCountry || null,
  })
  ```
- [ ] Render six `<Input>` fields in the form below the Summary textarea, each with a `<label>`.

### Task 9: Update tests (AC: 9)

- [ ] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java`
- [ ] In `buildFromProfile_allSections()`: add `profile.setLinkedInUrl("https://linkedin.com/in/test")` and `profile.setContactEmail("user@example.com")` to the profile setup. After the existing `summaryItem.text()` assertion, add:
  ```java
  assertThat(summaryItem.linkedInUrl()).isEqualTo("https://linkedin.com/in/test");
  assertThat(summaryItem.contactEmail()).isEqualTo("user@example.com");
  ```
- [ ] Open `frontend/src/components/resume/sections/SummarySectionRenderer.test.tsx`
- [ ] Update `buildItem()` helper to include the six new nullable fields defaulting to `null`.
- [ ] Add test: contact row renders when `linkedInUrl` is non-null (check `<a>` with `href` in DOM).
- [ ] Add test: no contact row when all six fields are null (check no `<div>` with flex class).
- [ ] Add test: location renders as `"Berlin, Germany"` when both city and country are set.
- [ ] Existing tests continue to pass with defaults all null (contact row absent).

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

## Change Log
- 2026-06-10: Story created
