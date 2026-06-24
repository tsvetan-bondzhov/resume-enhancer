package com.tsvetanbondzhov.resumeenhancer.template.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

/**
 * Request body for user-owned custom template create/update.
 * Mirrors {@link TemplateRequest} but is a distinct type so the admin and user
 * request shapes can evolve independently.
 */
public record CustomTemplateRequest(
        @NotBlank String name,
        String description,
        @NotNull Map<String, Object> templateDefinition
) {
}
