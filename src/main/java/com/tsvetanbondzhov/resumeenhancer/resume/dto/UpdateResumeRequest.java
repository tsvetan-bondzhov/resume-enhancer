package com.tsvetanbondzhov.resumeenhancer.resume.dto;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record UpdateResumeRequest(
        @NotBlank String name,
        @NotNull ResumeDocument content,
        UUID templateId   // nullable — null means "keep current"; omit @NotNull intentionally
) {}
