package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.util.List;

public record ResumeSection(
        String id,
        String title,
        boolean visible,
        List<ResumeItem> items
) {
    /**
     * Compact constructor — defensively copies the incoming list so the record
     * remains truly immutable even if the caller mutates the original list later.
     */
    public ResumeSection {
        items = items != null ? List.copyOf(items) : List.of();
    }
}
