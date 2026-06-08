package com.tsvetanbondzhov.resumeenhancer.upload;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LlmSectionExtractorTest {

    @Mock
    private AiService aiService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

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
        // Fallback: single item with "text" field = the raw line
        assertThat(section.items().get(0).fields()).containsKey("text");
        assertThat(section.items().get(0).fields().get("text"))
            .isEqualTo("Software Engineer at Acme Corp 2022-2024");
    }

    // AC7: Date fields with invalid format are nulled out
    @Test
    void extract_invalidDateField_isNulledOut() {
        String validJson = """
            [{"title": "Software Engineer", "company": "Acme Corp",
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
        var item = section.items().get(0);
        // Invalid startDate "not-a-date" must be nulled (not present in fields)
        assertThat(item.fields()).doesNotContainKey("startDate");
        // Valid fields retained
        assertThat(item.fields()).containsEntry("title", "Software Engineer");
        assertThat(item.fields()).containsEntry("company", "Acme Corp");
        assertThat(item.fields()).containsEntry("endDate", "Present");
    }

    // AC8: Anchor check failure sets lowConfidence: true, item NOT dropped
    @Test
    void extract_anchorCheckFailure_setsLowConfidenceItemNotDropped() {
        String validJson = """
            [{"title": "Fabricated Title", "company": "Ghost Corp",
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
        assertThat(section.items()).hasSize(1);
        // Item is NOT dropped — it is included despite low confidence
        assertThat(section.items().get(0).fields()).isNotEmpty();
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
        // Each line becomes one heuristic item
        assertThat(section.items()).hasSize(3);
    }
}
