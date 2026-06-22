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
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * ATS-compatible DOCX renderer using Apache POI.
 * <p>
 * Renders a {@link ResumeDocument} to a DOCX byte array following the layout
 * defined in a {@link ResumeTemplate}. All output is plain Word text (no images,
 * no tables for layout, no skill bars) to ensure ATS compatibility (NFR4, FR37).
 * <p>
 * Heading styles use Word built-in styles: {@code "Heading1"} for section titles,
 * {@code "Heading2"} for sub-item titles.
 * <p>
 * This class is a stateless {@code @Component} (singleton). All per-render state
 * lives in local variables inside {@link #render}.
 */
@Component("docx")
public class DocxRenderer implements DocumentRenderer {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM yyyy");
    private static final String SEPARATOR_PIPE = "  |  ";
    private static final String SEPARATOR_DASH = "  —  ";
    private static final String STYLE_HEADING2 = "Heading2";

    private final TemplateDefinitionService templateDefinitionService;

    public DocxRenderer(TemplateDefinitionService templateDefinitionService) {
        this.templateDefinitionService = templateDefinitionService;
    }

    @Override
    public byte[] render(ResumeDocument doc, ResumeTemplate template) {
        TemplateDefinition templateDef = templateDefinitionService.resolve(template);
        List<ResumeSection> sections = doc.sections() != null ? doc.sections() : List.of();

        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            // Render header block (name + contact line + summary text)
            SummaryItem summaryItem = findSummaryItem(sections);
            renderHeader(document, summaryItem);

            // Build ordered section list respecting template sectionOrder (single linear for ATS)
            List<ResumeSection> orderedSections = orderSections(sections, templateDef);

            for (ResumeSection section : orderedSections) {
                // Skip invisible, typeless, or SUMMARY sections (already rendered as header)
                if (!section.visible()
                        || section.sectionType() == null
                        || "SUMMARY".equals(section.sectionType().name())) continue;
                renderSection(document, section);
            }

            document.write(baos);
            return baos.toByteArray();

        } catch (IOException e) {
            throw new DocxRenderException("DOCX rendering failed", e);
        }
    }

    // ─── Header ──────────────────────────────────────────────────────────────

    private void renderHeader(XWPFDocument document, SummaryItem summary) {
        if (summary == null) return;

        // Candidate name — derive from email if available
        String nameDisplay = buildNameDisplay(summary);
        if (nameDisplay != null && !nameDisplay.isBlank()) {
            XWPFParagraph namePara = document.createParagraph();
            XWPFRun nameRun = namePara.createRun();
            nameRun.setText(nameDisplay);
            nameRun.setBold(true);
            nameRun.setFontSize(16);
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
            contactRun.setText(String.join(SEPARATOR_PIPE, contacts));
            contactRun.setFontSize(9);
        }

        // Summary text (italic)
        if (summary.text() != null && !summary.text().isBlank()) {
            XWPFParagraph summaryPara = document.createParagraph();
            XWPFRun summaryRun = summaryPara.createRun();
            summaryRun.setText(summary.text());
            summaryRun.setItalic(true);
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

    private void renderSection(XWPFDocument document, ResumeSection section) {
        // Section heading with Word "Heading 1" style
        String title;
        if (section.title() != null) {
            title = section.title();
        } else {
            title = section.sectionType() != null ? section.sectionType().name() : "Section";
        }
        XWPFParagraph heading = document.createParagraph();
        heading.setStyle("Heading1");
        XWPFRun headingRun = heading.createRun();
        headingRun.setText(title.toUpperCase());

        List<ResumeItem> items = section.items() != null ? section.items() : List.of();

        // Special case: SKILLS — comma-separated in one paragraph (ATS friendly)
        if (section.sectionType() != null && "SKILLS".equals(section.sectionType().name())) {
            renderSkillsSection(document, items);
            return;
        }

        for (ResumeItem item : items) {
            renderItem(document, item);
        }
    }

    private void renderSkillsSection(XWPFDocument document, List<ResumeItem> items) {
        String skills = items.stream()
                .filter(SkillItem.class::isInstance)
                .map(i -> ((SkillItem) i).name())
                .filter(n -> n != null && !n.isBlank())
                .collect(Collectors.joining(", "));
        if (!skills.isBlank()) {
            XWPFParagraph para = document.createParagraph();
            para.createRun().setText(skills);
        }
    }

    private void renderItem(XWPFDocument document, ResumeItem item) {
        switch (item) {
            case WorkExperienceItem w -> renderWorkExperience(document, w);
            case EducationItem e -> renderEducation(document, e);
            case CertificationItem c -> renderCertification(document, c);
            case LanguageItem l -> renderLanguage(document, l);
            case ProjectItem p -> renderProject(document, p);
            case VolunteeringItem v -> renderVolunteering(document, v);
            case SummaryItem ignored -> { /* already rendered as header */ }
            case FullNameItem n -> renderFullName(document, n);
            case SkillItem ignored -> { /* handled in renderSkillsSection */ }
            case GenericItem g -> renderGeneric(document, g);
        }
    }

    private void renderFullName(XWPFDocument document, FullNameItem n) {
        String fullName = java.util.stream.Stream.of(n.firstName(), n.lastName())
                .filter(v -> v != null && !v.isBlank())
                .collect(Collectors.joining(" "));
        if (!fullName.isBlank()) {
            XWPFParagraph para = document.createParagraph();
            XWPFRun run = para.createRun();
            run.setText(fullName);
            run.setBold(true);
            run.setFontSize(16);
        }
    }

    private void renderWorkExperience(XWPFDocument document, WorkExperienceItem w) {
        // Title + company as Heading2 sub-item
        StringBuilder titleLine = new StringBuilder();
        if (w.jobTitle() != null) titleLine.append(w.jobTitle());
        if (w.company() != null) titleLine.append(titleLine.isEmpty() ? "" : SEPARATOR_DASH).append(w.company());
        if (!titleLine.isEmpty()) {
            XWPFParagraph para = document.createParagraph();
            para.setStyle(STYLE_HEADING2);
            para.createRun().setText(titleLine.toString());
        }
        // Date range
        String dateRange = formatDateRange(w.startDate(), w.endDate(), w.isCurrent());
        if (!dateRange.isBlank()) {
            document.createParagraph().createRun().setText(dateRange);
        }
        // Description
        if (w.description() != null && !w.description().isBlank()) {
            document.createParagraph().createRun().setText(w.description());
        }
    }

    private void renderEducation(XWPFDocument document, EducationItem e) {
        StringBuilder line = new StringBuilder();
        if (e.institution() != null) line.append(e.institution());
        if (e.degree() != null) line.append(line.isEmpty() ? "" : ", ").append(e.degree());
        if (e.fieldOfStudy() != null) line.append(line.isEmpty() ? "" : ", ").append(e.fieldOfStudy());
        if (!line.isEmpty()) {
            XWPFParagraph para = document.createParagraph();
            para.setStyle(STYLE_HEADING2);
            para.createRun().setText(line.toString());
        }
        String dateRange = formatDateRange(e.startDate(), e.endDate(), false);
        if (!dateRange.isBlank()) {
            document.createParagraph().createRun().setText(dateRange);
        }
    }

    private void renderCertification(XWPFDocument document, CertificationItem c) {
        StringBuilder line = new StringBuilder();
        if (c.name() != null) line.append(c.name());
        if (c.issuer() != null) line.append(line.isEmpty() ? "" : " — ").append(c.issuer());
        if (c.issueDate() != null) line.append(SEPARATOR_PIPE).append(c.issueDate().format(DATE_FMT));
        if (!line.isEmpty()) {
            document.createParagraph().createRun().setText(line.toString());
        }
    }

    private void renderLanguage(XWPFDocument document, LanguageItem l) {
        // F7 null-guard: only prepend separator when the language portion is non-empty
        String langPart = l.language() != null ? l.language() : "";
        String profPart;
        if (l.proficiency() != null) {
            profPart = langPart.isEmpty() ? l.proficiency() : SEPARATOR_DASH + l.proficiency();
        } else {
            profPart = "";
        }
        String line = langPart + profPart;
        if (!line.isBlank()) {
            document.createParagraph().createRun().setText(line);
        }
    }

    private void renderProject(XWPFDocument document, ProjectItem p) {
        if (p.name() != null) {
            XWPFParagraph para = document.createParagraph();
            para.setStyle(STYLE_HEADING2);
            para.createRun().setText(p.name());
        }
        if (p.technologies() != null && !p.technologies().isBlank()) {
            document.createParagraph().createRun().setText(p.technologies());
        }
        String dateRange = formatDateRange(p.startDate(), p.endDate(), p.isCurrent());
        if (!dateRange.isBlank()) {
            document.createParagraph().createRun().setText(dateRange);
        }
        if (p.description() != null && !p.description().isBlank()) {
            document.createParagraph().createRun().setText(p.description());
        }
    }

    private void renderVolunteering(XWPFDocument document, VolunteeringItem v) {
        StringBuilder titleLine = new StringBuilder();
        if (v.role() != null) titleLine.append(v.role());
        if (v.organization() != null) titleLine.append(titleLine.isEmpty() ? "" : SEPARATOR_DASH).append(v.organization());
        if (!titleLine.isEmpty()) {
            XWPFParagraph para = document.createParagraph();
            para.setStyle(STYLE_HEADING2);
            para.createRun().setText(titleLine.toString());
        }
        String dateRange = formatDateRange(v.startDate(), v.endDate(), v.isCurrent());
        StringBuilder descLine = new StringBuilder();
        if (v.description() != null && !v.description().isBlank()) descLine.append(v.description());
        if (!dateRange.isBlank()) descLine.append(descLine.isEmpty() ? "" : SEPARATOR_PIPE).append(dateRange);
        if (!descLine.isEmpty()) {
            document.createParagraph().createRun().setText(descLine.toString());
        }
    }

    private void renderGeneric(XWPFDocument document, GenericItem g) {
        if (g.fields() != null && !g.fields().isEmpty()) {
            g.fields().forEach((key, value) -> {
                if (value != null && !value.isBlank()) {
                    document.createParagraph().createRun().setText(key + ": " + value);
                }
            });
        }
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
