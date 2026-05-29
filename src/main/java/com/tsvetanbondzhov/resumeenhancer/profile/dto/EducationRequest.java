package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record EducationRequest(
        @NotBlank(message = "Institution is required")
        String institution,

        String degree,
        String fieldOfStudy,
        LocalDate startDate,
        LocalDate endDate
) {
}
