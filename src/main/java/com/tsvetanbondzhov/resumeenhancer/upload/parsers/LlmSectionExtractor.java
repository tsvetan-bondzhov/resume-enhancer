package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.FullNameItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.GenericItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class LlmSectionExtractor {

    private static final Logger log = LoggerFactory.getLogger(LlmSectionExtractor.class);
    private static final int MAX_SECTION_LENGTH = 3000;
    private static final String START_DATE = "startDate";
    private static final String END_DATE = "endDate";
    private static final String IS_CURRENT = "isCurrent";
    private static final String DESCRIPTION = "description";
    private static final String FIRST_NAME = "firstName";
    private static final String LAST_NAME = "lastName";

    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public LlmSectionExtractor(AiService aiService, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    /**
     * Extracts typed {@link ParsedResumeDto} from a list of raw sections.
     * Never throws — falls back to heuristic lines on per-section failure.
     * UNKNOWN sections are skipped (not included in any typed list).
     */
    public ParsedResumeDto extract(List<RawSection> rawSections, String fullRawText) {
        ParsedResumeAccumulator acc = new ParsedResumeAccumulator();

        for (RawSection rawSection : rawSections) {
            ResumeSectionType sectionType = ResumeSectionType.fromHeader(
                rawSection.title().toLowerCase().replaceAll("[^a-z0-9 ]", "").trim()
            );
            String sectionText = truncate(rawSection);

            List<ResumeItem> items = extractSectionItems(
                rawSection, sectionType, sectionText, fullRawText);

            dispatchItems(acc, sectionType, items);
        }

        return acc.toDto(fullRawText);
    }

    /** Joins the section lines and truncates to {@link #MAX_SECTION_LENGTH} characters. */
    private String truncate(RawSection rawSection) {
        String sectionText = String.join("\n", rawSection.lines());
        if (sectionText.length() > MAX_SECTION_LENGTH) {
            log.warn("Section '{}' truncated from {} to {} chars",
                rawSection.title(), sectionText.length(), MAX_SECTION_LENGTH);
            sectionText = sectionText.substring(0, MAX_SECTION_LENGTH);
        }
        return sectionText;
    }

    /** Dispatches typed items to the appropriate accumulator list; UNKNOWN sections are skipped. */
    private void dispatchItems(ParsedResumeAccumulator acc, ResumeSectionType sectionType, List<ResumeItem> items) {
        switch (sectionType) {
            case WORK_EXPERIENCE -> typed(items, WorkExperienceItem.class).forEach(acc.workExperiences::add);
            case EDUCATION -> typed(items, EducationItem.class).forEach(acc.education::add);
            case SKILLS -> typed(items, SkillItem.class).forEach(acc.skills::add);
            case CERTIFICATIONS -> typed(items, CertificationItem.class).forEach(acc.certifications::add);
            case LANGUAGES -> typed(items, LanguageItem.class).forEach(acc.languages::add);
            case PROJECTS -> typed(items, ProjectItem.class).forEach(acc.projects::add);
            case VOLUNTEERING -> typed(items, VolunteeringItem.class).forEach(acc.volunteering::add);
            case SUMMARY -> {
                // Take the first SummaryItem only; ignore subsequent ones.
                acc.setSummaryIfAbsent(first(items, SummaryItem.class));
                // The name commonly lives in the summary/header block — capture it.
                acc.setFullNameIfAbsent(first(items, FullNameItem.class));
            }
            // Take the first FullNameItem only; ignore subsequent ones.
            case FULL_NAME -> acc.setFullNameIfAbsent(first(items, FullNameItem.class));
            case UNKNOWN -> {
                // UNKNOWN sections are intentionally excluded from the DTO
            }
        }
    }

    /** Streams only the items assignable to the given type. */
    private <T extends ResumeItem> java.util.stream.Stream<T> typed(List<ResumeItem> items, Class<T> type) {
        return items.stream().filter(type::isInstance).map(type::cast);
    }

    /** Returns the first item assignable to the given type, or null if none. */
    private <T extends ResumeItem> T first(List<ResumeItem> items, Class<T> type) {
        return typed(items, type).findFirst().orElse(null);
    }

    /** Mutable accumulator collecting typed items across sections before building the DTO. */
    private static final class ParsedResumeAccumulator {
        private final List<WorkExperienceItem> workExperiences = new ArrayList<>();
        private final List<EducationItem> education = new ArrayList<>();
        private final List<SkillItem> skills = new ArrayList<>();
        private final List<CertificationItem> certifications = new ArrayList<>();
        private final List<LanguageItem> languages = new ArrayList<>();
        private final List<ProjectItem> projects = new ArrayList<>();
        private final List<VolunteeringItem> volunteering = new ArrayList<>();
        private SummaryItem summary;
        private FullNameItem fullName;

        void setSummaryIfAbsent(SummaryItem candidate) {
            if (summary == null) {
                summary = candidate;
            }
        }

        void setFullNameIfAbsent(FullNameItem candidate) {
            if (fullName == null) {
                fullName = candidate;
            }
        }

        ParsedResumeDto toDto(String fullRawText) {
            return new ParsedResumeDto(
                fullRawText, workExperiences, education, skills, certifications,
                languages, projects, volunteering, summary, fullName
            );
        }
    }

    private List<ResumeItem> extractSectionItems(
            RawSection rawSection,
            ResumeSectionType sectionType,
            String sectionText,
            String fullRawText) {

        try {
            String jsonResponse = aiService.extractResumeSection(sectionType.name(), sectionText);

            if (jsonResponse == null) {
                log.warn("Null JSON response for section '{}', falling back to heuristic lines", rawSection.title());
                return heuristicItems(rawSection);
            }

            List<Map<String, Object>> rawItems = parseJsonItems(jsonResponse, rawSection);
            if (rawItems == null) {
                return heuristicItems(rawSection);
            }

            List<ResumeItem> result = new ArrayList<>();
            for (Map<String, Object> rawItem : rawItems) {
                result.add(buildItemWithFallback(sectionType, rawItem, fullRawText, rawSection.title()));
                // The candidate's name typically appears in the SUMMARY/header block rather than
                // under a dedicated "Name" header, so also derive a FullNameItem from it.
                if (sectionType == ResumeSectionType.SUMMARY
                        && (rawItem.get(FIRST_NAME) != null || rawItem.get(LAST_NAME) != null)) {
                    result.add(new FullNameItem(
                            UUID.randomUUID().toString(),
                            str(rawItem, FIRST_NAME),
                            str(rawItem, LAST_NAME)
                    ));
                }
            }
            return result;

        } catch (Exception e) {
            log.warn("LLM extraction failed for section '{}', using heuristic fallback: {}",
                rawSection.title(), e.getMessage());
            return heuristicItems(rawSection);
        }
    }

    private ResumeItem buildItemWithFallback(
            ResumeSectionType sectionType,
            Map<String, Object> rawItem,
            String fullRawText,
            String sectionTitle) {
        try {
            return buildTypedItem(sectionType, rawItem, fullRawText);
        } catch (Exception e) {
            log.warn("Failed to build typed item for section '{}', using GenericItem fallback: {}",
                sectionTitle, e.getMessage());
            return new GenericItem(UUID.randomUUID().toString(), toStringMap(rawItem));
        }
    }

    /** Parses the LLM JSON response into a list of raw item maps.
     *  Returns null (and logs a warning) if the JSON is malformed. */
    private List<Map<String, Object>> parseJsonItems(String jsonResponse, RawSection rawSection) {
        try {
            return objectMapper.readValue(jsonResponse,
                new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.warn("Malformed JSON for section '{}', falling back to heuristic lines: {}",
                rawSection.title(), e.getMessage());
            return null;
        }
    }

    private ResumeItem buildTypedItem(ResumeSectionType type, Map<String, Object> raw, String fullRawText) {
        String id = UUID.randomUUID().toString();

        // Anchor check — log WARN if no string field value (length > 3) appears in source text.
        // Boolean and short numeric values are excluded to avoid false-positive matches
        // (e.g. "false".toString() matches almost any text fragment).
        boolean hasAnchor = raw.values().stream()
            .filter(String.class::isInstance)
            .map(String.class::cast)
            .filter(v -> v.length() > 3)
            .anyMatch(v -> fullRawText.toLowerCase().contains(v.toLowerCase()));
        if (!hasAnchor && !raw.isEmpty()) {
            log.warn("Low confidence item in section type '{}': no anchor found in raw text", type);
        }

        return switch (type) {
            case WORK_EXPERIENCE -> new WorkExperienceItem(
                    id,
                    str(raw, "jobTitle"),
                    str(raw, "company"),
                    parseDate(raw, START_DATE),
                    parseDate(raw, END_DATE),
                    bool(raw, IS_CURRENT),
                    str(raw, DESCRIPTION)
            );
            case EDUCATION -> new EducationItem(
                    id,
                    str(raw, "institution"),
                    str(raw, "degree"),
                    str(raw, "fieldOfStudy"),
                    parseDate(raw, START_DATE),
                    parseDate(raw, END_DATE)
            );
            case SKILLS -> new SkillItem(id, str(raw, "name"));
            case CERTIFICATIONS -> new CertificationItem(
                    id,
                    str(raw, "name"),
                    str(raw, "issuer"),
                    parseDate(raw, "issueDate"),
                    parseDate(raw, "expirationDate")
            );
            case LANGUAGES -> new LanguageItem(id, str(raw, "language"), str(raw, "proficiency"));
            case PROJECTS -> new ProjectItem(
                    id,
                    str(raw, "name"),
                    str(raw, DESCRIPTION),
                    str(raw, "technologies"),
                    str(raw, "link"),
                    parseDate(raw, START_DATE),
                    parseDate(raw, END_DATE),
                    bool(raw, IS_CURRENT)
            );
            case VOLUNTEERING -> new VolunteeringItem(
                    id,
                    str(raw, "role"),
                    str(raw, "organization"),
                    str(raw, DESCRIPTION),
                    parseDate(raw, START_DATE),
                    parseDate(raw, END_DATE),
                    bool(raw, IS_CURRENT)
            );
            case SUMMARY -> new SummaryItem(
                    id,
                    str(raw, "text"),
                    str(raw, "linkedInUrl"),
                    str(raw, "personalPageUrl"),
                    str(raw, "blogUrl"),
                    str(raw, "contactEmail"),
                    str(raw, "locationCountry"),
                    str(raw, "locationCity")
            );
            case FULL_NAME -> new FullNameItem(
                    id,
                    str(raw, FIRST_NAME),
                    str(raw, LAST_NAME)
            );
            case UNKNOWN -> new GenericItem(id, toStringMap(raw));
        };
    }

    /** Extracts a String field from raw LLM map, returns null if missing or empty. */
    private String str(Map<String, Object> raw, String key) {
        Object val = raw.get(key);
        if (val == null) return null;
        String s = val.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /** Extracts a boolean field from raw LLM map. */
    private boolean bool(Map<String, Object> raw, String key) {
        Object val = raw.get(key);
        if (val == null) return false;
        if (val instanceof Boolean b) return b;
        return Boolean.parseBoolean(val.toString());
    }

    /** Parses a date field. Returns null and logs WARN on parse failure. */
    private LocalDate parseDate(Map<String, Object> raw, String key) {
        String val = str(raw, key);
        if (val == null || val.equalsIgnoreCase("Present") || val.equalsIgnoreCase("null")) return null;
        try {
            // Handle "YYYY-MM" by appending "-01"
            if (val.matches("\\d{4}-\\d{2}")) {
                val = val + "-01";
            }
            // Handle "YYYY" by appending "-01-01"
            if (val.matches("\\d{4}")) {
                val = val + "-01-01";
            }
            return LocalDate.parse(val);
        } catch (DateTimeParseException e) {
            log.warn("Could not parse date field '{}' value '{}': {}", key, val, e.getMessage());
            return null;
        }
    }

    /**
     * Converts Map&lt;String, Object&gt; to Map&lt;String, String&gt; for GenericItem.
     * Primitives and strings are converted via toString(); nested Maps and Lists
     * are serialized to compact JSON strings to avoid garbled output like "[item1, item2]".
     */
    private Map<String, String> toStringMap(Map<String, Object> raw) {
        Map<String, String> result = new HashMap<>();
        for (Map.Entry<String, Object> entry : raw.entrySet()) {
            Object val = entry.getValue();
            if (val == null) continue;
            if (val instanceof Map || val instanceof List) {
                try {
                    result.put(entry.getKey(), objectMapper.writeValueAsString(val));
                } catch (Exception e) {
                    log.warn("Could not serialize nested value for key '{}': {}", entry.getKey(), e.getMessage());
                    result.put(entry.getKey(), val.toString());
                }
            } else {
                result.put(entry.getKey(), val.toString());
            }
        }
        return result;
    }

    private List<ResumeItem> heuristicItems(RawSection rawSection) {
        List<ResumeItem> items = new ArrayList<>();
        for (String line : rawSection.lines()) {
            items.add(new GenericItem(
                UUID.randomUUID().toString(),
                Map.of("text", line)
            ));
        }
        return items;
    }
}
