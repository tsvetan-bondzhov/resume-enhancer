package com.tsvetanbondzhov.resumeenhancer.upload;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
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

    // AC6: JSON parse failure falls back to heuristic lines
    @Test
    void extract_malformedJsonResponse_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenReturn("NOT_VALID_JSON{{{{");

        List<RawSection> sections = List.of(
            new RawSection("Work Experience", List.of("Software Engineer at Acme Corp 2022-2024"))
        );

        ResumeDocument result = llmSectionExtractor.extract(sections, "Software Engineer at Acme Corp 2022-2024");

        assertThat(result.sections()).hasSize(1);
        ResumeSection section = result.sections().get(0);
        assertThat(section.items()).hasSize(1);
        // Fallback: single GenericItem with "text" field = the raw line
        assertThat(section.items().get(0)).isInstanceOf(GenericItem.class);
        assertThat(((GenericItem) section.items().get(0)).fields()).containsKey("text");
        assertThat(((GenericItem) section.items().get(0)).fields().get("text"))
            .isEqualTo("Software Engineer at Acme Corp 2022-2024");
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

        ResumeDocument result = llmSectionExtractor.extract(
            sections, "Software Engineer at Acme Corp Built services");

        ResumeSection section = result.sections().get(0);
        assertThat(section.items()).hasSize(1);
        assertThat(section.items().get(0)).isInstanceOf(WorkExperienceItem.class);
        WorkExperienceItem item = (WorkExperienceItem) section.items().get(0);
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

        ResumeDocument result = llmSectionExtractor.extract(sections, rawText);

        ResumeSection section = result.sections().get(0);
        // Exactly 1 item returned — anchor failure does NOT drop the item, just logs WARN
        assertThat(section.items()).hasSize(1);
        // Item is NOT dropped — it is included despite low confidence
        assertThat(section.items().get(0)).isInstanceOf(WorkExperienceItem.class);
        WorkExperienceItem item = (WorkExperienceItem) section.items().get(0);
        assertThat(item.jobTitle()).isNotNull();
    }

    // AC6: AiService throws OllamaUnavailableException — falls back to heuristic lines
    @Test
    void extract_aiServiceThrowsOllamaUnavailable_fallsBackToHeuristicLines() {
        when(aiService.extractResumeSection(anyString(), anyString()))
            .thenThrow(new OllamaUnavailableException("Ollama is down"));

        List<RawSection> sections = List.of(
            new RawSection("Skills", List.of("Java", "Spring Boot", "PostgreSQL"))
        );

        ResumeDocument result = llmSectionExtractor.extract(sections, "Java Spring Boot PostgreSQL");

        assertThat(result.sections()).hasSize(1);
        ResumeSection section = result.sections().get(0);
        // Each line becomes one heuristic GenericItem
        assertThat(section.items()).hasSize(3);
        assertThat(section.items().get(0)).isInstanceOf(GenericItem.class);
    }

    // New: typed WorkExperienceItem construction
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

    // New: UNKNOWN section builds GenericItem
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

    // New: Skills section builds typed SkillItem
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
}
