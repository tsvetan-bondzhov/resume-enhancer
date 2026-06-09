package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.util.List;
import java.util.Objects;

public record ResumeSection(
        ResumeSectionType sectionType,
        String title,
        boolean visible,
        List<ResumeItem> items
) {
    /**
     * Compact constructor — guards against null sectionType and defensively copies
     * the incoming list so the record remains truly immutable even if the caller
     * mutates the original list later.
     */
    public ResumeSection {
        Objects.requireNonNull(sectionType, "sectionType must not be null");
        items = items != null ? List.copyOf(items) : List.of();
    }
}
