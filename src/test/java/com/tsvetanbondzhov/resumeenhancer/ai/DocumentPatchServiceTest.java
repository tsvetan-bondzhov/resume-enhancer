package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class DocumentPatchServiceTest {

    private DocumentPatchService service;
    private ResumeDocument document;

    @BeforeEach
    void setUp() {
        service = new DocumentPatchService(new ObjectMapper());

        WorkExperienceItem item0 = new WorkExperienceItem(
                "item-0", "Software Engineer", "Acme Corp", null, null, true, "Built things");
        WorkExperienceItem item1 = new WorkExperienceItem(
                "item-1", "Junior Dev", "StartupXYZ", null, null, false, "Learned stuff");
        ResumeSection workSection = new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE, "Experience", true, List.of(item0, item1));

        SummaryItem summaryItem = new SummaryItem(
                "summary-0", "Experienced developer", null, null, null, "me@example.com", "UK", "London");
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY, "Summary", true, List.of(summaryItem));

        document = new ResumeDocument(List.of(workSection, summarySection));
    }

    // --- AC1: Happy path ---

    @Test
    void apply_patches_jobTitle_on_first_work_experience_item() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, "jobTitle", "Senior Engineer");
        ResumeDocument result = service.apply(document, patch);

        WorkExperienceItem updated = (WorkExperienceItem) result.sections().get(0).items().get(0);
        assertThat(updated.jobTitle()).isEqualTo("Senior Engineer");
        // Other fields unchanged
        assertThat(updated.company()).isEqualTo("Acme Corp");
        assertThat(updated.description()).isEqualTo("Built things");
        assertThat(updated.id()).isEqualTo("item-0");
    }

    @Test
    void apply_patches_description_on_second_work_experience_item() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 1, "description", "Built great things");
        ResumeDocument result = service.apply(document, patch);

        WorkExperienceItem updated = (WorkExperienceItem) result.sections().get(0).items().get(1);
        assertThat(updated.description()).isEqualTo("Built great things");
        assertThat(updated.jobTitle()).isEqualTo("Junior Dev"); // unchanged
    }

    @Test
    void apply_patches_summary_text() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "text", "10+ years of excellence");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.text()).isEqualTo("10+ years of excellence");
        assertThat(updated.contactEmail()).isEqualTo("me@example.com"); // unchanged
    }

    @Test
    void apply_returns_new_document_instance_original_is_unchanged() {
        var original0 = (WorkExperienceItem) document.sections().get(0).items().get(0);
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, "jobTitle", "Senior Engineer");

        ResumeDocument result = service.apply(document, patch);

        // Original document is unchanged (records + defensive copies)
        assertThat(document.sections().get(0).items().get(0)).isSameAs(original0);
        assertThat(result).isNotSameAs(document);
        // Unmodified section (SUMMARY) is the same instance (not unnecessarily copied)
        assertThat(result.sections().get(1)).isSameAs(document.sections().get(1));
    }

    @Test
    void apply_patches_newValue_null_clears_field() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, "description", null);
        ResumeDocument result = service.apply(document, patch);

        WorkExperienceItem updated = (WorkExperienceItem) result.sections().get(0).items().get(0);
        assertThat(updated.description()).isNull();
    }

    // --- AC2: Invalid sectionId ---

    @Test
    void apply_throws_InvalidPatchException_for_unknown_sectionId() {
        var patch = DocumentPatchEvent.modify("NONEXISTENT", 0, "jobTitle", "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("NONEXISTENT");
    }

    @Test
    void apply_throws_InvalidPatchException_for_valid_sectionType_not_in_document() {
        // SKILLS section is not present in the test document
        var patch = DocumentPatchEvent.modify("SKILLS", 0, "name", "Java");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("SKILLS");
    }

    // --- AC3: Edge cases ---

    @Test
    void apply_throws_InvalidPatchException_for_itemIndex_out_of_bounds_positive() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 99, "jobTitle", "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("out of bounds");
    }

    @Test
    void apply_throws_for_itemIndex_negative_lower_bound() {
        // F2: negative itemIndex should trigger the < 0 guard and throw InvalidPatchException
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", -1, "jobTitle", "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("out of bounds");
    }

    @Test
    void apply_throws_for_null_field() {
        // F1: null field should throw (switch on null → NPE or InvalidPatchException rather than silent ignore)
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, null, "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void apply_throws_InvalidPatchException_for_reserved_field_type() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, "type", "EDUCATION");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("reserved");
    }

    @Test
    void apply_throws_InvalidPatchException_for_reserved_field_id() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, "id", "new-id");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("reserved");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_work_experience() {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, "salary", "100k");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("salary");
    }

    @ParameterizedTest
    @ValueSource(strings = {"company", "description"})
    void apply_patches_all_string_fields_on_work_experience(String field) {
        var patch = DocumentPatchEvent.modify("WORK_EXPERIENCE", 0, field, "new-value");
        ResumeDocument result = service.apply(document, patch);
        WorkExperienceItem updated = (WorkExperienceItem) result.sections().get(0).items().get(0);
        // Verify the field was patched to new-value
        String actual = switch (field) {
            case "company" -> updated.company();
            case "description" -> updated.description();
            default -> throw new IllegalArgumentException(field);
        };
        assertThat(actual).isEqualTo("new-value");
    }

    // --- EducationItem patches ---

    private ResumeDocument documentWith(ResumeItem item, ResumeSectionType type, String title) {
        ResumeSection section = new ResumeSection(type, title, true, List.of(item));
        return new ResumeDocument(List.of(section));
    }

    @Test
    void apply_patches_education_institution() {
        EducationItem edu = new EducationItem("edu-0", "MIT", "BSc", "CS", null, null);
        ResumeDocument doc = documentWith(edu, ResumeSectionType.EDUCATION, "Education");

        var patch = DocumentPatchEvent.modify("EDUCATION", 0, "institution", "Harvard");
        ResumeDocument result = service.apply(doc, patch);

        EducationItem updated = (EducationItem) result.sections().get(0).items().get(0);
        assertThat(updated.institution()).isEqualTo("Harvard");
        assertThat(updated.degree()).isEqualTo("BSc");
    }

    @Test
    void apply_patches_education_degree() {
        EducationItem edu = new EducationItem("edu-0", "MIT", "BSc", "CS", null, null);
        ResumeDocument doc = documentWith(edu, ResumeSectionType.EDUCATION, "Education");

        var patch = DocumentPatchEvent.modify("EDUCATION", 0, "degree", "MSc");
        ResumeDocument result = service.apply(doc, patch);

        EducationItem updated = (EducationItem) result.sections().get(0).items().get(0);
        assertThat(updated.degree()).isEqualTo("MSc");
    }

    @Test
    void apply_patches_education_fieldOfStudy() {
        EducationItem edu = new EducationItem("edu-0", "MIT", "BSc", "CS", null, null);
        ResumeDocument doc = documentWith(edu, ResumeSectionType.EDUCATION, "Education");

        var patch = DocumentPatchEvent.modify("EDUCATION", 0, "fieldOfStudy", "Mathematics");
        ResumeDocument result = service.apply(doc, patch);

        EducationItem updated = (EducationItem) result.sections().get(0).items().get(0);
        assertThat(updated.fieldOfStudy()).isEqualTo("Mathematics");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_education() {
        EducationItem edu = new EducationItem("edu-0", "MIT", "BSc", "CS", null, null);
        ResumeDocument doc = documentWith(edu, ResumeSectionType.EDUCATION, "Education");

        var patch = DocumentPatchEvent.modify("EDUCATION", 0, "unknown", "val");
        assertThatThrownBy(() -> service.apply(doc, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("EDUCATION");
    }

    // --- SkillItem patches ---

    @Test
    void apply_patches_skill_name() {
        SkillItem skill = new SkillItem("skill-0", "Java");
        ResumeDocument doc = documentWith(skill, ResumeSectionType.SKILLS, "Skills");

        var patch = DocumentPatchEvent.modify("SKILLS", 0, "name", "Kotlin");
        ResumeDocument result = service.apply(doc, patch);

        SkillItem updated = (SkillItem) result.sections().get(0).items().get(0);
        assertThat(updated.name()).isEqualTo("Kotlin");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_skill() {
        SkillItem skill = new SkillItem("skill-0", "Java");
        ResumeDocument doc = documentWith(skill, ResumeSectionType.SKILLS, "Skills");

        var patch = DocumentPatchEvent.modify("SKILLS", 0, "level", "Expert");
        assertThatThrownBy(() -> service.apply(doc, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("SKILLS");
    }

    // --- CertificationItem patches ---

    @Test
    void apply_patches_certification_name() {
        CertificationItem cert = new CertificationItem("cert-0", "AWS Certified", "Amazon", null, null);
        ResumeDocument doc = documentWith(cert, ResumeSectionType.CERTIFICATIONS, "Certifications");

        var patch = DocumentPatchEvent.modify("CERTIFICATIONS", 0, "name", "GCP Certified");
        ResumeDocument result = service.apply(doc, patch);

        CertificationItem updated = (CertificationItem) result.sections().get(0).items().get(0);
        assertThat(updated.name()).isEqualTo("GCP Certified");
    }

    @Test
    void apply_patches_certification_issuer() {
        CertificationItem cert = new CertificationItem("cert-0", "AWS Certified", "Amazon", null, null);
        ResumeDocument doc = documentWith(cert, ResumeSectionType.CERTIFICATIONS, "Certifications");

        var patch = DocumentPatchEvent.modify("CERTIFICATIONS", 0, "issuer", "Google");
        ResumeDocument result = service.apply(doc, patch);

        CertificationItem updated = (CertificationItem) result.sections().get(0).items().get(0);
        assertThat(updated.issuer()).isEqualTo("Google");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_certification() {
        CertificationItem cert = new CertificationItem("cert-0", "AWS Certified", "Amazon", null, null);
        ResumeDocument doc = documentWith(cert, ResumeSectionType.CERTIFICATIONS, "Certifications");

        var patch = DocumentPatchEvent.modify("CERTIFICATIONS", 0, "expiry", "2030");
        assertThatThrownBy(() -> service.apply(doc, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("CERTIFICATIONS");
    }

    // --- LanguageItem patches ---

    @Test
    void apply_patches_language_language_field() {
        LanguageItem lang = new LanguageItem("lang-0", "English", "C2");
        ResumeDocument doc = documentWith(lang, ResumeSectionType.LANGUAGES, "Languages");

        var patch = DocumentPatchEvent.modify("LANGUAGES", 0, "language", "French");
        ResumeDocument result = service.apply(doc, patch);

        LanguageItem updated = (LanguageItem) result.sections().get(0).items().get(0);
        assertThat(updated.language()).isEqualTo("French");
    }

    @Test
    void apply_patches_language_proficiency() {
        LanguageItem lang = new LanguageItem("lang-0", "English", "C2");
        ResumeDocument doc = documentWith(lang, ResumeSectionType.LANGUAGES, "Languages");

        var patch = DocumentPatchEvent.modify("LANGUAGES", 0, "proficiency", "B2");
        ResumeDocument result = service.apply(doc, patch);

        LanguageItem updated = (LanguageItem) result.sections().get(0).items().get(0);
        assertThat(updated.proficiency()).isEqualTo("B2");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_language() {
        LanguageItem lang = new LanguageItem("lang-0", "English", "C2");
        ResumeDocument doc = documentWith(lang, ResumeSectionType.LANGUAGES, "Languages");

        var patch = DocumentPatchEvent.modify("LANGUAGES", 0, "unknown", "val");
        assertThatThrownBy(() -> service.apply(doc, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("LANGUAGES");
    }

    // --- ProjectItem patches ---

    @Test
    void apply_patches_project_name() {
        ProjectItem proj = new ProjectItem("proj-0", "MyApp", "A great app", "Java", "http://link", null, null, false);
        ResumeDocument doc = documentWith(proj, ResumeSectionType.PROJECTS, "Projects");

        var patch = DocumentPatchEvent.modify("PROJECTS", 0, "name", "BetterApp");
        ResumeDocument result = service.apply(doc, patch);

        ProjectItem updated = (ProjectItem) result.sections().get(0).items().get(0);
        assertThat(updated.name()).isEqualTo("BetterApp");
    }

    @Test
    void apply_patches_project_description() {
        ProjectItem proj = new ProjectItem("proj-0", "MyApp", "A great app", "Java", "http://link", null, null, false);
        ResumeDocument doc = documentWith(proj, ResumeSectionType.PROJECTS, "Projects");

        var patch = DocumentPatchEvent.modify("PROJECTS", 0, "description", "An incredible app");
        ResumeDocument result = service.apply(doc, patch);

        ProjectItem updated = (ProjectItem) result.sections().get(0).items().get(0);
        assertThat(updated.description()).isEqualTo("An incredible app");
    }

    @Test
    void apply_patches_project_technologies() {
        ProjectItem proj = new ProjectItem("proj-0", "MyApp", "A great app", "Java", "http://link", null, null, false);
        ResumeDocument doc = documentWith(proj, ResumeSectionType.PROJECTS, "Projects");

        var patch = DocumentPatchEvent.modify("PROJECTS", 0, "technologies", "Kotlin, Spring");
        ResumeDocument result = service.apply(doc, patch);

        ProjectItem updated = (ProjectItem) result.sections().get(0).items().get(0);
        assertThat(updated.technologies()).isEqualTo("Kotlin, Spring");
    }

    @Test
    void apply_patches_project_link() {
        ProjectItem proj = new ProjectItem("proj-0", "MyApp", "A great app", "Java", "http://link", null, null, false);
        ResumeDocument doc = documentWith(proj, ResumeSectionType.PROJECTS, "Projects");

        var patch = DocumentPatchEvent.modify("PROJECTS", 0, "link", "https://new-link.com");
        ResumeDocument result = service.apply(doc, patch);

        ProjectItem updated = (ProjectItem) result.sections().get(0).items().get(0);
        assertThat(updated.link()).isEqualTo("https://new-link.com");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_project() {
        ProjectItem proj = new ProjectItem("proj-0", "MyApp", "A great app", "Java", "http://link", null, null, false);
        ResumeDocument doc = documentWith(proj, ResumeSectionType.PROJECTS, "Projects");

        var patch = DocumentPatchEvent.modify("PROJECTS", 0, "budget", "$10k");
        assertThatThrownBy(() -> service.apply(doc, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("PROJECTS");
    }

    // --- VolunteeringItem patches ---

    @Test
    void apply_patches_volunteering_role() {
        VolunteeringItem vol = new VolunteeringItem("vol-0", "Mentor", "Code Club", "Helped beginners", null, null, false);
        ResumeDocument doc = documentWith(vol, ResumeSectionType.VOLUNTEERING, "Volunteering");

        var patch = DocumentPatchEvent.modify("VOLUNTEERING", 0, "role", "Lead Mentor");
        ResumeDocument result = service.apply(doc, patch);

        VolunteeringItem updated = (VolunteeringItem) result.sections().get(0).items().get(0);
        assertThat(updated.role()).isEqualTo("Lead Mentor");
    }

    @Test
    void apply_patches_volunteering_organization() {
        VolunteeringItem vol = new VolunteeringItem("vol-0", "Mentor", "Code Club", "Helped beginners", null, null, false);
        ResumeDocument doc = documentWith(vol, ResumeSectionType.VOLUNTEERING, "Volunteering");

        var patch = DocumentPatchEvent.modify("VOLUNTEERING", 0, "organization", "Dev Academy");
        ResumeDocument result = service.apply(doc, patch);

        VolunteeringItem updated = (VolunteeringItem) result.sections().get(0).items().get(0);
        assertThat(updated.organization()).isEqualTo("Dev Academy");
    }

    @Test
    void apply_patches_volunteering_description() {
        VolunteeringItem vol = new VolunteeringItem("vol-0", "Mentor", "Code Club", "Helped beginners", null, null, false);
        ResumeDocument doc = documentWith(vol, ResumeSectionType.VOLUNTEERING, "Volunteering");

        var patch = DocumentPatchEvent.modify("VOLUNTEERING", 0, "description", "Coached 20 students");
        ResumeDocument result = service.apply(doc, patch);

        VolunteeringItem updated = (VolunteeringItem) result.sections().get(0).items().get(0);
        assertThat(updated.description()).isEqualTo("Coached 20 students");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_volunteering() {
        VolunteeringItem vol = new VolunteeringItem("vol-0", "Mentor", "Code Club", "Helped beginners", null, null, false);
        ResumeDocument doc = documentWith(vol, ResumeSectionType.VOLUNTEERING, "Volunteering");

        var patch = DocumentPatchEvent.modify("VOLUNTEERING", 0, "unknown", "val");
        assertThatThrownBy(() -> service.apply(doc, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("VOLUNTEERING");
    }

    // --- SummaryItem patches ---

    @Test
    void apply_patches_summary_linkedInUrl() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "linkedInUrl", "https://linkedin.com/in/user");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.linkedInUrl()).isEqualTo("https://linkedin.com/in/user");
    }

    @Test
    void apply_patches_summary_personalPageUrl() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "personalPageUrl", "https://mypage.com");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.personalPageUrl()).isEqualTo("https://mypage.com");
    }

    @Test
    void apply_patches_summary_blogUrl() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "blogUrl", "https://blog.com");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.blogUrl()).isEqualTo("https://blog.com");
    }

    @Test
    void apply_patches_summary_contactEmail() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "contactEmail", "new@example.com");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.contactEmail()).isEqualTo("new@example.com");
    }

    @Test
    void apply_patches_summary_locationCountry() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "locationCountry", "Germany");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.locationCountry()).isEqualTo("Germany");
    }

    @Test
    void apply_patches_summary_locationCity() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "locationCity", "Berlin");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.locationCity()).isEqualTo("Berlin");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_summary() {
        var patch = DocumentPatchEvent.modify("SUMMARY", 0, "phone", "+44123456789");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("SUMMARY");
    }

    // --- GenericItem patches ---

    @Test
    void apply_patches_generic_item_any_field() {
        GenericItem generic = new GenericItem("generic-0", Map.of("customField", "original"));
        ResumeSection section = new ResumeSection(ResumeSectionType.SKILLS, "Extra", true, List.of(generic));
        ResumeDocument doc = new ResumeDocument(List.of(section));

        var patch = DocumentPatchEvent.modify("SKILLS", 0, "customField", "updated");
        ResumeDocument result = service.apply(doc, patch);

        GenericItem updated = (GenericItem) result.sections().get(0).items().get(0);
        assertThat(updated.fields()).containsEntry("customField", "updated");
    }

    @Test
    void apply_patches_generic_item_adds_new_field() {
        GenericItem generic = new GenericItem("generic-0", Map.of("existingField", "value"));
        ResumeSection section = new ResumeSection(ResumeSectionType.SKILLS, "Extra", true, List.of(generic));
        ResumeDocument doc = new ResumeDocument(List.of(section));

        var patch = DocumentPatchEvent.modify("SKILLS", 0, "newField", "newValue");
        ResumeDocument result = service.apply(doc, patch);

        GenericItem updated = (GenericItem) result.sections().get(0).items().get(0);
        assertThat(updated.fields()).containsEntry("newField", "newValue");
        assertThat(updated.fields()).containsEntry("existingField", "value");
    }
}
