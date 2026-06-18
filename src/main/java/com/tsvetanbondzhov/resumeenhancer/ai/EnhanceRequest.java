package com.tsvetanbondzhov.resumeenhancer.ai;

import jakarta.validation.constraints.NotBlank;

public record EnhanceRequest(
        @NotBlank String resumeId
) {}
