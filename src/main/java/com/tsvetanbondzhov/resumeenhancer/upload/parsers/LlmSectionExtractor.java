package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.ai.AiService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ResumeItemDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class LlmSectionExtractor {

    private static final Logger log = LoggerFactory.getLogger(LlmSectionExtractor.class);
    private static final int MAX_SECTION_LENGTH = 3000;
    private static final Pattern DATE_PATTERN = Pattern.compile("\\d{4}(-\\d{2})?");
    private static final Pattern DATE_FIELD_PATTERN = Pattern.compile("(?i)(date|start|end|graduation|issue|expiration)");

    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public LlmSectionExtractor(AiService aiService, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    /**
     * Extracts typed ResumeDocument from a list of raw sections.
     * Never throws — falls back to heuristic lines on per-section failure.
     */
    public ResumeDocument extract(List<RawSection> rawSections, String fullRawText) {
        List<ResumeSection> sections = new ArrayList<>();

        for (RawSection rawSection : rawSections) {
            ResumeSectionType sectionType = ResumeSectionType.fromHeader(
                rawSection.title().toLowerCase().replaceAll("[^a-z0-9 ]", "").trim()
            );
            String sectionText = String.join("\n", rawSection.lines());

            // AC9: Truncate to 3000 chars
            if (sectionText.length() > MAX_SECTION_LENGTH) {
                log.warn("Section '{}' truncated from {} to {} chars",
                    rawSection.title(), sectionText.length(), MAX_SECTION_LENGTH);
                sectionText = sectionText.substring(0, MAX_SECTION_LENGTH);
            }

            List<ResumeItem> items = extractSectionItems(
                rawSection, sectionType, sectionText, fullRawText);

            sections.add(new ResumeSection(
                UUID.randomUUID().toString(),
                rawSection.title(),
                true,
                items
            ));
        }

        return new ResumeDocument(sections);
    }

    private List<ResumeItem> extractSectionItems(
            RawSection rawSection,
            ResumeSectionType sectionType,
            String sectionText,
            String fullRawText) {

        try {
            System.out.println("-----------------------");
            System.out.printf("Section %s text: %s", sectionType.name(), sectionText);
            System.out.println("-----------------------");
            String jsonResponse = aiService.extractResumeSection(sectionType.name(), sectionText);

            // AC6: JSON parse check
            List<Map<String, Object>> rawItems;
            try {
                rawItems = objectMapper.readValue(jsonResponse,
                    new TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                log.warn("Malformed JSON for section '{}', falling back to heuristic lines: {}",
                    rawSection.title(), e.getMessage());
                return heuristicItems(rawSection);
            }

            // Validate and convert items
            List<ResumeItem> result = new ArrayList<>();
            for (Map<String, Object> rawItem : rawItems) {
                ResumeItemDto dto = validateAndConvert(rawItem, fullRawText);
                if (dto.lowConfidence()) {
                    log.warn("Low confidence item in section '{}': fields={}",
                        rawSection.title(), dto.fields());
                }
                result.add(new ResumeItem(UUID.randomUUID().toString(), dto.fields()));
            }
            return result;

        } catch (Exception e) {
            log.warn("LLM extraction failed for section '{}', using heuristic fallback: {}",
                rawSection.title(), e.getMessage());
            return heuristicItems(rawSection);
        }
    }

    private ResumeItemDto validateAndConvert(Map<String, Object> rawItem, String fullRawText) {
        Map<String, String> fields = new HashMap<>();

        for (Map.Entry<String, Object> entry : rawItem.entrySet()) {
            String key = entry.getKey();
            Object val = entry.getValue();
            if (val == null) continue;

            String strVal = val.toString();

            // AC7: Date format check
            if (DATE_FIELD_PATTERN.matcher(key).find()) {
                if (!strVal.equals("Present") && !DATE_PATTERN.matcher(strVal).matches()) {
                    log.debug("Nulling invalid date field '{}': '{}'", key, strVal);
                    continue; // null out — don't add to fields map
                }
            }
            fields.put(key, strVal);
        }

        // AC8: Anchor check — at least one field value must appear in rawText
        boolean hasAnchor = fields.values().stream()
            .anyMatch(v -> fullRawText.toLowerCase().contains(v.toLowerCase()));

        return new ResumeItemDto(fields, !hasAnchor && !fields.isEmpty());
    }

    private List<ResumeItem> heuristicItems(RawSection rawSection) {
        List<ResumeItem> items = new ArrayList<>();
        for (String line : rawSection.lines()) {
            items.add(new ResumeItem(
                UUID.randomUUID().toString(),
                Map.of("text", line)
            ));
        }
        return items;
    }
}
