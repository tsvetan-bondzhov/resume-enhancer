package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import java.util.List;

public record ParsedResumeDto(
        String rawText,
        List<String> workExperienceLines,
        List<String> educationLines,
        List<String> skillLines
) {}
