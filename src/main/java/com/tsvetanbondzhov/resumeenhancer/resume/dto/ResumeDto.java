package com.tsvetanbondzhov.resumeenhancer.resume.dto;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;

import java.time.Instant;
import java.util.UUID;

public record ResumeDto(
        UUID id,
        String name,
        UUID templateId,
        ResumeDocument content,
        boolean isTailored,
        Instant createdAt,
        Instant updatedAt
) {
}
