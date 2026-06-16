package com.tsvetanbondzhov.resumeenhancer.common;

/**
 * Thrown when a date string supplied by the client does not match any accepted format.
 * Handled globally by {@link GlobalExceptionHandler}, which returns HTTP 400 with a
 * user-friendly message listing the accepted formats.
 */
public class DateParseException extends RuntimeException {

    public DateParseException(String message) {
        super(message);
    }
}
