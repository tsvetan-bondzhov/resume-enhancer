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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final DocumentPatchService documentPatchService;
    private final MessageWindowChatMemory chatMemory;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AiController(AiService aiService, OllamaHealthGuard healthGuard,
                        ObjectMapper objectMapper, ResumeService resumeService,
                        DocumentPatchService documentPatchService,
                        MessageWindowChatMemory chatMemory) {
        this.aiService = aiService;
        this.healthGuard = healthGuard;
        this.objectMapper = objectMapper;
        this.resumeService = resumeService;
        this.documentPatchService = documentPatchService;
        this.chatMemory = chatMemory;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<?> chat(@Valid @RequestBody ChatRequest request, Authentication authentication) {
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

        // Load the resume document once: used for prompt context and, when edits are
        // allowed, for validating any patch the model produces.
        ResumeDocument document = resolveResumeDocument(request.resumeId(), authentication);
        String resumeContext = document != null ? ResumeContextBuilder.buildResumeContext(document) : null;
        boolean allowEdits = request.allowEdits() && document != null;

        executor.execute(() -> {
            // Explicit OTel context propagation — does NOT auto-propagate across async boundary
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamChat(
                        request.prompt(), conversationId, chatMemory, resumeContext, allowEdits);
                Disposable disposable = allowEdits
                        ? buildPatchAwareDisposable(tokenFlux, emitter, document)
                        : buildChatDisposable(tokenFlux, emitter);

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

        String enhanceConversationId = request.conversationId() != null
                ? request.conversationId()
                : UUID.randomUUID().toString();

        executor.execute(() -> {
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamEnhance(document, enhanceConversationId, chatMemory);
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

        String tailorConversationId = request.conversationId() != null
                ? request.conversationId()
                : UUID.randomUUID().toString();

        executor.execute(() -> {
            try (var ignored = otelContext.makeCurrent()) {
                Flux<String> tokenFlux = aiService.streamTailor(document, request.jobDescription(), tailorConversationId, chatMemory);
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

    @DeleteMapping("/chat/{conversationId}")
    public ResponseEntity<Void> clearConversation(@PathVariable String conversationId) {
        aiService.clearConversation(conversationId, chatMemory);
        return ResponseEntity.noContent().build();
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private ResumeDocument resolveResumeDocument(String resumeId, Authentication authentication) {
        if (resumeId == null || authentication == null) {
            return null;
        }
        try {
            UUID id = UUID.fromString(resumeId);
            return resumeService.getResume(authentication.getName(), id).content();
        } catch (Exception e) {
            log.warn("Could not load resume for chat: {}", e.getMessage());
            return null;
        }
    }

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
        return buildLineBufferedDisposable(tokenFlux, emitter, null, "Enhancement complete");
    }

    /**
     * Chat disposable used when resume edits are allowed. Prose lines are streamed as
     * tokens; lines that parse as a patch are validated against the document and emitted
     * as complete (non-streamed) patch events. Invalid patches are discarded.
     */
    private Disposable buildPatchAwareDisposable(Flux<String> tokenFlux, SseEmitter emitter, ResumeDocument document) {
        return buildLineBufferedDisposable(tokenFlux, emitter, document, "Stream complete");
    }

    /**
     * Line-buffered SSE pipeline. Patch JSON lines are NEVER streamed as text tokens —
     * they are validated (against {@code document} when provided) and emitted as complete
     * patch events. All other lines stream to the chat panel as token events.
     */
    @SuppressWarnings("java:S3063")
    private Disposable buildLineBufferedDisposable(Flux<String> tokenFlux, SseEmitter emitter,
                                                   ResumeDocument document, String doneSummary) {
        StringBuilder lineBuffer = new StringBuilder();

        return tokenFlux.doOnNext(token -> {
            lineBuffer.append(token);
            int newlineIdx;
            while ((newlineIdx = lineBuffer.indexOf("\n")) >= 0) {
                String line = lineBuffer.substring(0, newlineIdx);
                lineBuffer.delete(0, newlineIdx + 1);
                emitLine(emitter, line, document);
            }
        }).doOnComplete(() -> {
            try {
                // Flush any remaining buffered content as a final line
                emitLine(emitter, lineBuffer.toString(), document);
                emitter.send(SseEmitter.event()
                        .name(EVENT_DONE)
                        .data(objectMapper.writeValueAsString(Map.of("summary", doneSummary))));
                emitter.complete();
            } catch (IOException e) {
                emitter.completeWithError(e);
            }
        }).doOnError(err -> {
            log.warn("SSE stream error: {}", err.getMessage(), err);
            trySendError(emitter);
            emitter.completeWithError(err);
        }).subscribe();
    }

    /**
     * Emits a single completed line: as a validated patch event if it parses as one,
     * otherwise as a streamed text token (preserving the trailing newline for prose).
     */
    private void emitLine(SseEmitter emitter, String line, ResumeDocument document) {
        String trimmed = line.trim();
        if (!trimmed.isEmpty() && tryEmitPatch(emitter, trimmed, document)) {
            return; // patch line — not streamed as text
        }
        if (line.isEmpty()) {
            return;
        }
        try {
            emitter.send(SseEmitter.event()
                    .name(EVENT_TOKEN)
                    .data(objectMapper.writeValueAsString(Map.of(EVENT_TOKEN, line + "\n"))));
        } catch (IOException e) {
            log.warn("SSE send failed for token: {}", e.getMessage());
            emitter.completeWithError(e);
        }
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

    /**
     * Attempts to parse {@code line} as a patch and emit it as a complete (non-streamed)
     * patch event. When a {@code document} is provided the patch is validated against the
     * real apply schema and discarded if invalid. Returns true when the line was a patch
     * (valid or invalid) so callers know not to stream it as text.
     */
    private boolean tryEmitPatch(SseEmitter emitter, String line, ResumeDocument document) {
        DocumentPatchEvent patch;
        try {
            patch = objectMapper.readValue(line, DocumentPatchEvent.class);
        } catch (JsonProcessingException e) {
            // Line is not patch JSON — treat as prose
            return false;
        }
        if (patch.sectionId() == null || patch.sectionId().isBlank()) {
            // Parsed JSON that is not a real patch (e.g. some other object) — treat as prose
            return false;
        }
        if (document != null && !documentPatchService.isValid(document, patch)) {
            log.debug("Discarding invalid patch from chat stream: {}", line);
            return true; // recognized as a patch attempt but invalid — discard, do not stream
        }
        try {
            emitter.send(SseEmitter.event()
                    .name("patch")
                    .data(objectMapper.writeValueAsString(patch)));
        } catch (IOException e) {
            log.warn("Failed to emit patch event: {}", e.getMessage());
        }
        return true;
    }
}
