package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.auth.TokenService;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.SdkTracerProviderBuilderCustomizer;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

/**
 * Integration test proving OpenTelemetry span context propagates across the SSE async
 * boundary (AC2, AC3, AC5). A custom in-memory {@link SpanExporter} is registered via an
 * {@link SdkTracerProviderBuilderCustomizer} bean (the project does not pull in
 * {@code opentelemetry-sdk-testing}). The test asserts the async child span
 * {@code ai.sse.chat} is NOT a root span and shares the SAME {@code traceId} as the HTTP
 * server span — i.e. the request-thread trace continues into the async SSE thread.
 */
@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Import(AiControllerIntegrationTest.IntegrationTestConfig.class)
class AiControllerIntegrationTest {

    /** Collects every exported span in-memory so the test can assert on the trace tree. */
    static final class CollectingSpanExporter implements SpanExporter {
        private final List<SpanData> spans = new CopyOnWriteArrayList<>();

        @Override
        public CompletableResultCode export(Collection<SpanData> collection) {
            spans.addAll(collection);
            return CompletableResultCode.ofSuccess();
        }

        @Override
        public CompletableResultCode flush() {
            return CompletableResultCode.ofSuccess();
        }

        @Override
        public CompletableResultCode shutdown() {
            return CompletableResultCode.ofSuccess();
        }

        List<SpanData> spans() {
            return new ArrayList<>(spans);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class IntegrationTestConfig {
        @Bean
        @ServiceConnection
        PostgreSQLContainer postgresContainer() {
            return new PostgreSQLContainer(DockerImageName.parse("postgres:16"));
        }

        @Bean
        CollectingSpanExporter collectingSpanExporter() {
            return new CollectingSpanExporter();
        }

        @Bean
        SdkTracerProviderBuilderCustomizer testSpanExporterCustomizer(CollectingSpanExporter exporter) {
            return builder -> builder.addSpanProcessor(SimpleSpanProcessor.create(exporter));
        }
    }

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CollectingSpanExporter spanExporter;

    // SSE streaming must not depend on a live model — stub AiService.
    @MockitoBean
    private AiService aiService;

    // Always-available so the controller proceeds past the OllamaHealthGuard check.
    @MockitoBean
    private OllamaHealthGuard healthGuard;

    private String userToken;

    private WebTestClient webTestClient() {
        return WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .responseTimeout(Duration.ofSeconds(10))
                .build();
    }

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        User user = new User();
        user.setEmail("trace@example.com");
        user.setRole("USER");
        user.setEnabled(true);
        user.setPasswordHash(passwordEncoder.encode("Password1"));
        user = userRepository.save(user);
        userToken = tokenService.generateToken(user);
    }

    @Test
    void chat_asyncSseSpan_sharesTraceIdWithHttpRequestSpan() {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(), any(), anyBoolean()))
                .thenReturn(Flux.just("Hello from the model\n"));

        ChatRequest request = new ChatRequest("Say hello", null, null, false);

        // Drive the SSE stream so token + done events are emitted and the child span ends
        // (doFinally -> span.end()), making it available to the in-memory exporter. The SSE
        // connection close after completion surfaces as a PrematureCloseException on the
        // client body; that is expected for an SseEmitter stream and is intentionally
        // tolerated — the span assertions below (via awaitility) are the real verification.
        webTestClient().post()
                .uri("/api/v1/ai/chat")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(request)
                .exchange()
                .expectStatus().isOk()
                .returnResult(String.class)
                .getResponseBody()
                .onErrorComplete()
                .blockLast(Duration.ofSeconds(10));

        // SimpleSpanProcessor exports on span end; the async span ends slightly after the
        // HTTP response body completes, so poll until the child SSE span is captured.
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            Optional<SpanData> sseSpan = spanExporter.spans().stream()
                    .filter(s -> "ai.sse.chat".equals(s.getName()))
                    .findFirst();
            assertThat(sseSpan)
                    .as("async SSE child span 'ai.sse.chat' should be exported")
                    .isPresent();

            SpanData span = sseSpan.get();
            // AC2: the SSE span must be a CHILD, not an orphaned/new root.
            assertThat(span.getParentSpanContext().isValid())
                    .as("'ai.sse.chat' must have a valid parent span (not a new root trace)")
                    .isTrue();

            // AC3/AC5: the async child span shares the SAME traceId as the HTTP server span.
            String sseTraceId = span.getTraceId();
            boolean sharesTraceWithServerSpan = spanExporter.spans().stream()
                    .anyMatch(s -> !"ai.sse.chat".equals(s.getName())
                            && sseTraceId.equals(s.getTraceId()));
            assertThat(sharesTraceWithServerSpan)
                    .as("HTTP-thread span and async SSE span must share one traceId %s", sseTraceId)
                    .isTrue();
        });
    }
}
