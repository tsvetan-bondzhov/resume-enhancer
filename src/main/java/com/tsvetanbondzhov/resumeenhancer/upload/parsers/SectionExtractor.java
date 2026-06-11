package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Shared heuristic section extractor used by both PdfParser and DocxParser.
 * Splits raw resume text into work experience, education, and skills lines
 * by detecting common section heading keywords.
 */
public final class SectionExtractor {

    private static final Set<String> WORK_KEYWORDS = Set.of("experience", "work", "employment");
    private static final Set<String> EDUCATION_KEYWORDS = Set.of("education", "degree", "university", "college");
    private static final Set<String> SKILL_KEYWORDS = Set.of("skills", "technologies", "competencies");

    private static final Set<String> ALL_SECTION_KEYWORDS = Set.of(
        "experience", "work experience", "work", "employment", "work history", "professional experience",
        "education", "degree", "academic background", "educational background",
        "skills", "technologies", "technical skills", "core competencies", "competencies",
        "certifications", "certificates", "certification",
        "projects", "project experience", "personal projects", "open source", "key projects",
        "summary", "professional summary", "profile", "about me", "objective", "career objective",
        "publications",
        "languages", "language skills",
        "volunteering", "volunteer", "volunteer experience", "community involvement"
    );

    private SectionExtractor() {
    }

    public static ParsedResumeDto extract(String rawText) {
        List<String> workLines = new ArrayList<>();
        List<String> educationLines = new ArrayList<>();
        List<String> skillLines = new ArrayList<>();

        String[] lines = rawText.split("\\r?\\n");
        List<String> currentSection = null;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }

            String lower = trimmed.toLowerCase();
            if (containsKeyword(lower, WORK_KEYWORDS)) {
                currentSection = workLines;
            } else if (containsKeyword(lower, EDUCATION_KEYWORDS)) {
                currentSection = educationLines;
            } else if (containsKeyword(lower, SKILL_KEYWORDS)) {
                currentSection = skillLines;
            } else if (currentSection != null) {
                currentSection.add(trimmed);
            }
        }

        // Map heuristic lines to typed items with minimal fields.
        // Fields not derivable from a plain text line are left null/false.
        List<WorkExperienceItem> workExperiences = workLines.stream()
            .map(line -> new WorkExperienceItem(
                UUID.randomUUID().toString(),
                line,       // jobTitle = the raw line
                null,       // company
                null,       // startDate
                null,       // endDate
                false,      // isCurrent
                null        // description
            ))
            .toList();

        List<EducationItem> education = educationLines.stream()
            .map(line -> new EducationItem(
                UUID.randomUUID().toString(),
                line,       // institution = the raw line
                null,       // degree
                null,       // fieldOfStudy
                null,       // startDate
                null        // endDate
            ))
            .toList();

        List<SkillItem> skills = skillLines.stream()
            .map(line -> new SkillItem(UUID.randomUUID().toString(), line))
            .toList();

        return new ParsedResumeDto(
            rawText,
            workExperiences,
            education,
            skills,
            List.of(),  // certifications
            List.of(),  // languages
            List.of(),  // projects
            List.of(),  // volunteering
            null        // summary
        );
    }

    private static boolean containsKeyword(String line, Set<String> keywords) {
        for (String keyword : keywords) {
            if (line.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Segments raw resume text into sections by detecting header lines.
     * FULL-LINE match only: a line must normalize to a known keyword exactly.
     * This prevents mid-sentence false positives (e.g. "5 years of experience").
     */
    public static List<RawSection> segmentByHeaders(String rawText) {
        List<RawSection> sections = new ArrayList<>();
        String[] lines = rawText.split("\\r?\\n");

        String currentTitle = null;
        List<String> currentLines = new ArrayList<>();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            String normalized = trimmed.toLowerCase()
                    .replaceAll("[^a-z0-9 ]", "")  // strip punctuation
                    .trim();

            if (ALL_SECTION_KEYWORDS.contains(normalized)) {
                // Save previous section if it had content
                if (currentTitle != null) {
                    sections.add(new RawSection(currentTitle, List.copyOf(currentLines)));
                }
                currentTitle = trimmed;
                currentLines = new ArrayList<>();
            } else if (currentTitle != null) {
                currentLines.add(trimmed);
            }
        }

        // Add final section
        if (currentTitle != null) {
            sections.add(new RawSection(currentTitle, List.copyOf(currentLines)));
        }

        return sections;
    }
}
