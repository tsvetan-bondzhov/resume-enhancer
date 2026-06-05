package com.tsvetanbondzhov.resumeenhancer.resume.dto;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateResumeRequest(
        @NotBlank String name,
        @NotNull ResumeDocument content
) {}
