package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.time.LocalDate;

public record EducationItem(
        String id,
        String institution,
        String degree,
        String fieldOfStudy,
        LocalDate startDate,
        LocalDate endDate
) implements ResumeItem {}
