package com.tsvetanbondzhov.resumeenhancer.common;

import com.tsvetanbondzhov.resumeenhancer.auth.InvalidCurrentPasswordException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeAccessDeniedException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeNotFoundException;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateNotFoundException;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateValidationException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String BAD_REQUEST = BAD_REQUEST;

    @ExceptionHandler(InvalidCurrentPasswordException.class)
    public ProblemDetail handleInvalidCurrentPassword(InvalidCurrentPasswordException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle(BAD_REQUEST);
        return problem;
    }

    @ExceptionHandler(DomainAuthException.class)
    public ProblemDetail handleDomainAuth(DomainAuthException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED,
                ex.getMessage()
        );
        problem.setTitle("Unauthorized");
        return problem;
    }

    @ExceptionHandler(DomainConflictException.class)
    public ProblemDetail handleDomainConflict(DomainConflictException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                ex.getMessage()
        );
        problem.setTitle("Conflict");
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, List<String>> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(fieldError.getField(), k -> new ArrayList<>())
                    .add(fieldError.getDefaultMessage());
        }
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "Request validation failed"
        );
        problem.setTitle(BAD_REQUEST);
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(FileValidationException.class)
    public ProblemDetail handleFileValidation(FileValidationException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNPROCESSABLE_ENTITY,
                ex.getMessage()
        );
        problem.setTitle("Unprocessable Entity");
        return problem;
    }

    @ExceptionHandler(ResumeAccessDeniedException.class)
    public ProblemDetail handleResumeAccessDenied(ResumeAccessDeniedException ex) {
        log.warn("Resume access denied for request");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, ex.getMessage());
        problem.setTitle("Forbidden");
        return problem;
    }

    @ExceptionHandler(ResumeNotFoundException.class)
    public ProblemDetail handleResumeNotFound(ResumeNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Not Found");
        return problem;
    }

    @ExceptionHandler(TemplateNotFoundException.class)
    public ProblemDetail handleTemplateNotFound(TemplateNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Not Found");
        return problem;
    }

    @ExceptionHandler(TemplateValidationException.class)
    public ProblemDetail handleTemplateValidation(TemplateValidationException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setInstance(URI.create(request.getRequestURI()));
        return pd;
    }

    /**
     * Handles date strings that do not match any accepted format.
     * {@link DateParseException} is thrown by {@link FlexibleLocalDateDeserializer} and wrapped
     * by Jackson inside {@link HttpMessageNotReadableException} with an {@link InvalidFormatException}
     * as the cause.  Both paths are caught here and surfaced as HTTP 400 with a user-friendly message.
     */
    @ExceptionHandler(DateParseException.class)
    public ProblemDetail handleDateParse(DateParseException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle(BAD_REQUEST);
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleNotReadable(HttpMessageNotReadableException ex) {
        // Walk the cause chain to surface DateParseException with a user-friendly message.
        // Jackson wraps RuntimeExceptions from deserializers in JsonMappingException, which
        // Spring wraps in HttpMessageNotReadableException.
        Throwable t = ex.getCause();
        while (t != null) {
            if (t instanceof DateParseException dpe) {
                ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, dpe.getMessage());
                problem.setTitle(BAD_REQUEST);
                return problem;
            }
            t = t.getCause();
        }
        log.warn("Unreadable HTTP message", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Malformed request body.");
        problem.setTitle(BAD_REQUEST);
        return problem;
    }

    /**
     * Handles Spring Security method-level authorization failures ({@code @PreAuthorize}).
     * {@link AuthorizationDeniedException} is thrown inside the MVC dispatch layer (post-filter)
     * and must be caught here — it never reaches {@code ExceptionTranslationFilter}.
     * Filter-chain access denials are handled separately via {@code SecurityConfig.accessDeniedHandler}.
     */
    @ExceptionHandler(AuthorizationDeniedException.class)
    public ProblemDetail handleAuthorizationDenied(AuthorizationDeniedException ex) {
        log.warn("Authorization denied");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, "Access denied");
        problem.setTitle("Forbidden");
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleException(Exception ex) {
        log.error("Unhandled exception", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred."
        );
        problem.setTitle("Internal Server Error");
        return problem;
    }
}
