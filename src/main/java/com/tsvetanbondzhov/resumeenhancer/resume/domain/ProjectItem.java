package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.time.LocalDate;

public record ProjectItem(
        String id,
        String name,
        String description,
        String technologies,
        String link,
        LocalDate startDate,
        LocalDate endDate,
        boolean isCurrent
) implements ResumeItem {}
