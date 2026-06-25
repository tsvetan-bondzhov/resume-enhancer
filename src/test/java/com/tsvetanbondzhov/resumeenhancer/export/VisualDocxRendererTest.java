package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.export.renderers.VisualDocxRenderer;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.FullNameItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
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
 * Unit tests for {@link VisualDocxRenderer}.
 * <p>
 * No Spring context — pure Mockito-based unit test. Uses Apache POI's
 * {@link XWPFDocument} to validate styling (colors, fonts), the real candidate
 * name, and the table-based two-column / modern-accent layouts.
 */
@ExtendWith(MockitoExtension.class)
class VisualDocxRendererTest {

    private VisualDocxRenderer renderer;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        renderer = new VisualDocxRenderer(new TemplateDefinitionService(objectMapper));
    }

    private ResumeTemplate templateFor(TemplateDefinition def) {
        ResumeTemplate template = new ResumeTemplate();
        Map<String, Object> defMap = objectMapper.convertValue(
                def, new TypeReference<Map<String, Object>>() {});
        // Mirror the DB JSONB shape: derived boolean getters (isTwoColumn/isModernAccent)
        // are not persisted, so drop them before round-tripping back through resolve().
        defMap.remove("twoColumn");
        defMap.remove("modernAccent");
        template.setTemplateDefinition(defMap);
        return template;
    }

    private ResumeSection fullNameSection(String first, String last) {
        return new ResumeSection(
                ResumeSectionType.FULL_NAME, "Name", true,
                List.of(new FullNameItem(UUID.randomUUID().toString(), first, last)));
    }

    private ResumeSection summarySection(String email) {
        return new ResumeSection(
                ResumeSectionType.SUMMARY, "Summary", true,
                List.of(new SummaryItem(UUID.randomUUID().toString(),
                        "A summary.", null, null, null, email, "USA", "NYC")));
    }

    private ResumeSection workSection() {
        return new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE, "Experience", true,
                List.of(new WorkExperienceItem(UUID.randomUUID().toString(),
                        "Engineer", "Acme", LocalDate.of(2020, 1, 1), null, true, "Did work.")));
    }

    private ResumeSection skillsSection() {
        return new ResumeSection(
                ResumeSectionType.SKILLS, "Skills", true,
                List.of(new SkillItem(UUID.randomUUID().toString(), "Python")));
    }

    // ─── Real name (not email-derived) ───────────────────────────────────────

    @Test
    void render_usesRealFullName_notEmailDerivedName() throws IOException {
        ResumeDocument doc = new ResumeDocument(List.of(
                fullNameSection("Jane", "Doe"),
                summarySection("john.smith@example.com")));
        ResumeTemplate template = new ResumeTemplate();

        byte[] docx = renderer.render(doc, template);

        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            boolean hasRealName = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("Jane Doe"));
            boolean hasEmailDerivedName = parsed.getParagraphs().stream()
                    .anyMatch(p -> p.getText().contains("john smith"));
            assertThat(hasRealName).as("real name should be rendered").isTrue();
            assertThat(hasEmailDerivedName).as("email-derived name must NOT be used").isFalse();
        }
    }

    // ─── Heading color + font ────────────────────────────────────────────────

    @Test
    void render_sectionHeading_carriesTemplateColorAndFont() throws IOException {
        TemplateDefinition def = new TemplateDefinition(
                "single-column",
                Map.of("--primary-color", "#FF0000",
                        "--text-color", "#222222",
                        "--font-family-sans", "Georgia, serif",
                        "--font-size-base", "16px"),
                new TemplateLayout("name-contact", List.of("WORK_EXPERIENCE"), null, Map.of()),
                Map.of());
        ResumeDocument doc = new ResumeDocument(List.of(workSection()));

        byte[] docx = renderer.render(doc, templateFor(def));

        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFRun headingRun = parsed.getParagraphs().stream()
                    .flatMap(p -> p.getRuns().stream())
                    .filter(r -> r.getText(0) != null && "EXPERIENCE".equals(r.getText(0)))
                    .findFirst()
                    .orElseThrow();
            assertThat(headingRun.getColor()).isEqualTo("FF0000");
            assertThat(headingRun.getFontFamily()).isEqualTo("Georgia");
            // body 16px * 0.75 = 12pt; heading adds +3 → 15pt
            assertThat(headingRun.getFontSizeAsDouble()).isEqualTo(15.0);
        }
    }

    // ─── Two-column layout produces a 2-column table ─────────────────────────

    @Test
    void render_twoColumnTemplate_producesTwoColumnTable() throws IOException {
        TemplateDefinition def = new TemplateDefinition(
                "two-column",
                Map.of("--font-size-base", "11px"),
                new TemplateLayout("name-contact", null,
                        new TemplateColumns(List.of("WORK_EXPERIENCE"), List.of("SKILLS")),
                        Map.of()),
                Map.of());
        ResumeDocument doc = new ResumeDocument(List.of(workSection(), skillsSection()));

        byte[] docx = renderer.render(doc, templateFor(def));

        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            List<XWPFTable> tables = parsed.getTables();
            assertThat(tables).isNotEmpty();
            XWPFTable table = tables.get(tables.size() - 1);
            assertThat(table.getRow(0).getTableCells()).hasSize(2);
            String leftText = table.getRow(0).getCell(0).getText();
            String rightText = table.getRow(0).getCell(1).getText();
            assertThat(leftText).contains("Engineer");
            assertThat(rightText).contains("Python");
        }
    }

    // ─── modern-accent layout produces a shaded accent table ─────────────────

    @Test
    void render_modernAccentTemplate_producesShadedAccentTable() throws IOException {
        TemplateDefinition def = new TemplateDefinition(
                "modern-accent",
                Map.of("--accent-color", "#3B82F6",
                        "--font-size-base", "11px"),
                new TemplateLayout("name-contact", List.of("WORK_EXPERIENCE"), null, Map.of()),
                Map.of());
        ResumeDocument doc = new ResumeDocument(List.of(
                fullNameSection("Jane", "Doe"), workSection()));

        byte[] docx = renderer.render(doc, templateFor(def));

        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            List<XWPFTable> tables = parsed.getTables();
            assertThat(tables).as("accent band table should exist").isNotEmpty();
            String accentColor = tables.get(0).getRow(0).getCell(0).getColor();
            assertThat(accentColor).isEqualTo("3B82F6");
        }
    }

    // ─── Name run carries heading color ──────────────────────────────────────

    @Test
    void render_nameRun_carriesHeadingColor() throws IOException {
        TemplateDefinition def = new TemplateDefinition(
                "single-column",
                Map.of("--primary-color", "#0A0B0C", "--font-size-base", "11px"),
                new TemplateLayout("name-contact", List.of(), null, Map.of()),
                Map.of());
        ResumeDocument doc = new ResumeDocument(List.of(fullNameSection("Jane", "Doe")));

        byte[] docx = renderer.render(doc, templateFor(def));

        try (XWPFDocument parsed = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFParagraph namePara = parsed.getParagraphs().stream()
                    .filter(p -> p.getText().contains("Jane Doe"))
                    .findFirst().orElseThrow();
            assertThat(namePara.getRuns().get(0).getColor()).isEqualTo("0A0B0C");
        }
    }
}
