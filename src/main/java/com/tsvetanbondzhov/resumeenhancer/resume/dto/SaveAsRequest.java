package com.tsvetanbondzhov.resumeenhancer.resume.dto;

import jakarta.validation.constraints.NotBlank;

public record SaveAsRequest(
        @NotBlank String name
) {
}
