package com.tsvetanbondzhov.resumeenhancer.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * SPA fallback: serve static assets from classpath:/static/ and fall back to
 * index.html for client-side routes. Registered as a resource handler at the
 * lowest precedence, so it does NOT intercept Spring MVC mappings such as
 * /api/**, /swagger-ui/**, /v3/api-docs/**, /webjars/**, or /actuator/**.
 * Returns null (-> 404) when index.html is not yet built (e.g. before the
 * frontend module exists), avoiding any forward-loop risk.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
            .addResourceLocations("classpath:/static/")
            .resourceChain(true)
            .addResolver(new PathResourceResolver() {
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
            });
    }

}
