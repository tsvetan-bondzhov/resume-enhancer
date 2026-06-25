package com.tsvetanbondzhov.resumeenhancer.export.renderers;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.FullNameItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Shared per-item display-string builders for the DOCX renderers
 * ({@link DocxRenderer} and {@code VisualDocxRenderer}).
 * <p>
 * Centralising these string builders avoids logic duplication between the
 * ATS-flat and visual DOCX renderers while keeping each renderer free to lay the
 * resulting strings out with its own paragraph/run styling.
 */
final class DocxItemFormatter {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM yyyy");
    private static final String SEPARATOR_PIPE = "  |  ";
    private static final String SEPARATOR_DASH = "  —  ";

    private DocxItemFormatter() {}

    /** Full name: "First Last" with blank parts skipped. */
    static String fullName(FullNameItem n) {
        return Stream.of(n.firstName(), n.lastName())
                .filter(v -> v != null && !v.isBlank())
                .collect(Collectors.joining(" "));
    }

    /** Work experience title line: "Job Title  —  Company". */
    static String workTitleLine(WorkExperienceItem w) {
        StringBuilder titleLine = new StringBuilder();
        if (w.jobTitle() != null) titleLine.append(w.jobTitle());
        if (w.company() != null) {
            titleLine.append(titleLine.isEmpty() ? "" : SEPARATOR_DASH).append(w.company());
        }
        return titleLine.toString();
    }

    /** Education line: "Institution, Degree, Field of Study". */
    static String educationLine(EducationItem e) {
        StringBuilder line = new StringBuilder();
        if (e.institution() != null) line.append(e.institution());
        if (e.degree() != null) line.append(line.isEmpty() ? "" : ", ").append(e.degree());
        if (e.fieldOfStudy() != null) line.append(line.isEmpty() ? "" : ", ").append(e.fieldOfStudy());
        return line.toString();
    }

    /** Certification line: "Name — Issuer  |  Mon yyyy". */
    static String certificationLine(CertificationItem c) {
        StringBuilder line = new StringBuilder();
        if (c.name() != null) line.append(c.name());
        if (c.issuer() != null) line.append(line.isEmpty() ? "" : " — ").append(c.issuer());
        if (c.issueDate() != null) line.append(SEPARATOR_PIPE).append(c.issueDate().format(DATE_FMT));
        return line.toString();
    }

    /** Language line: "Language  —  Proficiency". */
    static String languageLine(LanguageItem l) {
        String langPart = l.language() != null ? l.language() : "";
        String profPart;
        if (l.proficiency() != null) {
            profPart = langPart.isEmpty() ? l.proficiency() : SEPARATOR_DASH + l.proficiency();
        } else {
            profPart = "";
        }
        return langPart + profPart;
    }

    /** Volunteering title line: "Role  —  Organization". */
    static String volunteeringTitleLine(VolunteeringItem v) {
        StringBuilder titleLine = new StringBuilder();
        if (v.role() != null) titleLine.append(v.role());
        if (v.organization() != null) {
            titleLine.append(titleLine.isEmpty() ? "" : SEPARATOR_DASH).append(v.organization());
        }
        return titleLine.toString();
    }

    /** Volunteering description line: "Description  |  Date range". */
    static String volunteeringDescriptionLine(VolunteeringItem v, String dateRange) {
        StringBuilder descLine = new StringBuilder();
        if (v.description() != null && !v.description().isBlank()) descLine.append(v.description());
        if (dateRange != null && !dateRange.isBlank()) {
            descLine.append(descLine.isEmpty() ? "" : SEPARATOR_PIPE).append(dateRange);
        }
        return descLine.toString();
    }

    /** Comma-separated list of skill names from a section's items. */
    static String skillsJoin(List<ResumeItem> items) {
        return items.stream()
                .filter(SkillItem.class::isInstance)
                .map(i -> ((SkillItem) i).name())
                .filter(n -> n != null && !n.isBlank())
                .collect(Collectors.joining(", "));
    }

    /** Project technologies line (verbatim). */
    static String projectTechnologies(ProjectItem p) {
        return p.technologies() != null ? p.technologies() : "";
    }
}
