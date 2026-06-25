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
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Visually-faithful DOCX renderer using Apache POI.
 * <p>
 * Unlike {@link DocxRenderer} (which produces ATS-flat output), this renderer
 * mirrors the web preview's styling: it reads the {@link TemplateDefinition}'s
 * CSS variables to apply font family, font size and colours, draws underline
 * rules beneath section headings, and reproduces {@code two-column} and
 * {@code modern-accent} layouts with POI tables.
 * <p>
 * Per-item text is built with the shared {@link DocxItemFormatter} so the
 * displayed strings stay in lockstep with {@link DocxRenderer}.
 * <p>
 * This class is a stateless {@code @Component} (singleton). All per-render state
 * lives in a local {@link Style} record passed through the render methods.
 */
@Component("docx-visual")
public class VisualDocxRenderer implements DocumentRenderer {

    private static final String SEPARATOR_PIPE = "  |  ";
    private static final String WHITE = "FFFFFF";

    private final TemplateDefinitionService templateDefinitionService;

    public VisualDocxRenderer(TemplateDefinitionService templateDefinitionService) {
        this.templateDefinitionService = templateDefinitionService;
    }

    /**
     * Resolved visual styling derived from the template's CSS variables.
     */
    private record Style(String fontFamily, int bodyFontSize, int nameFontSize,
                         int headingFontSize, String headingColor, String textColor,
                         String accentColor) {}

