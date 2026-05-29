package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;

public record SkillRequest(
        @NotBlank(message = "Skill name is required")
        String name
) {
}
