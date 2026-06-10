# Story 3.12: Extended Profile Domain — Certifications, Languages, Projects, Volunteering

Status: done

## Story

As a user,
I want my profile to store certifications, languages, projects, and volunteering experience in addition to work history, education, and skills,
so that my resume can accurately reflect my full professional background across all common section types.

## Acceptance Criteria

**AC1 — Flyway migration `V10__add_profile_extended_sections.sql`**
**Given** Flyway migration `V10__add_profile_extended_sections.sql` is applied
**When** the application starts
**Then** four new tables exist:
- `profile_certifications(id UUID PK DEFAULT gen_random_uuid(), profile_id UUID FK NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, issuer VARCHAR(255), issue_date DATE, expiration_date DATE, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())`
- `profile_languages(id UUID PK DEFAULT gen_random_uuid(), profile_id UUID FK NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, proficiency_level VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())`
- `profile_projects(id UUID PK DEFAULT gen_random_uuid(), profile_id UUID FK NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, description TEXT, technologies VARCHAR(255), link VARCHAR(255), start_date DATE, end_date DATE, is_current BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())`
- `profile_volunteering(id UUID PK DEFAULT gen_random_uuid(), profile_id UUID FK NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, role VARCHAR(255) NOT NULL, organization VARCHAR(255) NOT NULL, description TEXT, start_date DATE, end_date DATE, is_current BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW())`

**AC2 — Four new JPA entities in `profile.domain`**
**Given** the four new JPA entities are defined in `profile.domain`
**When** Hibernate validates the schema
**Then** `Certification`, `Language`, `Project`, and `Volunteering` each extend `BaseEntity`; each has a `@ManyToOne` to `Profile`; `Language.proficiencyLevel` is stored as `VARCHAR` mapped to a `LanguageProficiencyLevel` enum (`BEGINNER`, `ELEMENTARY`, `INTERMEDIATE`, `UPPER_INTERMEDIATE`, `ADVANCED`, `NATIVE`) using `@Enumerated(EnumType.STRING)`; all nullable columns are reflected as nullable Java fields; non-null DB columns are mapped with `nullable = false` in the `@Column` annotation

**AC3 — `Profile.java` updated with four new `@OneToMany` lists**
**Given** `Profile.java` is updated
**When** profile data is loaded or cascaded
**Then** `Profile` gains `@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)` lists for `certifications`, `languages`, `projects`, and `volunteering`; all four are initialized as `new ArrayList<>()` following the same pattern as `workExperiences`, `education`, and `skills`; no existing `@OneToMany` annotations or field initializations are changed

**AC4 — Request and DTO records in `profile.dto`**
**Given** Request and DTO records are defined in `profile.dto`
**When** a caller uses them
**Then**:
- `CertificationRequest(@NotBlank String name, String issuer, LocalDate issueDate, LocalDate expirationDate)`
- `LanguageRequest(@NotBlank String name, @NotNull LanguageProficiencyLevel proficiencyLevel)`
- `ProjectRequest(@NotBlank String name, String description, String technologies, String link, LocalDate startDate, LocalDate endDate, boolean isCurrent)`
- `VolunteeringRequest(@NotBlank String role, @NotBlank String organization, String description, LocalDate startDate, LocalDate endDate, boolean isCurrent)`
- Corresponding `CertificationDto`, `LanguageDto`, `ProjectDto`, `VolunteeringDto` records mirror the same fields without validation annotations; `LanguageDto.proficiencyLevel` is `LanguageProficiencyLevel` (enum type, not String)

**AC5 — `ProfileUpdateRequest` and `ProfileDto` updated**
**Given** `ProfileUpdateRequest` and `ProfileDto` are updated
**When** `PUT /api/v1/profile` is called
**Then** `ProfileUpdateRequest` gains optional `List<CertificationRequest> certifications`, `List<LanguageRequest> languages`, `List<ProjectRequest> projects`, `List<VolunteeringRequest> volunteering` fields annotated with `@Valid`; `ProfileDto` gains four corresponding `List<CertificationDto> certifications`, `List<LanguageDto> languages`, `List<ProjectDto> projects`, `List<VolunteeringDto> volunteering` fields; null request lists are treated as empty lists (PUT-replace strategy unchanged)

**AC6 — `ProfileService.updateProfile()` updated**
**Given** `ProfileService.updateProfile()` is updated
**When** a profile update is persisted
**Then** the same clear-and-repopulate strategy is applied to all four new lists using `profile.get<Collection>().clear()` followed by `forEach`; `toDto()` includes all four new lists in the returned `ProfileDto`; `emptyProfileDto()` is updated to include four empty lists for the new fields; existing behaviour for `workExperiences`, `education`, and `skills` is unchanged

**AC7 — Frontend `ProfileDto` TypeScript interface updated**
**Given** the frontend `ProfileDto` TypeScript interface is updated in `frontend/src/types/api.ts`
**When** the API response is parsed
**Then** `ProfileDto` gains `certifications: CertificationDto[]`, `languages: LanguageDto[]`, `projects: ProjectDto[]`, `volunteering: VolunteeringDto[]`; a `LanguageProficiencyLevel` TypeScript union type is defined as `"BEGINNER" | "ELEMENTARY" | "INTERMEDIATE" | "UPPER_INTERMEDIATE" | "ADVANCED" | "NATIVE"`; all four new list fields default to empty arrays when absent (backward-compatible); `CertificationDto`, `LanguageDto`, `ProjectDto`, `VolunteeringDto` interfaces and corresponding `*Request` types are added

**AC8 — Profile edit form updated with four new collapsible subsections**
**Given** the profile edit form is updated
**When** the user opens the profile page
**Then** collapsible subsections for Certifications, Languages, Projects, and Volunteering are rendered below the existing Skills section; each subsection supports adding, inline editing, and deleting individual items using the same UX pattern as work experiences and education (same component shape: `id`-keyed draft state, required-field blur validation, "Add another" button, "× Remove" per entry, "Save & Continue" calls `onSaveAndContinue`); `ProfilePage.tsx` is updated to pass new list fields in the `current` baseline when building `payload` for `PUT /api/v1/profile`; `ProfileUpdateRequest` baseline in `ProfilePage.tsx` is extended to include the four new fields defaulting to `[]`

