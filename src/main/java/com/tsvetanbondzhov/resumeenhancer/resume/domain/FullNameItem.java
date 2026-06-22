package com.tsvetanbondzhov.resumeenhancer.resume.domain;

public record FullNameItem(
        String id,
        String firstName,
        String lastName
) implements ResumeItem {}
