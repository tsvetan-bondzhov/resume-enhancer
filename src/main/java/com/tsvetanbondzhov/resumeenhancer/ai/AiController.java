package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import io.opentelemetry.context.Context;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);
    private static final long SSE_TIMEOUT_MS = 120_000L; // 2 minutes
    private static final String EVENT_TOKEN = "token";
    private static final String EVENT_DONE = "done";
    private static final String EVENT_ERROR = "error";

    private final AiService aiService;
    private final OllamaHealthGuard healthGuard;
    private final ObjectMapper objectMapper;
    private final ResumeService resumeService;
    private final MessageWindowChatMemory chatMemory;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AiController(AiService aiService, OllamaHealthGuard healthGuard,
                        ObjectMapper objectMapper, ResumeService resumeService,
                        MessageWindowChatMemory chatMemory) {
        this.aiService = aiService;
        this.healthGuard = healthGuard;
        this.objectMapper = objectMapper;
        this.resumeService = resumeService;
        this.chatMemory = chatMemory;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<?> chat(@Valid @RequestBody ChatRequest request) {
        // AC8: OllamaHealthGuard checked first — before any AiService call
        if (!healthGuard.isAvailable()) {
            return unavailableResponse();
        }

        // AC7: Generate or reuse conversationId for memory scoping (AC4: new session = new UUID)
        String conversationId = request.conversationId() != null
                ? request.conversationId()
                : UUID.randomUUID().toString();

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        // Capture OTel context in the request thread for propagation into async thread
        Context otelContext = Context.current();

        executor.execute(() -> {
            // Explicit OTel context propagation — does NOT auto-propagate across async boundary
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamChat(request.prompt(), conversationId, chatMemory);
                Disposable disposable = buildChatDisposable(tokenFlux, emitter);

                // Register emitter lifecycle callbacks to cancel the Flux on client disconnect / timeout
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

    @PostMapping(value = "/enhance", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<?> enhance(@Valid @RequestBody EnhanceRequest request,
                                     Authentication authentication) {
        // AC2: OllamaHealthGuard checked first
        if (!healthGuard.isAvailable()) {
            return unavailableResponse();
        }

        // Load resume and verify ownership — same pattern as ResumeController
        UUID resumeId = UUID.fromString(request.resumeId());
        ResumeDocument document = resumeService.getResume(authentication.getName(), resumeId).content();

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Context otelContext = Context.current();

        executor.execute(() -> {
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamEnhance(document);
                Disposable disposable = buildEnhanceDisposable(tokenFlux, emitter);

                emitter.onCompletion(disposable::dispose);
                emitter.onTimeout(disposable::dispose);
                emitter.onError(e -> disposable.dispose());
            } catch (Exception e) {
                log.error("SSE enhance emitter setup failed", e);
                emitter.completeWithError(e);
            }
        });

        return ResponseEntity.ok(emitter);
    }

    @PostMapping(value = "/tailor", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<?> tailor(@Valid @RequestBody TailorRequest request,
                                    Authentication authentication) {
        if (!healthGuard.isAvailable()) {
            return unavailableResponse();
        }

        UUID resumeId = UUID.fromString(request.resumeId());
        ResumeDocument document = resumeService.getResume(authentication.getName(), resumeId).content();

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Context otelContext = Context.current();

        executor.execute(() -> {
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamTailor(document, request.jobDescription());
                Disposable disposable = buildEnhanceDisposable(tokenFlux, emitter);

                emitter.onCompletion(disposable::dispose);
                emitter.onTimeout(disposable::dispose);
                emitter.onError(e -> disposable.dispose());
            } catch (Exception e) {
                log.error("SSE tailor emitter setup failed", e);
                emitter.completeWithError(e);
            }
        });

        return ResponseEntity.ok(emitter);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private ResponseEntity<?> unavailableResponse() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE,
                "AI features are temporarily unavailable");
        problem.setTitle("Service Unavailable");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
    }

    private Disposable buildChatDisposable(Flux<String> tokenFlux, SseEmitter emitter) {
        return tokenFlux.doOnNext(token -> {
            try {
                emitter.send(SseEmitter.event()
                        .name(EVENT_TOKEN)
                        .data(objectMapper.writeValueAsString(Map.of(EVENT_TOKEN, token))));
            } catch (IOException e) {
                log.warn("SSE send failed for token: {}", e.getMessage());
                emitter.completeWithError(e);
            }
        }).doOnComplete(() -> {
            try {
                emitter.send(SseEmitter.event()
                        .name(EVENT_DONE)
                        .data(objectMapper.writeValueAsString(Map.of("summary", "Stream complete"))));
                emitter.complete();
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        }).doOnError(err -> {
            // F4: log full error server-side; send generic message to client
            log.warn("SSE stream error: {}", err.getMessage(), err);
            trySendError(emitter);
            emitter.completeWithError(err);
        }).subscribe();
    }

    @SuppressWarnings("java:S3063")
    private Disposable buildEnhanceDisposable(Flux<String> tokenFlux, SseEmitter emitter) {
        StringBuilder lineBuffer = new StringBuilder();

        return tokenFlux.doOnNext(token -> {
            try {
                // Forward raw token to chat panel (narration)
                emitter.send(SseEmitter.event()
                        .name(EVENT_TOKEN)
                        .data(objectMapper.writeValueAsString(Map.of(EVENT_TOKEN, token))));

                // Accumulate tokens to detect complete patch JSON lines
                lineBuffer.append(token);
                int newlineIdx;
                while ((newlineIdx = lineBuffer.indexOf("\n")) >= 0) {
                    String line = lineBuffer.substring(0, newlineIdx).trim();
                    lineBuffer.delete(0, newlineIdx + 1);
                    if (!line.isEmpty()) {
                        tryEmitPatch(emitter, line);
                    }
                }
            } catch (IOException e) {
                log.warn("SSE send failed for token: {}", e.getMessage());
                emitter.completeWithError(e);
            }
        }).doOnComplete(() -> {
            try {
                // Flush any remaining buffered content
                String remaining = lineBuffer.toString().trim();
                if (!remaining.isEmpty()) {
                    tryEmitPatch(emitter, remaining);
                }
                emitter.send(SseEmitter.event()
                        .name(EVENT_DONE)
                        .data(objectMapper.writeValueAsString(
                                Map.of("summary", "Enhancement complete"))));
                emitter.complete();
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        }).doOnError(err -> {
            log.warn("SSE enhance stream error: {}", err.getMessage(), err);
            trySendError(emitter);
            emitter.completeWithError(err);
        }).subscribe();
    }

    private void trySendError(SseEmitter emitter) {
        try {
            emitter.send(SseEmitter.event()
                    .name(EVENT_ERROR)
                    .data(objectMapper.writeValueAsString(
                            Map.of("detail", "AI streaming error — please try again"))));
        } catch (IOException ex) {
            log.warn("SSE send failed for error event: {}", ex.getMessage());
        }
    }

    private void tryEmitPatch(SseEmitter emitter, String line) {
        try {
            // Attempt to parse as DocumentPatchEvent
            DocumentPatchEvent patch = objectMapper.readValue(line, DocumentPatchEvent.class);
            emitter.send(SseEmitter.event()
                    .name("patch")
                    .data(objectMapper.writeValueAsString(patch)));
        } catch (JsonProcessingException e) {
            // Line is not a valid patch JSON — skip silently (may be partial token or prose)
            log.debug("Skipping non-patch line from enhance stream: {}", line);
        } catch (IOException e) {
            log.warn("Failed to emit patch event: {}", e.getMessage());
        }
    }
}
