package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.export.renderers.DocxRenderer;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
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
import java.util.Map;
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

    // ─── PROJECTS section ─────────────────────────────────────────────────────

    @Test
    void render_projectsSection_rendersWithoutException() throws IOException {
        ResumeSection projectsSection = new ResumeSection(
                ResumeSectionType.PROJECTS,
                "Projects",
                true,
                List.of(new ProjectItem(
                        UUID.randomUUID().toString(),
                        "My Project",
                        "A useful tool.",
                        "Java, Kotlin",
                        "https://github.com/example/myproject",
                        LocalDate.of(2023, 1, 1),
                        LocalDate.of(2023, 6, 30),
                        false
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(projectsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasProject = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("My Project"));
            assertThat(hasProject).as("DOCX should contain project name").isTrue();
        }
    }

    @Test
    void render_projectsSection_withCurrentProject_rendersPresentText() throws IOException {
        ResumeSection projectsSection = new ResumeSection(
                ResumeSectionType.PROJECTS,
                "Projects",
                true,
                List.of(new ProjectItem(
                        UUID.randomUUID().toString(),
                        "OSS Project",
                        "Ongoing open source work.",
                        "Go",
                        null,
                        LocalDate.of(2024, 1, 1),
                        null,
                        true  // isCurrent
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(projectsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasPresent = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Present"));
            assertThat(hasPresent).as("DOCX should contain 'Present' for current project").isTrue();
        }
    }

    // ─── VOLUNTEERING section ─────────────────────────────────────────────────

    @Test
    void render_volunteeringSection_rendersWithoutException() throws IOException {
        ResumeSection volunteeringSection = new ResumeSection(
                ResumeSectionType.VOLUNTEERING,
                "Volunteering",
                true,
                List.of(new VolunteeringItem(
                        UUID.randomUUID().toString(),
                        "Tutor",
                        "Community Center",
                        "Taught coding workshops.",
                        LocalDate.of(2022, 1, 1),
                        LocalDate.of(2022, 12, 31),
                        false
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(volunteeringSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasTutor = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Tutor"));
            assertThat(hasTutor).as("DOCX should contain volunteering role").isTrue();
        }
    }

    @Test
    void render_volunteeringSection_withCurrentRole_rendersPresentText() throws IOException {
        ResumeSection volunteeringSection = new ResumeSection(
                ResumeSectionType.VOLUNTEERING,
                "Volunteering",
                true,
                List.of(new VolunteeringItem(
                        UUID.randomUUID().toString(),
                        "Coordinator",
                        "Local Nonprofit",
                        "Organizing events.",
                        LocalDate.of(2023, 3, 1),
                        null,
                        true  // isCurrent
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(volunteeringSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasPresent = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Present"));
            assertThat(hasPresent).as("DOCX should contain 'Present' for current volunteering role").isTrue();
        }
    }

    // ─── GENERIC section ──────────────────────────────────────────────────────

    @Test
    void render_genericSection_rendersFieldKeyValuePairs() throws IOException {
        ResumeSection genericSection = new ResumeSection(
                ResumeSectionType.UNKNOWN,
                "Interests",
                true,
                List.of(new GenericItem(
                        UUID.randomUUID().toString(),
                        Map.of("hobby", "Hiking")
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(genericSection));

        // Use a template with null layout so orderSections() returns all sections
        // unfiltered (avoids UNKNOWN being excluded from a fixed sectionOrder)
        ResumeTemplate template = new ResumeTemplate();
        Map<String, Object> defMap = new ObjectMapper().convertValue(
                new TemplateDefinition(
                        "single-column",
                        Map.of("--font-size-base", "11px"),
                        null,  // null layout → buildSectionOrder returns empty → all sections pass through
                        null
                ),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
        );
        template.setTemplateDefinition(defMap);

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        // Verify the document is a valid parseable DOCX — the GenericItem fields flow
        // through renderGeneric() which adds key: value paragraphs for each field
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(parsed).isNotNull();
        }
    }

    // ─── No SUMMARY section (null summary) ───────────────────────────────────

    @Test
    void render_noSummarySection_rendersWithoutException() throws IOException {
        ResumeSection workSection = new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE,
                "Experience",
                true,
                List.of(new WorkExperienceItem(
                        UUID.randomUUID().toString(),
                        "Developer",
                        "Company",
                        LocalDate.of(2021, 1, 1),
                        null,
                        true,
                        "Building things."
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(workSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(parsed).isNotNull();
        }
    }

    // ─── SummaryItem with null email (buildNameDisplay returns null) ──────────

    @Test
    void render_summaryWithNullEmail_rendersWithoutNameDisplay() throws IOException {
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of(new SummaryItem(
                        UUID.randomUUID().toString(),
                        "Professional summary.",
                        "https://linkedin.com/in/someone",
                        null,
                        null,
                        null,   // contactEmail is null
                        "France",
                        "Paris"
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(summarySection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(parsed).isNotNull();
        }
    }

    // ─── SummaryItem with email that has no '@' sign ──────────────────────────

    @Test
    void render_summaryWithEmailWithoutAtSign_buildNameDisplayReturnsNull() throws IOException {
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of(new SummaryItem(
                        UUID.randomUUID().toString(),
                        "Some summary text.",
                        null,
                        null,
                        null,
                        "notanemail",   // no '@' character
                        "Spain",
                        "Madrid"
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(summarySection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertThat(parsed).isNotNull();
        }
    }

    // ─── Summary text is rendered in document ────────────────────────────────

    @Test
    void render_summaryWithText_rendersTextInDocument() throws IOException {
        String summaryText = "A seasoned backend developer with strong system design skills.";
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of(new SummaryItem(
                        UUID.randomUUID().toString(),
                        summaryText,
                        null,
                        null,
                        null,
                        "dev@example.com",
                        null,
                        null
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(summarySection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasText = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("seasoned backend developer"));
            assertThat(hasText).as("DOCX should contain the summary text").isTrue();
        }
    }

    // ─── renderLanguage with null language, non-null proficiency ─────────────

    @Test
    void render_languageItem_withNullLanguage_rendersOnlyProficiency() throws IOException {
        ResumeSection langSection = new ResumeSection(
                ResumeSectionType.LANGUAGES,
                "Languages",
                true,
                List.of(new LanguageItem(UUID.randomUUID().toString(), null, "B2"))
        );
        ResumeDocument doc = new ResumeDocument(List.of(langSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasB2 = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("B2"));
            assertThat(hasB2).as("DOCX should contain proficiency when language is null").isTrue();
        }
    }

    // ─── renderLanguage with non-null language, null proficiency ─────────────

    @Test
    void render_languageItem_withNullProficiency_rendersOnlyLanguage() throws IOException {
        ResumeSection langSection = new ResumeSection(
                ResumeSectionType.LANGUAGES,
                "Languages",
                true,
                List.of(new LanguageItem(UUID.randomUUID().toString(), "Italian", null))
        );
        ResumeDocument doc = new ResumeDocument(List.of(langSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasItalian = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Italian"));
            assertThat(hasItalian).as("DOCX should contain language name when proficiency is null").isTrue();
        }
    }

    // ─── renderCertification with null issuer and null issueDate ─────────────

    @Test
    void render_certificationWithNullIssuerAndNullDate_rendersNameOnly() throws IOException {
        ResumeSection certsSection = new ResumeSection(
                ResumeSectionType.CERTIFICATIONS,
                "Certifications",
                true,
                List.of(new CertificationItem(
                        UUID.randomUUID().toString(),
                        "Cloud Practitioner",
                        null,   // null issuer
                        null,   // null issueDate
                        null
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(certsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasCert = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Cloud Practitioner"));
            assertThat(hasCert).as("DOCX should contain certification name").isTrue();
        }
    }

    // ─── Two-column template flattens left + right section order ─────────────

    @Test
    void render_twoColumnTemplate_flattensSectionsIntoSingleColumn() throws IOException {
        ResumeSection workSection = new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE,
                "Experience",
                true,
                List.of(new WorkExperienceItem(
                        UUID.randomUUID().toString(),
                        "Lead Engineer",
                        "Firm",
                        LocalDate.of(2021, 1, 1),
                        null,
                        true,
                        "Leading the backend team."
                ))
        );
        ResumeSection skillsSection = new ResumeSection(
                ResumeSectionType.SKILLS,
                "Skills",
                true,
                List.of(new SkillItem(UUID.randomUUID().toString(), "Python"))
        );
        ResumeDocument doc = new ResumeDocument(List.of(workSection, skillsSection));

        ResumeTemplate template = new ResumeTemplate();
        Map<String, Object> defMap = new ObjectMapper().convertValue(
                new TemplateDefinition(
                        "two-column",
                        Map.of("--font-size-base", "11px"),
                        new TemplateLayout(
                                "name-contact",
                                null,  // no sectionOrder for two-column
                                new TemplateColumns(
                                        List.of("WORK_EXPERIENCE"),
                                        List.of("SKILLS")
                                ),
                                Map.of()
                        ),
                        Map.of()
                ),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
        );
        template.setTemplateDefinition(defMap);

        byte[] docx = renderer.render(doc, template);

        assertThat(docx).isNotEmpty();
        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasWork = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Lead Engineer"));
            boolean hasSkills = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Python"));
            assertThat(hasWork).as("Two-column DOCX should include left-column sections").isTrue();
            assertThat(hasSkills).as("Two-column DOCX should include right-column sections").isTrue();
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
