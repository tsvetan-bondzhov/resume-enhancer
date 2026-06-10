package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import java.time.LocalDate;

public record CertificationItem(
        String id,
        String name,
        String issuer,
        LocalDate issueDate,
        LocalDate expirationDate
) implements ResumeItem {}
