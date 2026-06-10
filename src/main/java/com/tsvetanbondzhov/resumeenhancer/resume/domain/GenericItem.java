package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.util.Map;

public record GenericItem(
        String id,
        Map<String, String> fields
) implements ResumeItem {
    public GenericItem {
        fields = fields != null ? Map.copyOf(fields) : Map.of();
    }
}
