package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CertificationRequest(
        @NotBlank(message = "Certification name is required")
        String name,
        String issuer,
        LocalDate issueDate,
        LocalDate expirationDate
) {}
