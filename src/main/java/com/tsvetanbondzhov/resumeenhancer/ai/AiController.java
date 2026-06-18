package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.opentelemetry.context.Context;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);
    private static final long SSE_TIMEOUT_MS = 120_000L; // 2 minutes

    private final AiService aiService;
    private final OllamaHealthGuard healthGuard;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AiController(AiService aiService, OllamaHealthGuard healthGuard, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.healthGuard = healthGuard;
        this.objectMapper = objectMapper;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<?> chat(@Valid @RequestBody ChatRequest request) {
        // AC2: OllamaHealthGuard checked first — before any AiService call
        if (!healthGuard.isAvailable()) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI features are temporarily unavailable");
            problem.setTitle("Service Unavailable");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        // AC3: Capture OTel context in the request thread for propagation into async thread
        Context otelContext = Context.current();

        executor.execute(() -> {
            // AC3: Explicit OTel context propagation — does NOT auto-propagate across async boundary
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamChat(request.prompt());
                Disposable disposable = tokenFlux.doOnNext(token -> {
                    try {
                        emitter.send(SseEmitter.event()
                                .name("token")
                                .data(objectMapper.writeValueAsString(Map.of("token", token))));
                    } catch (IOException e) {
                        log.warn("SSE send failed for token: {}", e.getMessage());
                        emitter.completeWithError(e);
                    }
                }).doOnComplete(() -> {
                    try {
                        emitter.send(SseEmitter.event()
                                .name("done")
                                .data(objectMapper.writeValueAsString(Map.of("summary", "Stream complete"))));
                        emitter.complete();
                    } catch (IOException e) {
                        emitter.completeWithError(e);
                    }
                }).doOnError(err -> {
                    // F4: log full error server-side; send generic message to client
                    log.warn("SSE stream error: {}", err.getMessage(), err);
                    try {
                        emitter.send(SseEmitter.event()
                                .name("error")
                                .data(objectMapper.writeValueAsString(Map.of("detail", "AI streaming error — please try again"))));
                    } catch (IOException ex) {
                        log.warn("SSE send failed for error event: {}", ex.getMessage());
                    }
                    emitter.completeWithError(err);
                }).subscribe();

                // F1: Register emitter lifecycle callbacks to cancel the Flux on client disconnect / timeout
                emitter.onCompletion(disposable::dispose);
                emitter.onTimeout(disposable::dispose);
                emitter.onError(e -> disposable.dispose());
            } catch (Exception e) {
                log.error("SSE emitter setup failed", e);
                emitter.completeWithError(e);
            }
        });

        return ResponseEntity.ok(emitter);
    }
}
