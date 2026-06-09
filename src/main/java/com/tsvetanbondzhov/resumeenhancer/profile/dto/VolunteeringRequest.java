package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record VolunteeringRequest(
        @NotBlank(message = "Role is required")
        String role,
        @NotBlank(message = "Organization is required")
        String organization,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
