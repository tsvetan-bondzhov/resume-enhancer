package com.tsvetanbondzhov.resumeenhancer.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TailorRequest(
        @NotBlank String resumeId,
        @NotBlank @Size(max = 10000) String jobDescription,
        @Size(min = 1, max = 36)
        @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        String conversationId
) {}
