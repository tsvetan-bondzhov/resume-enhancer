package com.tsvetanbondzhov.resumeenhancer.resume.domain;

public record SkillItem(
        String id,
        String name
) implements ResumeItem {}
