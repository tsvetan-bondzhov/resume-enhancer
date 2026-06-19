package com.tsvetanbondzhov.resumeenhancer.export.renderers;

import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.properties.TextAlignment;
import com.tsvetanbondzhov.resumeenhancer.export.DocumentRenderer;
import com.tsvetanbondzhov.resumeenhancer.export.TemplateDefinition;
import com.tsvetanbondzhov.resumeenhancer.export.TemplateDefinitionService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
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
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * ATS-compatible single-column PDF renderer using iText 8.
 * <p>
 * Renders a {@link ResumeDocument} to a PDF byte array following the layout and
 * typography defined in a {@link ResumeTemplate}. All output is plain text (no
 * images, no decorative graphics, no skill bars) to ensure ATS compatibility
 * (NFR4, FR37).
 * <p>
 * Even if the selected template specifies a two-column layout, this renderer
 * always produces a single-column PDF because multi-column PDFs break ATS parsing.
 * The two-column presentation is a frontend CSS concern only.
 * <p>
 * This class is a stateless {@code @Component} (singleton). All per-render state
 * lives in local variables inside {@link #render}.
 */
@Component
@Qualifier("pdf")
public class PdfRenderer implements DocumentRenderer {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM yyyy");
    private static final float PT_PER_IN = 72f;
    private static final float PT_PER_PX = 0.75f;
    private static final float DEFAULT_MARGIN_PT = 54f; // 0.75 in
    private static final float BASE_FONT_SIZE_PT = 8.25f; // 11px * 0.75
    private static final float HEADING_FONT_SIZE_PT = BASE_FONT_SIZE_PT + 3f;
    private static final float NAME_FONT_SIZE_PT = BASE_FONT_SIZE_PT + 8f;

    private final TemplateDefinitionService templateDefinitionService;

    public PdfRenderer(TemplateDefinitionService templateDefinitionService) {
        this.templateDefinitionService = templateDefinitionService;
    }

    @Override
    public byte[] render(ResumeDocument doc, ResumeTemplate template) {
        TemplateDefinition templateDef = templateDefinitionService.resolve(template);
        Map<String, Object> cssVars = templateDef.cssVariables() != null
                ? templateDef.cssVariables()
                : Map.of();

        float marginTop = parseMargin(cssVars.get("--page-margin-top"));
        float marginRight = parseMargin(cssVars.get("--page-margin-right"));
        float marginBottom = parseMargin(cssVars.get("--page-margin-bottom"));
        float marginLeft = parseMargin(cssVars.get("--page-margin-left"));
        float baseFontSize = parseFontSize(cssVars.get("--font-size-base"));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // F3: wrap iText resources in try-with-resources so PdfWriter/PdfDocument are
        // always closed even when an exception occurs mid-render.
        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdfDoc = new PdfDocument(writer);
             Document document = new Document(pdfDoc, PageSize.A4)) {

            document.setMargins(marginTop, marginRight, marginBottom, marginLeft);

            PdfFont regularFont = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont boldFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont italicFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_OBLIQUE);

            List<ResumeSection> sections = doc.sections() != null ? doc.sections() : List.of();

            // Render summary header first (candidate name + contact)
            SummaryItem summaryItem = findSummaryItem(sections);
            renderHeader(document, summaryItem, boldFont, regularFont, baseFontSize);

            // Build ordered section list — respect template sectionOrder, single-column for ATS
            List<ResumeSection> orderedSections = orderSections(sections, templateDef);

            for (ResumeSection section : orderedSections) {
                if (!section.visible()) continue;
                // Skip SUMMARY — already rendered as header
                if (section.sectionType() != null &&
                        "SUMMARY".equals(section.sectionType().name())) continue;
                renderSection(document, section, boldFont, regularFont, italicFont, baseFontSize);
            }
        } catch (IOException e) {
            // F4: accurate message — covers font creation and any I/O during PDF generation.
            throw new PdfRenderException("PDF rendering failed", e);
        }

        return baos.toByteArray();
    }

    // ─── Header ──────────────────────────────────────────────────────────────

    private void renderHeader(Document document, SummaryItem summary,
                              PdfFont boldFont, PdfFont regularFont, float baseFontSize) throws IOException {
        if (summary != null) {
            // Candidate name placeholder — use email domain or "Resume" if no name available
            String nameDisplay = buildNameDisplay(summary);
            if (nameDisplay != null && !nameDisplay.isBlank()) {
                Paragraph name = new Paragraph(nameDisplay)
                        .setFont(boldFont)
                        .setFontSize(NAME_FONT_SIZE_PT)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMarginBottom(4f);
                document.add(name);
            }

            // Contact line
            List<String> contacts = new ArrayList<>();
            if (summary.contactEmail() != null) contacts.add(summary.contactEmail());
            if (summary.linkedInUrl() != null) contacts.add(summary.linkedInUrl());
            if (summary.locationCity() != null) contacts.add(summary.locationCity());
            if (summary.locationCountry() != null) contacts.add(summary.locationCountry());
            if (!contacts.isEmpty()) {
                Paragraph contact = new Paragraph(String.join("  |  ", contacts))
                        .setFont(regularFont)
                        .setFontSize(baseFontSize - 1f)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMarginBottom(6f);
                document.add(contact);
            }

            // Summary text
            if (summary.text() != null && !summary.text().isBlank()) {
                Paragraph summaryText = new Paragraph(summary.text())
                        .setFont(regularFont)
                        .setFontSize(baseFontSize)
                        .setItalic()
                        .setMarginBottom(8f);
                document.add(summaryText);
            }
        }
    }

    private String buildNameDisplay(SummaryItem summary) {
        // Use email as name hint (before @) if no better field available
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

    private void renderSection(Document document, ResumeSection section,
                               PdfFont boldFont, PdfFont regularFont, PdfFont italicFont,
                               float baseFontSize) throws IOException {
        // Section heading
        String title = section.title() != null ? section.title()
                : (section.sectionType() != null ? section.sectionType().name() : "Section");
        Paragraph heading = new Paragraph(title.toUpperCase())
                .setFont(boldFont)
                .setFontSize(HEADING_FONT_SIZE_PT)
                .setMarginTop(10f)
                .setMarginBottom(4f);
        document.add(heading);

        // Horizontal rule effect via underline on heading (simple approach)
        Paragraph rule = new Paragraph("─────────────────────────────────────────")
                .setFont(regularFont)
                .setFontSize(6f)
                .setMarginTop(-6f)
                .setMarginBottom(4f);
        document.add(rule);

        // Render items
        List<ResumeItem> items = section.items() != null ? section.items() : List.of();

        // Special case: SKILLS — comma-separated in one paragraph (ATS friendly)
        if (section.sectionType() != null && "SKILLS".equals(section.sectionType().name())) {
            renderSkillsSection(document, items, regularFont, baseFontSize);
            return;
        }

        for (ResumeItem item : items) {
            renderItem(document, item, boldFont, regularFont, italicFont, baseFontSize);
        }
    }

    private void renderSkillsSection(Document document, List<ResumeItem> items,
                                     PdfFont regularFont, float baseFontSize) throws IOException {
        String skills = items.stream()
                .filter(i -> i instanceof SkillItem)
                .map(i -> ((SkillItem) i).name())
                .filter(n -> n != null && !n.isBlank())
                .collect(Collectors.joining(", "));
        if (!skills.isBlank()) {
            document.add(new Paragraph(skills)
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(4f));
        }
    }

    private void renderItem(Document document, ResumeItem item,
                            PdfFont boldFont, PdfFont regularFont, PdfFont italicFont,
                            float baseFontSize) throws IOException {
        switch (item) {
            case WorkExperienceItem w -> renderWorkExperience(document, w, boldFont, regularFont, italicFont, baseFontSize);
            case EducationItem e -> renderEducation(document, e, boldFont, regularFont, italicFont, baseFontSize);
            case CertificationItem c -> renderCertification(document, c, boldFont, regularFont, baseFontSize);
            case LanguageItem l -> renderLanguage(document, l, regularFont, baseFontSize);
            case ProjectItem p -> renderProject(document, p, boldFont, regularFont, italicFont, baseFontSize);
            case VolunteeringItem v -> renderVolunteering(document, v, boldFont, regularFont, italicFont, baseFontSize);
            case SummaryItem ignored -> { /* already rendered as header */ }
            case SkillItem ignored -> { /* handled in renderSkillsSection */ }
            case GenericItem g -> renderGeneric(document, g, regularFont, baseFontSize);
        }
    }

    private void renderWorkExperience(Document document, WorkExperienceItem w,
                                      PdfFont boldFont, PdfFont regularFont, PdfFont italicFont,
                                      float baseFontSize) throws IOException {
        StringBuilder line = new StringBuilder();
        if (w.jobTitle() != null) line.append(w.jobTitle());
        if (w.company() != null) line.append(line.isEmpty() ? "" : "  —  ").append(w.company());
        String dateRange = formatDateRange(w.startDate(), w.endDate(), w.isCurrent());
        // F6: only prepend the separator when line is non-empty to avoid leading "  |  Jan 2020"
        if (!dateRange.isBlank()) line.append(line.isEmpty() ? "" : "  |  ").append(dateRange);

        if (!line.isEmpty()) {
            document.add(new Paragraph(line.toString())
                    .setFont(boldFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(2f));
        }
        if (w.description() != null && !w.description().isBlank()) {
            document.add(new Paragraph(w.description())
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(6f));
        }
    }

    private void renderEducation(Document document, EducationItem e,
                                 PdfFont boldFont, PdfFont regularFont, PdfFont italicFont,
                                 float baseFontSize) throws IOException {
        StringBuilder line = new StringBuilder();
        if (e.institution() != null) line.append(e.institution());
        if (e.degree() != null) line.append(line.isEmpty() ? "" : ", ").append(e.degree());
        if (e.fieldOfStudy() != null) line.append(line.isEmpty() ? "" : ", ").append(e.fieldOfStudy());
        String dateRange = formatDateRange(e.startDate(), e.endDate(), false);
        if (!dateRange.isBlank()) line.append("  |  ").append(dateRange);
        if (!line.isEmpty()) {
            document.add(new Paragraph(line.toString())
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(6f));
        }
    }

    private void renderCertification(Document document, CertificationItem c,
                                     PdfFont boldFont, PdfFont regularFont, float baseFontSize) throws IOException {
        StringBuilder line = new StringBuilder();
        if (c.name() != null) line.append(c.name());
        if (c.issuer() != null) line.append(line.isEmpty() ? "" : " — ").append(c.issuer());
        if (c.issueDate() != null) line.append("  |  ").append(c.issueDate().format(DATE_FMT));
        if (!line.isEmpty()) {
            document.add(new Paragraph(line.toString())
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(4f));
        }
    }

    private void renderLanguage(Document document, LanguageItem l,
                                PdfFont regularFont, float baseFontSize) throws IOException {
        // F7: only prepend separator when the language portion is non-empty to avoid "  —  C2"
        String langPart = l.language() != null ? l.language() : "";
        String profPart = l.proficiency() != null
                ? (langPart.isEmpty() ? l.proficiency() : "  —  " + l.proficiency())
                : "";
        String line = langPart + profPart;
        if (!line.isBlank()) {
            document.add(new Paragraph(line)
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(4f));
        }
    }

    private void renderProject(Document document, ProjectItem p,
                               PdfFont boldFont, PdfFont regularFont, PdfFont italicFont,
                               float baseFontSize) throws IOException {
        StringBuilder line = new StringBuilder();
        if (p.name() != null) line.append(p.name());
        if (p.technologies() != null) line.append(line.isEmpty() ? "" : "  —  ").append(p.technologies());
        String dateRange = formatDateRange(p.startDate(), p.endDate(), p.isCurrent());
        if (!dateRange.isBlank()) line.append("  |  ").append(dateRange);
        if (!line.isEmpty()) {
            document.add(new Paragraph(line.toString())
                    .setFont(boldFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(2f));
        }
        if (p.description() != null && !p.description().isBlank()) {
            document.add(new Paragraph(p.description())
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(6f));
        }
    }

    private void renderVolunteering(Document document, VolunteeringItem v,
                                    PdfFont boldFont, PdfFont regularFont, PdfFont italicFont,
                                    float baseFontSize) throws IOException {
        StringBuilder line = new StringBuilder();
        if (v.role() != null) line.append(v.role());
        if (v.organization() != null) line.append(line.isEmpty() ? "" : "  —  ").append(v.organization());
        String dateRange = formatDateRange(v.startDate(), v.endDate(), v.isCurrent());
        if (!dateRange.isBlank()) line.append("  |  ").append(dateRange);
        if (!line.isEmpty()) {
            document.add(new Paragraph(line.toString())
                    .setFont(boldFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(2f));
        }
        if (v.description() != null && !v.description().isBlank()) {
            document.add(new Paragraph(v.description())
                    .setFont(regularFont)
                    .setFontSize(baseFontSize)
                    .setMarginBottom(6f));
        }
    }

    private void renderGeneric(Document document, GenericItem g,
                               PdfFont regularFont, float baseFontSize) throws IOException {
        if (g.fields() != null && !g.fields().isEmpty()) {
            String text = g.fields().values().stream()
                    .filter(v -> v != null && !v.isBlank())
                    .collect(Collectors.joining(" "));
            if (!text.isBlank()) {
                document.add(new Paragraph(text)
                        .setFont(regularFont)
                        .setFontSize(baseFontSize)
                        .setMarginBottom(4f));
            }
        }
    }

    // ─── Section ordering ─────────────────────────────────────────────────────

    /**
     * Orders sections for single-column ATS output. For two-column templates, left
     * columns are rendered first, then right columns (both in a single linear flow).
     */
    private List<ResumeSection> orderSections(List<ResumeSection> sections,
                                              TemplateDefinition templateDef) {
        List<String> order = buildSectionOrder(templateDef);
        if (order.isEmpty()) return sections;

        List<ResumeSection> ordered = new ArrayList<>();
        List<ResumeSection> unordered = new ArrayList<>(sections);

        for (String sectionTypeName : order) {
            sections.stream()
                    .filter(s -> s.sectionType() != null
                            && sectionTypeName.equals(s.sectionType().name()))
                    .findFirst()
                    .ifPresent(found -> {
                        ordered.add(found);
                        unordered.remove(found);
                    });
        }
        // Append any sections not in the template order (safer: skip for ATS)
        // Per story: "skip sections not in sectionOrder" — we do not append unordered

        return ordered;
    }

    private List<String> buildSectionOrder(TemplateDefinition templateDef) {
        if (templateDef.layout() == null) return List.of();
        if (templateDef.isTwoColumn() && templateDef.layout().columns() != null) {
            // Flatten left + right into single ATS-compatible order
            List<String> merged = new ArrayList<>();
            var cols = templateDef.layout().columns();
            if (cols.left() != null) merged.addAll(cols.left());
            if (cols.right() != null) merged.addAll(cols.right());
            return merged;
        }
        return templateDef.layout().sectionOrder() != null
                ? templateDef.layout().sectionOrder()
                : List.of();
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    private SummaryItem findSummaryItem(List<ResumeSection> sections) {
        for (ResumeSection section : sections) {
            if (section.sectionType() != null
                    && "SUMMARY".equals(section.sectionType().name())) {
                for (ResumeItem item : section.items()) {
                    if (item instanceof SummaryItem si) return si;
                }
            }
        }
        return null;
    }

    private String formatDateRange(LocalDate start, LocalDate end, boolean isCurrent) {
        String startStr = start != null ? start.format(DATE_FMT) : "";
        String endStr = isCurrent ? "Present" : (end != null ? end.format(DATE_FMT) : "");
        if (!startStr.isBlank() && !endStr.isBlank()) return startStr + " – " + endStr;
        if (!startStr.isBlank()) return startStr;
        if (!endStr.isBlank()) return endStr;
        return "";
    }

    private float parseMargin(Object cssValue) {
        if (cssValue == null) return DEFAULT_MARGIN_PT;
        String val = cssValue.toString().trim();
        if (val.endsWith("in")) {
            try {
                return Float.parseFloat(val.substring(0, val.length() - 2).trim()) * PT_PER_IN;
            } catch (NumberFormatException ignored) {
                return DEFAULT_MARGIN_PT;
            }
        }
        if (val.endsWith("px")) {
            try {
                return Float.parseFloat(val.substring(0, val.length() - 2).trim()) * PT_PER_PX;
            } catch (NumberFormatException ignored) {
                return DEFAULT_MARGIN_PT;
            }
        }
        return DEFAULT_MARGIN_PT;
    }

    private float parseFontSize(Object cssValue) {
        if (cssValue == null) return BASE_FONT_SIZE_PT;
        String val = cssValue.toString().trim();
        if (val.endsWith("px")) {
            try {
                return Float.parseFloat(val.substring(0, val.length() - 2).trim()) * PT_PER_PX;
            } catch (NumberFormatException ignored) {
                return BASE_FONT_SIZE_PT;
            }
        }
        return BASE_FONT_SIZE_PT;
    }

    // ─── Internal exception ───────────────────────────────────────────────────

    static class PdfRenderException extends RuntimeException {
        PdfRenderException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
