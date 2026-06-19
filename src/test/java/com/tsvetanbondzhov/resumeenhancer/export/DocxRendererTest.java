package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.export.renderers.DocxRenderer;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link DocxRenderer}.
 * <p>
 * No Spring context — pure Mockito-based unit test (AC6).
 * Uses Apache POI's {@link XWPFDocument} to validate that the output is a
 * well-formed DOCX file.
 */
@ExtendWith(MockitoExtension.class)
class DocxRendererTest {

    private DocxRenderer renderer;

    @BeforeEach
    void setUp() {
        renderer = new DocxRenderer(new TemplateDefinitionService(new ObjectMapper()));
    }

    // ─── Fixture 1: Default template + full document ──────────────────────────

    @Test
    void render_fullDocument_defaultTemplate_returnsNonEmptyValidDocx() throws IOException {
        ResumeDocument doc = buildFullDocument();
        ResumeTemplate template = new ResumeTemplate(); // null templateDefinition → DEFAULT

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(parsed.getParagraphs()).isNotEmpty();
        }
    }

    // ─── Fixture 2: Single SKILLS section ────────────────────────────────────

    @Test
    void render_skillsSectionOnly_returnsNonEmptyValidDocx() throws IOException {
        ResumeSection skillsSection = new ResumeSection(
                ResumeSectionType.SKILLS,
                "Skills",
                true,
                List.of(
                        new SkillItem(UUID.randomUUID().toString(), "Java"),
                        new SkillItem(UUID.randomUUID().toString(), "Spring Boot"),
                        new SkillItem(UUID.randomUUID().toString(), "PostgreSQL")
                )
        );
        ResumeDocument doc = new ResumeDocument(List.of(skillsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(parsed.getParagraphs()).isNotEmpty();
        }
    }

    // ─── Empty document renders without throwing ──────────────────────────────

    @Test
    void render_emptyDocument_rendersWithoutException() throws IOException {
        ResumeDocument doc = new ResumeDocument(List.of());
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            // A blank DOCX may have zero paragraphs — just verify it parses without error
            assertThat(parsed).isNotNull();
        }
    }

    // ─── isCurrent=true renders "Present" not null date ──────────────────────

    @Test
    void render_workExperienceWithIsCurrent_rendersPresentText() throws IOException {
        ResumeSection workSection = new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE,
                "Experience",
                true,
                List.of(new WorkExperienceItem(
                        UUID.randomUUID().toString(),
                        "Senior Engineer",
                        "Acme Corp",
                        LocalDate.of(2022, 1, 1),
                        null,  // endDate is null
                        true,  // isCurrent = true
                        "Leading the platform team."
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(workSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasPresent = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Present"));
            assertThat(hasPresent)
                    .as("DOCX should contain 'Present' for isCurrent=true work experience")
                    .isTrue();
        }
    }

    // ─── Invisible sections are skipped ──────────────────────────────────────

    @Test
    void render_invisibleSection_isNotIncludedInOutput() throws IOException {
        ResumeSection visibleSection = new ResumeSection(
                ResumeSectionType.SKILLS,
                "Skills",
                true,
                List.of(new SkillItem(UUID.randomUUID().toString(), "Java"))
        );
        ResumeSection hiddenSection = new ResumeSection(
                ResumeSectionType.LANGUAGES,
                "Languages",
                false, // not visible
                List.of()
        );
        ResumeDocument doc = new ResumeDocument(List.of(visibleSection, hiddenSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            // The hidden section's title "LANGUAGES" should not appear as a heading
            boolean hasHiddenHeading = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().toUpperCase().contains("LANGUAGES"));
            assertThat(hasHiddenHeading)
                    .as("Hidden section title should not appear in the DOCX output")
                    .isFalse();
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private ResumeDocument buildFullDocument() {
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of(new SummaryItem(
                        UUID.randomUUID().toString(),
                        "Experienced software engineer with a passion for clean code.",
                        "https://linkedin.com/in/johndoe",
                        null,
                        null,
                        "john.doe@example.com",
                        "USA",
                        "New York"
                ))
        );

        ResumeSection workSection = new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE,
                "Experience",
                true,
                List.of(
                        new WorkExperienceItem(
                                UUID.randomUUID().toString(),
                                "Senior Software Engineer",
                                "Acme Corp",
                                LocalDate.of(2020, 1, 1),
                                null,
                                true,
                                "Led backend development using Java and Spring Boot."
                        ),
                        new WorkExperienceItem(
                                UUID.randomUUID().toString(),
                                "Software Engineer",
                                "Startup Inc",
                                LocalDate.of(2017, 6, 1),
                                LocalDate.of(2019, 12, 31),
                                false,
                                "Built microservices and REST APIs."
                        )
                )
        );

        ResumeSection educationSection = new ResumeSection(
                ResumeSectionType.EDUCATION,
                "Education",
                true,
                List.of(
                        new EducationItem(
                                UUID.randomUUID().toString(),
                                "State University",
                                "Bachelor of Science",
                                "Computer Science",
                                LocalDate.of(2013, 9, 1),
                                LocalDate.of(2017, 5, 31)
                        )
                )
        );

        ResumeSection skillsSection = new ResumeSection(
                ResumeSectionType.SKILLS,
                "Skills",
                true,
                List.of(
                        new SkillItem(UUID.randomUUID().toString(), "Java"),
                        new SkillItem(UUID.randomUUID().toString(), "Spring Boot"),
                        new SkillItem(UUID.randomUUID().toString(), "PostgreSQL")
                )
        );

        ResumeSection certsSection = new ResumeSection(
                ResumeSectionType.CERTIFICATIONS,
                "Certifications",
                true,
                List.of(
                        new CertificationItem(
                                UUID.randomUUID().toString(),
                                "AWS Certified Solutions Architect",
                                "Amazon Web Services",
                                LocalDate.of(2022, 3, 1),
                                null
                        )
                )
        );

        ResumeSection languagesSection = new ResumeSection(
                ResumeSectionType.LANGUAGES,
                "Languages",
                true,
                List.of(
                        new LanguageItem(UUID.randomUUID().toString(), "English", "Native"),
                        new LanguageItem(UUID.randomUUID().toString(), "German", "Intermediate")
                )
        );

        return new ResumeDocument(List.of(
                summarySection, workSection, educationSection,
                skillsSection, certsSection, languagesSection
        ));
    }
}
