# Story 5.1: AI Streaming Spike — Spring AI + Ollama + SSE End-to-End

**Status:** done
**Epic:** 5 — AI Enhancement & Conversational Chat
**Story Key:** 5-1-ai-streaming-spike-spring-ai-ollama-sse-end-to-end
**Dependencies:** Epic 4 done (all stories done)

---

## Story

As a developer,
I want an isolated end-to-end spike that proves Spring AI + Ollama + SseEmitter + frontend EventSource work together,
So that the full streaming pipeline is validated and risks are surfaced before dependent stories are built.

---

## Acceptance Criteria

**AC1 — SSE stream from POST /api/v1/ai/chat**
**Given** Ollama is running via Docker Compose with a model available
**When** a POST request is made to `POST /api/v1/ai/chat` with a simple prompt `{"prompt": "..."}`
**Then** the endpoint returns `text/event-stream`; named `token` events arrive progressively; a named `done` event closes the stream

---

**AC2 — OllamaHealthGuard 503 fast-fail**
**Given** the SSE endpoint is called
**When** `OllamaHealthGuard.isAvailable()` returns false at the controller entry point
**Then** the endpoint returns HTTP 503 with `ProblemDetail` `detail: "AI features are temporarily unavailable"` — `AiService` is never invoked; no SSE stream is opened

---

**AC3 — OpenTelemetry span propagation into SseEmitter thread**
**Given** the SSE stream is active
**When** the `SseEmitter` async thread runs
**Then** OpenTelemetry span context is explicitly propagated via `Context.makeCurrent()` into the emitter thread; the trace ID appears in logs for both the HTTP request and the async emission

---

**AC4 — Minimal frontend test harness at /ai-test**
**Given** a test harness page `AiTestPage.tsx` is added and routed to `/ai-test` (protected route — requires auth)
**When** the user submits a prompt via the test harness form
**Then** `token` events are appended to a `<textarea>` in real time; the `done` event closes the connection and displays the summary; `error` events display the error message inline

> **Dev-spike exemption**: `AiTestPage` uses inline `fetch` + `ReadableStream` instead of `lib/sseClient.ts` `createSseConnection`. This is explicitly permitted for dev-only spike/test pages because the backend endpoint is `POST /api/v1/ai/chat` (requires a JSON body) and a JWT `Authorization` header — neither of which native `EventSource` supports. Production chat pages in Story 5.3+ must use `lib/sseClient.ts`. This exemption is documented in `project-context.md` under the React/Frontend rules.

---

**AC5 — useStreamingChat hook dispatches patch events (unit test, no live resume)**
**Given** the SSE stream receives a `patch` event with a valid `DocumentPatchEvent` JSON payload `{"sectionId": "...", "itemIndex": 0, "field": "...", "newValue": "..."}`
**When** the event is dispatched in `useStreamingChat`
**Then** the hook calls `useResumeStore.getState().applyPatch(event)` without error — verified by unit test; no live resume or live Ollama instance is needed

---

**AC6 — AiService streaming unit test**
**Given** `AiService` streaming method is implemented
**When** unit tests run in `AiServiceTest.java`
**Then** the streaming test mocks `ChatClient` via the established mock chain (`chatClient.prompt().user(...).stream().content()`) and verifies that the returned `Flux<String>` emits tokens; tests do not require a live Ollama instance

---

**AC7 — Spike findings documented**
**Given** the spike is complete
**When** the team reviews it
**Then** `docs/ai-spike-findings.md` is created documenting: the chosen Ollama model, the Spring AI 2.0.0-M6 streaming API surface actually used, any constraints discovered, and the confirmed SSE event flow

---

## Tasks / Subtasks

### Task 1: Add `streamChat` method to `AiService` (AC: 1, 6)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- [x] The existing `AiService` uses `.call().content()` (blocking). Add a streaming overload using `.stream().content()` which returns `Flux<String>` (Spring AI 2.0.0-M6 API):
  ```java
  public Flux<String> streamChat(String prompt) {
      try {
          return chatClient.prompt()
                  .user(prompt)
                  .stream()
                  .content();
      } catch (Exception e) {
          log.warn("Ollama streaming call failed: {}", e.getMessage());
          throw new OllamaUnavailableException("Ollama is unavailable: " + e.getMessage(), e);
      }
  }
  ```
