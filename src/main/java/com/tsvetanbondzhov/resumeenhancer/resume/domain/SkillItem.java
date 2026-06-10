package com.tsvetanbondzhov.resumeenhancer.resume.domain;

public record SkillItem(
        String id,
        String name,
        String category,
        String proficiency
) implements ResumeItem {}
