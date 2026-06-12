package com.tsvetanbondzhov.resumeenhancer.upload;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
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
}
