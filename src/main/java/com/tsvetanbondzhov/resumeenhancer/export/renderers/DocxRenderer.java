package com.tsvetanbondzhov.resumeenhancer.export.renderers;

import com.tsvetanbondzhov.resumeenhancer.export.DocumentRenderer;
import com.tsvetanbondzhov.resumeenhancer.export.TemplateDefinition;
import com.tsvetanbondzhov.resumeenhancer.export.TemplateDefinitionService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.FullNameItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.apache.poi.xwpf.usermodel.Borders;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * ATS-compatible DOCX renderer using Apache POI.
 * <p>
 * Renders a {@link ResumeDocument} to a DOCX byte array following the layout
 * defined in a {@link ResumeTemplate}. All output is plain Word text in a single
 * linear column (no images, no layout tables, no skill bars) to ensure ATS
 * compatibility (NFR4, FR37).
 * <p>
 * Typography (font family, sizes), colours and spacing are derived from the
 * template's CSS variables — reusing the shared parsing helpers in
 * {@link RendererUtils} so behaviour stays in lockstep with
 * {@link VisualDocxRenderer}. This keeps the ATS output readable (clear section
 * separation, accent-coloured headings) without introducing non-ATS layout.
 * <p>
 * This class is a stateless {@code @Component} (singleton). All per-render state
 * lives in local variables / a local {@link Style} record inside {@link #render}.
 */
@Component("docx")
public class DocxRenderer implements DocumentRenderer {

    private static final String SEPARATOR_PIPE = "  |  ";

    /** POI spacing units: 1pt = 20 twips. */
    private static final int TWIPS_PER_PT = 20;
    /** Default section spacing (px) when --section-spacing is missing. */
    private static final int DEFAULT_SECTION_SPACING_PT = 12;
    /** Default item spacing (px) when --item-spacing is missing. */
    private static final int DEFAULT_ITEM_SPACING_PT = 8;
    /** Small breathing room after a heading rule. */
    private static final int HEADING_AFTER_PT = 4;

    private final TemplateDefinitionService templateDefinitionService;

    public DocxRenderer(TemplateDefinitionService templateDefinitionService) {
        this.templateDefinitionService = templateDefinitionService;
    }

    /**
     * Resolved typography / spacing styling derived from the template's CSS variables.
     * Spacing fields are in twips (POI spacing unit).
     */
    private record Style(String fontFamily, int bodyFontSize, int nameFontSize,
                         int headingFontSize, String headingColor, String textColor,
                         int sectionSpacingTwips, int itemSpacingTwips) {}

    @Override
    public byte[] render(ResumeDocument doc, ResumeTemplate template) {
        TemplateDefinition templateDef = templateDefinitionService.resolve(template);
        Style style = resolveStyle(templateDef);
        List<ResumeSection> sections = doc.sections() != null ? doc.sections() : List.of();

        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            // Render header block (name + contact line + summary text)
            SummaryItem summaryItem = findSummaryItem(sections);
            renderHeader(document, summaryItem, style);

            // Build ordered section list respecting template sectionOrder (single linear for ATS)
            List<ResumeSection> orderedSections = orderSections(sections, templateDef);

            for (ResumeSection section : orderedSections) {
                // Skip invisible, typeless, or SUMMARY sections (already rendered as header)
                if (!section.visible()
                        || section.sectionType() == null
                        || "SUMMARY".equals(section.sectionType().name())) continue;
                renderSection(document, section, style);
            }

            document.write(baos);
            return baos.toByteArray();

        } catch (IOException e) {
            throw new DocxRenderException("DOCX rendering failed", e);
        }
    }

    // ─── Style resolution ──────────────────────────────────────────────────────

    private Style resolveStyle(TemplateDefinition templateDef) {
        Map<String, Object> css = RendererUtils.cssVariables(templateDef);

        String fontFamily = RendererUtils.parseFontFamily(css.get("--font-family-sans"));
        int bodyFontSize = RendererUtils.parseFontSizePt(css.get("--font-size-base"));
        int headingFontSize = bodyFontSize + 3;
        int nameFontSize = bodyFontSize + 8;

        String headingColor = RendererUtils.parseColor(css.get("--primary-color"),
                RendererUtils.parseColor(css.get("--accent-color"), RendererUtils.DEFAULT_PRIMARY));
        String textColor = RendererUtils.parseColor(css.get("--text-color"), RendererUtils.DEFAULT_TEXT);

        int sectionSpacingTwips = RendererUtils.parsePxToPt(
                css.get("--section-spacing"), DEFAULT_SECTION_SPACING_PT) * TWIPS_PER_PT;
        int itemSpacingTwips = RendererUtils.parsePxToPt(
                css.get("--item-spacing"), DEFAULT_ITEM_SPACING_PT) * TWIPS_PER_PT;

        return new Style(fontFamily, bodyFontSize, nameFontSize, headingFontSize,
                headingColor, textColor, sectionSpacingTwips, itemSpacingTwips);
    }

    // ─── Header ──────────────────────────────────────────────────────────────

    private void renderHeader(XWPFDocument document, SummaryItem summary, Style style) {
        if (summary == null) return;

        // Candidate name — derive from email if available
        String nameDisplay = buildNameDisplay(summary);
        if (nameDisplay != null && !nameDisplay.isBlank()) {
            XWPFParagraph namePara = document.createParagraph();
            XWPFRun nameRun = namePara.createRun();
            applyFont(nameRun, style);
            nameRun.setText(nameDisplay);
            nameRun.setBold(true);
            nameRun.setFontSize(style.nameFontSize());
            nameRun.setColor(style.headingColor());
        }

        // Contact line
        List<String> contacts = new ArrayList<>();
        if (summary.contactEmail() != null) contacts.add(summary.contactEmail());
        if (summary.linkedInUrl() != null) contacts.add(summary.linkedInUrl());
        if (summary.locationCity() != null) contacts.add(summary.locationCity());
        if (summary.locationCountry() != null) contacts.add(summary.locationCountry());
        if (!contacts.isEmpty()) {
            XWPFParagraph contactPara = document.createParagraph();
            XWPFRun contactRun = contactPara.createRun();
            applyFont(contactRun, style);
            contactRun.setText(String.join(SEPARATOR_PIPE, contacts));
            contactRun.setColor(style.textColor());
        }

        // Summary text (italic)
        if (summary.text() != null && !summary.text().isBlank()) {
            XWPFParagraph summaryPara = document.createParagraph();
            summaryPara.setSpacingAfter(style.itemSpacingTwips());
            XWPFRun summaryRun = summaryPara.createRun();
            applyFont(summaryRun, style);
            summaryRun.setText(summary.text());
            summaryRun.setItalic(true);
            summaryRun.setColor(style.textColor());
        }
    }

    private String buildNameDisplay(SummaryItem summary) {
        if (summary.contactEmail() != null && !summary.contactEmail().isBlank()) {
            int atIdx = summary.contactEmail().indexOf('@');
            if (atIdx > 0) {
                return summary.contactEmail().substring(0, atIdx)
                        .replace(".", " ")
                        .replace("_", " ");
            }
        }
        return null;
    }

    // ─── Section rendering ────────────────────────────────────────────────────

    private void renderSection(XWPFDocument document, ResumeSection section, Style style) {
        // Section heading: accent-coloured, larger, separated from preceding content,
        // with a subtle bottom border rule. Single column — no tables.
        String title;
        if (section.title() != null) {
            title = section.title();
        } else {
            title = section.sectionType() != null ? section.sectionType().name() : "Section";
        }
        XWPFParagraph heading = document.createParagraph();
        heading.setStyle("Heading1");
        heading.setBorderBottom(Borders.SINGLE);
        heading.setSpacingBefore(style.sectionSpacingTwips());
        heading.setSpacingAfter(HEADING_AFTER_PT * TWIPS_PER_PT);
        XWPFRun headingRun = heading.createRun();
        applyFont(headingRun, style);
        headingRun.setText(title.toUpperCase());
        headingRun.setBold(true);
        headingRun.setFontSize(style.headingFontSize());
        headingRun.setColor(style.headingColor());

        List<ResumeItem> items = section.items() != null ? section.items() : List.of();

        // Special case: SKILLS — comma-separated in one paragraph (ATS friendly)
        if (section.sectionType() != null && "SKILLS".equals(section.sectionType().name())) {
            renderSkillsSection(document, items, style);
            return;
        }

        for (ResumeItem item : items) {
            renderItem(document, item, style);
        }
    }

    private void renderSkillsSection(XWPFDocument document, List<ResumeItem> items, Style style) {
        String skills = DocxItemFormatter.skillsJoin(items);
        if (!skills.isBlank()) {
            bodyParagraph(document, skills, style, true);
        }
    }

    private void renderItem(XWPFDocument document, ResumeItem item, Style style) {
        switch (item) {
            case WorkExperienceItem w -> renderWorkExperience(document, w, style);
            case EducationItem e -> renderEducation(document, e, style);
            case CertificationItem c -> renderCertification(document, c, style);
            case LanguageItem l -> renderLanguage(document, l, style);
            case ProjectItem p -> renderProject(document, p, style);
            case VolunteeringItem v -> renderVolunteering(document, v, style);
            case SummaryItem ignored -> { /* already rendered as header */ }
            case FullNameItem n -> renderFullName(document, n, style);
            case SkillItem ignored -> { /* handled in renderSkillsSection */ }
            case GenericItem g -> renderGeneric(document, g, style);
        }
    }

    private void renderFullName(XWPFDocument document, FullNameItem n, Style style) {
        String fullName = DocxItemFormatter.fullName(n);
        if (!fullName.isBlank()) {
            XWPFParagraph para = document.createParagraph();
            XWPFRun run = para.createRun();
            applyFont(run, style);
            run.setText(fullName);
            run.setBold(true);
            run.setFontSize(style.nameFontSize());
            run.setColor(style.headingColor());
        }
    }

    private void renderWorkExperience(XWPFDocument document, WorkExperienceItem w, Style style) {
        String titleLine = DocxItemFormatter.workTitleLine(w);
        if (!titleLine.isBlank()) {
            boldParagraph(document, titleLine, style, false);
        }
        String dateRange = formatDateRange(w.startDate(), w.endDate(), w.isCurrent());
        if (!dateRange.isBlank()) {
            bodyParagraph(document, dateRange, style, false);
        }
        if (w.description() != null && !w.description().isBlank()) {
            bodyParagraph(document, w.description(), style, true);
        }
    }

    private void renderEducation(XWPFDocument document, EducationItem e, Style style) {
        String line = DocxItemFormatter.educationLine(e);
        if (!line.isBlank()) {
            boldParagraph(document, line, style, false);
        }
        String dateRange = formatDateRange(e.startDate(), e.endDate(), false);
        if (!dateRange.isBlank()) {
            bodyParagraph(document, dateRange, style, true);
        }
    }

    private void renderCertification(XWPFDocument document, CertificationItem c, Style style) {
        String line = DocxItemFormatter.certificationLine(c);
        if (!line.isBlank()) {
            bodyParagraph(document, line, style, true);
        }
    }

    private void renderLanguage(XWPFDocument document, LanguageItem l, Style style) {
        String line = DocxItemFormatter.languageLine(l);
        if (!line.isBlank()) {
            bodyParagraph(document, line, style, true);
        }
    }

    private void renderProject(XWPFDocument document, ProjectItem p, Style style) {
        if (p.name() != null) {
            boldParagraph(document, p.name(), style, false);
        }
        String technologies = DocxItemFormatter.projectTechnologies(p);
        if (!technologies.isBlank()) {
            bodyParagraph(document, technologies, style, false);
        }
        String dateRange = formatDateRange(p.startDate(), p.endDate(), p.isCurrent());
        if (!dateRange.isBlank()) {
            bodyParagraph(document, dateRange, style, false);
        }
        if (p.description() != null && !p.description().isBlank()) {
            bodyParagraph(document, p.description(), style, true);
        }
    }

    private void renderVolunteering(XWPFDocument document, VolunteeringItem v, Style style) {
        String titleLine = DocxItemFormatter.volunteeringTitleLine(v);
        if (!titleLine.isBlank()) {
            boldParagraph(document, titleLine, style, false);
        }
        String dateRange = formatDateRange(v.startDate(), v.endDate(), v.isCurrent());
        String descLine = DocxItemFormatter.volunteeringDescriptionLine(v, dateRange);
        if (!descLine.isBlank()) {
            bodyParagraph(document, descLine, style, true);
        }
    }

    private void renderGeneric(XWPFDocument document, GenericItem g, Style style) {
        if (g.fields() != null && !g.fields().isEmpty()) {
            g.fields().forEach((key, value) -> {
                if (value != null && !value.isBlank()) {
                    bodyParagraph(document, key + ": " + value, style, true);
                }
            });
        }
    }

    // ─── Run / paragraph helpers ──────────────────────────────────────────────

    /**
     * Body paragraph. {@code endOfItem} adds item-spacing after the paragraph so
     * consecutive entries aren't cramped.
     */
    private void bodyParagraph(XWPFDocument document, String text, Style style, boolean endOfItem) {
        XWPFParagraph para = document.createParagraph();
        if (endOfItem) para.setSpacingAfter(style.itemSpacingTwips());
        XWPFRun run = para.createRun();
        applyFont(run, style);
        run.setText(text);
        run.setColor(style.textColor());
    }

    private void boldParagraph(XWPFDocument document, String text, Style style, boolean endOfItem) {
        XWPFParagraph para = document.createParagraph();
        if (endOfItem) para.setSpacingAfter(style.itemSpacingTwips());
        XWPFRun run = para.createRun();
        applyFont(run, style);
        run.setText(text);
        run.setBold(true);
        run.setColor(style.textColor());
    }

    private void applyFont(XWPFRun run, Style style) {
        run.setFontFamily(style.fontFamily());
        run.setFontSize(style.bodyFontSize());
    }

    // ─── Section ordering ─────────────────────────────────────────────────────

    /**
     * Orders sections for single-column ATS output. For two-column templates, left
     * columns are rendered first, then right columns (both in a single linear flow).
     * Uses {@code layout.sectionOrder()} directly — never {@code resolvedSectionOrder()}
     * which throws on two-column layouts.
     */
    private List<ResumeSection> orderSections(List<ResumeSection> sections,
                                               TemplateDefinition templateDef) {
        return RendererUtils.orderSections(sections, templateDef);
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    private SummaryItem findSummaryItem(List<ResumeSection> sections) {
        return RendererUtils.findSummaryItem(sections);
    }

    private String formatDateRange(LocalDate start, LocalDate end, boolean isCurrent) {
        return RendererUtils.formatDateRange(start, end, isCurrent);
    }

    // ─── Internal exception ───────────────────────────────────────────────────

    static class DocxRenderException extends RuntimeException {
        DocxRenderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