- [x] The method returns `Flux<String>` — each emission is one streaming token chunk from Ollama.
- [x] `AiService` remains the ONLY class that calls `ChatClient` directly. The new method must live here.
- [x] Existing `extractResumeSection` method is unchanged — do NOT modify it.

**Spring AI 2.0.0-M6 streaming API note:** The chain is `.prompt().user(text).stream().content()` which returns `Flux<String>`. The `.stream()` method returns a `StreamResponseSpec`; `.content()` on that returns `Flux<String>`. This is distinct from `.call()` which returns `CallResponseSpec` with a blocking `.content(): String`. Both chains start from `chatClient.prompt()`.

### Task 2: Create `AiController` and `ChatRequest` (AC: 1, 2, 3)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/ChatRequest.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.ai;

  import jakarta.validation.constraints.NotBlank;

  public record ChatRequest(@NotBlank String prompt) {}
  ```

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.ai;

  import com.fasterxml.jackson.core.JsonProcessingException;
  import com.fasterxml.jackson.databind.ObjectMapper;
  import io.opentelemetry.context.Context;
  import jakarta.validation.Valid;
  import org.slf4j.Logger;
  import org.slf4j.LoggerFactory;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.MediaType;
  import org.springframework.http.ProblemDetail;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.bind.annotation.*;
  import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
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
                  tokenFlux.doOnNext(token -> {
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
                      try {
                          emitter.send(SseEmitter.event()
                                  .name("error")
                                  .data(objectMapper.writeValueAsString(Map.of("detail", err.getMessage()))));
                      } catch (IOException ex) {
                          log.warn("SSE send failed for error event: {}", ex.getMessage());
                      }
                      emitter.completeWithError(err);
                  }).subscribe();
              } catch (Exception e) {
                  log.error("SSE emitter setup failed", e);
                  emitter.completeWithError(e);
              }
          });

          return ResponseEntity.ok(emitter);
      }
  }
  ```

- [x] **SSE event shape contract** (matches `sseClient.ts` exactly — 4 event types only):
  - `token`: `{"token": "chunk text"}`
  - `done`: `{"summary": "Stream complete"}`
  - `error`: `{"detail": "error message"}`
  - `patch`: not emitted in this spike (wired in Story 5.2)

- [x] **No `@Async`**: use `SseEmitter` + `ExecutorService` with virtual threads. Spring Boot 4 supports `Executors.newVirtualThreadPerTaskExecutor()`.

- [x] **Route is authenticated**: `SecurityConfig` already requires auth for all `/api/v1/**` routes not explicitly permit-all. No `SecurityConfig` change needed for `/api/v1/ai/chat`.

- [x] **`OllamaUnavailableException` in GlobalExceptionHandler**: The existing `GlobalExceptionHandler` has no handler for `OllamaUnavailableException`. Add one:
  ```java
  @ExceptionHandler(OllamaUnavailableException.class)
  public ProblemDetail handleOllamaUnavailable(OllamaUnavailableException ex) {
      ProblemDetail problem = ProblemDetail.forStatusAndDetail(
              HttpStatus.SERVICE_UNAVAILABLE,
              "AI features are temporarily unavailable");
      problem.setTitle("Service Unavailable");
      return problem;
  }
  ```
  Add this to `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`.

### Task 3: Create `useStreamingChat` hook (AC: 5)

- [x] Create `frontend/src/hooks/useStreamingChat.ts`:
  ```typescript
  import { createSseConnection } from "@/lib/sseClient"
  import { useResumeStore } from "@/stores/useResumeStore"
  import { useChatStore } from "@/stores/useChatStore"

  export interface UseStreamingChatOptions {
    onDone?: (summary: string) => void
    onError?: (detail: string) => void
  }

  export function useStreamingChat(options: UseStreamingChatOptions = {}) {
    const addMessage = useChatStore((state) => state.addMessage)
    const setStreaming = useChatStore((state) => state.setStreaming)
    const applyPatch = useResumeStore((state) => state.applyPatch)

    function startStream(url: string): () => void {
      setStreaming(true)

      // Start with an empty assistant message that tokens will be appended to
      const assistantMsgId = crypto.randomUUID()
      addMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      })

      const cleanup = createSseConnection(url, {
        onToken: ({ token }) => {
          // Append token to the assistant message content in useChatStore
          useChatStore.setState((state) => ({
            ...state,
            messages: state.messages.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + token } : m
            ),
          }))
        },
        onPatch: (patch) => {
          // Dispatch patch to useResumeStore — AC5
          applyPatch(patch)
        },
        onDone: ({ summary }) => {
          setStreaming(false)
          options.onDone?.(summary)
        },
        onError: ({ detail }) => {
          setStreaming(false)
          options.onError?.(detail)
        },
      })

      return cleanup
    }

    return { startStream }
  }
  ```

