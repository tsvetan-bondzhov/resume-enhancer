package com.tsvetanbondzhov.resumeenhancer.common;

import com.tsvetanbondzhov.resumeenhancer.auth.InvalidCurrentPasswordException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeAccessDeniedException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeNotFoundException;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateNotFoundException;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateValidationException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authorization.AuthorizationDeniedException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    // Lines 32-34: handleInvalidCurrentPassword
    @Test
    void handleInvalidCurrentPassword_returns400WithMessage() {
        InvalidCurrentPasswordException ex = new InvalidCurrentPasswordException();
        ProblemDetail result = handler.handleInvalidCurrentPassword(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(result.getDetail()).isEqualTo("Current password is incorrect");
        assertThat(result.getTitle()).isEqualTo("Bad Request");
    }

    // Lines 75-80: handleFileValidation
    @Test
    void handleFileValidation_returns422WithMessage() {
        FileValidationException ex = new FileValidationException("File is too large");
        ProblemDetail result = handler.handleFileValidation(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY.value());
        assertThat(result.getDetail()).isEqualTo("File is too large");
        assertThat(result.getTitle()).isEqualTo("Unprocessable Entity");
    }

    // Lines 94-97: handleResumeNotFound
    @Test
    void handleResumeNotFound_returns404WithMessage() {
        ResumeNotFoundException ex = new ResumeNotFoundException("Resume not found");
        ProblemDetail result = handler.handleResumeNotFound(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(result.getDetail()).isEqualTo("Resume not found");
        assertThat(result.getTitle()).isEqualTo("Not Found");
    }

    // Lines 110-112: handleTemplateValidation (with URI instance)
    @Test
    void handleTemplateValidation_returns400WithRequestUri() {
        TemplateValidationException ex = new TemplateValidationException("Template is invalid");
        HttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/templates/validate");
        ProblemDetail result = handler.handleTemplateValidation(ex, request);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(result.getDetail()).isEqualTo("Template is invalid");
        assertThat(result.getInstance()).hasToString("/api/v1/templates/validate");
    }

    // Lines 132-138: handleException (generic fallback)
    @Test
    void handleException_returns500WithGenericMessage() {
        Exception ex = new RuntimeException("Unexpected failure");
        ProblemDetail result = handler.handleException(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
        assertThat(result.getDetail()).isEqualTo("An unexpected error occurred.");
        assertThat(result.getTitle()).isEqualTo("Internal Server Error");
    }

    // Also cover TemplateNotFoundException (lines not explicitly listed but handler at 102-105 may show as covered;
    // handleResumeAccessDenied is already partially tested but lines 94-97 are for ResumeNotFoundException)
    @Test
    void handleTemplateNotFound_returns404WithMessage() {
        TemplateNotFoundException ex = new TemplateNotFoundException("Template not found");
        ProblemDetail result = handler.handleTemplateNotFound(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(result.getDetail()).isEqualTo("Template not found");
        assertThat(result.getTitle()).isEqualTo("Not Found");
    }

    // AuthorizationDeniedException handling (lines 132-133 of handler body, actually 123-127)
    @Test
    void handleAuthorizationDenied_returns403WithAccessDeniedMessage() {
        AuthorizationDeniedException ex = new AuthorizationDeniedException("Access denied");
        ProblemDetail result = handler.handleAuthorizationDenied(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(result.getDetail()).isEqualTo("Access denied");
        assertThat(result.getTitle()).isEqualTo("Forbidden");
    }
}