**AC9 — Tests**
**Given** the story is implemented
**When** tests are run
**Then** `ProfileServiceTest.java` covers:
- `updateProfile_newProfile_includesAllFourNewLists` — verifies create path persists certifications, languages, projects, and volunteering from request
- `updateProfile_existingProfile_replacesAllFourNewLists` — verifies clear-and-repopulate for each new list
- `getProfile_profileWithAllSections_mapsAllFourNewCollections` — verifies `toDto()` maps all four new lists correctly
And `ProfileControllerIntegrationTest.java` verifies a round-trip `PUT /api/v1/profile` with all four new lists persists correctly and is returned by `GET /api/v1/profile`

---

## Tasks / Subtasks

### Task 1: Create Flyway migration `V10__add_profile_extended_sections.sql` (AC: 1)

- [x] Create `src/main/resources/db/migration/V10__add_profile_extended_sections.sql`

**CRITICAL — Flyway state:** V1–V9 are applied. Next version is V10. NEVER modify existing migrations.

**Migration SQL:**
```sql
-- V10: Add profile extended section tables for certifications, languages, projects, volunteering.
-- DDL only — no data changes.

CREATE TABLE profile_certifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    issuer          VARCHAR(255),
    issue_date      DATE,
    expiration_date DATE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_languages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    technologies VARCHAR(255),
    link         VARCHAR(255),
    start_date   DATE,
    end_date     DATE,
    is_current   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_volunteering (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    role         VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    description  TEXT,
    start_date   DATE,
    end_date     DATE,
    is_current   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Pattern reference:** Matches V2 (`profile_work_experiences`, `profile_education`, `profile_skills`) exactly — same UUID PK, same FK with ON DELETE CASCADE, same `created_at`/`updated_at` defaults.

---

### Task 2: Create `LanguageProficiencyLevel` enum in `profile.domain` (AC: 2)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/LanguageProficiencyLevel.java`

```java
package com.tsvetanbondzhov.resumeenhancer.profile.domain;

public enum LanguageProficiencyLevel {
    BEGINNER,
    ELEMENTARY,
    INTERMEDIATE,
    UPPER_INTERMEDIATE,
    ADVANCED,
    NATIVE
}
```

**CRITICAL:** This is a domain enum, NOT a DTO type. It lives in `profile.domain` alongside `WorkExperience`, `Education`, `Skill`. The DTO `LanguageDto` uses this same enum type for its `proficiencyLevel` field.

---

### Task 3: Create four JPA entity classes in `profile.domain` (AC: 2)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Certification.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Language.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Project.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Volunteering.java`

**`Certification.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.domain;

import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "profile_certifications")
@Getter
@Setter
public class Certification extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private Profile profile;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "issuer")
    private String issuer;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;
}
```

**`Language.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.domain;

import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "profile_languages")
@Getter
@Setter
public class Language extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private Profile profile;

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "proficiency_level", nullable = false)
    private LanguageProficiencyLevel proficiencyLevel;
}
```

**`Project.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.domain;

import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "profile_projects")
@Getter
@Setter
public class Project extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private Profile profile;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "technologies")
    private String technologies;

    @Column(name = "link")
    private String link;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "is_current", nullable = false)
    private boolean isCurrent = false;
}
```

**`Volunteering.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.domain;

import com.tsvetanbondzhov.resumeenhancer.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "profile_volunteering")
@Getter
@Setter
public class Volunteering extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "profile_id", nullable = false)
    private Profile profile;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "organization", nullable = false)
    private String organization;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "is_current", nullable = false)
    private boolean isCurrent = false;
}
```

**CRITICAL — Lombok on entity classes only:** Consistent with `WorkExperience`, `Education`, and `Skill` — all use `@Getter @Setter` with no `@Data` or `@Builder`. Do NOT use records for JPA entities.

**CRITICAL — `BaseEntity`:** All four extend `com.tsvetanbondzhov.resumeenhancer.common.BaseEntity` which provides `id` (UUID), `createdAt`, `updatedAt`. Do NOT redeclare these fields.

**CRITICAL — `columnDefinition = "TEXT"`:** `description` fields are mapped to PostgreSQL `TEXT` type. Without this, Hibernate defaults to `VARCHAR(255)` which would conflict with the DDL `TEXT` column.

---

### Task 4: Update `Profile.java` with four new `@OneToMany` lists (AC: 3)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java`

**Add four imports:**
```java
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Certification;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Language;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Project;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Volunteering;
```

**Add four new `@OneToMany` fields after the existing `skills` field:**
```java
@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Certification> certifications = new ArrayList<>();

@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Language> languages = new ArrayList<>();

@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Project> projects = new ArrayList<>();

@OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Volunteering> volunteering = new ArrayList<>();
```

**CRITICAL — Do NOT change existing fields:** The existing `workExperiences`, `education`, and `skills` `@OneToMany` annotations, fetch types, and `ArrayList<>` initializations must remain exactly as they are. Only append new fields.

---

### Task 5: Create Request and DTO records in `profile.dto` (AC: 4)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/CertificationRequest.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/CertificationDto.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/LanguageRequest.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/LanguageDto.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProjectRequest.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProjectDto.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/VolunteeringRequest.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/VolunteeringDto.java`

**`CertificationRequest.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CertificationRequest(
        @NotBlank(message = "Certification name is required")
        String name,
        String issuer,
        LocalDate issueDate,
        LocalDate expirationDate
) {}
```

**`CertificationDto.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record CertificationDto(
        String name,
        String issuer,
        LocalDate issueDate,
        LocalDate expirationDate
) {}
```

**`LanguageRequest.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import com.tsvetanbondzhov.resumeenhancer.profile.domain.LanguageProficiencyLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LanguageRequest(
        @NotBlank(message = "Language name is required")
        String name,
        @NotNull(message = "Proficiency level is required")
        LanguageProficiencyLevel proficiencyLevel
) {}
```

**`LanguageDto.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import com.tsvetanbondzhov.resumeenhancer.profile.domain.LanguageProficiencyLevel;

public record LanguageDto(
        String name,
        LanguageProficiencyLevel proficiencyLevel
) {}
```

**`ProjectRequest.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record ProjectRequest(
        @NotBlank(message = "Project name is required")
        String name,
        String description,
        String technologies,
        String link,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
```

**`ProjectDto.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record ProjectDto(
        String name,
        String description,
        String technologies,
        String link,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
```

**`VolunteeringRequest.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record VolunteeringRequest(
        @NotBlank(message = "Role is required")
        String role,
        @NotBlank(message = "Organization is required")
        String organization,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
```

**`VolunteeringDto.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record VolunteeringDto(
        String role,
        String organization,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
```

