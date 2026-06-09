package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record ProjectRequest(
        @NotBlank(message = "Project name is required")
        String name,
        String description,
        String technologies,
        String link,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
