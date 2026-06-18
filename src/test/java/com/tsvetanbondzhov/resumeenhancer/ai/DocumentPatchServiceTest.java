package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class DocumentPatchServiceTest {

    private DocumentPatchService service;
    private ResumeDocument document;

    @BeforeEach
    void setUp() {
        service = new DocumentPatchService();

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
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, "jobTitle", "Senior Engineer");
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
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 1, "description", "Built great things");
        ResumeDocument result = service.apply(document, patch);

        WorkExperienceItem updated = (WorkExperienceItem) result.sections().get(0).items().get(1);
        assertThat(updated.description()).isEqualTo("Built great things");
        assertThat(updated.jobTitle()).isEqualTo("Junior Dev"); // unchanged
    }

    @Test
    void apply_patches_summary_text() {
        var patch = new DocumentPatchEvent("SUMMARY", 0, "text", "10+ years of excellence");
        ResumeDocument result = service.apply(document, patch);

        SummaryItem updated = (SummaryItem) result.sections().get(1).items().get(0);
        assertThat(updated.text()).isEqualTo("10+ years of excellence");
        assertThat(updated.contactEmail()).isEqualTo("me@example.com"); // unchanged
    }

    @Test
    void apply_returns_new_document_instance_original_is_unchanged() {
        var original0 = (WorkExperienceItem) document.sections().get(0).items().get(0);
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, "jobTitle", "Senior Engineer");

        ResumeDocument result = service.apply(document, patch);

        // Original document is unchanged (records + defensive copies)
        assertThat(document.sections().get(0).items().get(0)).isSameAs(original0);
        assertThat(result).isNotSameAs(document);
        // Unmodified section (SUMMARY) is the same instance (not unnecessarily copied)
        assertThat(result.sections().get(1)).isSameAs(document.sections().get(1));
    }

    @Test
    void apply_patches_newValue_null_clears_field() {
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, "description", null);
        ResumeDocument result = service.apply(document, patch);

        WorkExperienceItem updated = (WorkExperienceItem) result.sections().get(0).items().get(0);
        assertThat(updated.description()).isNull();
    }

    // --- AC2: Invalid sectionId ---

    @Test
    void apply_throws_InvalidPatchException_for_unknown_sectionId() {
        var patch = new DocumentPatchEvent("NONEXISTENT", 0, "jobTitle", "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("NONEXISTENT");
    }

    @Test
    void apply_throws_InvalidPatchException_for_valid_sectionType_not_in_document() {
        // SKILLS section is not present in the test document
        var patch = new DocumentPatchEvent("SKILLS", 0, "name", "Java");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("SKILLS");
    }

    // --- AC3: Edge cases ---

    @Test
    void apply_throws_InvalidPatchException_for_itemIndex_out_of_bounds_positive() {
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 99, "jobTitle", "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("out of bounds");
    }

    @Test
    void apply_throws_for_itemIndex_negative_lower_bound() {
        // F2: negative itemIndex should trigger the < 0 guard and throw InvalidPatchException
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", -1, "jobTitle", "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("out of bounds");
    }

    @Test
    void apply_throws_for_null_field() {
        // F1: null field should throw (switch on null → NPE or InvalidPatchException rather than silent ignore)
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, null, "X");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void apply_throws_InvalidPatchException_for_reserved_field_type() {
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, "type", "EDUCATION");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("reserved");
    }

    @Test
    void apply_throws_InvalidPatchException_for_reserved_field_id() {
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, "id", "new-id");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("reserved");
    }

    @Test
    void apply_throws_InvalidPatchException_for_unknown_field_on_work_experience() {
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, "salary", "100k");
        assertThatThrownBy(() -> service.apply(document, patch))
                .isInstanceOf(InvalidPatchException.class)
                .hasMessageContaining("salary");
    }

    @ParameterizedTest
    @ValueSource(strings = {"company", "description"})
    void apply_patches_all_string_fields_on_work_experience(String field) {
        var patch = new DocumentPatchEvent("WORK_EXPERIENCE", 0, field, "new-value");
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
}
