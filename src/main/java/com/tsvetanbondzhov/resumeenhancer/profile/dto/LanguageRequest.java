package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import com.tsvetanbondzhov.resumeenhancer.profile.domain.LanguageProficiencyLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LanguageRequest(
        @NotBlank(message = "Language name is required")
        String name,
        @NotNull(message = "Proficiency level is required")
        LanguageProficiencyLevel proficiencyLevel
) {}
