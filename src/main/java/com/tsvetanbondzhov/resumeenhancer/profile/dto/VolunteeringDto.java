package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record VolunteeringDto(
        String role,
        String organization,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
