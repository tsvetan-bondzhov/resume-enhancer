package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.time.LocalDate;

public record VolunteeringItem(
        String id,
        String role,
        String organization,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) implements ResumeItem {}
