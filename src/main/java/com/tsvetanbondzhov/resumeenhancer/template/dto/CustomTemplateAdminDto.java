package com.tsvetanbondzhov.resumeenhancer.template.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Admin-facing view of a custom (user-owned) template. Mirrors {@link TemplateDto} but adds
 * the owner's email so administrators can see who authored each custom template.
 */
public record CustomTemplateAdminDto(
        UUID id,
        String name,
        String description,
        boolean isPrebuilt,
        boolean isPublished,
        Map<String, Object> templateDefinition,
        Instant createdAt,
        Instant updatedAt,
        UUID ownerId,
        String ownerEmail
) {
}
