package com.tsvetanbondzhov.resumeenhancer.resume.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record CreateResumeRequest(
        @NotBlank String name,
        UUID templateId
) {
}
