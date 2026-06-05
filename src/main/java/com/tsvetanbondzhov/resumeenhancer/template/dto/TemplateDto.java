package com.tsvetanbondzhov.resumeenhancer.template.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record TemplateDto(
        UUID id,
        String name,
        String description,
        boolean isPrebuilt,
        boolean isPublished,
        Map<String, Object> templateDefinition,
        Instant createdAt,
        Instant updatedAt
) {
}
