package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record WorkExperienceDto(
        String jobTitle,
        String company,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent,
        String description
) {
}
