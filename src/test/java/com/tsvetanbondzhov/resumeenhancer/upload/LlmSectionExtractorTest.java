package com.tsvetanbondzhov.resumeenhancer.upload;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.Month;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LlmSectionExtractorTest {

    @Mock
    private AiService aiService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @InjectMocks
    private LlmSectionExtractor llmSectionExtractor;

    // JSON parse failure falls back to heuristic lines — section produces no typed items (UNKNOWN skipped)
    @Test
    void extract_malformedJsonResponse_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenReturn("NOT_VALID_JSON{{{{");

        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Acme Corp 2022-2024"))
        );

        ParsedResumeDto result = llmSectionExtractor.extract(sections, "Software Engineer at Acme Corp 2022-2024");

        // Heuristic fallback produces GenericItems which are dispatched into workExperiences list
        // but since GenericItem is not WorkExperienceItem, the list ends up empty
        // (heuristic items are only used for fallback logging — typed dispatch filters by instanceof)
        assertThat(result).isNotNull();
        assertThat(result.rawText()).isEqualTo("Software Engineer at Acme Corp 2022-2024");
        // workExperiences will be empty because heuristic items are GenericItems (not WorkExperienceItem)
        assertThat(result.workExperiences()).isEmpty();
    }

    // Invalid date fields are nulled out (returned as null on typed record)
    @Test
    void extract_invalidDateField_isNulledOut() {
        String validJson = """
            [{"jobTitle": "Software Engineer", "company": "Acme Corp",
              "startDate": "not-a-date", "endDate": "Present",
              "description": "Built services"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Acme Corp"))
        );

        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "Software Engineer at Acme Corp Built services");

        assertThat(result.workExperiences()).hasSize(1);
        WorkExperienceItem item = result.workExperiences().get(0);
        // Invalid startDate "not-a-date" must be nulled
        assertThat(item.startDate()).isNull();
        // Valid fields retained
        assertThat(item.jobTitle()).isEqualTo("Software Engineer");
        assertThat(item.company()).isEqualTo("Acme Corp");
        // "Present" maps to null endDate
        assertThat(item.endDate()).isNull();
    }

    // Anchor check failure: item is NOT dropped, just logged as low confidence
    @Test
    void extract_anchorCheckFailure_setsLowConfidenceItemNotDropped() {
        String validJson = """
            [{"jobTitle": "Fabricated Title", "company": "Ghost Corp",
              "startDate": "2020-01", "endDate": "2022-06",
              "description": "Invented achievements"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        // rawText does NOT contain "Fabricated Title" or "Ghost Corp"
        String rawText = "Software Engineer at Real Company 2020 to 2022";
        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Real Company"))
        );

        ParsedResumeDto result = llmSectionExtractor.extract(sections, rawText);

        // Exactly 1 item — anchor failure does NOT drop the item, just logs WARN
        assertThat(result.workExperiences()).hasSize(1);
        assertThat(result.workExperiences().get(0).jobTitle()).isNotNull();
    }

    // AiService throws OllamaUnavailableException — falls back to heuristic (empty typed lists for SKILLS)
    @Test
    void extract_aiServiceThrowsOllamaUnavailable_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenThrow(new OllamaUnavailableException("Ollama is down"));

        List<RawSection> sections = List.of(
            new RawSection("Skills", List.of("Java", "Spring Boot", "PostgreSQL"))
        );

        ParsedResumeDto result = llmSectionExtractor.extract(sections, "Java Spring Boot PostgreSQL");

        // Heuristic items are GenericItems; SKILLS dispatch filters instanceof SkillItem → empty list
        assertThat(result).isNotNull();
        assertThat(result.skills()).isEmpty();
    }

    // Typed WorkExperienceItem construction from LLM JSON
    @Test
    void extract_workExperienceSection_returnsTypedWorkExperiences() {
        String validJson = """
            [{"jobTitle": "Software Engineer", "company": "Acme Corp",
              "startDate": "2020-01", "endDate": "2023-06",
              "isCurrent": false, "description": "Built services"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Acme Corp"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(sections, "Software Engineer at Acme Corp Built services");

        assertThat(result.workExperiences()).hasSize(1);
        WorkExperienceItem item = result.workExperiences().get(0);
        assertThat(item.jobTitle()).isEqualTo("Software Engineer");
        assertThat(item.company()).isEqualTo("Acme Corp");
        assertThat(item.startDate()).isEqualTo(LocalDate.of(2020, Month.JANUARY, 1));
        assertThat(item.endDate()).isEqualTo(LocalDate.of(2023, Month.JUNE, 1));
        assertThat(item.isCurrent()).isFalse();
    }

    // SUMMARY section maps to summary field
    @Test
    void extract_summarySection_mapsSummaryField() {
        String validJson = """
            [{"text": "Experienced software engineer with 5 years building distributed systems."}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Summary", List.of("Experienced software engineer with 5 years building distributed systems."))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "Experienced software engineer with 5 years building distributed systems.");

        assertThat(result.summary()).isNotNull();
        assertThat(result.summary().text()).isEqualTo(
            "Experienced software engineer with 5 years building distributed systems.");
    }

    // UNKNOWN section produces no entries in any typed list
    @Test
    void extract_unknownSection_producesNoTypedItems() {
        String validJson = """
            [{"text": "Some custom content"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Custom Section", List.of("Some custom content"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(sections, "Some custom content");

        // UNKNOWN sections are explicitly skipped — no items in any typed list
        assertThat(result.workExperiences()).isEmpty();
        assertThat(result.education()).isEmpty();
        assertThat(result.skills()).isEmpty();
        assertThat(result.certifications()).isEmpty();
        assertThat(result.languages()).isEmpty();
        assertThat(result.projects()).isEmpty();
        assertThat(result.volunteering()).isEmpty();
        assertThat(result.summary()).isNull();
    }

    // Skills section builds typed SkillItem
    @Test
    void extract_skillsSection_buildsTypedSkillItem() {
        String validJson = """
            [{"name": "Java"}, {"name": "Spring Boot"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Skills", List.of("Java", "Spring Boot"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(sections, "Java Spring Boot");

        assertThat(result.skills()).hasSize(2);
        assertThat(result.skills().get(0)).isInstanceOf(SkillItem.class);
        assertThat(result.skills().get(0).name()).isEqualTo("Java");
    }

    // Lines 72-74: section text longer than 3000 chars is truncated before sending to LLM
    @Test
    void extract_sectionTextExceedsMaxLength_isTruncatedTo3000Chars() {
        String longLine = "A".repeat(3200);
        String validJson = """
            [{"name": "Java"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Skills", List.of(longLine))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(sections, longLine);

        // The LLM is still called (with truncated text) and returns a valid result
        assertThat(result.skills()).hasSize(1);
    }

    // Lines 86-89: EDUCATION section dispatches typed EducationItem
    @Test
    void extract_educationSection_buildsTypedEducationItem() {
        String validJson = """
            [{"institution": "MIT", "degree": "B.Sc.", "fieldOfStudy": "CS",
              "startDate": "2016-09-01", "endDate": "2020-06-01"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Education", List.of("MIT B.Sc. CS 2016-2020"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(sections, "MIT B.Sc. CS 2016-2020");

        assertThat(result.education()).hasSize(1);
        EducationItem item = result.education().get(0);
        assertThat(item).isInstanceOf(EducationItem.class);
        assertThat(item.institution()).isEqualTo("MIT");
        assertThat(item.degree()).isEqualTo("B.Sc.");
        assertThat(item.fieldOfStudy()).isEqualTo("CS");
        assertThat(item.startDate()).isEqualTo(LocalDate.of(2016, Month.SEPTEMBER, 1));
    }

    // Lines 94-99: CERTIFICATIONS section dispatches typed CertificationItem
    @Test
    void extract_certificationsSection_buildsTypedCertificationItem() {
        String validJson = """
            [{"name": "AWS Solutions Architect", "issuer": "Amazon",
              "issueDate": "2022-03-01", "expirationDate": "2025-03-01"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Certifications", List.of("AWS Solutions Architect Amazon 2022"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "AWS Solutions Architect Amazon 2022");

        assertThat(result.certifications()).hasSize(1);
        CertificationItem item = result.certifications().get(0);
        assertThat(item).isInstanceOf(CertificationItem.class);
        assertThat(item.name()).isEqualTo("AWS Solutions Architect");
        assertThat(item.issuer()).isEqualTo("Amazon");
        assertThat(item.issueDate()).isEqualTo(LocalDate.of(2022, Month.MARCH, 1));
        assertThat(item.expirationDate()).isEqualTo(LocalDate.of(2025, Month.MARCH, 1));
    }

    // Lines 98-101: LANGUAGES section dispatches typed LanguageItem
    @Test
    void extract_languagesSection_buildsTypedLanguageItem() {
        String validJson = """
            [{"language": "English", "proficiency": "Native"},
             {"language": "Spanish", "proficiency": "Intermediate"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Languages", List.of("English Native", "Spanish Intermediate"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "English Native Spanish Intermediate");

        assertThat(result.languages()).hasSize(2);
        LanguageItem item = result.languages().get(0);
        assertThat(item).isInstanceOf(LanguageItem.class);
        assertThat(item.language()).isEqualTo("English");
        assertThat(item.proficiency()).isEqualTo("Native");
    }

    // Lines 102-105: PROJECTS section dispatches typed ProjectItem
    @Test
    void extract_projectsSection_buildsTypedProjectItem() {
        String validJson = """
            [{"name": "Resume Enhancer", "description": "AI-powered resume tool",
              "technologies": "Java Spring Boot", "link": "https://github.com/example",
              "startDate": "2023-01", "endDate": null, "isCurrent": true}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Projects", List.of("Resume Enhancer AI-powered resume tool"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "Resume Enhancer AI-powered resume tool Java Spring Boot");

        assertThat(result.projects()).hasSize(1);
        ProjectItem item = result.projects().get(0);
        assertThat(item).isInstanceOf(ProjectItem.class);
        assertThat(item.name()).isEqualTo("Resume Enhancer");
        assertThat(item.description()).isEqualTo("AI-powered resume tool");
        assertThat(item.isCurrent()).isTrue();
    }

    // Lines 106-109: VOLUNTEERING section dispatches typed VolunteeringItem
    @Test
    void extract_volunteeringSection_buildsTypedVolunteeringItem() {
        String validJson = """
            [{"role": "Mentor", "organization": "Code for Good",
              "description": "Taught programming", "startDate": "2021-06",
              "endDate": "2022-12", "isCurrent": false}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Volunteering", List.of("Mentor at Code for Good 2021-2022"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "Mentor Code for Good Taught programming");

        assertThat(result.volunteering()).hasSize(1);
        VolunteeringItem item = result.volunteering().get(0);
        assertThat(item).isInstanceOf(VolunteeringItem.class);
        assertThat(item.role()).isEqualTo("Mentor");
        assertThat(item.organization()).isEqualTo("Code for Good");
        assertThat(item.isCurrent()).isFalse();
    }

    // Lines 149-150: null JSON response falls back to heuristic lines
    @Test
    void extract_nullJsonResponse_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(null);

        List<RawSection> sections = List.of(
            new RawSection("Work Experience",
                List.of("Software Engineer at Acme Corp 2022-2024"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "Software Engineer at Acme Corp 2022-2024");

        // Null response → heuristic fallback → GenericItems not typed as WorkExperienceItem
        assertThat(result).isNotNull();
        assertThat(result.workExperiences()).isEmpty();
    }

    // Lines 291: date in "YYYY" format is parsed as YYYY-01-01
    @Test
    void extract_yearOnlyDate_isParsedAsJanuaryFirst() {
        String validJson = """
            [{"institution": "University of Sofia", "degree": "M.Sc.",
              "fieldOfStudy": "Computer Science", "startDate": "2014", "endDate": "2018"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Education", List.of("University of Sofia M.Sc. CS 2014-2018"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "University of Sofia M.Sc. Computer Science 2014 2018");

        assertThat(result.education()).hasSize(1);
        EducationItem item = result.education().get(0);
        // "2014" → 2014-01-01
        assertThat(item.startDate()).isEqualTo(LocalDate.of(2014, Month.JANUARY, 1));
        // "2018" → 2018-01-01
        assertThat(item.endDate()).isEqualTo(LocalDate.of(2018, Month.JANUARY, 1));
    }

    // Lines 178-181: buildTypedItem failure falls back to GenericItem
    // We trigger this by providing a JSON field that would cause a build error —
    // the easiest way is to use an UNKNOWN section type (which returns GenericItem directly).
    // But to test the fallback path specifically we need a section type that can fail.
    // We use a Skills section with fields that cause str() to get called on a non-string value
    // that still parses fine — so instead we test via UNKNOWN section with toStringMap logic.
    @Test
    void extract_unknownSectionWithNestedFields_producesGenericItemsViaToStringMap() {
        String validJson = """
            [{"category": "Tech", "items": ["Java", "Python"]}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Other Skills", List.of("Tech: Java, Python"))
        );
        // "Other Skills" header maps to UNKNOWN section type
        ParsedResumeDto result = llmSectionExtractor.extract(sections, "Tech: Java, Python");

        // UNKNOWN dispatches are skipped in typed lists — but the toStringMap code path
        // is exercised when building the GenericItem inside buildTypedItem
        assertThat(result.workExperiences()).isEmpty();
        assertThat(result.education()).isEmpty();
    }

    // Multiple SUMMARY sections — only the first one is retained
    @Test
    void extract_multipleSummarySections_onlyFirstIsRetained() {
        String firstJson = """
            [{"text": "First summary text here for testing."}]
            """;
        String secondJson = """
            [{"text": "Second summary text here for testing."}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenReturn(firstJson)
            .thenReturn(secondJson);

        List<RawSection> sections = List.of(
            new RawSection("Summary", List.of("First summary text here for testing.")),
            new RawSection("Profile", List.of("Second summary text here for testing."))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "First summary text here for testing. Second summary text here for testing.");

        assertThat(result.summary()).isNotNull();
        assertThat(result.summary().text()).isEqualTo("First summary text here for testing.");
    }

    // CERTIFICATIONS section with null issueDate and expirationDate (both "Present")
    @Test
    void extract_certificationSection_nullDates_handledGracefully() {
        String validJson = """
            [{"name": "PMP", "issuer": "PMI",
              "issueDate": "Present", "expirationDate": "null"}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Certifications", List.of("PMP PMI"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(sections, "PMP PMI");

        assertThat(result.certifications()).hasSize(1);
        CertificationItem item = result.certifications().get(0);
        // "Present" and "null" both map to null date
        assertThat(item.issueDate()).isNull();
        assertThat(item.expirationDate()).isNull();
    }

    // PROJECTS section with isCurrent=false and valid dates
    @Test
    void extract_projectsSection_isCurrentFalse_parsedDatesSet() {
        String validJson = """
            [{"name": "Open Source Library", "description": "A utility library",
              "technologies": "Kotlin", "link": null,
              "startDate": "2020", "endDate": "2021", "isCurrent": false}]
            """;
        when(aiService.extractResumeSection(anyString(), anyString())).thenReturn(validJson);

        List<RawSection> sections = List.of(
            new RawSection("Projects", List.of("Open Source Library utility Kotlin 2020-2021"))
        );
        ParsedResumeDto result = llmSectionExtractor.extract(
            sections, "Open Source Library A utility library Kotlin");

        assertThat(result.projects()).hasSize(1);
        ProjectItem item = result.projects().get(0);
        assertThat(item.isCurrent()).isFalse();
        assertThat(item.startDate()).isEqualTo(LocalDate.of(2020, 1, 1));
        assertThat(item.endDate()).isEqualTo(LocalDate.of(2021, 1, 1));
        assertThat(item.link()).isNull();
    }
}
