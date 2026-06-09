package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record ProjectDto(
        String name,
        String description,
        String technologies,
        String link,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) {}
