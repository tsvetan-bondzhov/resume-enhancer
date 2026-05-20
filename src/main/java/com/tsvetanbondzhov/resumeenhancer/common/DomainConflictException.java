package com.tsvetanbondzhov.resumeenhancer.common;

/**
 * Base exception for domain-level conflict errors (HTTP 409).
 * Domain-specific exceptions (e.g. EmailAlreadyExistsException) extend this class.
 * Handled globally by GlobalExceptionHandler — no cross-domain imports required there.
 */
public class DomainConflictException extends RuntimeException {

    public DomainConflictException(String message) {
        super(message);
    }
}
