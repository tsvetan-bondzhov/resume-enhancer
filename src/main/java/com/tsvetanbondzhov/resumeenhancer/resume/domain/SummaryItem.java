package com.tsvetanbondzhov.resumeenhancer.resume.domain;

public record SummaryItem(
        String id,
        String text,
        String linkedInUrl,
        String personalPageUrl,
        String blogUrl,
        String contactEmail,
        String locationCountry,
        String locationCity
) implements ResumeItem {}
