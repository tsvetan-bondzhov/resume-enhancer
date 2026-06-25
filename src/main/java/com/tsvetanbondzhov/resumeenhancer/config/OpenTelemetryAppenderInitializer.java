package com.tsvetanbondzhov.resumeenhancer.config;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Configuration;

/**
 * Installs the Spring-managed {@link OpenTelemetry} instance into the Logback
 * {@link OpenTelemetryAppender} declared in {@code logback-spring.xml}.
 *
 * <p>The starter ({@code spring-boot-starter-opentelemetry}) auto-configures the
 * OpenTelemetry SDK and an OTLP log exporter, but it does NOT wire the Logback
 * appender to that SDK. Until {@link OpenTelemetryAppender#install(OpenTelemetry)}
 * runs, the appender drops (buffers) log records and nothing reaches Loki. This
 * bean performs that one-time installation at startup.
 */
@Configuration
public class OpenTelemetryAppenderInitializer implements InitializingBean {

    private final OpenTelemetry openTelemetry;

    public OpenTelemetryAppenderInitializer(OpenTelemetry openTelemetry) {
        this.openTelemetry = openTelemetry;
    }

    @Override
    public void afterPropertiesSet() {
        OpenTelemetryAppender.install(this.openTelemetry);
    }
}
