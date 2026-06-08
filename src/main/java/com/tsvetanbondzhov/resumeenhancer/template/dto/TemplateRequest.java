package com.tsvetanbondzhov.resumeenhancer.template.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record TemplateRequest(
        @NotBlank String name,
        String description,
        @NotNull Map<String, Object> templateDefinition
) {
}