- [x] This hook uses `createSseConnection` from `lib/sseClient.ts` — do NOT create a raw `EventSource` here.
- [x] `applyPatch` is currently a no-op stub in `useResumeStore.ts` (see line 178). The hook calling it is correct — Story 5.2 will implement the real logic. The AC5 unit test verifies the hook calls it.
- [x] `useChatStore` already has `messages`, `isStreaming`, `addMessage`, `setStreaming` — use them.

### Task 4: Create `useStreamingChat.test.ts` (AC: 5)

- [x] Create `frontend/src/hooks/useStreamingChat.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest"
  import { renderHook, act } from "@testing-library/react"
  import { useStreamingChat } from "./useStreamingChat"
  import { useChatStore } from "@/stores/useChatStore"
  import { useResumeStore } from "@/stores/useResumeStore"
  import * as sseModule from "@/lib/sseClient"

  // Mock sseClient so we control what events fire
  vi.mock("@/lib/sseClient")

  describe("useStreamingChat", () => {
    let capturedHandlers: Parameters<typeof sseModule.createSseConnection>[1]

    beforeEach(() => {
      useChatStore.setState({ messages: [], isStreaming: false })
      // Reset applyPatch to a spy
      vi.spyOn(useResumeStore.getState(), "applyPatch")

      vi.mocked(sseModule.createSseConnection).mockImplementation((_url, handlers) => {
        capturedHandlers = handlers
        return vi.fn() // cleanup fn
      })
    })

    it("adds an assistant message and sets isStreaming on startStream", () => {
      const { result } = renderHook(() => useStreamingChat())
      act(() => { result.current.startStream("/api/v1/ai/chat") })

      expect(useChatStore.getState().isStreaming).toBe(true)
      expect(useChatStore.getState().messages).toHaveLength(1)
      expect(useChatStore.getState().messages[0].role).toBe("assistant")
    })

    it("appends tokens to the assistant message", () => {
      const { result } = renderHook(() => useStreamingChat())
      act(() => { result.current.startStream("/api/v1/ai/chat") })

      act(() => {
        capturedHandlers.onToken({ token: "Hello" })
        capturedHandlers.onToken({ token: " world" })
      })

      expect(useChatStore.getState().messages[0].content).toBe("Hello world")
    })

    it("dispatches patch events to useResumeStore.applyPatch", () => {
      const applyPatchSpy = vi.spyOn(useResumeStore.getState(), "applyPatch")
      const { result } = renderHook(() => useStreamingChat())
      act(() => { result.current.startStream("/api/v1/ai/chat") })

      const patch = { sectionId: "WORK_EXPERIENCE", itemIndex: 0, field: "jobTitle", newValue: "Engineer" }
      act(() => { capturedHandlers.onPatch(patch) })

      expect(applyPatchSpy).toHaveBeenCalledWith(patch)
    })

    it("clears isStreaming on done event", () => {
      const onDone = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onDone }))
      act(() => { result.current.startStream("/api/v1/ai/chat") })

      act(() => { capturedHandlers.onDone({ summary: "Done!" }) })

      expect(useChatStore.getState().isStreaming).toBe(false)
      expect(onDone).toHaveBeenCalledWith("Done!")
    })

    it("clears isStreaming on error event", () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useStreamingChat({ onError }))
      act(() => { result.current.startStream("/api/v1/ai/chat") })

      act(() => { capturedHandlers.onError({ detail: "AI offline" }) })

      expect(useChatStore.getState().isStreaming).toBe(false)
      expect(onError).toHaveBeenCalledWith("AI offline")
    })
  })
  ```

### Task 5: Create `AiTestPage.tsx` and route it to `/ai-test` (AC: 4)

