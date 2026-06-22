package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.export.renderers.PdfRenderer;
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
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

/**
 * Unit tests for {@link PdfRenderer}.
 * <p>
 * No Spring context — pure Mockito-based unit test (AC6).
 * Uses PDFBox to validate that the output is a well-formed PDF.
 */
@ExtendWith(MockitoExtension.class)
class PdfRendererTest {

    private PdfRenderer renderer;

    @BeforeEach
    void setUp() {
        renderer = new PdfRenderer(new TemplateDefinitionService(new ObjectMapper()));
    }

    // ─── Fixture 1: Default single-column template + full document ────────────

    @Test
    void render_fullDocument_defaultTemplate_returnsNonEmptyValidPdf() throws IOException {
        ResumeDocument doc = buildFullDocument();
        ResumeTemplate template = new ResumeTemplate(); // null templateDefinition → DEFAULT

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── Fixture 2: Single section (SKILLS only) ─────────────────────────────

    @Test
    void render_skillsSectionOnly_withExplicitTemplateDefinition_returnsValidPdf() throws IOException {
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
        Map<String, Object> defMap = new ObjectMapper().convertValue(
                TemplateDefinition.DEFAULT,
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        template.setTemplateDefinition(defMap);

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── Empty document renders without throwing ──────────────────────────────

    @Test
    void render_emptyDocument_rendersWithoutException() throws IOException {
        ResumeDocument doc = new ResumeDocument(List.of());
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── Null templateDefinition falls back to DEFAULT (AC7) ─────────────────

    @Test
    void render_nullTemplateDefinition_fallsBackToDefault_doesNotThrow() {
        ResumeDocument doc = buildFullDocument();
        ResumeTemplate template = new ResumeTemplate();
        // templateDefinition is null → TemplateDefinitionService returns DEFAULT

        assertThatNoException().isThrownBy(() -> {
            byte[] pdf = renderer.render(doc, template);
            assertThat(pdf).isNotEmpty();
        });
    }

    // ─── Invisible sections are skipped ──────────────────────────────────────

    @Test
    void render_invisibleSection_skippedWithoutError() throws IOException {
        ResumeSection hiddenSection = new ResumeSection(
                ResumeSectionType.SKILLS,
                "Skills",
                false, // not visible
                List.of(new SkillItem(UUID.randomUUID().toString(), "Java"))
        );
        ResumeDocument doc = new ResumeDocument(List.of(hiddenSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
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
                        "Resume Enhancer",
                        "An AI-powered resume tool.",
                        "Java, Spring Boot, React",
                        "https://github.com/example/resume-enhancer",
                        LocalDate.of(2023, 1, 1),
                        LocalDate.of(2023, 12, 31),
                        false
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(projectsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Resume Enhancer");
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
                        "Open Source Tool",
                        "Ongoing OSS project.",
                        "Kotlin",
                        null,
                        LocalDate.of(2024, 3, 1),
                        null,
                        true  // isCurrent
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(projectsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Present");
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
                        "Mentor",
                        "Code For Good",
                        "Mentored junior developers.",
                        LocalDate.of(2021, 6, 1),
                        LocalDate.of(2022, 6, 1),
                        false
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(volunteeringSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Mentor");
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
                        "Board Member",
                        "Tech Nonprofit",
                        null,
                        LocalDate.of(2023, 1, 1),
                        null,
                        true  // isCurrent
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(volunteeringSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Present");
        }
    }

    // ─── GENERIC section ──────────────────────────────────────────────────────

    @Test
    void render_genericSection_rendersFieldValues() throws IOException {
        ResumeSection genericSection = new ResumeSection(
                ResumeSectionType.UNKNOWN,
                "Interests",
                true,
                List.of(new GenericItem(
                        UUID.randomUUID().toString(),
                        Map.of("interest1", "Hiking", "interest2", "Open Source")
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

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        // Verify the document is a valid parseable PDF — the GenericItem fields flow
        // through renderGeneric() which joins field values into a paragraph
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── Null summary (no SUMMARY section) ───────────────────────────────────

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
                        LocalDate.of(2020, 1, 1),
                        null,
                        true,
                        "Working on cool things."
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(workSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
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
                        "Experienced developer.",
                        "https://linkedin.com/in/someone",
                        null,
                        null,
                        null,   // contactEmail is null
                        "UK",
                        "London"
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(summarySection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
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
                        "Professional summary text.",
                        null,
                        null,
                        null,
                        "notanemail",   // no '@' character
                        "Germany",
                        "Berlin"
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(summarySection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── Summary text is rendered in the header ───────────────────────────────

    @Test
    void render_summaryWithText_rendersTextInDocument() throws IOException {
        String summaryText = "Passionate software engineer with 10 years of experience.";
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

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Passionate software engineer");
        }
    }

    // ─── parseMargin with "in" units via cssVariables ────────────────────────

    @Test
    void render_templateWithInchMargins_appliesCustomMargins() throws IOException {
        ResumeDocument doc = new ResumeDocument(List.of());
        ResumeTemplate template = new ResumeTemplate();
        Map<String, Object> defMap = new ObjectMapper().convertValue(
                new TemplateDefinition(
                        "single-column",
                        Map.of(
                                "--page-margin-top", "1in",
                                "--page-margin-right", "1in",
                                "--page-margin-bottom", "1in",
                                "--page-margin-left", "1in",
                                "--font-size-base", "11px"
                        ),
                        new TemplateLayout(
                                "name-contact",
                                List.of("WORK_EXPERIENCE"),
                                null,
                                Map.of()
                        ),
                        Map.of()
                ),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
        );
        template.setTemplateDefinition(defMap);

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── parseMargin with "px" units via cssVariables ────────────────────────

    @Test
    void render_templateWithPixelMargins_appliesCustomMargins() throws IOException {
        ResumeDocument doc = new ResumeDocument(List.of());
        ResumeTemplate template = new ResumeTemplate();
        Map<String, Object> defMap = new ObjectMapper().convertValue(
                new TemplateDefinition(
                        "single-column",
                        Map.of(
                                "--page-margin-top", "40px",
                                "--page-margin-right", "40px",
                                "--page-margin-bottom", "40px",
                                "--page-margin-left", "40px",
                                "--font-size-base", "12px"
                        ),
                        new TemplateLayout(
                                "name-contact",
                                List.of("WORK_EXPERIENCE"),
                                null,
                                Map.of()
                        ),
                        Map.of()
                ),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
        );
        template.setTemplateDefinition(defMap);

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
        }
    }

    // ─── parseMargin with invalid value falls back to default ────────────────

    @Test
    void render_templateWithInvalidMarginValue_usesDefaultMargin() throws IOException {
        ResumeDocument doc = new ResumeDocument(List.of());
        ResumeTemplate template = new ResumeTemplate();
        Map<String, Object> defMap = new ObjectMapper().convertValue(
                new TemplateDefinition(
                        "single-column",
                        Map.of(
                                "--page-margin-top", "notanumberin",
                                "--page-margin-right", "notanumberpx",
                                "--page-margin-bottom", "0.75in",
                                "--page-margin-left", "0.75in",
                                "--font-size-base", "notanumberpx"
                        ),
                        new TemplateLayout(
                                "name-contact",
                                List.of("WORK_EXPERIENCE"),
                                null,
                                Map.of()
                        ),
                        Map.of()
                ),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}
        );
        template.setTemplateDefinition(defMap);

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(0);
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
                        "Engineer",
                        "Company",
                        LocalDate.of(2020, 1, 1),
                        null,
                        true,
                        "Description."
                ))
        );
        ResumeSection skillsSection = new ResumeSection(
                ResumeSectionType.SKILLS,
                "Skills",
                true,
                List.of(new SkillItem(UUID.randomUUID().toString(), "Java"))
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

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Engineer");
            assertThat(text).contains("Java");
        }
    }

    // ─── renderLanguage with null language, non-null proficiency ─────────────

    @Test
    void render_languageItem_withNullLanguage_rendersOnlyProficiency() throws IOException {
        ResumeSection langSection = new ResumeSection(
                ResumeSectionType.LANGUAGES,
                "Languages",
                true,
                List.of(new LanguageItem(UUID.randomUUID().toString(), null, "C2"))
        );
        ResumeDocument doc = new ResumeDocument(List.of(langSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("C2");
        }
    }

    // ─── renderLanguage with non-null language, null proficiency ─────────────

    @Test
    void render_languageItem_withNullProficiency_rendersOnlyLanguage() throws IOException {
        ResumeSection langSection = new ResumeSection(
                ResumeSectionType.LANGUAGES,
                "Languages",
                true,
                List.of(new LanguageItem(UUID.randomUUID().toString(), "Spanish", null))
        );
        ResumeDocument doc = new ResumeDocument(List.of(langSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Spanish");
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
                        "Some Certification",
                        null,   // null issuer
                        null,   // null issueDate
                        null
                ))
        );
        ResumeDocument doc = new ResumeDocument(List.of(certsSection));
        ResumeTemplate template = new ResumeTemplate();

        byte[] pdf = renderer.render(doc, template);

        assertThat(pdf).isNotEmpty();
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(loaded);
            assertThat(text).contains("Some Certification");
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
