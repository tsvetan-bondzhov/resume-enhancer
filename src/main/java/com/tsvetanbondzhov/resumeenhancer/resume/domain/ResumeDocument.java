package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.util.List;

public record ResumeDocument(
        List<ResumeSection> sections
) {
    /**
     * Compact constructor — defensively copies the incoming list so the record
     * remains truly immutable even if the caller mutates the original list later.
     */
    public ResumeDocument {
        sections = sections != null ? List.copyOf(sections) : List.of();
    }
}
