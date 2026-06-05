package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.util.Map;

public record ResumeItem(
        String id,
        Map<String, String> fields
) {
    /**
     * Compact constructor — defensively copies the incoming map so the record
     * remains truly immutable even if the caller mutates the original map later.
     */
    public ResumeItem {
        fields = fields != null ? Map.copyOf(fields) : Map.of();
    }
}
