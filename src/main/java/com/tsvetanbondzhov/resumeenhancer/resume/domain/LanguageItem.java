package com.tsvetanbondzhov.resumeenhancer.resume.domain;

public record LanguageItem(
        String id,
        String language,
        String proficiency
) implements ResumeItem {}
