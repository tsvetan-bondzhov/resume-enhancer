package com.tsvetanbondzhov.resumeenhancer.export.renderers;

import com.tsvetanbondzhov.resumeenhancer.export.TemplateDefinition;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Shared utilities for {@link DocxRenderer} and {@link PdfRenderer}.
 */
final class RendererUtils {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM yyyy");

    private static final float PT_PER_PX = 0.75f;
    static final String DEFAULT_FONT_FAMILY = "Calibri";
    static final int DEFAULT_FONT_SIZE_PT = 8; // 11px * 0.75
    static final String DEFAULT_PRIMARY = "1F2937";
    static final String DEFAULT_TEXT = "111827";
    static final String DEFAULT_ACCENT = "3B82F6";

    private RendererUtils() {}

    // ─── CSS variable parsing ─────────────────────────────────────────────────

    /** First family token of a CSS font stack, e.g. "Inter, Arial" → "Inter". */
    static String parseFontFamily(Object cssValue) {
        if (cssValue == null) return DEFAULT_FONT_FAMILY;
        String val = cssValue.toString().trim();
        if (val.isEmpty()) return DEFAULT_FONT_FAMILY;
        String first = val.split(",")[0].trim().replace("\"", "").replace("'", "");
        return first.isEmpty() ? DEFAULT_FONT_FAMILY : first;
    }

    /** Parse "11px" → 8pt (px × 0.75, rounded). */
    static int parseFontSizePt(Object cssValue) {
        return parsePxToPt(cssValue, DEFAULT_FONT_SIZE_PT);
    }

    /** Parse a "NNpx" CSS length into points (px × 0.75, rounded), falling back when absent/invalid. */
    static int parsePxToPt(Object cssValue, int fallbackPt) {
        if (cssValue == null) return fallbackPt;
        String val = cssValue.toString().trim();
        if (val.endsWith("px")) {
            try {
                float px = Float.parseFloat(val.substring(0, val.length() - 2).trim());
                return Math.max(1, Math.round(px * PT_PER_PX));
            } catch (NumberFormatException ignored) {
                return fallbackPt;
            }
        }
        return fallbackPt;
    }

    /** POI paragraph spacing unit: 1pt = 20 twips. */
    static final int TWIPS_PER_PT = 20;

    /** Parse a "NNpx" CSS length into POI twips (px × 0.75 → pt → × 20). */
    static int parseSpacingTwips(Object cssValue, int fallbackPt) {
        return parsePxToPt(cssValue, fallbackPt) * TWIPS_PER_PT;
    }

    /** Strip a leading '#' from a CSS hex color; fall back when absent/invalid. */
    static String parseColor(Object cssValue, String fallback) {
        if (cssValue == null) return fallback;
        String val = cssValue.toString().trim();
        if (val.startsWith("#")) val = val.substring(1);
        return val.matches("(?i)[0-9a-f]{6}") ? val.toUpperCase() : fallback;
    }

    /** Null-safe accessor for a template's CSS variable map. */
    static Map<String, Object> cssVariables(TemplateDefinition templateDef) {
        return templateDef != null && templateDef.cssVariables() != null
                ? templateDef.cssVariables() : Map.of();
    }

    /**
     * Orders sections for single-column ATS output. For two-column templates, left
     * columns are rendered first, then right columns (both in a single linear flow).
     */
    static List<ResumeSection> orderSections(List<ResumeSection> sections,
                                             TemplateDefinition templateDef) {
        List<String> order = buildSectionOrder(templateDef);
        if (order.isEmpty()) return sections;

        List<ResumeSection> ordered = new ArrayList<>();

        for (String sectionTypeName : order) {
            sections.stream()
                    .filter(s -> s.sectionType() != null
                            && sectionTypeName.equals(s.sectionType().name()))
                    .findFirst()
                    .ifPresent(ordered::add);
        }
        // Sections not in the template order are skipped (ATS-safe ordering only)

        return ordered;
    }

    static List<String> buildSectionOrder(TemplateDefinition templateDef) {
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

    static SummaryItem findSummaryItem(List<ResumeSection> sections) {
        for (ResumeSection section : sections) {
            if (section.sectionType() != null
                    && "SUMMARY".equals(section.sectionType().name())) {
                List<ResumeItem> items = section.items();
                if (items == null) continue;
                for (ResumeItem item : items) {
                    if (item instanceof SummaryItem si) return si;
                }
            }
        }
        return null;
    }

    static String formatDateRange(LocalDate start, LocalDate end, boolean isCurrent) {
        String startStr = start != null ? start.format(DATE_FMT) : "";
        String endStr;
        if (isCurrent) {
            endStr = "Present";
        } else {
            endStr = end != null ? end.format(DATE_FMT) : "";
        }
        if (!startStr.isBlank() && !endStr.isBlank()) return startStr + " – " + endStr;
        if (!startStr.isBlank()) return startStr;
        if (!endStr.isBlank()) return endStr;
        return "";
    }
}
