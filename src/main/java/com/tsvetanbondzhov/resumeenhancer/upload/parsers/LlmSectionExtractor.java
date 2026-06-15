package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
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
        List<WorkExperienceItem> workExperiences = new ArrayList<>();
        List<EducationItem> education = new ArrayList<>();
        List<SkillItem> skills = new ArrayList<>();
        List<CertificationItem> certifications = new ArrayList<>();
        List<LanguageItem> languages = new ArrayList<>();
        List<ProjectItem> projects = new ArrayList<>();
        List<VolunteeringItem> volunteering = new ArrayList<>();
        SummaryItem summary = null;

        for (RawSection rawSection : rawSections) {
            ResumeSectionType sectionType = ResumeSectionType.fromHeader(
                rawSection.title().toLowerCase().replaceAll("[^a-z0-9 ]", "").trim()
            );
            String sectionText = String.join("\n", rawSection.lines());

            // Truncate to 3000 chars
            if (sectionText.length() > MAX_SECTION_LENGTH) {
                log.warn("Section '{}' truncated from {} to {} chars",
                    rawSection.title(), sectionText.length(), MAX_SECTION_LENGTH);
                sectionText = sectionText.substring(0, MAX_SECTION_LENGTH);
            }

            List<ResumeItem> items = extractSectionItems(
                rawSection, sectionType, sectionText, fullRawText);

            // Dispatch typed items to the appropriate list; skip UNKNOWN
            switch (sectionType) {
                case WORK_EXPERIENCE -> items.stream()
                    .filter(WorkExperienceItem.class::isInstance)
                    .map(WorkExperienceItem.class::cast)
                    .forEach(workExperiences::add);
                case EDUCATION -> items.stream()
                    .filter(EducationItem.class::isInstance)
                    .map(EducationItem.class::cast)
                    .forEach(education::add);
                case SKILLS -> items.stream()
                    .filter(SkillItem.class::isInstance)
                    .map(SkillItem.class::cast)
                    .forEach(skills::add);
                case CERTIFICATIONS -> items.stream()
                    .filter(CertificationItem.class::isInstance)
                    .map(CertificationItem.class::cast)
                    .forEach(certifications::add);
                case LANGUAGES -> items.stream()
                    .filter(LanguageItem.class::isInstance)
                    .map(LanguageItem.class::cast)
                    .forEach(languages::add);
                case PROJECTS -> items.stream()
                    .filter(ProjectItem.class::isInstance)
                    .map(ProjectItem.class::cast)
                    .forEach(projects::add);
                case VOLUNTEERING -> items.stream()
                    .filter(VolunteeringItem.class::isInstance)
                    .map(VolunteeringItem.class::cast)
                    .forEach(volunteering::add);
                case SUMMARY -> {
                    // Take the first SummaryItem only; ignore subsequent ones
                    if (summary == null) {
                        summary = items.stream()
                            .filter(SummaryItem.class::isInstance)
                            .map(SummaryItem.class::cast)
                            .findFirst()
                            .orElse(null);
                    }
                }
                case UNKNOWN -> {
                    // UNKNOWN sections are intentionally excluded from the DTO
                }
            }
        }

        return new ParsedResumeDto(
            fullRawText,
            workExperiences,
            education,
            skills,
            certifications,
            languages,
            projects,
            volunteering,
            summary
        );
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
            case SUMMARY -> new SummaryItem(id, str(raw, "text"), null, null, null, null, null, null);
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
