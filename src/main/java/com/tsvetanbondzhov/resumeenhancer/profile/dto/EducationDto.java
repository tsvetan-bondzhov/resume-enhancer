package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record EducationDto(
        String institution,
        String degree,
        String fieldOfStudy,
        LocalDate startDate,
        LocalDate endDate
) {
}
