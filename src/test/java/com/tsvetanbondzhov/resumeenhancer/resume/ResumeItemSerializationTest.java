package com.tsvetanbondzhov.resumeenhancer.resume;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates Jackson polymorphic round-trip for all nine ResumeItem subtypes.
 *
 * <p><strong>NOTE:</strong> This test uses a locally constructed {@code ObjectMapper} that mirrors
 * the configuration in {@code JacksonConfig.objectMapper()} (JavaTimeModule + WRITE_DATES_AS_TIMESTAMPS
 * disabled). If {@code JacksonConfig} is ever changed (e.g. additional modules, features, or custom
 * serializers are registered), this mapper must be updated in sync — otherwise serialization behaviour
 * tested here will silently diverge from the Spring bean used at runtime. Consider extracting a shared
 * test helper (e.g. {@code TestObjectMapperFactory}) if this becomes a maintenance burden.
 */
class ResumeItemSerializationTest {

    // Must match JacksonConfig.objectMapper() — JavaTimeModule + no timestamp dates.
    // See class-level javadoc for divergence risk note.
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
        SkillItem original = new SkillItem("id-3", "Java");
        String json = mapper.writeValueAsString(original);
        assertThat(json).contains("\"type\":\"SKILLS\"");
        assertThat(json).doesNotContain("\"category\"");
        assertThat(json).doesNotContain("\"proficiency\"");

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
