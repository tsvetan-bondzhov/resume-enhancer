package com.tsvetanbondzhov.resumeenhancer.common;

import com.tsvetanbondzhov.resumeenhancer.ai.InvalidPatchException;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
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
import org.springframework.http.converter.HttpMessageNotReadableException;
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

    // Lines 135-137: handleDateParse
    @Test
    void handleDateParse_returns400WithMessage() {
        DateParseException ex = new DateParseException("Unsupported date format: '31-12-2024'");
        ProblemDetail result = handler.handleDateParse(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(result.getDetail()).isEqualTo("Unsupported date format: '31-12-2024'");
        assertThat(result.getTitle()).isEqualTo("Bad Request");
    }

    // Lines 145-150: handleNotReadable — DateParseException in cause chain
    @Test
    void handleNotReadable_withDateParseExceptionInCause_returns400WithDateParseMessage() {
        DateParseException dpe = new DateParseException("Bad date value");
        RuntimeException wrapper = new RuntimeException("Jackson mapping error", dpe);
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException("Not readable", wrapper, null);

        ProblemDetail result = handler.handleNotReadable(ex);

        assertThat(result.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(result.getDetail()).isEqualTo("Bad date value");
        assertThat(result.getTitle()).isEqualTo("Bad Request");
    }

    // Lines 154-158: handleNotReadable — no DateParseException in cause chain (fallback path)
    @Test
    void handleNotReadable_withoutDateParseException_returns400WithMalformedBody() {
        RuntimeException cause = new RuntimeException("Some other parse error");
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException("Not readable", cause, null);

        ProblemDetail result = handler.handleNotReadable(ex);

        assertThat(result.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(result.getDetail()).isEqualTo("Malformed request body.");
        assertThat(result.getTitle()).isEqualTo("Bad Request");
    }

    // Lines 178-183: handleOllamaUnavailable
    @Test
    void handleOllamaUnavailable_returns503WithGenericMessage() {
        OllamaUnavailableException ex = new OllamaUnavailableException("Ollama is down");
        ProblemDetail result = handler.handleOllamaUnavailable(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE.value());
        assertThat(result.getDetail()).isEqualTo("AI features are temporarily unavailable");
        assertThat(result.getTitle()).isEqualTo("Service Unavailable");
    }

    // Lines 188-191: handleInvalidPatch
    @Test
    void handleInvalidPatch_returns422WithMessage() {
        InvalidPatchException ex = new InvalidPatchException("Patch field 'summary' is invalid");
        ProblemDetail result = handler.handleInvalidPatch(ex);
        assertThat(result.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY.value());
        assertThat(result.getDetail()).isEqualTo("Patch field 'summary' is invalid");
        assertThat(result.getTitle()).isEqualTo("Unprocessable Entity");
    }
}