- [x] Create `frontend/src/pages/AiTestPage.tsx`:
  ```tsx
  import { useRef, useState } from "react"
  import { useStreamingChat } from "@/hooks/useStreamingChat"
  import { useChatStore } from "@/stores/useChatStore"

  export default function AiTestPage() {
    const [prompt, setPrompt] = useState("")
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [doneMsg, setDoneMsg] = useState<string | null>(null)
    const cleanupRef = useRef<(() => void) | null>(null)
    const isStreaming = useChatStore((state) => state.isStreaming)
    const messages = useChatStore((state) => state.messages)
    const { startStream } = useStreamingChat({
      onDone: (summary) => setDoneMsg(summary),
      onError: (detail) => setErrorMsg(detail),
    })

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      setErrorMsg(null)
      setDoneMsg(null)
      const url = `/api/v1/ai/chat?prompt=${encodeURIComponent(prompt)}`
      // Note: POST with body requires custom SSE — the GET with query param works for a dev spike only.
      // For the real implementation in Story 5.3, the POST body approach will be used via fetch + ReadableStream.
      // For this spike, use the simpler GET approach by passing prompt as a query param.
      // If the backend only accepts POST, open as a GET endpoint variant for spike purposes.
      cleanupRef.current?.()
      cleanupRef.current = startStream(`/api/v1/ai/chat?prompt=${encodeURIComponent(prompt)}`)
    }

    const assistantContent = messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n---\n")

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">AI Streaming Spike — Test Harness</h1>
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <input
            className="border rounded px-3 py-2 flex-1"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt..."
            disabled={isStreaming}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={isStreaming || !prompt.trim()}
          >
            {isStreaming ? "Streaming..." : "Send"}
          </button>
        </form>
        {errorMsg && (
          <div className="text-red-600 mb-2">Error: {errorMsg}</div>
        )}
        {doneMsg && (
          <div className="text-green-600 mb-2">Done: {doneMsg}</div>
        )}
        <textarea
          readOnly
          className="w-full h-64 border rounded p-3 font-mono text-sm"
          value={assistantContent}
        />
      </div>
    )
  }
  ```

- [x] **Routing note**: The epic spec says `/ai-test` is "dev only". Add it as a protected route (requires auth but no admin role) inside the existing `ProtectedRoute` block in `frontend/src/router/index.tsx`:
  ```tsx
  import AiTestPage from "@/pages/AiTestPage"
  // Inside the ProtectedRoute children array:
  {
    path: "/ai-test",
    element: <AiTestPage />,
  },
  ```

- [x] **SSE POST limitation**: Native `EventSource` only supports GET. For this spike, the backend should also expose a `GET /api/v1/ai/chat?prompt=...` variant **OR** the test harness can use a `fetch` + `ReadableStream` approach for POST. The simplest option for the spike: add a `GET` mapping in `AiController` that accepts `@RequestParam String prompt`. The POST endpoint is the canonical one for Story 5.3. Document this limitation in `docs/ai-spike-findings.md`.

- [x] **Alternative (preferred)**: Keep only POST on the backend but change the test harness to use `fetch` with `ReadableStream` instead of `EventSource`:
  ```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setDoneMsg(null)
    const token = useAuthStore.getState().token
    const res = await fetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ prompt }),
    })
    // Parse SSE manually from ReadableStream
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        // parse SSE line format
      }
    }
  }
  ```
  **Decision for the spike**: Use the `fetch`+`ReadableStream` approach for the test harness to keep the backend POST-only. Document the finding in `docs/ai-spike-findings.md`. `createSseConnection` in `lib/sseClient.ts` uses native `EventSource` (GET-only) — that is correct for Story 5.3 where the ChatPanel will use this library. For the spike test harness, inline `fetch` is acceptable since this page is dev-only scaffolding.

### Task 6: Update `AiServiceTest.java` for streaming (AC: 6)

