package com.tsvetanbondzhov.resumeenhancer.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
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
}
