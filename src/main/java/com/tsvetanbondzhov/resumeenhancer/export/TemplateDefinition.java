package com.tsvetanbondzhov.resumeenhancer.export;

import java.util.List;
import java.util.Map;

/**
 * Typed representation of the {@code template_definition} JSONB column.
 * <p>
 * {@code cssVariables} is typed as {@code Map<String, Object>} (matching the
 * Hibernate JSONB deserialization type) to avoid Jackson coercion errors.
 * All actual values stored in the DB are strings — cast to {@code String} at use time.
 * </p>
 * <p>
 * {@code DEFAULT} provides compile-time fallback values used by the frontend
 * when {@code templateId} is {@code null} or a template fetch fails (AC5/AC6).
 * </p>
 */
public record TemplateDefinition(
        String layoutType,
        Map<String, Object> cssVariables,
        TemplateLayout layout,
        Map<String, Object> metadata
) {
    public static final TemplateDefinition DEFAULT = new TemplateDefinition(
            "single-column",
            Map.ofEntries(
                    Map.entry("--primary-color", "#1f2937"),
                    Map.entry("--accent-color", "#3b82f6"),
                    Map.entry("--font-family-sans", "Inter, system-ui, sans-serif"),
                    Map.entry("--font-size-base", "11px"),
                    Map.entry("--line-height-base", "1.5"),
                    Map.entry("--section-spacing", "12px"),
                    Map.entry("--page-margin-top", "0.75in"),
                    Map.entry("--page-margin-right", "0.75in"),
                    Map.entry("--page-margin-bottom", "0.75in"),
                    Map.entry("--page-margin-left", "0.75in"),
                    Map.entry("--text-color", "#111827")
            ),
            new TemplateLayout(
                    "name-contact",
                    List.of("SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"),
                    null,
                    Map.of()
            ),
            Map.of("version", "1.0", "atsCompatible", true, "pageSize", "letter")
    );

    public boolean isTwoColumn() {
        return "two-column".equals(layoutType);
    }

    public boolean isModernAccent() {
        return "modern-accent".equals(layoutType);
    }
}
