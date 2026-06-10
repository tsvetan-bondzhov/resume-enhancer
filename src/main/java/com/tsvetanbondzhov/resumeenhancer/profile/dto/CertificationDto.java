package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.time.LocalDate;

public record CertificationDto(
        String name,
        String issuer,
        LocalDate issueDate,
        LocalDate expirationDate
) {}
