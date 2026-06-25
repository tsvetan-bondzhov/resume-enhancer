package com.tsvetanbondzhov.resumeenhancer.admin;

import java.util.UUID;

/**
 * Thrown when an admin operation targets a user ID that does not exist.
 * Mapped to HTTP 404 {@code ProblemDetail} by {@code GlobalExceptionHandler}.
 */
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(UUID userId) {
        super("User not found: " + userId);
    }
}
