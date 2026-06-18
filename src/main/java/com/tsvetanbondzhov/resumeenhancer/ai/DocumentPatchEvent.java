package com.tsvetanbondzhov.resumeenhancer.ai;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record DocumentPatchEvent(
        @NotBlank String sectionId,
        @Min(0) int itemIndex,
        @NotBlank String field,
        String newValue
) {}
