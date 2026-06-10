package com.tsvetanbondzhov.resumeenhancer.export;

import java.util.List;
import java.util.Map;

public record TemplateLayout(
        String headerFormat,
        List<String> sectionOrder,
        TemplateColumns columns,
        Map<String, SectionStyle> sectionStyles
) {
    public List<String> resolvedSectionOrder() {
        if (columns != null) throw new IllegalStateException(
                "Use columns.left/right for two-column layouts");
        return sectionOrder != null ? sectionOrder : List.of();
    }
}
