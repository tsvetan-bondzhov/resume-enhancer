package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.*;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ResumeContextBuilderTest {

    @Test
    void returns_empty_string_for_null_document() {
        assertThat(ResumeContextBuilder.buildResumeContext(null)).isEmpty();
    }

    @Test
    void returns_empty_string_for_document_with_no_sections() {
        ResumeDocument doc = new ResumeDocument(List.of());
        assertThat(ResumeContextBuilder.buildResumeContext(doc)).isEmpty();
    }

    @Test
    void builds_context_with_section_header_and_numbered_items() {
        SkillItem java = new SkillItem("s-0", "Java");
        SkillItem kotlin = new SkillItem("s-1", "Kotlin");
        ResumeSection section = new ResumeSection(
                ResumeSectionType.SKILLS, "Skills", true, List.of(java, kotlin));
        ResumeDocument doc = new ResumeDocument(List.of(section));

        String context = ResumeContextBuilder.buildResumeContext(doc);

        assertThat(context)
                .startsWith("--- RESUME CONTENT ---")
                .contains("[SKILLS]")
                .contains("1. ")
                .contains("2. ")
                .endsWith("--- END OF RESUME ---\n");
    }

    @Test
    void skips_invisible_sections() {
        SkillItem visibleSkill = new SkillItem("s-0", "Visible");
        ResumeSection hidden = new ResumeSection(
                ResumeSectionType.SUMMARY, "Summary", false,
                List.of(new SummaryItem("sum-0", "Hidden text", null, null, null, null, null, null)));
        ResumeSection shown = new ResumeSection(
                ResumeSectionType.SKILLS, "Skills", true, List.of(visibleSkill));
        ResumeDocument doc = new ResumeDocument(List.of(hidden, shown));

        String context = ResumeContextBuilder.buildResumeContext(doc);

        assertThat(context)
                .doesNotContain("[SUMMARY]")
                .contains("[SKILLS]");
    }
}
