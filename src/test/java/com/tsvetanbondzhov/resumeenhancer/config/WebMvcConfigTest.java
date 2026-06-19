package com.tsvetanbondzhov.resumeenhancer.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.resource.PathResourceResolver;
import org.springframework.web.servlet.resource.ResourceResolverChain;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Unit tests for the anonymous {@code PathResourceResolver} registered by {@link WebMvcConfig}.
 *
 * <p>Since the resolver is an anonymous class created inside
 * {@link WebMvcConfig#addResourceHandlers}, we exercise the same logic by creating a
 * concrete subclass with the same {@code getResource()} override.
 *
 * <p>Covered code paths:
 * <ul>
 *   <li>Line 31-33: resource exists and is readable → return it directly</li>
 *   <li>Lines 35-36: path starts with "api/" → return null</li>
 *   <li>Line 38-39: client-side route, index.html present → return index.html</li>
 * </ul>
 *
 * <p>A minimal {@code static/index.html} lives under
 * {@code src/test/resources/static/} to satisfy the classpath lookup.
 */
class WebMvcConfigTest {

    /**
     * Concrete subclass that mirrors the anonymous PathResourceResolver in WebMvcConfig.
     */
    static class SpaFallbackResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (requested.exists() && requested.isReadable()) {
                return requested;
            }
            if (resourcePath.startsWith("api/")) {
                return null;
            }
            Resource indexHtml = new ClassPathResource("static/index.html");
            return indexHtml.exists() ? indexHtml : null;
        }
    }

    private SpaFallbackResolver resolver;
    private Resource staticLocation;

    @BeforeEach
    void setUp() {
        resolver = new SpaFallbackResolver();
        staticLocation = new ClassPathResource("static/");
    }

    @Test
    void existingStaticFile_isReturnedDirectly() throws IOException {
        // index.html lives in src/test/resources/static/ — it exists and is readable
        Resource result = resolver.getResource("index.html", staticLocation);

        assertThat(result).isNotNull();
        assertThat(result.exists()).isTrue();
    }

    @Test
    void apiPath_returnsNull() throws IOException {
        // Covers line 35-36: resourcePath.startsWith("api/") → return null
        Resource result = resolver.getResource("api/v1/some-endpoint", staticLocation);

        assertThat(result).isNull();
    }

    @Test
    void spaClientSideRoute_fallsBackToIndexHtml() throws IOException {
        // A path that doesn't exist as a static file falls back to index.html
        // Covers lines 38-39: ClassPathResource("static/index.html") exists → return it
        Resource result = resolver.getResource("some-client-side-route", staticLocation);

        assertThat(result).isNotNull();
        assertThat(result.exists()).isTrue();
        // Should be the index.html resource
        assertThat(result.getFilename()).isEqualTo("index.html");
    }

    @Test
    void spaRoute_whenIndexHtmlAbsent_returnsNull() throws IOException {
        // When index.html does not exist in classpath, fallback returns null
        // We simulate this by using a location where no file exists matching the request
        // and a resolver variant that checks a non-existent path.
        // We use a custom location that has no files to simulate missing index.html scenario:
        // The classpath:/static-missing/ does not exist, so the resolver returns null.
        SpaFallbackResolver resolverWithMissingIndex = new SpaFallbackResolver() {
            @Override
            protected Resource getResource(String resourcePath, Resource location) throws IOException {
                Resource requested = location.createRelative(resourcePath);
                if (requested.exists() && requested.isReadable()) {
                    return requested;
                }
                if (resourcePath.startsWith("api/")) {
                    return null;
                }
                Resource indexHtml = new ClassPathResource("static-missing/index.html");
                return indexHtml.exists() ? indexHtml : null;
            }
        };

        Resource result = resolverWithMissingIndex.getResource("some-route", staticLocation);

        assertThat(result).isNull();
    }

    // ─── Integration tests via MockMvc — exercises the real WebMvcConfig anonymous resolver ───

    /**
     * Minimal Spring MVC context that wires {@link WebMvcConfig} so the real
     * anonymous {@link PathResourceResolver} is instantiated and invoked through
     * the resource handler chain.
     */
    @Configuration
    @EnableWebMvc
    static class TestWebMvcConfig extends WebMvcConfig {
        // inherits addResourceHandlers — no override needed
    }

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        AnnotationConfigWebApplicationContext ctx = new AnnotationConfigWebApplicationContext();
        ctx.register(TestWebMvcConfig.class);
        ctx.setServletContext(new MockServletContext());
        ctx.refresh();
        mockMvc = MockMvcBuilders.webAppContextSetup(ctx).build();
    }

    @Test
    void realWebMvcConfig_existingStaticFile_returns200() throws Exception {
        // classpath:/static/index.html exists (src/test/resources/static/index.html)
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk());
    }

    @Test
    void realWebMvcConfig_apiPath_returns404() throws Exception {
        // api/ paths are not served as static resources → resolver returns null → 404
        mockMvc.perform(get("/api/v1/some-endpoint"))
                .andExpect(status().isNotFound());
    }

    @Test
    void realWebMvcConfig_spaClientSideRoute_fallsBackToIndexHtml() throws Exception {
        // SPA route that doesn't exist as a file → falls back to index.html → 200
        mockMvc.perform(get("/some-spa-route"))
                .andExpect(status().isOk());
    }
}
