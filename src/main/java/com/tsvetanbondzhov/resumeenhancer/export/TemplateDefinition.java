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
            Map.of(
                    "--primary-color", "#1f2937",
                    "--accent-color", "#3b82f6",
                    "--font-family-sans", "Inter, system-ui, sans-serif",
                    "--font-size-base", "11px",
                    "--line-height-base", "1.5",
                    "--section-spacing", "12px",
                    "--page-margin-top", "0.75in",
                    "--page-margin-right", "0.75in",
                    "--page-margin-bottom", "0.75in",
                    "--page-margin-left", "0.75in"
            ),
            new TemplateLayout(
                    "name-contact",
                    List.of("experience", "education", "skills"),
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