**CRITICAL — Pattern:** All Request records use `jakarta.validation.constraints.*`. All Dto records have no validation annotations. This is identical to the existing `WorkExperienceRequest` / `WorkExperienceDto` pattern. Use Java records (not classes) for both.

**CRITICAL — `LocalDate` in DTOs:** `LocalDate` fields are used directly (not `String`). Jackson serializes `LocalDate` as `"YYYY-MM-DD"` strings — this works because the Spring Boot `ObjectMapper` is configured with `JavaTimeModule`. Do NOT change to `String` in DTOs.

---

### Task 6: Update `ProfileUpdateRequest.java` and `ProfileDto.java` (AC: 5)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java`
- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java`

**New `ProfileUpdateRequest.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.Valid;
import java.util.List;

public record ProfileUpdateRequest(
        String summary,

        @Valid
        List<WorkExperienceRequest> workExperiences,

        @Valid
        List<EducationRequest> education,

        @Valid
        List<SkillRequest> skills,

        @Valid
        List<CertificationRequest> certifications,

        @Valid
        List<LanguageRequest> languages,

        @Valid
        List<ProjectRequest> projects,

        @Valid
        List<VolunteeringRequest> volunteering
) {
}
```

**New `ProfileDto.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.util.List;

public record ProfileDto(
        String summary,
        List<WorkExperienceDto> workExperiences,
        List<EducationDto> education,
        List<SkillDto> skills,
        List<CertificationDto> certifications,
        List<LanguageDto> languages,
        List<ProjectDto> projects,
        List<VolunteeringDto> volunteering
) {
}
```

**CRITICAL — `ProfileDto` constructor change is BREAKING:** `ProfileDto` is a Java record. Its canonical constructor signature changes from 4 → 8 parameters. Every `new ProfileDto(...)` call site must be updated. There are exactly two in `ProfileService`: `toDto(Profile)` and `emptyProfileDto()`. Both are updated in Task 7.

**CRITICAL — `ProfileUpdateRequest` constructor change is BREAKING:** `ProfileUpdateRequest` is also a Java record. Its constructor changes from 4 → 8 parameters. Every `new ProfileUpdateRequest(...)` call site must be found and updated. Check `ProfileServiceTest.java` — it constructs `ProfileUpdateRequest` directly in tests (lines 126–131, 174–178). Those test call sites must be updated in Task 9.

---

### Task 7: Update `ProfileService.java` (AC: 6)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java`

**Imports to add:**
```java
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Certification;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Language;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Project;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Volunteering;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.CertificationDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.CertificationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.LanguageDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.LanguageRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringRequest;
```

**Add to `updateProfile()` after the `skills` block (before `profileRepository.save(profile)`):**
```java
profile.getCertifications().clear();
List<CertificationRequest> certList = request.certifications() != null
        ? request.certifications() : Collections.emptyList();
certList.forEach(dto -> profile.getCertifications().add(toEntity(dto, profile)));

profile.getLanguages().clear();
List<LanguageRequest> langList = request.languages() != null
        ? request.languages() : Collections.emptyList();
langList.forEach(dto -> profile.getLanguages().add(toEntity(dto, profile)));

profile.getProjects().clear();
List<ProjectRequest> projList = request.projects() != null
        ? request.projects() : Collections.emptyList();
projList.forEach(dto -> profile.getProjects().add(toEntity(dto, profile)));

profile.getVolunteering().clear();
List<VolunteeringRequest> volList = request.volunteering() != null
        ? request.volunteering() : Collections.emptyList();
volList.forEach(dto -> profile.getVolunteering().add(toEntity(dto, profile)));
```

**Update `toDto(Profile profile)` — change return statement to include all 8 fields:**
```java
private ProfileDto toDto(Profile profile) {
    List<WorkExperienceDto> workExperiences = profile.getWorkExperiences().stream()
            .map(this::toDto)
            .toList();
    List<EducationDto> education = profile.getEducation().stream()
            .map(this::toDto)
            .toList();
    List<SkillDto> skills = profile.getSkills().stream()
            .map(we -> new SkillDto(we.getName()))
            .toList();
    List<CertificationDto> certifications = profile.getCertifications().stream()
            .map(this::toDto)
            .toList();
    List<LanguageDto> languages = profile.getLanguages().stream()
            .map(this::toDto)
            .toList();
    List<ProjectDto> projects = profile.getProjects().stream()
            .map(this::toDto)
            .toList();
    List<VolunteeringDto> volunteering = profile.getVolunteering().stream()
            .map(this::toDto)
            .toList();
    return new ProfileDto(profile.getSummary(), workExperiences, education, skills,
            certifications, languages, projects, volunteering);
}
```

**Update `emptyProfileDto()`:**
```java
private ProfileDto emptyProfileDto() {
    return new ProfileDto(null, Collections.emptyList(), Collections.emptyList(),
            Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
            Collections.emptyList(), Collections.emptyList());
}
```

**Add four new `toDto()` overloads:**
```java
private CertificationDto toDto(Certification c) {
    return new CertificationDto(c.getName(), c.getIssuer(), c.getIssueDate(), c.getExpirationDate());
}

private LanguageDto toDto(Language l) {
    return new LanguageDto(l.getName(), l.getProficiencyLevel());
}

private ProjectDto toDto(Project p) {
    return new ProjectDto(p.getName(), p.getDescription(), p.getTechnologies(),
            p.getLink(), p.getStartDate(), p.getEndDate(), p.isCurrent());
}

private VolunteeringDto toDto(Volunteering v) {
    return new VolunteeringDto(v.getRole(), v.getOrganization(), v.getDescription(),
            v.getStartDate(), v.getEndDate(), v.isCurrent());
}
```

**Add four new `toEntity()` converters:**
```java
private Certification toEntity(CertificationRequest dto, Profile profile) {
    Certification c = new Certification();
    c.setProfile(profile);
    c.setName(dto.name());
    c.setIssuer(dto.issuer());
    c.setIssueDate(dto.issueDate());
    c.setExpirationDate(dto.expirationDate());
    return c;
}

private Language toEntity(LanguageRequest dto, Profile profile) {
    Language l = new Language();
    l.setProfile(profile);
    l.setName(dto.name());
    l.setProficiencyLevel(dto.proficiencyLevel());
    return l;
}

private Project toEntity(ProjectRequest dto, Profile profile) {
    Project p = new Project();
    p.setProfile(profile);
    p.setName(dto.name());
    p.setDescription(dto.description());
    p.setTechnologies(dto.technologies());
    p.setLink(dto.link());
    p.setStartDate(dto.startDate());
    p.setEndDate(dto.endDate());
    p.setCurrent(dto.isCurrent());
    return p;
}

private Volunteering toEntity(VolunteeringRequest dto, Profile profile) {
    Volunteering v = new Volunteering();
    v.setProfile(profile);
    v.setRole(dto.role());
    v.setOrganization(dto.organization());
    v.setDescription(dto.description());
    v.setStartDate(dto.startDate());
    v.setEndDate(dto.endDate());
    v.setCurrent(dto.isCurrent());
    return v;
}
```

