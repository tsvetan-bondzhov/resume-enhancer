package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.time.LocalDate;

public record WorkExperienceItem(
        String id,
        String jobTitle,
        String company,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent,
        String description
) implements ResumeItem {}
