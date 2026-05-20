package com.tsvetanbondzhov.resumeenhancer.auth;

import com.tsvetanbondzhov.resumeenhancer.common.DomainConflictException;

public class EmailAlreadyExistsException extends DomainConflictException {

    public EmailAlreadyExistsException(String email) {
        super("An account with email '" + email + "' already exists.");
    }
}
