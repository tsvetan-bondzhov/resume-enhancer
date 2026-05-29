package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record WorkExperienceRequest(
        @NotBlank(message = "Job title is required")
        String jobTitle,

        @NotBlank(message = "Company is required")
        String company,

        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent,
        String description
) {
}
