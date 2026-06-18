package com.tsvetanbondzhov.resumeenhancer.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TailorRequest(
        @NotBlank String resumeId,
        @NotBlank @Size(max = 10000) String jobDescription
) {}
