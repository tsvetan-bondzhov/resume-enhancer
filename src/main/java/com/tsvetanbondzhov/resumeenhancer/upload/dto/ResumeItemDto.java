package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import java.util.Map;

public record ResumeItemDto(
        Map<String, String> fields,
        boolean lowConfidence
) {
    public ResumeItemDto {
        fields = fields != null ? Map.copyOf(fields) : Map.of();
    }
}
