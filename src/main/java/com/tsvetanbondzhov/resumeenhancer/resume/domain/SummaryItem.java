package com.tsvetanbondzhov.resumeenhancer.resume.domain;

public record SummaryItem(
        String id,
        String text
) implements ResumeItem {}