- [x] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java`
- [x] The existing test stubs `ChatClient` via: `chatClient.prompt()` → `promptSpec` → `.user(Consumer)` → `userSpec` → `.call()` → `callSpec` → `.content()`.
- [x] For the new streaming method, add a test using `.stream()` chain. In Spring AI 2.0.0-M6, `.stream()` returns a `StreamResponseSpec`; `.content()` on it returns `Flux<String>`:
  ```java
  @Test
  void streamChat_returns_flux_of_tokens() {
      ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
      ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);
      ChatClient.StreamResponseSpec streamSpec = mock(ChatClient.StreamResponseSpec.class);

      when(chatClient.prompt()).thenReturn(promptSpec);
      when(promptSpec.user(anyString())).thenReturn(userSpec);
      when(userSpec.stream()).thenReturn(streamSpec);
      when(streamSpec.content()).thenReturn(Flux.just("Hello", " world"));

      Flux<String> result = aiService.streamChat("test prompt");

      StepVerifier.create(result)
              .expectNext("Hello")
              .expectNext(" world")
              .verifyComplete();
  }

  @Test
  void streamChat_throws_OllamaUnavailableException_when_chatClient_fails() {
      ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
      ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);

      when(chatClient.prompt()).thenReturn(promptSpec);
      when(promptSpec.user(anyString())).thenReturn(userSpec);
      when(userSpec.stream()).thenThrow(new RuntimeException("Connection refused"));

      assertThatThrownBy(() -> aiService.streamChat("test"))
              .isInstanceOf(OllamaUnavailableException.class)
              .hasMessageContaining("Ollama is unavailable");
  }
  ```
- [x] Add imports: `reactor.core.publisher.Flux`, `reactor.test.StepVerifier`
- [x] Note: `.user(anyString())` is used in the streaming stub (not `.user(any(Consumer.class))`) because `streamChat` calls `.user(prompt)` with a plain String, not a Consumer. The existing extraction tests use the Consumer overload.

### Task 7: Add `OllamaUnavailableException` handler to `GlobalExceptionHandler` (AC: 2)

- [x] Open `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- [x] Add before the catch-all `@ExceptionHandler(Exception.class)`:
  ```java
  import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;

  @ExceptionHandler(OllamaUnavailableException.class)
  public ProblemDetail handleOllamaUnavailable(OllamaUnavailableException ex) {
      log.warn("Ollama unavailable: {}", ex.getMessage());
      ProblemDetail problem = ProblemDetail.forStatusAndDetail(
              HttpStatus.SERVICE_UNAVAILABLE,
              "AI features are temporarily unavailable");
      problem.setTitle("Service Unavailable");
      return problem;
  }
  ```

### Task 8: Create `docs/ai-spike-findings.md` (AC: 7)

- [x] Create `docs/ai-spike-findings.md` documenting:
  - Model used and how to verify it's available via Ollama
  - Spring AI 2.0.0-M6 streaming API: `.prompt().user(String).stream().content()` returns `Flux<String>`
  - `SseEmitter` + virtual thread executor pattern for servlet stack (not reactive/WebFlux)
  - `EventSource` GET-only limitation and the `fetch`+`ReadableStream` workaround used in test harness
  - OpenTelemetry `Context.makeCurrent()` propagation requirement across async boundary
  - Confirmed SSE event types: `token`, `done`, `error` (`patch` wired in Story 5.2)

---

## Developer Context & Guardrails

### Files to Create (NEW)

| File | Purpose |
|------|---------|
| `src/main/java/.../ai/ChatRequest.java` | Request record for `POST /api/v1/ai/chat` |
| `src/main/java/.../ai/AiController.java` | SSE streaming endpoint |
| `frontend/src/hooks/useStreamingChat.ts` | Hook dispatching SSE events to stores |
| `frontend/src/hooks/useStreamingChat.test.ts` | Unit tests for the hook |
| `frontend/src/pages/AiTestPage.tsx` | Dev-only spike test harness |
| `docs/ai-spike-findings.md` | Spike learnings document |

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `src/main/java/.../ai/AiService.java` | Add `streamChat(String prompt): Flux<String>` method |
| `src/main/java/.../common/GlobalExceptionHandler.java` | Add `OllamaUnavailableException` handler |
| `src/test/java/.../ai/AiServiceTest.java` | Add streaming tests |
| `frontend/src/router/index.tsx` | Add `/ai-test` route inside `ProtectedRoute` |

### Critical Implementation Details

**`AiService` already exists — extend, do not rewrite.** It has `extractResumeSection` (blocking, used by `LlmSectionExtractor`). Add `streamChat` as a second public method. Do not touch `extractResumeSection`. Keep the same `ChatClient.Builder` injection pattern already in use.

