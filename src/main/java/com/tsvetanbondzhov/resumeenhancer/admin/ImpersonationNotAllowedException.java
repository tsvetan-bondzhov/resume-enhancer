package com.tsvetanbondzhov.resumeenhancer.admin;

import java.util.UUID;

/**
 * Thrown when an admin attempts to impersonate a user that is not eligible —
 * i.e. another admin or a deactivated account. Mapped to HTTP 409
 * {@code ProblemDetail} by {@code GlobalExceptionHandler}.
 */
public class ImpersonationNotAllowedException extends RuntimeException {

    public ImpersonationNotAllowedException(UUID userId) {
        super("User cannot be impersonated: " + userId);
    }
}