**CRITICAL — `Project.isCurrent()` vs `Project.getIsCurrent()`:** Lombok generates `isCurrent()` for boolean fields named `isCurrent` (strips the `is` prefix). The getter is `isCurrent()`, and the setter is `setCurrent(boolean)`. This is the same pattern used in `WorkExperience` — confirmed by `ProfileService.java` line 119: `we.setCurrent(dto.isCurrent())`.

---

### Task 8: Update frontend `types/api.ts` (AC: 7)

- [x] Edit `frontend/src/types/api.ts`

**Add `LanguageProficiencyLevel` type and four new DTO interfaces/types after the existing `SkillDto`/`SkillRequest` block, before `ParsedResumeDtoResponse`:**

```typescript
export type LanguageProficiencyLevel =
  | "BEGINNER"
  | "ELEMENTARY"
  | "INTERMEDIATE"
  | "UPPER_INTERMEDIATE"
  | "ADVANCED"
  | "NATIVE"

export interface CertificationDto {
  name: string
  issuer: string | null
  issueDate: string | null
  expirationDate: string | null
}

export interface LanguageDto {
  name: string
  proficiencyLevel: LanguageProficiencyLevel
}

export interface ProjectDto {
  name: string
  description: string | null
  technologies: string | null
  link: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface VolunteeringDto {
  role: string
  organization: string
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface CertificationRequest {
  name: string
  issuer: string | null
  issueDate: string | null
  expirationDate: string | null
}

export interface LanguageRequest {
  name: string
  proficiencyLevel: LanguageProficiencyLevel
}

export interface ProjectRequest {
  name: string
  description: string | null
  technologies: string | null
  link: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export interface VolunteeringRequest {
  role: string
  organization: string
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}
```

**Update `ProfileDto` interface — add four new fields:**
```typescript
export interface ProfileDto {
  summary: string | null
  workExperiences: WorkExperienceDto[]
  education: EducationDto[]
  skills: SkillDto[]
  certifications: CertificationDto[]
  languages: LanguageDto[]
  projects: ProjectDto[]
  volunteering: VolunteeringDto[]
}
```

**Update `ProfileUpdateRequest` interface — add four new fields:**
```typescript
export interface ProfileUpdateRequest {
  summary: string | null
  workExperiences: WorkExperienceRequest[]
  education: EducationRequest[]
  skills: SkillRequest[]
  certifications: CertificationRequest[]
  languages: LanguageRequest[]
  projects: ProjectRequest[]
  volunteering: VolunteeringRequest[]
}
```

**CRITICAL — date fields as `string | null`:** `LocalDate` fields from the Java backend serialize as `"YYYY-MM-DD"` strings. Use `string | null` in TypeScript, never `Date | null`. Parse with `new Date()` only at display time. This is the established pattern for `startDate`/`endDate` in `WorkExperienceDto`.

**CRITICAL — `ProfilePage.tsx` `current` baseline must also be updated (Task 10):** `ProfilePage.tsx` builds `payload` by spreading from `current` which is hardcoded as `{ summary: null, workExperiences: [], education: [], skills: [] }`. After adding four new fields to `ProfileUpdateRequest`, that baseline object will be missing the new fields — TypeScript strict mode will surface this as a compile error.

---

### Task 9: Update `ProfileServiceTest.java` (AC: 9)

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java`

**CRITICAL — `ProfileUpdateRequest` constructor changed from 4 → 8 params.** Every `new ProfileUpdateRequest(...)` call in the test file must be updated to include the four new list arguments.

**Existing test at line 126–131 (`updateProfile_noProfileExists_createsProfileBoundToUser`):**
```java
// Before (4 args):
ProfileUpdateRequest request = new ProfileUpdateRequest(
        "Summary text",
        List.of(new WorkExperienceRequest("Dev", "Corp", LocalDate.of(2020, 1, 1), null, true, "Work")),
        List.of(new EducationRequest("Uni", "MSc", "CS", LocalDate.of(2018, 9, 1), LocalDate.of(2020, 6, 1))),
        List.of(new SkillRequest("Java"))
);

// After (8 args):
ProfileUpdateRequest request = new ProfileUpdateRequest(
        "Summary text",
        List.of(new WorkExperienceRequest("Dev", "Corp", LocalDate.of(2020, 1, 1), null, true, "Work")),
        List.of(new EducationRequest("Uni", "MSc", "CS", LocalDate.of(2018, 9, 1), LocalDate.of(2020, 6, 1))),
        List.of(new SkillRequest("Java")),
        List.of(),    // certifications
        List.of(),    // languages
        List.of(),    // projects
        List.of()     // volunteering
);
```

**Existing test at line 174–178 (`updateProfile_profileExists_replacesChildCollections`):**
```java
// Before (4 args):
ProfileUpdateRequest request = new ProfileUpdateRequest(
        "New summary",
        List.of(new WorkExperienceRequest("NewJob", "NewCorp", null, null, false, null)),
        List.of(),
        List.of(new SkillRequest("NewSkill"))
);

