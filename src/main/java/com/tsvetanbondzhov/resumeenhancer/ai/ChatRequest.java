package com.tsvetanbondzhov.resumeenhancer.ai;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(
        @NotBlank String prompt,
        String resumeId  // nullable — future AI context enrichment; not validated here
) {}
