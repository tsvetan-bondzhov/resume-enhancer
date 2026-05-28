package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.common.DomainAuthException;

public class InvalidCredentialsException extends DomainAuthException {

    public InvalidCredentialsException() {
        super("Invalid email or password");
    }
}
