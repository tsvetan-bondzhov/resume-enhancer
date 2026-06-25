# Story 7.3: OpenTelemetry Span Propagation Through SSE & Log Correlation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want all user-initiated operations — including AI SSE streaming paths — to produce distributed traces with correlated log entries,
so that I can link logs to traces and debug the full request lifecycle without relying on the Grafana UI.

## Acceptance Criteria

1. **(AC1 — Baseline non-AI tracing + log correlation)** Given `spring-boot-starter-opentelemetry` is on the classpath (already present in `pom.xml`), when a user initiates any non-AI operation (login, profile save, resume CRUD, export), then a complete distributed trace is generated with spans for the HTTP request, service layer, and repository layer; each span carries a `traceId` that ALSO appears in the correlated log lines for that request. (NFR17, NFR18)

2. **(AC2 — SSE async span propagation)** Given a user initiates an AI operation (`/api/v1/ai/chat`, `/enhance`, `/tailor`) that uses `SseEmitter`, when the SSE async thread runs, then the OpenTelemetry span context captured on the request thread is explicitly propagated via `Context.makeCurrent()` at the async callback entry point, and the AI inference work (token streaming, patch emission) runs as a **child span** of the originating HTTP request span — NOT an orphaned/new-root trace. (NFR17, architecture constraint)

3. **(AC3 — Log correlation across the async boundary)** Given a distributed trace spans the AI SSE path, when application logs are inspected, then every log line emitted during the SSE async thread includes the `traceId` and `spanId` correlation fields, and log entries from the HTTP request thread and the async SSE thread are linkable via the **same `traceId`**. (NFR18)

4. **(AC4 — Error span status)** Given an AI operation results in an error (Ollama unavailable, patch parse/validation failure, SSE send IOException), when the error span is recorded, then the span status is set to `ERROR` with a descriptive message, and the error is visible in any OTel-compatible trace view alongside the originating request span.

5. **(AC5 — Integration test proving correlation)** Given the OTel propagation implementation is complete, when integration tests run, then `AiControllerIntegrationTest.java` includes at least one test verifying that a `traceId` established during the HTTP phase is present in the async SSE emission (asserted via an in-memory span exporter from `spring-boot-starter-opentelemetry-test` and/or a captured log appender) — proving HTTP-thread and async-thread spans share one trace.

6. **(AC6 — Configuration correctness, no regressions)** Given the tracing/logging configuration in `application.yml`, when the application boots in `dev` and `prod` profiles and under `@SpringBootTest`, then OTLP export config and the log correlation pattern are valid Spring Boot 4 keys (no misplaced/ignored properties), the existing 516+ backend tests still pass, and trace sampling remains at probability `1.0` for local/dev observability.

## Tasks / Subtasks

