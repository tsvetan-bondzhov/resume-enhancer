package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.common.DomainAuthException;

/**
 * Thrown during login when a user's account has been deactivated
 * ({@code enabled == false}). Maps to HTTP 401 via the existing
 * {@code GlobalExceptionHandler.handleDomainAuth} handler.
 */
public class AccountDeactivatedException extends DomainAuthException {

    public AccountDeactivatedException() {
        super("Account is deactivated");
    }
}
