# AI Streaming Spike Findings — Story 5.1

**Date:** 2026-06-18
**Story:** 5-1-ai-streaming-spike-spring-ai-ollama-sse-end-to-end

---

## Ollama Model

The Ollama container is defined in `compose.yaml`. The model to use is configured via `spring.ai.ollama.chat.options.model` in `application.properties` / `application.yml`.

To verify a model is available:
```bash
docker compose exec ollama ollama list
```

To pull a model (e.g. llama3.2):
```bash
docker compose exec ollama ollama pull llama3.2
```

The spike was designed to work with any model available in the running Ollama container.

---

## Spring AI 2.0.0-M6 Streaming API

The streaming API surface used in this spike:

```java
// Streaming (returns Flux<String>)
chatClient.prompt()
    .user(String text)   // plain String overload
    .stream()            // returns StreamResponseSpec
    .content()           // returns Flux<String>

// Blocking (existing, unchanged — used by extractResumeSection)
chatClient.prompt()
    .user(Consumer<UserSpec>)  // consumer overload
    .call()                    // returns CallResponseSpec
    .content()                 // returns String
```

Key distinction between `ChatClientRequestSpec.user()` overloads:
- `.user(String text)` — plain text shorthand (used by `streamChat`)
- `.user(Consumer<UserSpec> user)` — full consumer for multi-modal / template use (used by `extractResumeSection`)

Both overloads return `ChatClientRequestSpec` and are valid in 2.0.0-M6.

---

## SseEmitter + Virtual Thread Executor Pattern

The servlet stack (`spring-boot-starter-webmvc`) does not support reactive endpoints. The pattern used:

1. `@PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)` returns `ResponseEntity<SseEmitter>`
2. An `ExecutorService` using `Executors.newVirtualThreadPerTaskExecutor()` handles the async emission
3. The `Flux<String>` from Spring AI is subscribed inside the virtual thread
4. `doOnNext` / `doOnComplete` / `doOnError` operators send named SSE events via `SseEmitter`

This is the correct approach for the servlet stack. Do NOT use `@Async` or WebFlux for this purpose.

---

## EventSource GET-Only Limitation and fetch+ReadableStream Workaround

**Constraint discovered:** Native browser `EventSource` API only supports GET requests and does not allow custom headers (including `Authorization: Bearer <token>`).

**Impact:** The production endpoint `POST /api/v1/ai/chat` cannot be consumed directly by `EventSource` because:
1. It requires a POST body with `{"prompt": "..."}`
2. It requires a JWT `Authorization` header for authentication

**Resolution for spike test harness (`AiTestPage.tsx`):**
The test harness uses `fetch` + `ReadableStream` with manual SSE line parsing. This supports POST bodies and custom headers.

**Production path (Story 5.3):** The ChatPanel will use the same `fetch`+`ReadableStream` approach, not the `lib/sseClient.ts` `EventSource`-based library. The `sseClient.ts` `createSseConnection` function remains valid for future use cases where a GET-based SSE endpoint is appropriate (e.g. server push notifications).

---

## OpenTelemetry Context Propagation Requirement

Spring Boot's OpenTelemetry auto-instrumentation does NOT propagate trace context automatically across thread/async boundaries.

**Required pattern** (implemented in `AiController`):
```java
// In the request thread — capture current OTel context
Context otelContext = Context.current();

executor.execute(() -> {
    // In the async thread — restore context before creating spans
    try (var ignored = otelContext.makeCurrent()) {
        // All OTel spans created here are children of the original HTTP request span
        // The trace ID appears in logs for both HTTP request and async SSE emission
    }
});
```

Without `otelContext.makeCurrent()`, the async thread runs in the background span context, breaking distributed trace correlation.

---

## Confirmed SSE Event Types

The spike confirmed the following event types and payload shapes:

| Event | Payload | Description |
|-------|---------|-------------|
| `token` | `{"token": "chunk text"}` | One streaming token chunk from Ollama |
| `done` | `{"summary": "Stream complete"}` | Stream finished successfully |
| `error` | `{"detail": "error message"}` | Stream failed or Ollama error |
| `patch` | `{"sectionId": "...", "itemIndex": 0, "field": "...", "newValue": "..."}` | Document mutation (wired in Story 5.2, not emitted in this spike) |

These 4 event types are the complete set. No other event types are used.

---

## Constraints and Notes

- `reactor-test` (`StepVerifier`) is not transitively included via Spring Boot's webmvc test starter — it was added explicitly to `pom.xml` as a test-scope dependency.
- The `SseEmitter` timeout is set to 120 seconds (2 minutes). Ollama inference should complete well within this window.
- `AiController` uses virtual threads (`Executors.newVirtualThreadPerTaskExecutor()`) — Spring Boot 4 on Java 25 supports this natively.
- `OllamaHealthGuard.isAvailable()` is checked synchronously at the controller entry point before any `AiService` call — this provides a fast-fail 503 when Ollama is down.
