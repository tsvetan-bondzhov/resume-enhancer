package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Shared heuristic section extractor used by both PdfParser and DocxParser.
 * Splits raw resume text into work experience, education, and skills lines
 * by detecting common section heading keywords.
 */
public final class SectionExtractor {

    private static final Set<String> WORK_KEYWORDS = Set.of("experience", "work", "employment");
    private static final Set<String> EDUCATION_KEYWORDS = Set.of("education", "degree", "university", "college");
    private static final Set<String> SKILL_KEYWORDS = Set.of("skills", "technologies", "competencies");

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

        return new ParsedResumeDto(rawText, workLines, educationLines, skillLines);
    }

    private static boolean containsKeyword(String line, Set<String> keywords) {
        for (String keyword : keywords) {
            if (line.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