**`AiService` is the ONLY class that calls `ChatClient`.** `AiController` must inject `AiService` — it must NOT inject or use `ChatClient` directly.

**`OllamaHealthGuard` is already implemented** at `src/main/java/.../ai/OllamaHealthGuard.java`. It does a synchronous HTTP probe to `${spring.ai.ollama.base-url}`. Call `healthGuard.isAvailable()` at the top of the controller method before calling `aiService.streamChat()`.

**`OllamaUnavailableException` already exists** at `src/main/java/.../ai/OllamaUnavailableException.java`. Use it — do not create a new exception class.

**`GlobalExceptionHandler` does not yet handle `OllamaUnavailableException`.** The current catch-all `@ExceptionHandler(Exception.class)` would map it to 500. Add a specific handler mapping it to 503. This is required for both the controller fast-fail path and any propagated exceptions from `AiService`.

**`sseClient.ts` is already fully implemented** with all 4 event handlers (`token`, `patch`, `done`, `error`). The hook `useStreamingChat` must use `createSseConnection` from `lib/sseClient.ts` — no raw `EventSource` outside that file.

**`useResumeStore.applyPatch` is currently a no-op stub** (line 178 of `useResumeStore.ts`). The comment says "Fully implemented in Story 4.2" but that note is stale — it will be properly implemented in Story 5.2. AC5 requires the `useStreamingChat` hook to call it — this is correct. The unit test verifies the call happens, not the actual patch logic.

**`useChatStore` has `messages: ChatMessage[]`, `isStreaming: boolean`, `addMessage`, `setStreaming`, `clearMessages`.** The `ChatMessage` type in `types/api.ts` has `{id, role, content, timestamp}`. The hook should build assistant messages using `crypto.randomUUID()` for `id`.

**`EventSource` and POST**: Native `EventSource` only supports GET requests. The production chat flow in Story 5.3 will use a different SSE approach (likely `fetch`+`ReadableStream` to support POST bodies). For this spike, either add a companion GET endpoint or use `fetch`+`ReadableStream` in the test harness. The `lib/sseClient.ts` `createSseConnection` creates a `new EventSource(url)` — this is the correct production library for Story 5.3's GET-based or token-based SSE. Document the decision in `docs/ai-spike-findings.md`.

**Spring AI 2.0.0-M6 API surface** (milestone — verify against actual library in `pom.xml`):
- `ChatClient.prompt()` → `ChatClientRequestSpec`
- `.user(String text)` → `ChatClientRequestSpec` (plain text overload)
- `.user(Consumer<UserSpec>)` → `ChatClientRequestSpec` (consumer overload, used by existing `extractResumeSection`)
- `.call()` → `CallResponseSpec` → `.content(): String` (blocking)
- `.stream()` → `StreamResponseSpec` → `.content(): Flux<String>` (reactive streaming)

**OpenTelemetry across async boundary**: Spring Boot's OTel auto-instrumentation does NOT propagate trace context across thread boundaries automatically. The pattern is:
```java
Context otelContext = Context.current();  // capture in request thread
executor.execute(() -> {
    try (var ignored = otelContext.makeCurrent()) {  // restore in async thread
        // OTel spans created here will be children of the original request span
    }
});
```
`io.opentelemetry.context.Context` is from `opentelemetry-api` which is transitively included via `spring-boot-starter-opentelemetry`.

**Virtual threads**: Spring Boot 4 supports `Executors.newVirtualThreadPerTaskExecutor()`. This is preferred over `Executors.newCachedThreadPool()` for SSE emitter threads. Each `SseEmitter` stream gets its own virtual thread.

**`SseEmitter` timeout**: Set to 120 seconds (2 minutes). Ollama inference for a typical resume prompt should complete well within this window. The emitter is completed (`.complete()`) in the `doOnComplete` callback.

**`produces = MediaType.TEXT_EVENT_STREAM_VALUE`**: The `@PostMapping` must declare this — otherwise Spring will try to serialize `SseEmitter` as JSON. The `ResponseEntity<?>` return type handles both the 503 `ProblemDetail` case and the 200 `SseEmitter` case.

**Reactor dependency**: `Flux` is from `reactor-core`. It is transitively included via `spring-ai-starter-model-ollama`. `StepVerifier` is from `reactor-test` — add to `pom.xml` test scope if not already present (check `spring-boot-starter-webmvc-test` transitives; it likely is not included).