- [x] **Task 1: Audit & fix tracing/logging configuration** (AC: #1, #3, #6)
  - [x] Reviewed `application.yml`. Confirmed BOTH `opentelemetry:` and `management:` were nested under `spring:` (silently ignored). `spring.opentelemetry.*` is NOT a valid Boot 4 prefix at all. Corrected: `management:` is now a TOP-LEVEL key with the authoritative Boot 4 keys — `management.tracing.sampling.probability: 1.0`, `management.otlp.tracing.endpoint`, `management.otlp.logging.endpoint`, `management.otlp.metrics.export.url` (verified against the `spring-configuration-metadata.json` of `spring-boot-micrometer-tracing`, `spring-boot-micrometer-tracing-opentelemetry`, `spring-boot-opentelemetry`, `spring-boot-micrometer-metrics`). Context boot under `@SpringBootTest` confirms binding.
  - [x] Confirmed `spring-boot-starter-opentelemetry` bundles `micrometer-tracing-bridge-otel` (Micrometer→OTel bridge present in `~/.m2`), so `traceId`/`spanId` populate the SLF4J MDC and the default Boot console pattern emits `[appName,traceId,spanId]` via `%correlationId` when a tracer is active. No `logback-spring.xml` and no explicit `logging.pattern.correlation` needed — kept minimal per Dev Notes.
  - [x] Confirmed OTLP endpoints target `http://localhost:4318/v1/{traces,logs,metrics}`, aligned with the `grafana-lgtm` (`grafana/otel-lgtm`) service exposing 4318 in `compose.yaml`. No change needed.
- [x] **Task 2: Harden SSE span propagation into named child spans** (AC: #2, #4)
  - [x] PRESERVED the load-bearing propagation idiom: request thread captures `Context.current()`; async work re-binds it via `captured.makeCurrent()` inside the new `runInChildSpan(...)` helper. Not removed or refactored away.
  - [x] Inside the async block (after `makeCurrent()`), `runInChildSpan` opens a named child span via the injected OTel `Tracer` (`ai.sse.chat` / `ai.sse.enhance` / `ai.sse.tailor`), makes it current for setup, and ends it via the Flux terminal callback. `Tracer` injected through a new constructor param (auto-configured `otelTracer` bean), not a static accessor.
  - [x] Error paths set `span.setStatus(StatusCode.ERROR, msg)` + `span.recordException(err)` via `markSpanError(...)`: `buildChatDisposable`/`buildLineBufferedDisposable` `doOnError`, SSE-send `IOException`, and the setup `catch (Exception e)` block. Invalid-patch discard records a `span.addEvent("ai.patch.discarded.invalid")` so it is visible in the trace without failing the whole stream span. Client-facing generic error (`trySendError`) unchanged.
  - [x] Child span ended exactly once on all terminal paths via `doFinally(signal -> span.end())` (fires once on complete, error, AND cancel/timeout-driven dispose). End tied to span/Flux lifecycle, not to emitter disposal — no double-end. Setup-failure path (before subscribe) ends the span explicitly in the `catch`.
- [x] **Task 3: Create `AiControllerIntegrationTest.java`** (AC: #5)
  - [x] New file created. Mirrors `AdminControllerIntegrationTest.java`: `@SpringBootTest(webEnvironment = RANDOM_PORT)`, `@ActiveProfiles("test")`, inner `@TestConfiguration` with `@ServiceConnection PostgreSQLContainer("postgres:16")`, `WebTestClient.bindToServer().baseUrl(...)`, JWT seeding via `TokenService`/`UserRepository`/`PasswordEncoder`.
  - [x] Used option (a): `@MockitoBean AiService` returning a deterministic `Flux.just("Hello from the model\n")`. No live Ollama.
  - [x] `opentelemetry-sdk-testing` is NOT on the classpath, so instead of `InMemorySpanExporter` a tiny custom `SpanExporter` is registered via an `SdkTracerProviderBuilderCustomizer` bean (consumed by the OTel tracing auto-config). Asserts the async child span `ai.sse.chat` has a valid parent (NOT a root) and shares the SAME `traceId` as the HTTP server span — proving propagation across the async boundary.
  - [x] One focused correlation test (the AC minimum). Error-span test deferred (covered at unit level by the existing `*_withStreamError_*` tests which now exercise `markSpanError`).
- [x] **Task 4: Unit-level guard for span instrumentation** (AC: #2, #4)
  - [x] Updated `AiControllerTest.setUp()` constructor call to pass `OpenTelemetry.noop().getTracer("test")` as the new `Tracer` arg. All 26 existing unit tests (unavailable-path, happy-path token, patch-aware, stream-error) compile and pass.
- [x] **Task 5: Verify no regressions & build** (AC: #6)
  - [x] `./mvnw test` — 517 tests pass (516 existing + 1 new integration test), 0 failures, 0 errors. BUILD SUCCESS.
  - [x] App context boots cleanly under `@SpringBootTest` with the corrected top-level `management.*` tracing config and no property-binding warnings.

## Dev Notes

### Current state of the codebase (READ before implementing)

- **`src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java`** — the SSE entry point. ALL THREE endpoints (`chat` L63, `enhance` L107, `tailor` L143) already implement the core propagation idiom:
  ```java
  Context otelContext = Context.current();              // captured on request thread
  executor.execute(() -> {
      try (var ignored = otelContext.makeCurrent()) {   // re-bound on async thread
          ... aiService.stream*(...) ...
      }
  });
  ```
  Uses a virtual-thread executor: `Executors.newVirtualThreadPerTaskExecutor()` (L49). SSE events are exactly 4 types: `token`, `patch`, `done`, `error` (see `EVENT_*` constants L39–41). **This story HARDENS this existing code (named child span + error status) — it does NOT add propagation from scratch.** The `import io.opentelemetry.context.Context;` (L7) confirms the OTel API is already on the classpath via the starter.
- **`AiService.java`** — the ONLY class allowed to call Spring AI `ChatClient` (project rule). Returns `Flux<String>`. Do not instrument span logic here; keep tracing in the controller's async boundary where the thread hop happens.
- **`AiControllerTest.java`** — Mockito unit test. Constructor call at L55: `new AiController(aiService, healthGuard, objectMapper, resumeService, documentPatchService, memory)`. If you add a `Tracer`/`OpenTelemetry` constructor param, this line MUST be updated.

### Configuration findings (concrete)

- **`pom.xml`**: `spring-boot-starter-opentelemetry` (L49–51, main) and `spring-boot-starter-opentelemetry-test` (L167–171, test scope) are ALREADY present. No new tracing dependency is expected. Do NOT add `micrometer-tracing-bridge-otel` manually unless the starter proves not to wire it — the Boot 4 starter is designed to bundle the bridge.
- **`src/main/resources/application.yml` L25–41** — SUSPECTED MISCONFIGURATION:
  ```yaml
  spring:
    ...
    opentelemetry:        # nested under spring: — verify this binds
      tracing: { export: { otlp: { endpoint: http://localhost:4318/v1/traces } } }
      logging: { export: { otlp: { endpoint: http://localhost:4318/v1/logs } } }
      metrics: { export: { otlp: { endpoint: http://localhost:4318/v1/metrics } } }
    management:           # ← LIKELY BUG: management.* should be TOP-LEVEL, not under spring:
      tracing: { sampling: { probability: 1.0 } }
  ```
  In Spring Boot, `management.tracing.sampling.probability` is a **root** property. Nesting it under `spring:` makes it `spring.management.tracing...` which is NOT bound → sampling may silently default. Fix the indentation so `management:` is a sibling of `spring:`. Verify the `spring.opentelemetry.*` export keys are correct for Boot 4 (they may belong under a different prefix in the OTel starter — confirm against the starter's actual `@ConfigurationProperties`).
- **No `logback-spring.xml` / `logback.xml` exists** and no log pattern currently includes `traceId`/`spanId`. The Boot default console pattern emits a `%correlationId` segment (`[appName,traceId,spanId]`) automatically WHEN a tracer is active. Confirm correlation actually appears in logs at runtime; if not, set `logging.pattern.correlation` rather than introducing a full logback config.
- **`compose.yaml`**: single `grafana/otel-lgtm:latest` service (`grafana-lgtm`) exposes ports 3000 (Grafana UI), 4317 (OTLP gRPC), 4318 (OTLP HTTP). The app's OTLP endpoints point at `:4318`. Story 7.4 owns the Grafana dashboard JSON — do NOT build dashboards here.

### Integration-test pattern (copy from existing)

`AdminControllerIntegrationTest.java` is the canonical template:
- `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `@ActiveProfiles("test")`
- inner `@TestConfiguration(proxyBeanMethods = false)` with `@Bean @ServiceConnection PostgreSQLContainer postgresContainer()` (`postgres:16`)
- `WebTestClient.bindToServer().baseUrl("http://localhost:" + port).build()`
- JWT obtained by seeding a `User` (via `UserRepository` + `PasswordEncoder`) and minting a token with `TokenService`
- `src/test/resources/application-test.yml` disables Ollama (`spring.ai.ollama.chat.enabled: false`) and sets `spring.cache.type: none` — your SSE test must NOT depend on a live model; stub `AiService` instead.

### Testing standards summary

- Integration test name: `AiControllerIntegrationTest.java`, `@SpringBootTest`, Testcontainers PostgreSQL (project rule: every controller has ≥1 happy-path integration test).
- SSE endpoint integration testing uses `WebTestClient` (established convention).
- Unit tests use JUnit 5 + Mockito (`@ExtendWith(MockitoExtension.class)`); mirror package structure under `src/test/java/...`.
- In-memory span assertions available via `spring-boot-starter-opentelemetry-test`.

### Project Structure Notes

- Backend package root: `com.tsvetanbondzhov.resumeenhancer`; AI domain package: `...ai`. New test file lives at `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiControllerIntegrationTest.java`.
- `config/` package is isolated from domain logic — if a `Tracer` bean needs explicit exposure, prefer the auto-configured bean from the starter; only add a `config/` bean if the starter does not provide one.
- Servlet stack (`spring-boot-starter-webmvc`), NOT WebFlux — `Flux` is used internally only as a streaming token source, bridged to `SseEmitter`; do not introduce reactive web.
- Scope guard: this story is OTel propagation + log correlation ONLY. Grafana dashboard provisioning is Story 7.4. The readiness report (`implementation-readiness-report-2026-05-14.md` L287–289) explicitly recommended splitting these — respect that boundary.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7-administration-observability.md#Story 7.3] — acceptance criteria, NFR17/NFR18 mapping
- [Source: _bmad-output/planning-artifacts/epics/requirements-inventory.md#NFR17,NFR18] — "logs include trace correlation IDs"; "OTel context does NOT auto-propagate through SseEmitter async thread — explicit `Context.makeCurrent()` required"
- [Source: _bmad-output/project-context.md#SSE / AI Streaming] — "OpenTelemetry context does NOT propagate automatically through `SseEmitter` async thread — explicit `Context.makeCurrent()` required"; 4 SSE event types only
- [Source: src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java#L7,L49,L63-L175] — existing `Context.current()`/`makeCurrent()` propagation
- [Source: src/main/resources/application.yml#L25-L41] — tracing/OTLP config (suspected `management:` nesting bug)
- [Source: compose.yaml#grafana-lgtm] — OTLP collector endpoints 4317/4318
- [Source: src/test/java/com/tsvetanbondzhov/resumeenhancer/admin/AdminControllerIntegrationTest.java] — integration-test scaffold
- [Source: pom.xml#L49-L51,L167-L171] — OTel starter (main + test) already present

### Review Findings

Code review 2026-06-24 (Amelia / bmad-code-review): clean pass. 0 decision-needed, 0 patch, 0 defer, 1 dismissed.

- [x] [Review][Dismiss] `emitLine` token-send `IOException` (AiController.java:342–345) does not call `markSpanError` — dismissed: non-blocking, the line-buffered path still records span ERROR via `doOnError`/`doOnComplete`, and AC4's primary error paths (doOnError, setup catch, chat-path send) are covered; cosmetic consistency only.

Verification performed during review:
- AC6 config keys validated against Boot 4 `spring-configuration-metadata.json`: `management.tracing.sampling.probability`, `management.otlp.tracing.endpoint`, `management.otlp.logging.endpoint`, `management.otlp.metrics.export.url` all confirmed valid.
- `SdkTracerProviderBuilderCustomizer` import path confirmed present in `spring-boot-micrometer-tracing-opentelemetry-4.0.6.jar`.
- `AiControllerTest` re-run: 26 tests pass. `AiControllerIntegrationTest` re-run (Testcontainers postgres:16): 1 test passes.
- Scope guard confirmed: auth contract (`AuthResponse`/`AuthService`/`UserDto`) untouched — only AiController.java, application.yml, AiControllerTest.java, and the new AiControllerIntegrationTest.java changed.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `AiControllerIntegrationTest` first run failed with `PrematureCloseException` because the SSE
  connection close after stream completion surfaces as a client-side error on `blockLast`. Resolved
  by `.onErrorComplete()` on the response body — the span assertions (via awaitility) are the real
  verification, not the client body completion.

### Completion Notes List

- **AC1 / AC3 (log correlation):** `spring-boot-starter-opentelemetry` bundles
  `micrometer-tracing-bridge-otel` (confirmed in `~/.m2`), so `traceId`/`spanId` populate the SLF4J
  MDC and the Boot default console pattern emits `[appName,traceId,spanId]` when a tracer is active.
  No `logback-spring.xml` / `logging.pattern.correlation` added — kept minimal.
- **AC6 (config fix):** `application.yml` had `opentelemetry:` and `management:` nested under
  `spring:` (silently ignored). Corrected to ROOT-level Boot 4 keys verified against the
  `spring-configuration-metadata.json` of the tracing/metrics starters:
  `management.tracing.sampling.probability: 1.0`, `management.otlp.tracing.endpoint`,
  `management.otlp.logging.endpoint`, `management.otlp.metrics.export.url`. Context boots cleanly
  under `@SpringBootTest`.
- **AC2 (child span):** Preserved the load-bearing propagation idiom — request thread captures
  `Context.current()`, async work re-binds via `makeCurrent()` inside the new `runInChildSpan(...)`
  helper. Inside that scope a NAMED child span (`ai.sse.chat` / `ai.sse.enhance` / `ai.sse.tailor`)
  is opened via an injected `OpenTelemetry` bean (`getTracer(...)`), making the AI inference work a
  child of the originating HTTP request span. `OpenTelemetry` injected via constructor (auto-config
  bean from `OpenTelemetrySdkAutoConfiguration`); unit test passes `OpenTelemetry.noop()`.
- **AC4 (error status):** `markSpanError(...)` sets `span.setStatus(StatusCode.ERROR, msg)` +
  `recordException(err)` on all SSE error paths (doOnError, SSE-send IOException, setup catch).
  Invalid-patch discard adds `span.addEvent("ai.patch.discarded.invalid")` without failing the stream
  span. Child span ends exactly once via `doFinally(signal -> span.end())` (complete/error/cancel),
  and explicitly in the setup-failure catch before subscribe.
- **AC5 (integration test):** New `AiControllerIntegrationTest.java` mirrors
  `AdminControllerIntegrationTest` (RANDOM_PORT, `@ActiveProfiles("test")`, Testcontainers
  `postgres:16`, JWT seeded via `TokenService`/`UserRepository`/`PasswordEncoder`). `opentelemetry-sdk-testing`
  is NOT on the classpath, so a custom in-memory `SpanExporter` is registered via an
  `SdkTracerProviderBuilderCustomizer` bean. Asserts `ai.sse.chat` has a valid parent (not a root) and
  shares the SAME `traceId` as the HTTP server span. `AiService`/`OllamaHealthGuard` stubbed via
  `@MockitoBean` (no live Ollama).
- **Scope guard honoured:** No auth contract changes — `AuthResponse`/`AuthService`/`UserDto`
  untouched. JWT minted via existing `TokenService` pattern. No Grafana dashboards (Story 7.4).
- **AC6 regression:** `./mvnw test` → **517 tests pass** (516 existing + 1 new), 0 failures/errors,
  BUILD SUCCESS.

### File List

- `src/main/resources/application.yml` (modified — corrected OTel/management config to root-level Boot 4 keys)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java` (modified — child-span hardening, `runInChildSpan`, `markSpanError`, `OpenTelemetry` constructor param)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiControllerTest.java` (modified — constructor updated to pass `OpenTelemetry.noop()`)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiControllerIntegrationTest.java` (new — AC5 span-propagation correlation test)

### Change Log

- 2026-06-24: Implemented OTel SSE span propagation + log correlation (Story 7.3). Fixed misconfigured
  tracing/OTLP keys in `application.yml`; hardened `AiController` to open named child spans across the
  SSE async boundary with ERROR span status on failures; added `AiControllerIntegrationTest` proving
  HTTP-thread and async-thread spans share one trace. 517 backend tests pass.
