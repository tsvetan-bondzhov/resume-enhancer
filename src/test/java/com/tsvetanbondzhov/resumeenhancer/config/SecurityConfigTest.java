package com.tsvetanbondzhov.resumeenhancer.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.JwtAuthenticationFilter;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.ExceptionTranslationFilter;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link SecurityConfig}.
 *
 * <p>These tests build the <em>real</em> {@link SecurityFilterChain} from
 * {@link SecurityConfig#filterChain} so that the {@code authenticationEntryPoint}
 * and {@code accessDeniedHandler} lambdas (lines 39-54) are actually instantiated and
 * invoked, then extract those handlers from the configured
 * {@link ExceptionTranslationFilter} and exercise every branch directly.
 */
class SecurityConfigTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Builds a minimal {@link HttpSecurity} suitable for invoking the
     * {@link SecurityConfig#filterChain} bean in a plain unit test (no Spring context).
     */
    private HttpSecurity newHttpSecurity() {
        ObjectPostProcessor<Object> opp = new ObjectPostProcessor<>() {
            @Override
            public <O> O postProcess(O object) {
                return object;
            }
        };
        AuthenticationManagerBuilder amb = new AuthenticationManagerBuilder(opp);

        GenericApplicationContext context = new GenericApplicationContext();
        context.refresh();

        Map<Class<?>, Object> sharedObjects = new HashMap<>();
        sharedObjects.put(AuthenticationManager.class, mock(AuthenticationManager.class));
        sharedObjects.put(ApplicationContext.class, context);

        HttpSecurity http = new HttpSecurity(opp, amb, sharedObjects);
        http.setSharedObject(ApplicationContext.class, context);
        return http;
    }

    /**
     * Builds the real filter chain and returns the configured
     * {@link ExceptionTranslationFilter}, which holds the entry point and access denied handler.
     */
    private ExceptionTranslationFilter buildExceptionTranslationFilter() throws Exception {
        SecurityConfig config = new SecurityConfig();
        JwtAuthenticationFilter jwtFilter = mock(JwtAuthenticationFilter.class);
        SecurityFilterChain chain = config.filterChain(newHttpSecurity(), jwtFilter, objectMapper);

        for (Filter filter : chain.getFilters()) {
            if (filter instanceof ExceptionTranslationFilter etf) {
                return etf;
            }
        }
        throw new IllegalStateException("ExceptionTranslationFilter not found in chain");
    }

    private AccessDeniedHandler extractAccessDeniedHandler(ExceptionTranslationFilter etf) throws Exception {
        Field f = ExceptionTranslationFilter.class.getDeclaredField("accessDeniedHandler");
        f.setAccessible(true);
        return (AccessDeniedHandler) f.get(etf);
    }

    private AuthenticationEntryPoint extractEntryPoint(ExceptionTranslationFilter etf) throws Exception {
        Field f = ExceptionTranslationFilter.class.getDeclaredField("authenticationEntryPoint");
        f.setAccessible(true);
        return (AuthenticationEntryPoint) f.get(etf);
    }

    /**
     * Invokes the real {@code accessDeniedHandler} lambda (lines 46-54) when the response is
     * NOT committed: it should write a 403 JSON problem-detail body.
     */
    @Test
    void accessDeniedHandler_whenResponseNotCommitted_writes403Json() throws Exception {
        AccessDeniedHandler handler = extractAccessDeniedHandler(buildExceptionTranslationFilter());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(request, response, new AccessDeniedException("denied"));

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentType()).isEqualTo(MediaType.APPLICATION_JSON_VALUE);
        String body = response.getContentAsString();
        assertThat(body).contains("\"title\":\"Forbidden\"");
        assertThat(body).contains("\"detail\":\"Access denied\"");
    }

    /**
     * Invokes the real {@code accessDeniedHandler} lambda and exercises the committed branch
     * (line 47): when the response IS already committed the handler must do nothing.
     */
    @Test
    void accessDeniedHandler_whenResponseAlreadyCommitted_doesNothing() throws Exception {
        AccessDeniedHandler handler = extractAccessDeniedHandler(buildExceptionTranslationFilter());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = spy(new MockHttpServletResponse());
        when(response.isCommitted()).thenReturn(true);

        handler.handle(request, response, new AccessDeniedException("denied"));

        // Nothing written: status stays at the default and body is empty.
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentAsString()).isEmpty();
    }

    /**
     * Invokes the real {@code authenticationEntryPoint} lambda (lines 39-44):
     * it should write a 401 JSON problem-detail body.
     */
    @Test
    void authenticationEntryPoint_writes401Json() throws Exception {
        AuthenticationEntryPoint entryPoint = extractEntryPoint(buildExceptionTranslationFilter());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException authException = mock(AuthenticationException.class);

        entryPoint.commence(request, response, authException);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(response.getContentType()).isEqualTo(MediaType.APPLICATION_JSON_VALUE);
        String body = response.getContentAsString();
        assertThat(body).contains("\"title\":\"Unauthorized\"");
        assertThat(body).contains("\"detail\":\"Authentication required\"");
    }

    /**
     * Sanity check that the real chain wires the {@link JwtAuthenticationFilter} in.
     */
    @Test
    void filterChain_includesJwtAuthenticationFilter() throws Exception {
        SecurityConfig config = new SecurityConfig();
        JwtAuthenticationFilter jwtFilter = mock(JwtAuthenticationFilter.class);

        SecurityFilterChain chain = config.filterChain(newHttpSecurity(), jwtFilter, objectMapper);

        assertThat(chain.getFilters()).contains(jwtFilter);
    }

    /**
     * Verifies that the passwordEncoder bean returns a working BCryptPasswordEncoder.
     */
    @Test
    void passwordEncoder_returnsBCryptPasswordEncoder() {
        SecurityConfig config = new SecurityConfig();
        PasswordEncoder encoder = config.passwordEncoder();

        assertThat(encoder).isInstanceOf(BCryptPasswordEncoder.class);
        String encoded = encoder.encode("secret");
        assertThat(encoder.matches("secret", encoded)).isTrue();
        assertThat(encoder.matches("wrong", encoded)).isFalse();
    }
}
