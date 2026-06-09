package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import com.tsvetanbondzhov.resumeenhancer.profile.domain.LanguageProficiencyLevel;

public record LanguageDto(
        String name,
        LanguageProficiencyLevel proficiencyLevel
) {}