**`reactor-test` in pom.xml**: Add if `StepVerifier` is not resolvable:
```xml
<dependency>
    <groupId>io.projectreactor</groupId>
    <artifactId>reactor-test</artifactId>
    <scope>test</scope>
</dependency>
```
Spring Boot manages the version via its BOM — no `<version>` tag needed.

**Package for new AI classes**: `com.tsvetanbondzhov.resumeenhancer.ai` — all AI classes go in this package. `AiController`, `AiService`, `OllamaHealthGuard`, `OllamaUnavailableException`, `ChatRequest` all live together here.

**Router index.tsx**: Add `AiTestPage` import alongside the other page imports (not lazy-loaded — it's a dev spike page, no lazy needed). Place the `/ai-test` route inside the `ProtectedRoute` children array (requires auth, no admin required).

**Anti-patterns to avoid:**
- Do NOT call `ChatClient` directly from `AiController` — `AiService` is the sole boundary
- Do NOT use `@Async` for SSE emission — use `SseEmitter` + `ExecutorService`
- Do NOT use raw `EventSource` outside `lib/sseClient.ts` in production code
- Do NOT add new Zustand stores — use existing `useChatStore` and `useResumeStore`
- Do NOT hardcode API URLs in components — use the Vite dev proxy (configured at `vite.config.ts` line 17)

---

## Dev Notes

**Spring AI `ChatClient.prompt().user()` overloads**: The existing `AiService.extractResumeSection` uses `.user(u -> u.text(prompt))` (consumer overload). The new `streamChat` can use the simpler `.user(prompt)` (String overload) since no additional user message customization is needed. Both overloads return `ChatClientRequestSpec`.

**`SseEmitter` + `Flux` subscription**: The `tokenFlux.subscribe()` in the executor thread subscribes to the reactor Flux and drives the emission. This is intentional — the Flux is cold (does not start until subscribed). The Reactor subscription runs on the thread pool Ollama/Spring AI uses internally; the `doOnNext`/`doOnComplete`/`doOnError` operators run on that same thread, sending data to the `SseEmitter`.

**Error in SSE mid-stream**: If Ollama drops mid-stream, `doOnError` fires, sends an `error` event to the client, then calls `emitter.completeWithError()`. The client `sseClient.ts` handles this in its `error` listener by calling `es.close()`.

**`/ai-test` route accessibility**: This is a protected route requiring authentication. The spike test harness needs a valid JWT — use the existing login flow to get a token before testing. The `EventSource` or `fetch` approach both need the `Authorization: Bearer <token>` header. Native `EventSource` does NOT support custom headers. The `fetch`+`ReadableStream` approach in the test harness is therefore superior for POST endpoints with JWT auth.

---

## File List

### To Create
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/ChatRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java`
- `frontend/src/hooks/useStreamingChat.ts`
- `frontend/src/hooks/useStreamingChat.test.ts`
- `frontend/src/pages/AiTestPage.tsx`
- `docs/ai-spike-findings.md`

### To Modify
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java`
- `frontend/src/router/index.tsx`

---

## Dev Agent Record

### Implementation Notes
- AC1/AC6: Added `streamChat(String prompt): Flux<String>` to `AiService` using `.prompt().user(String).stream().content()` chain. Added `reactor-test` to `pom.xml` (not transitively provided). `AiServiceTest` now has 33 passing tests (+2 streaming tests).
- AC2: `AiController` checks `OllamaHealthGuard.isAvailable()` at entry before any `AiService` call. Returns 503 `ProblemDetail` on unavailability. `GlobalExceptionHandler` updated with dedicated `OllamaUnavailableException` → 503 handler.
- AC3: OTel context captured with `Context.current()` in request thread; restored via `otelContext.makeCurrent()` inside `ExecutorService` virtual thread. Follows project-context.md documented pattern.
- AC4: `AiTestPage.tsx` uses `fetch`+`ReadableStream` approach (preferred over `EventSource`): supports POST body + JWT `Authorization` header. Native SSE line parsing implemented inline. Routed to `/ai-test` inside `ProtectedRoute`.
- AC5: `useStreamingChat` hook dispatches `patch` events to `useResumeStore.applyPatch()`. 5 unit tests pass verifying token append, patch dispatch, done/error lifecycle.
- AC7: `docs/ai-spike-findings.md` documents Ollama model verification, Spring AI 2.0.0-M6 API surface, `SseEmitter`+virtual thread pattern, `EventSource` GET-only limitation with `fetch`+`ReadableStream` workaround, OTel propagation requirement, and all 4 SSE event types.

### Completion Notes
All 7 ACs satisfied. Backend: 33 tests pass (0 failures). Frontend: 555 tests pass (0 regressions). New files linted clean. `pom.xml` extended with `reactor-test` test scope dependency.

## File List

### Created
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/ChatRequest.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java`
- `frontend/src/hooks/useStreamingChat.ts`
- `frontend/src/hooks/useStreamingChat.test.ts`
- `frontend/src/pages/AiTestPage.tsx`
- `docs/ai-spike-findings.md`

### Modified
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java`
- `frontend/src/router/index.tsx`
- `pom.xml`

---

### Review Findings

- [x] [Review][Decision] D1 — AiTestPage raw fetch() vs. apiClient.ts/sseClient.ts constraint — AiTestPage uses fetch+ReadableStream directly (POST + JWT header required, EventSource supports neither). Resolution: Option 1 — amended project-context.md to carve out dev-only spike/test pages from the apiClient/sseClient constraints; updated AC4 text with formal exemption note. [AiTestPage.tsx, project-context.md]
- [x] [Review][Patch] F1 — Flux subscription Disposable not stored; emitter callbacks not registered — doOnNext/doOnComplete/doOnError can fire after emitter is completed/timed-out with no way to cancel the Flux; client disconnect does not cancel the stream. Fix: store Disposable from .subscribe(), register emitter.onCompletion/onTimeout/onError callbacks that call disposable.dispose(). [AiController.java:57-92]
- [x] [Review][Patch] F3 — AiService.streamChat try/catch wraps Flux assembly, not execution — mid-stream reactive errors propagate as onError signals, not thrown exceptions; OllamaUnavailableException is never raised for runtime Ollama failures. Fix: added .onErrorMap(e -> new OllamaUnavailableException(..., e)) on the returned Flux. [AiService.java:42-52]
- [x] [Review][Patch] F4 — SSE error event sends err.getMessage() verbatim to client — exposes internal error details. Fix: sanitized to generic "AI streaming error — please try again" message; full error logged server-side with warn level. [AiController.java:81-83]
- [x] [Review][Patch] F5 — useStreamingChat: setStreaming(false) never called if cleanup invoked before done/error — isStreaming stays true permanently on component unmount. Fix: wrapper cleanup() function calls closeConnection() then setStreaming(false). [useStreamingChat.ts:27-51]
- [x] [Review][Patch] F6 — res.body! non-null assertion in AiTestPage — body can be null at runtime. Fix: guard added — if (!res.body) sets error message and returns early. [AiTestPage.tsx:69]
- [x] [Review][Patch] F12 — AiTestPage SSE parser: eventName/dataLine not reset on every blank line — stale values from previous event can corrupt next event dispatch. Fix: eventName and dataLine are now reset unconditionally on every blank line; dispatch only fires when both are non-empty. [AiTestPage.tsx:89-112]
- [x] [Review][Defer] F2 — ExecutorService field never shut down (@PreDestroy missing) — pre-existing pattern across the codebase; low impact with virtual threads; defer to production hardening. [AiController.java:34]
- [x] [Review][Defer] F8 — OllamaHealthGuard creates new HttpClient per isAvailable() call — pre-existing in OllamaHealthGuard, not introduced by this story. [OllamaHealthGuard.java]
- [x] [Review][Defer] F11 — /ai-test route has no production exclusion guard — acknowledged in story as dev-only spike page; defer to production hardening or Epic 5 cleanup. [router/index.tsx]

## Change Log
- 2026-06-18: Story created
- 2026-06-18: Story implemented — all tasks complete, all ACs satisfied, status → review
- 2026-06-18: Code review complete — 1 decision-needed, 6 patch, 3 deferred, 3 dismissed — status → in-progress
- 2026-06-18: All review findings resolved — D1 (docs-only: project-context.md + AC4 amended), F1/F3/F4/F5/F6/F12 patched — status → done
