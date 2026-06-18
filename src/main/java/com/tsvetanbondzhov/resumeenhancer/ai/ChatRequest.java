package com.tsvetanbondzhov.resumeenhancer.ai;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(@NotBlank String prompt) {}