// After (8 args):
ProfileUpdateRequest request = new ProfileUpdateRequest(
        "New summary",
        List.of(new WorkExperienceRequest("NewJob", "NewCorp", null, null, false, null)),
        List.of(),
        List.of(new SkillRequest("NewSkill")),
        List.of(),    // certifications
        List.of(),    // languages
        List.of(),    // projects
        List.of()     // volunteering
);
```

**Add imports for new types:**
```java
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Certification;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Language;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.LanguageProficiencyLevel;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Project;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Volunteering;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.CertificationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.LanguageRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringRequest;
```

**Add three new test methods:**

```java
@Test
void updateProfile_newProfile_includesAllFourNewLists() {
    User user = buildUser();
    when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    when(profileRepository.findByUser(user)).thenReturn(Optional.empty());

    ProfileUpdateRequest request = new ProfileUpdateRequest(
            "Summary",
            List.of(),
            List.of(),
            List.of(),
            List.of(new CertificationRequest("AWS Cloud", "Amazon", LocalDate.of(2023, 1, 1), null)),
            List.of(new LanguageRequest("English", LanguageProficiencyLevel.NATIVE)),
            List.of(new ProjectRequest("MyApp", "A cool app", "Java, React", "https://github.com/test", null, null, false)),
            List.of(new VolunteeringRequest("Mentor", "Code.org", "Teaching kids", null, null, false))
    );

    ArgumentCaptor<Profile> captor = ArgumentCaptor.forClass(Profile.class);
    when(profileRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

    ProfileDto result = profileService.updateProfile(EMAIL, request);

    Profile saved = captor.getValue();
    assertThat(saved.getCertifications()).hasSize(1);
    assertThat(saved.getCertifications().get(0).getName()).isEqualTo("AWS Cloud");
    assertThat(saved.getLanguages()).hasSize(1);
    assertThat(saved.getLanguages().get(0).getProficiencyLevel()).isEqualTo(LanguageProficiencyLevel.NATIVE);
    assertThat(saved.getProjects()).hasSize(1);
    assertThat(saved.getProjects().get(0).getName()).isEqualTo("MyApp");
    assertThat(saved.getVolunteering()).hasSize(1);
    assertThat(saved.getVolunteering().get(0).getRole()).isEqualTo("Mentor");

    assertThat(result.certifications()).hasSize(1);
    assertThat(result.languages()).hasSize(1);
    assertThat(result.projects()).hasSize(1);
    assertThat(result.volunteering()).hasSize(1);
}

@Test
void updateProfile_existingProfile_replacesAllFourNewLists() {
    User user = buildUser();

    Profile existingProfile = new Profile();
    existingProfile.setUser(user);

    Certification oldCert = new Certification();
    oldCert.setName("OldCert");
    oldCert.setProfile(existingProfile);
    existingProfile.getCertifications().add(oldCert);

    Language oldLang = new Language();
    oldLang.setName("French");
    oldLang.setProficiencyLevel(LanguageProficiencyLevel.BEGINNER);
    oldLang.setProfile(existingProfile);
    existingProfile.getLanguages().add(oldLang);

    when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    when(profileRepository.findByUser(user)).thenReturn(Optional.of(existingProfile));

    ProfileUpdateRequest request = new ProfileUpdateRequest(
            null,
            List.of(),
            List.of(),
            List.of(),
            List.of(new CertificationRequest("NewCert", null, null, null)),
            List.of(new LanguageRequest("Spanish", LanguageProficiencyLevel.ADVANCED)),
            List.of(),
            List.of()
    );

    ArgumentCaptor<Profile> captor = ArgumentCaptor.forClass(Profile.class);
    when(profileRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

    profileService.updateProfile(EMAIL, request);

    Profile saved = captor.getValue();
    assertThat(saved.getCertifications()).hasSize(1);
    assertThat(saved.getCertifications().get(0).getName()).isEqualTo("NewCert");
    assertThat(saved.getLanguages()).hasSize(1);
    assertThat(saved.getLanguages().get(0).getName()).isEqualTo("Spanish");
    assertThat(saved.getProjects()).isEmpty();
    assertThat(saved.getVolunteering()).isEmpty();
}

@Test
void getProfile_profileWithAllSections_mapsAllFourNewCollections() {
    User user = buildUser();
    Profile profile = new Profile();
    profile.setUser(user);

    Certification cert = new Certification();
    cert.setProfile(profile);
    cert.setName("AWS");
    cert.setIssuer("Amazon");
    cert.setIssueDate(LocalDate.of(2023, 5, 1));
    profile.getCertifications().add(cert);

    Language lang = new Language();
    lang.setProfile(profile);
    lang.setName("English");
    lang.setProficiencyLevel(LanguageProficiencyLevel.NATIVE);
    profile.getLanguages().add(lang);

    Project project = new Project();
    project.setProfile(profile);
    project.setName("ResumeApp");
    project.setTechnologies("Java, React");
    profile.getProjects().add(project);

    Volunteering vol = new Volunteering();
    vol.setProfile(profile);
    vol.setRole("Tutor");
    vol.setOrganization("LocalSchool");
    profile.getVolunteering().add(vol);

    when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    when(profileRepository.findByUser(user)).thenReturn(Optional.of(profile));

    ProfileDto result = profileService.getProfile(EMAIL);

    assertThat(result.certifications()).hasSize(1);
    assertThat(result.certifications().get(0).name()).isEqualTo("AWS");
    assertThat(result.languages()).hasSize(1);
    assertThat(result.languages().get(0).proficiencyLevel()).isEqualTo(LanguageProficiencyLevel.NATIVE);
    assertThat(result.projects()).hasSize(1);
    assertThat(result.projects().get(0).name()).isEqualTo("ResumeApp");
    assertThat(result.volunteering()).hasSize(1);
    assertThat(result.volunteering().get(0).role()).isEqualTo("Tutor");
}
```

**Also update existing tests that assert the empty `ProfileDto`** — e.g., `getProfile_noProfileExists_returnsEmptyProfileDto` currently asserts only 4 DTO fields. After the record change, any assertion that calls `new ProfileDto(...)` or checks emptyProfileDto will already work because the test just reads `result.certifications()` etc. — no constructor calls in the assertions. But verify the existing `assertThat(result.skills()).isEmpty()` etc. still compile (they will, since record accessors use field names, not constructor order).

---

### Task 10: Update `ProfilePage.tsx` baseline object (AC: 8)

- [x] Edit `frontend/src/pages/ProfilePage.tsx`

**The `current` baseline object in `handleSaveAndContinue` must include all four new fields:**

```typescript
// Before (4 fields):
const current = profile ?? {
  summary: null,
  workExperiences: [],
  education: [],
  skills: [],
}

// After (8 fields):
const current = profile ?? {
  summary: null,
  workExperiences: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
  projects: [],
  volunteering: [],
}
```

**The `payload` construction must include four new fields:**
```typescript
const payload: ProfileUpdateRequest = {
  summary: partial.summary !== undefined ? partial.summary : current.summary,
  workExperiences:
    partial.workExperiences !== undefined
      ? partial.workExperiences
      : current.workExperiences,
  education:
    partial.education !== undefined ? partial.education : current.education,
  skills: partial.skills !== undefined ? partial.skills : current.skills,
  certifications:
    partial.certifications !== undefined
      ? partial.certifications
      : (current.certifications ?? []),
  languages:
    partial.languages !== undefined
      ? partial.languages
      : (current.languages ?? []),
  projects:
    partial.projects !== undefined
      ? partial.projects
      : (current.projects ?? []),
  volunteering:
    partial.volunteering !== undefined
      ? partial.volunteering
      : (current.volunteering ?? []),
}
```

**CRITICAL — `?? []` fallback for new list fields:** When loading existing profiles from the API (stored before this story's migration), the response may omit the new fields (they'll default to `undefined`). The `?? []` ensures type safety. TypeScript strict mode enforces this since `ProfileDto.certifications` is `CertificationDto[]` not `CertificationDto[] | undefined`. Alternatively update `ProfileDto.certifications` to be optional — but the simpler fix is `?? []` in `ProfilePage`.

**Also update `isEmptyProfile()` to avoid marking profiles with new sections as "empty":**
```typescript
function isEmptyProfile(profile: ProfileDto): boolean {
  return (
    !profile.summary &&
    profile.workExperiences.length === 0 &&
    profile.education.length === 0 &&
    profile.skills.length === 0 &&
    (profile.certifications ?? []).length === 0 &&
    (profile.languages ?? []).length === 0 &&
    (profile.projects ?? []).length === 0 &&
    (profile.volunteering ?? []).length === 0
  )
}
```

**CRITICAL — `STEPS` array must be extended** to include the four new steps (or the new steps must be added to the existing step structure). The current STEPS are `["Experience", "Education", "Skills", "Summary"]`. The AC says collapsible subsections are rendered below Skills. Choose one of two approaches:
1. Add new steps: `["Experience", "Education", "Skills", "Certifications", "Languages", "Projects", "Volunteering", "Summary"]` and create new Step components.
2. Add new sections to the existing SkillsStep or a new combined "Additional" step.

**The epic AC states:** "collapsible subsections for Certifications, Languages, Projects, and Volunteering are rendered below the existing Skills section." This implies a new step or an expanded step. The most consistent UX approach with the existing step pattern is to add four new step components following the same pattern as `SkillsStep`. New steps: `["Experience", "Education", "Skills", "Certifications", "Languages", "Projects", "Volunteering", "Summary"]`.

**CRITICAL — `LAST_STEP` must be updated:** `LAST_STEP = STEPS.length - 1`. After adding steps, this must be recalculated. Currently it is `3`. With 8 steps it becomes `7`. The check `if (currentStep < LAST_STEP)` in `handleSaveAndContinue` controls when `toast.success("Profile saved")` fires and when `setStep(currentStep + 1)` is called — SummaryStep still must be the final step.

---

### Task 11: Create four new Step components in `frontend/src/components/profile/` (AC: 8)

- [x] Create `frontend/src/components/profile/CertificationsStep.tsx`
- [x] Create `frontend/src/components/profile/LanguagesStep.tsx`
- [x] Create `frontend/src/components/profile/ProjectsStep.tsx`
- [x] Create `frontend/src/components/profile/VolunteeringStep.tsx`

**Follow `SkillsStep.tsx` / `ExperienceStep.tsx` patterns exactly:**
- Internal draft state keyed by `crypto.randomUUID()` stable `id`
- `useState` initialized from `profile?.certifications ?? []` (etc.)
- `updateField(index, field, value)` function
- `handleBlur(index, field)` for required-field validation
- `addAnother()` appends new empty draft
- `removeEntry(index)` — show remove button only when `entries.length > 1`
- `validateAll()` returns entries with error strings set
- `handleSubmit()` calls `validateAll()`, bails if errors, calls `onSaveAndContinue({ certifications: [...] })`
- `<Button onClick={handleSubmit} disabled={isSaving}>Save & Continue</Button>`

**`CertificationsStep.tsx` required fields:** `name` only (`@NotBlank`). `issuer`, `issueDate`, `expirationDate` are optional.

**`LanguagesStep.tsx` required fields:** `name` (`@NotBlank`) and `proficiencyLevel` (`@NotNull`). Use a `<select>` or shadcn `Select` component for `proficiencyLevel` populated with `LanguageProficiencyLevel` values.

**`ProjectsStep.tsx` required fields:** `name` only (`@NotBlank`). All other fields optional.

**`VolunteeringStep.tsx` required fields:** `role` and `organization` (both `@NotBlank`). All other fields optional.

**shadcn component imports pattern** (follow existing steps):
- `Input` from `@/components/ui/input`
- `Button` from `@/components/ui/button`
- `Textarea` from `@/components/ui/textarea` (for description fields)
- `Checkbox` from `@/components/ui/checkbox` (for `isCurrent`)
- `useProfileStore` from `@/stores/useProfileStore`

---

### Task 12: Update `ProfileControllerIntegrationTest.java` (AC: 9)

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileControllerIntegrationTest.java`

**Add a new integration test method verifying round-trip for all four new list types:**

```java
@Test
void updateProfile_withAllNewSections_roundTripsCorrectly() throws Exception {
    String token = loginAndGetToken(); // use existing helper

    String requestBody = """
            {
              "summary": "Extended profile test",
              "workExperiences": [],
              "education": [],
              "skills": [],
              "certifications": [
                {"name": "AWS Cloud Practitioner", "issuer": "Amazon", "issueDate": "2023-01-15", "expirationDate": null}
              ],
              "languages": [
                {"name": "English", "proficiencyLevel": "NATIVE"},
                {"name": "Spanish", "proficiencyLevel": "INTERMEDIATE"}
              ],
              "projects": [
                {"name": "ResumeApp", "description": "A resume enhancer", "technologies": "Java, React", "link": "https://github.com/test", "startDate": "2024-01-01", "endDate": null, "isCurrent": true}
              ],
              "volunteering": [
                {"role": "Mentor", "organization": "Code.org", "description": "Teaching programming", "startDate": null, "endDate": null, "isCurrent": false}
              ]
            }
            """;

    // PUT
    mockMvc.perform(put("/api/v1/profile")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(requestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.certifications[0].name").value("AWS Cloud Practitioner"))
            .andExpect(jsonPath("$.languages[0].name").value("English"))
            .andExpect(jsonPath("$.languages[0].proficiencyLevel").value("NATIVE"))
            .andExpect(jsonPath("$.projects[0].name").value("ResumeApp"))
            .andExpect(jsonPath("$.volunteering[0].role").value("Mentor"));

    // GET — verify persistence
    mockMvc.perform(get("/api/v1/profile")
                    .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.certifications").hasJsonPath())
            .andExpect(jsonPath("$.certifications[0].name").value("AWS Cloud Practitioner"))
            .andExpect(jsonPath("$.languages[1].name").value("Spanish"))
            .andExpect(jsonPath("$.projects[0].isCurrent").value(true))
            .andExpect(jsonPath("$.volunteering[0].organization").value("Code.org"));
}
```

**CRITICAL — Read the existing `ProfileControllerIntegrationTest.java` before implementing** to understand how authentication tokens are obtained (`loginAndGetToken()` method or inline JWT setup). Follow the exact same pattern.

---

### Task 13: Update `ProfileForm.test.tsx` (AC: 8, 9 for frontend)

- [x] Edit `frontend/src/components/profile/ProfileForm.test.tsx`

**Update `resetProfileStore()` to include the four new empty lists:**
```typescript
function resetProfileStore() {
  useProfileStore.setState({
    profile: {
      summary: null,
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    },
    isSaving: false,
    isLoading: false,
    error: null,
    currentStep: 0,
    hasStarted: false,
  })
}
```

**Update `apiClient.put` mock return value** to include all four new empty arrays (to avoid TypeScript strict errors on `ProfileDto`):
```typescript
vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({
      summary: null,
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    }),
    get: vi.fn().mockResolvedValue({
      summary: null,
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
    }),
  },
}))
```

**Add basic tests for each new Step component** following the same test patterns as existing step tests:
- Blur validation on required field shows `text-red-600` error
- "Add another" appends a new entry
- Valid form calls `onSaveAndContinue` with correct payload shape

---

### Task 14: Run lint and tests (AC: all)

- [x] Run `cd frontend && npm run lint` — must pass with 0 errors
- [x] Run `cd frontend && npm run test -- --run` — all existing + new tests pass
- [x] Run `./mvnw test -Dtest="ProfileServiceTest" -Dsurefire.useFile=false` — all pass
- [x] Run `./mvnw test` — full suite passes (no regressions)

---

## Dev Notes

### CRITICAL: Read `ProfileControllerIntegrationTest.java` Before Task 12

The existing integration test file was not fully analyzed. Read it to understand: JWT token acquisition helper, `@SpringBootTest` setup, `mockMvc` wiring, Testcontainers PostgreSQL setup. Follow existing patterns exactly.

### CRITICAL: `ProfileUpdateRequest` Constructor Change Breaks All Callers

`ProfileUpdateRequest` is a Java record. Its canonical constructor signature changes from 4 → 8 parameters. All callers must be updated before the project compiles. Known callers:
- `ProfileServiceTest.java` (2 call sites, updated in Task 9)
- Any integration test that builds a `ProfileUpdateRequest` directly

### CRITICAL: `ProfileDto` Constructor Change Breaks All Callers

`ProfileDto` is a Java record. Canonical constructor changes from 4 → 8 parameters. Known callers:
- `ProfileService.toDto()` — updated in Task 7
- `ProfileService.emptyProfileDto()` — updated in Task 7
- `ProfileServiceTest.java` — does NOT construct `ProfileDto` directly (only reads from `result.fieldName()`) — no changes needed in assertions
- Any other class that constructs `ProfileDto` via `new ProfileDto(...)` — scan codebase with grep

### CRITICAL: `ProfilePage.tsx` `isEmptyProfile()` Must Include New Fields

If `isEmptyProfile()` only checks the original 4 fields, a profile with only certifications/languages/projects/volunteering (and no work experience, education, or skills) would show the "empty state" CTA — incorrect behavior.

### CRITICAL: Flyway Next Version is V10

V9 is the current latest migration (`V9__update_template_section_order_to_enum_names.sql`). The new migration must be `V10__add_profile_extended_sections.sql`. Do NOT use V8 or V9 (already applied).

### CRITICAL: `LanguageProficiencyLevel` Enum Serialization

The `Language` entity stores `proficiency_level` as `VARCHAR(50)` via `@Enumerated(EnumType.STRING)`. Jackson serializes `LanguageProficiencyLevel` enum to/from its `name()` string (e.g. `"NATIVE"`). No custom serializer needed. The frontend uses the same string values.

### CRITICAL: `TEXT` Column Mapping for `description` Fields

`description` columns in `profile_projects` and `profile_volunteering` are defined as `TEXT` in the DDL. The JPA entity must use `@Column(name = "description", columnDefinition = "TEXT")` — without `columnDefinition = "TEXT"`, Hibernate Validator may warn about VARCHAR(255) vs TEXT mismatch during schema validation. This is the correct mapping.

### CRITICAL: `Project.isCurrent` / `Volunteering.isCurrent` Lombok Setter

Lombok generates getter `isCurrent()` and setter `setCurrent(boolean)` for a `boolean isCurrent` field (strips the `is` prefix for the setter). In `toEntity()` call `p.setCurrent(dto.isCurrent())`. In `toDto()` call `p.isCurrent()`.

### CRITICAL: New Step Components Must Follow Exact UX Pattern

The `ProfilePage.tsx` step system uses `currentStep` index. After adding four new steps, the `currentStep` references in `handleSaveAndContinue` (`if (currentStep < LAST_STEP)`) and the conditional render block `{currentStep === N && <StepComponent .../>}` must both be updated. SummaryStep MUST remain the final step — it handles navigation to `/` itself.

### CRITICAL: `ProfileForm.test.tsx` Mock Return Must Include New Fields

TypeScript strict mode will fail if mock return objects don't match the updated `ProfileDto` interface. The `apiClient.put` and `apiClient.get` mock return values must include all 8 `ProfileDto` fields.

### CRITICAL: Out of Scope — Do NOT Add These

- Mapping new profile entities to `ResumeSection` / `ResumeItem` (Story 3.14)
- Typed `ResumeItem` records for new section types (Story 3.13)
- `ResumeService.buildFromProfile()` expansion (Story 3.14)
- Any changes to resume domain, templates, or canvas

### File Locations (no deviations)

| Action | File |
|--------|------|
| CREATE | `src/main/resources/db/migration/V10__add_profile_extended_sections.sql` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/LanguageProficiencyLevel.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Certification.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Language.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Project.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Volunteering.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/CertificationRequest.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/CertificationDto.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/LanguageRequest.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/LanguageDto.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProjectRequest.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProjectDto.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/VolunteeringRequest.java` |
| CREATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/VolunteeringDto.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java` |
| UPDATE | `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java` |
| UPDATE | `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java` |
| UPDATE | `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileControllerIntegrationTest.java` |
| UPDATE | `frontend/src/types/api.ts` |
| UPDATE | `frontend/src/pages/ProfilePage.tsx` |
| CREATE | `frontend/src/components/profile/CertificationsStep.tsx` |
| CREATE | `frontend/src/components/profile/LanguagesStep.tsx` |
| CREATE | `frontend/src/components/profile/ProjectsStep.tsx` |
| CREATE | `frontend/src/components/profile/VolunteeringStep.tsx` |
| UPDATE | `frontend/src/components/profile/ProfileForm.test.tsx` |

### References

- `_bmad-output/planning-artifacts/epics/epic-3-resume-management-template-selection.md` — Story 3.12 AC and background (lines 446–497)
- `_bmad-output/implementation-artifacts/3-11-resumesectiontype-as-core-domain-concept-typed-section-identifiers.md` — Story 3.11 file list and dev notes (previous story context)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java` — current state (3 `@OneToMany` fields; Task 3 appends 4 more)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/WorkExperience.java` — pattern for new entity classes
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java` — current state; all update paths follow identical clear+repopulate pattern
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java` — current 4-field record (will become 8-field)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java` — current 4-field record (will become 8-field)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/WorkExperienceRequest.java` — validation annotation pattern for new Request records
- `src/main/resources/db/migration/V2__create_profiles_tables.sql` — DDL pattern for new tables
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java` — existing test patterns; two `ProfileUpdateRequest` call sites that must be updated
- `frontend/src/types/api.ts` — current ProfileDto/ProfileUpdateRequest interfaces (lines 106–135)
- `frontend/src/pages/ProfilePage.tsx` — `handleSaveAndContinue`, `isEmptyProfile`, `STEPS` constant (all must be updated)
- `frontend/src/components/profile/ExperienceStep.tsx` — template for new Step component structure
- `frontend/src/components/profile/SkillsStep.tsx` — simpler template for new Step components
- `frontend/src/components/profile/ProfileForm.test.tsx` — existing test patterns; `resetProfileStore()` must be updated
- `_bmad-output/project-context.md` — technology stack, anti-patterns (Java records for DTOs; Lombok on entities only; Flyway only DDL; `Instant` for timestamps but `LocalDate` for date-only fields)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded without blockers.

### Completion Notes List

- AC1: Flyway migration V10 creates all four new tables (`profile_certifications`, `profile_languages`, `profile_projects`, `profile_volunteering`) with UUID PKs, FK to `profiles(id) ON DELETE CASCADE`, and `created_at`/`updated_at` defaults. Applied successfully in integration tests.
- AC2: `LanguageProficiencyLevel` enum (6 values) in `profile.domain`. Four new JPA entities (`Certification`, `Language`, `Project`, `Volunteering`) extend `BaseEntity`, use `@Getter @Setter` Lombok (no @Data), correct `columnDefinition = "TEXT"` for description fields, `@Enumerated(EnumType.STRING)` on `Language.proficiencyLevel`.
- AC3: `Profile.java` gains four `@OneToMany(cascade=ALL, orphanRemoval=true)` lists initialized as `new ArrayList<>()`, following exact same pattern as existing three lists.
- AC4: Eight new DTO/Request Java records created. `LocalDate` used directly in all records (not String). Request records use `jakarta.validation.constraints.*`. Dto records have no validation annotations.
- AC5: `ProfileUpdateRequest` and `ProfileDto` expanded from 4 to 8 constructor params.
- AC6: `ProfileService.updateProfile()` applies clear-and-repopulate to all four new collections. `toDto()`, `emptyProfileDto()`, plus 4 new `toDto()` overloads and 4 new `toEntity()` converters added.
- AC7: `frontend/src/types/api.ts` gains `LanguageProficiencyLevel` union type, 4 new Dto interfaces, 4 new Request interfaces, and `ProfileDto`/`ProfileUpdateRequest` extended to 8 fields.
- AC8: `ProfilePage.tsx` updated — `STEPS` array extended to 8 steps (Experience → Education → Skills → Certifications → Languages → Projects → Volunteering → Summary), `LAST_STEP` recalculated to 7, `isEmptyProfile()` checks all 8 fields, `current` baseline and `payload` include all four new fields with `?? []` fallback. Four new step components created following exact `ExperienceStep`/`SkillsStep` UX patterns with required-field blur validation.
- AC9: `ProfileServiceTest` updated — 2 existing call sites updated to 8-param constructor, 3 new test methods added. `ProfileControllerIntegrationTest` gains `updateProfile_withAllNewSections_roundTripsCorrectly` integration test. `ProfileForm.test.tsx` updated with new mock return values and 4 new describe blocks.
- All tests: 91 backend (0 failures), 102 frontend (0 failures). ESLint: 0 errors. Flyway migration applied successfully in testcontainer.

### File List

- `src/main/resources/db/migration/V10__add_profile_extended_sections.sql` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/LanguageProficiencyLevel.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Certification.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Language.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Project.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Volunteering.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/domain/Profile.java` (MODIFIED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/CertificationRequest.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/CertificationDto.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/LanguageRequest.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/LanguageDto.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProjectRequest.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProjectDto.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/VolunteeringRequest.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/VolunteeringDto.java` (CREATED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileUpdateRequest.java` (MODIFIED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/dto/ProfileDto.java` (MODIFIED)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileService.java` (MODIFIED)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileServiceTest.java` (MODIFIED)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/profile/ProfileControllerIntegrationTest.java` (MODIFIED)
- `frontend/src/types/api.ts` (MODIFIED)
- `frontend/src/pages/ProfilePage.tsx` (MODIFIED)
- `frontend/src/components/profile/CertificationsStep.tsx` (CREATED)
- `frontend/src/components/profile/LanguagesStep.tsx` (CREATED)
- `frontend/src/components/profile/ProjectsStep.tsx` (CREATED)
- `frontend/src/components/profile/VolunteeringStep.tsx` (CREATED)
- `frontend/src/components/profile/ProfileForm.test.tsx` (MODIFIED)
- `_bmad-output/implementation-artifacts/3-12-extended-profile-domain-certifications-languages-projects-volunteering.md` (MODIFIED — story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)

### Change Log

- 2026-06-09: Implemented Story 3.12 — Extended Profile Domain (Certifications, Languages, Projects, Volunteering). Added Flyway V10 migration, 4 JPA entities, 8 DTO/Request records, updated ProfileDto/ProfileUpdateRequest/ProfileService, created 4 frontend step components, extended ProfilePage STEPS, updated all tests. Backend: 91 tests pass. Frontend: 102 tests pass. ESLint: 0 errors.