    @Override
    public byte[] render(ResumeDocument doc, ResumeTemplate template) {
        TemplateDefinition templateDef = templateDefinitionService.resolve(template);
        Style style = resolveStyle(templateDef);
        List<ResumeSection> sections = doc.sections() != null ? doc.sections() : List.of();

        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            // modern-accent: top accent band shaded with --accent-color
            if (templateDef.isModernAccent()) {
                renderAccentBand(document, style);
            }

            // Header (name + contact + summary) — stays outside the columns
            renderHeader(document, sections, style);

            if (templateDef.isTwoColumn() && templateDef.layout() != null
                    && templateDef.layout().columns() != null) {
                renderTwoColumn(document, sections, templateDef, style);
            } else {
                renderLinear(document, sections, templateDef, style);
            }

            document.write(baos);
            return baos.toByteArray();

        } catch (IOException e) {
            throw new VisualDocxRenderException("Visual DOCX rendering failed", e);
        }
    }

    // ─── Layout strategies ────────────────────────────────────────────────────

    private void renderLinear(XWPFDocument document, List<ResumeSection> sections,
                              TemplateDefinition templateDef, Style style) {
        List<ResumeSection> orderedSections = RendererUtils.orderSections(sections, templateDef);
        List<ResumeSection> toRender = orderedSections.isEmpty() ? sections : orderedSections;
        for (ResumeSection section : toRender) {
            if (isHeaderOrHidden(section)) continue;
            renderSection(document::createParagraph, section, style);
        }
    }

    private void renderTwoColumn(XWPFDocument document, List<ResumeSection> sections,
                                 TemplateDefinition templateDef, Style style) {
        List<String> left = templateDef.layout().columns().left() != null
                ? templateDef.layout().columns().left() : List.of();
        List<String> right = templateDef.layout().columns().right() != null
                ? templateDef.layout().columns().right() : List.of();

        XWPFTable table = document.createTable(1, 2);
        removeTableBorders(table);
        XWPFTableRow row = table.getRow(0);
        XWPFTableCell leftCell = row.getCell(0);
        XWPFTableCell rightCell = row.getCell(1);

        renderColumnCell(leftCell, sections, left, style);
        renderColumnCell(rightCell, sections, right, style);
    }

    private void renderColumnCell(XWPFTableCell cell, List<ResumeSection> sections,
                                  List<String> sectionTypeNames, Style style) {
        // POI seeds a new cell with one empty paragraph — reuse it for the first
        // paragraph, then create fresh ones.
        boolean[] firstParagraph = {true};
        ParagraphFactory factory = () -> {
            if (firstParagraph[0] && !cell.getParagraphs().isEmpty()) {
                firstParagraph[0] = false;
                return cell.getParagraphs().get(0);
            }
            return cell.addParagraph();
        };
        for (String typeName : sectionTypeNames) {
            sections.stream()
                    .filter(s -> s.sectionType() != null
                            && typeName.equals(s.sectionType().name()))
                    .filter(s -> !isHeaderOrHidden(s))
                    .findFirst()
                    .ifPresent(section -> renderSection(factory, section, style));
        }
    }

    private boolean isHeaderOrHidden(ResumeSection section) {
        if (!section.visible() || section.sectionType() == null) return true;
        String name = section.sectionType().name();
        return "SUMMARY".equals(name) || "FULL_NAME".equals(name);
    }

    // ─── Header ───────────────────────────────────────────────────────────────

    private void renderHeader(XWPFDocument document, List<ResumeSection> sections, Style style) {
        // Real candidate name from the FULL_NAME section, not derived from email.
        String name = findFullName(sections);
        SummaryItem summary = RendererUtils.findSummaryItem(sections);

        if (name != null && !name.isBlank()) {
            XWPFParagraph namePara = document.createParagraph();
            XWPFRun nameRun = namePara.createRun();
            applyFont(nameRun, style);
            nameRun.setText(name);
            nameRun.setBold(true);
            nameRun.setColor(style.headingColor());
            nameRun.setFontSize(style.nameFontSize());
        }

        if (summary == null) return;

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

        if (summary.text() != null && !summary.text().isBlank()) {
            XWPFParagraph summaryPara = document.createParagraph();
            XWPFRun summaryRun = summaryPara.createRun();
            applyFont(summaryRun, style);
            summaryRun.setText(summary.text());
            summaryRun.setItalic(true);
            summaryRun.setColor(style.textColor());
        }
    }

    private String findFullName(List<ResumeSection> sections) {
        for (ResumeSection section : sections) {
            if (section.sectionType() == null
                    || !"FULL_NAME".equals(section.sectionType().name())
                    || section.items() == null) continue;
            for (ResumeItem item : section.items()) {
                if (item instanceof FullNameItem fn) {
                    String full = DocxItemFormatter.fullName(fn);
                    if (!full.isBlank()) return full;
                }
            }
        }
        return null;
    }

    // ─── Section rendering ────────────────────────────────────────────────────

    private void renderSection(ParagraphFactory factory, ResumeSection section, Style style) {
        String title;
        if (section.title() != null) {
            title = section.title();
        } else {
            title = section.sectionType() != null ? section.sectionType().name() : "Section";
        }

        // Heading: bold + colored + uppercase + bottom border rule
        XWPFParagraph heading = factory.create();
        heading.setBorderBottom(Borders.SINGLE);
        XWPFRun headingRun = heading.createRun();
        applyFont(headingRun, style);
        headingRun.setText(title.toUpperCase());
        headingRun.setBold(true);
        headingRun.setColor(style.headingColor());
        headingRun.setFontSize(style.headingFontSize());

        List<ResumeItem> items = section.items() != null ? section.items() : List.of();

        if (section.sectionType() != null && "SKILLS".equals(section.sectionType().name())) {
            String skills = DocxItemFormatter.skillsJoin(items);
            if (!skills.isBlank()) bodyParagraph(factory, skills, style);
            return;
        }

        for (ResumeItem item : items) {
            renderItem(factory, item, style);
        }
    }

    private void renderItem(ParagraphFactory factory, ResumeItem item, Style style) {
        switch (item) {
            case WorkExperienceItem w -> renderWorkExperience(factory, w, style);
            case EducationItem e -> renderEducation(factory, e, style);
            case CertificationItem c -> renderCertification(factory, c, style);
            case LanguageItem l -> renderLanguage(factory, l, style);
            case ProjectItem p -> renderProject(factory, p, style);
            case VolunteeringItem v -> renderVolunteering(factory, v, style);
            case SummaryItem ignored -> { /* rendered in header */ }
            case FullNameItem ignored -> { /* rendered in header */ }
            case SkillItem ignored -> { /* handled in skills join */ }
            case GenericItem g -> renderGeneric(factory, g, style);
        }
    }

    private void renderWorkExperience(ParagraphFactory factory, WorkExperienceItem w, Style style) {
        String titleLine = DocxItemFormatter.workTitleLine(w);
        if (!titleLine.isBlank()) boldParagraph(factory, titleLine, style);
        String dateRange = RendererUtils.formatDateRange(w.startDate(), w.endDate(), w.isCurrent());
        if (!dateRange.isBlank()) bodyParagraph(factory, dateRange, style);
        if (w.description() != null && !w.description().isBlank()) {
            bodyParagraph(factory, w.description(), style);
        }
    }

    private void renderEducation(ParagraphFactory factory, EducationItem e, Style style) {
        String line = DocxItemFormatter.educationLine(e);
        if (!line.isBlank()) boldParagraph(factory, line, style);
        String dateRange = RendererUtils.formatDateRange(e.startDate(), e.endDate(), false);
        if (!dateRange.isBlank()) bodyParagraph(factory, dateRange, style);
    }

    private void renderCertification(ParagraphFactory factory, CertificationItem c, Style style) {
        String line = DocxItemFormatter.certificationLine(c);
        if (!line.isBlank()) bodyParagraph(factory, line, style);
    }

    private void renderLanguage(ParagraphFactory factory, LanguageItem l, Style style) {
        String line = DocxItemFormatter.languageLine(l);
        if (!line.isBlank()) bodyParagraph(factory, line, style);
    }

    private void renderProject(ParagraphFactory factory, ProjectItem p, Style style) {
        if (p.name() != null && !p.name().isBlank()) boldParagraph(factory, p.name(), style);
        String technologies = DocxItemFormatter.projectTechnologies(p);
        if (!technologies.isBlank()) bodyParagraph(factory, technologies, style);
        String dateRange = RendererUtils.formatDateRange(p.startDate(), p.endDate(), p.isCurrent());
        if (!dateRange.isBlank()) bodyParagraph(factory, dateRange, style);
        if (p.description() != null && !p.description().isBlank()) {
            bodyParagraph(factory, p.description(), style);
        }
    }

    private void renderVolunteering(ParagraphFactory factory, VolunteeringItem v, Style style) {
        String titleLine = DocxItemFormatter.volunteeringTitleLine(v);
        if (!titleLine.isBlank()) boldParagraph(factory, titleLine, style);
        String dateRange = RendererUtils.formatDateRange(v.startDate(), v.endDate(), v.isCurrent());
        String descLine = DocxItemFormatter.volunteeringDescriptionLine(v, dateRange);
        if (!descLine.isBlank()) bodyParagraph(factory, descLine, style);
    }

    private void renderGeneric(ParagraphFactory factory, GenericItem g, Style style) {
        if (g.fields() == null || g.fields().isEmpty()) return;
        g.fields().forEach((key, value) -> {
            if (value != null && !value.isBlank()) {
                bodyParagraph(factory, key + ": " + value, style);
            }
        });
    }

    // ─── Run / paragraph helpers ──────────────────────────────────────────────

    private void bodyParagraph(ParagraphFactory factory, String text, Style style) {
        XWPFRun run = factory.create().createRun();
        applyFont(run, style);
        run.setText(text);
        run.setColor(style.textColor());
    }

    private void boldParagraph(ParagraphFactory factory, String text, Style style) {
        XWPFRun run = factory.create().createRun();
        applyFont(run, style);
        run.setText(text);
        run.setBold(true);
        run.setColor(style.textColor());
    }

    private void applyFont(XWPFRun run, Style style) {
        run.setFontFamily(style.fontFamily());
        run.setFontSize(style.bodyFontSize());
    }

    // ─── modern-accent band ───────────────────────────────────────────────────

    private void renderAccentBand(XWPFDocument document, Style style) {
        XWPFTable table = document.createTable(1, 1);
        removeTableBorders(table);
        XWPFTableCell cell = table.getRow(0).getCell(0);
        cell.setColor(style.accentColor());
        // Keep the (mandatory) seeded paragraph empty — the band is purely visual.
    }

    // ─── Table helpers ────────────────────────────────────────────────────────

    private void removeTableBorders(XWPFTable table) {
        table.setInsideHBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, WHITE);
        table.setInsideVBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, WHITE);
        table.setTopBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, WHITE);
        table.setBottomBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, WHITE);
        table.setLeftBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, WHITE);
        table.setRightBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, WHITE);
    }

    // ─── Style resolution ─────────────────────────────────────────────────────

    private Style resolveStyle(TemplateDefinition templateDef) {
        Map<String, Object> css = RendererUtils.cssVariables(templateDef);

        String fontFamily = RendererUtils.parseFontFamily(css.get("--font-family-sans"));
        int bodyFontSize = RendererUtils.parseFontSizePt(css.get("--font-size-base"));
        int headingFontSize = bodyFontSize + 3;
        int nameFontSize = bodyFontSize + 8;

        String headingColor = RendererUtils.parseColor(css.get("--primary-color"),
                RendererUtils.parseColor(css.get("--accent-color"), RendererUtils.DEFAULT_PRIMARY));
        String textColor = RendererUtils.parseColor(css.get("--text-color"), RendererUtils.DEFAULT_TEXT);
        String accentColor = RendererUtils.parseColor(css.get("--accent-color"), RendererUtils.DEFAULT_ACCENT);

        return new Style(fontFamily, bodyFontSize, nameFontSize, headingFontSize,
                headingColor, textColor, accentColor);
    }

    // ─── Function + exception types ───────────────────────────────────────────

    /**
     * Supplies fresh paragraphs into the current render target (the document body
     * or a table cell), abstracting away where sections are laid out.
     */
    @FunctionalInterface
    private interface ParagraphFactory {
        XWPFParagraph create();
    }

    static class VisualDocxRenderException extends RuntimeException {
        VisualDocxRenderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
