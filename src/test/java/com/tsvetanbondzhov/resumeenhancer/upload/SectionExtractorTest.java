package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.SectionExtractor;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SectionExtractorTest {

    // AC2: Full-line match only — "experience" in mid-sentence does NOT trigger section
    @Test
    void segmentByHeaders_midSentenceKeyword_doesNotTriggerSection() {
        String rawText = """
            John Doe
            5 years of experience in backend development
            Strong problem-solving skills
            """;

        List<RawSection> sections = SectionExtractor.segmentByHeaders(rawText);

        // "5 years of experience..." should NOT be treated as a section header
        assertThat(sections).isEmpty();
    }

    // AC2: Full-line keyword triggers new section
    @Test
    void segmentByHeaders_fullLineKeyword_triggersNewSection() {
        String rawText = """
            Work Experience
            Software Engineer at Acme Corp 2022-2024
            Built microservices

            Education
            BS Computer Science, MIT 2022
            """;

        List<RawSection> sections = SectionExtractor.segmentByHeaders(rawText);

        assertThat(sections).hasSize(2);
        assertThat(sections.get(0).title()).isEqualTo("Work Experience");
        assertThat(sections.get(0).lines()).contains("Software Engineer at Acme Corp 2022-2024");
        assertThat(sections.get(1).title()).isEqualTo("Education");
    }

    // AC2: Expanded keyword set — certifications detected
    @Test
    void segmentByHeaders_certifications_detected() {
        String rawText = """
            Certifications
            AWS Certified Solutions Architect 2023
            """;

        List<RawSection> sections = SectionExtractor.segmentByHeaders(rawText);

        assertThat(sections).hasSize(1);
        assertThat(sections.get(0).title()).isEqualTo("Certifications");
    }
}
