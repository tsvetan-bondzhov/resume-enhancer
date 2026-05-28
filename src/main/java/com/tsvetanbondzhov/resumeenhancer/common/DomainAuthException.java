package com.tsvetanbondzhov.resumeenhancer.common;

/**
 * Base exception for domain-level authentication errors (HTTP 401).
 * Domain-specific exceptions (e.g. InvalidCredentialsException) extend this class.
 * Handled globally by GlobalExceptionHandler — no cross-domain imports required there.
 */
public class DomainAuthException extends RuntimeException {

    public DomainAuthException(String message) {
        super(message);
    }
}
