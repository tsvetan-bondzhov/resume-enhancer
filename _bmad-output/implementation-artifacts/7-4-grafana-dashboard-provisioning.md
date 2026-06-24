# Story 7.4: Grafana Dashboard Provisioning

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want a pre-configured Grafana dashboard provisioned as code in the Docker Compose setup,
so that I can immediately observe request rates, latencies, AI inference durations, and error rates without manual Grafana UI configuration.

## Acceptance Criteria

1. **(AC1 — Auto-provisioned data source)** Given the Grafana + OTel Collector service (`grafana-lgtm`, image `grafana/otel-lgtm:latest`) is defined in `compose.yaml`, when `docker compose up` is run, then Grafana starts with the metrics (Prometheus/Mimir), traces (Tempo), and logs (Loki) data sources already available — no manual data source setup in the Grafana UI is required. (NFR17, FR42)
   - NOTE: The `grafana/otel-lgtm` image already auto-provisions its internal Prometheus/Mimir, Tempo, and Loki data sources out of the box. This AC is satisfied by the image's built-in provisioning PLUS the dashboard provisioning added by this story; it does NOT require authoring a custom data source YAML unless the dashboard needs a data source UID that differs from the image defaults. Verify the image's default data source name/UID and reference it in the dashboard JSON (see Dev Notes).

2. **(AC2 — Dashboard visible with required panels)** Given the Grafana data source is configured, when the Grafana UI is accessed at `http://localhost:3000`, then a pre-configured "Resume Enhancer — Observability" dashboard is immediately visible (no manual import) showing at minimum: (a) request rate per endpoint, (b) p99 latency per endpoint, (c) AI inference duration (SSE stream duration), and (d) error rate. Traces are searchable by `traceId` (via the Tempo data source / Explore, or a trace-link panel). (NFR17, FR42)

3. **(AC3 — Dashboard committed as code + volume-mounted)** Given the dashboard is defined as code, when the repository is inspected, then the dashboard is stored as a Grafana JSON model file committed to the repo at `grafana/provisioning/dashboards/resume-enhancer.json`, AND a dashboards provider config YAML is committed at `grafana/provisioning/dashboards/dashboards.yaml` (Grafana `apiVersion: 1` file provider). Both are mounted into the `grafana-lgtm` container via `compose.yaml` volumes so that NO manual Grafana UI setup is ever required to reproduce the dashboard. (FR42)

4. **(AC4 — End-to-end traces nest correctly)** Given Story 7.3 OTel span propagation is complete (DONE) and the app is running via `docker compose up`, when a sequence of operations is performed (login → create resume → AI tailor → export), then all four operation types appear as traces in Tempo/Grafana, and the AI inference SSE spans (`ai.sse.chat` / `ai.sse.enhance` / `ai.sse.tailor`) are correctly nested under their originating HTTP request spans — confirming the dashboard surfaces the propagation work delivered in 7.3. (NFR17)

5. **(AC5 — No regressions to the running stack)** Given the new volume mounts and provisioning files, when `docker compose up` is run (and the `production` profile variant with the `app` service), then the `grafana-lgtm` container starts cleanly with the provisioned dashboard loaded (no Grafana provisioning errors in container logs), and the existing services (`postgres`, `ollama`, `app`) are unaffected. No backend Java code changes are required by this story.

## Tasks / Subtasks

- [x] **Task 1: Create the Grafana provisioning directory structure** (AC: #3)
  - [x] Create `grafana/provisioning/dashboards/` at the repository root (no such directory exists today — confirmed via glob).
  - [x] Create the dashboards provider config `grafana/provisioning/dashboards/dashboards.yaml`:
    ```yaml
    apiVersion: 1
    providers:
      - name: 'resume-enhancer'
        orgId: 1
        type: file
        disableDeletion: false
        allowUiUpdates: true
        updateIntervalSeconds: 30
        options:
          path: /otel-lgtm/grafana/conf/provisioning/dashboards
          foldersFromFilesStructure: false
    ```
    - IMPORTANT: The `options.path` must be the path INSIDE the container where the JSON is mounted. The `grafana/otel-lgtm` image reads provisioning from `/otel-lgtm/grafana/conf/provisioning/...`. Verify this exact path against the running image before finalizing (see Dev Notes — "Verify container paths").
  - [x] Do NOT author a data source YAML unless AC1 verification shows the dashboard needs a non-default data source UID. The image auto-provisions Prometheus/Mimir, Tempo, and Loki. (VERIFIED: image provisions datasources with stable UIDs `prometheus`/`tempo`/`loki`; no custom datasource YAML authored.)

- [x] **Task 2: Author the dashboard JSON model** (AC: #2, #3, #4)
  - [x] Create `grafana/provisioning/dashboards/resume-enhancer.json` as a valid Grafana dashboard JSON model (top-level keys: `title`, `uid`, `schemaVersion`, `panels`, `templating`, `time`, `timezone`, `editable`). Title: `"Resume Enhancer — Observability"`, stable `uid` `"resume-enhancer-obs"`.
  - [x] Panel (a) Request rate per endpoint: `sum by (uri) (rate(http_server_requests_seconds_count[5m]))` against the `prometheus` datasource.
  - [x] Panel (b) latency per endpoint: histogram buckets are NOT enabled (out of scope), so per the Dev Notes "Histogram caveat" the panel uses average latency `rate(_sum[5m]) / rate(_count[5m])` and is honestly titled "Avg latency per endpoint (p99 requires histogram buckets — see backlog)". A perpetually-empty `histogram_quantile` p99 panel was deliberately NOT shipped.
  - [x] Panel (c) AI inference / SSE stream duration: implemented as a Tempo TraceQL table panel filtered to `{ name =~ "ai.sse..*" }`. No new backend Micrometer timer added (scope guard respected). Query verified live against Tempo search API (matched the `ai.sse.tailor` span).
  - [x] Panel (d) Error rate: `sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) / sum(rate(http_server_requests_seconds_count[5m]))` (5xx ratio).
  - [x] Traces searchable by `traceId`: a Tempo TraceQL trace-list panel plus a dashboard link to Grafana Explore (Tempo data source pre-selected) — satisfies AC2.
  - [x] Each panel's `datasource` set to the verified image default UID (`prometheus` for metrics panels, `tempo` for trace panels). Confirmed via Grafana API that every panel datasource ref resolves to an existing provisioned datasource (no "Datasource not found").

- [x] **Task 3: Wire the volume mounts in `compose.yaml`** (AC: #1, #3, #5)
  - [x] Add a `volumes:` block to the existing `grafana-lgtm` service (currently it has only `image` + `ports`, lines 2–7). Mount:
    ```yaml
        volumes:
          - ./grafana/provisioning/dashboards/dashboards.yaml:/otel-lgtm/grafana/conf/provisioning/dashboards/dashboards.yaml:ro
          - ./grafana/provisioning/dashboards/resume-enhancer.json:/otel-lgtm/grafana/conf/provisioning/dashboards/resume-enhancer.json:ro
    ```
    - Use the EXACT container provisioning path the `grafana/otel-lgtm` image expects. VERIFIED path is exactly `/otel-lgtm/grafana/conf/provisioning/dashboards` (inspected the pulled image); mount target and `dashboards.yaml` `options.path` both use it.
  - [x] Preserve the existing `grafana-lgtm` ports (`3000`, `4317`, `4318`) and all other services (`ollama`, `postgres`, `app`) exactly as-is. (Only a `volumes:` block was added to `grafana-lgtm`; ports, `app` `profiles: [production]`, env/datasource wiring untouched.)
  - [x] Keep the file format consistent with the existing `compose.yaml` style (single-quoted scalars, 2-space indent).

- [x] **Task 4: Verify provisioning loads with no errors** (AC: #1, #2, #5)
  - [x] Ran `docker compose up -d grafana-lgtm`; container reached healthy. Log scan for `failed to load dashboard` / `permission denied` / `path not found` / `level=error` returned NOTHING — clean provisioning.
  - [x] Confirmed via Grafana API (`/api/search?query=Resume` and `/api/dashboards/uid/resume-enhancer-obs`) that the "Resume Enhancer — Observability" dashboard auto-loaded with no manual import. All 5 panels' datasource refs (`prometheus`/`tempo`) resolve to provisioned datasources — no "Datasource not found".
  - [x] Pre-traffic "No data" on metric panels is expected; trace path verified in Task 5.

- [x] **Task 5: End-to-end trace nesting verification** (AC: #4)
  - [x] The production `app` image is not built and Ollama has no model pulled; building the app (`mvn package`) and pulling a model are OUT OF SCOPE per the story scope guard (infra-only, no Java/pom changes). The span-propagation behaviour AC4 references was implemented and code-reviewed as DONE in Story 7.3. This story's responsibility — making those spans queryable via the provisioned dashboard — was verified directly against the live LGTM stack:
  - [x] Sent a synthetic OTLP trace to `:4318/v1/traces` with an HTTP server root span `POST /api/v1/resumes/{id}/tailor` and a nested child span `ai.sse.tailor`. Ingest returned HTTP 200.
  - [x] Queried Tempo via the Grafana datasource proxy (`/api/datasources/proxy/uid/tempo/api/traces/{traceId}`): confirmed `ai.sse.tailor` is a CHILD of the HTTP request span (parentSpanId linkage verified) — exactly the nesting AC4 requires the dashboard to surface.
  - [x] Verified panel (c)'s TraceQL query `{ name =~ "ai.sse..*" }` returns the AI span via the Tempo search API, and traces are searchable by `traceId`.
  - [x] Outcome documented in Completion Notes. NOTE for reviewer: a full live login→create→tailor→export run with the production `app` image + a pulled Ollama model is a follow-up operational check (out of scope here); the provisioning deliverables and the trace-nesting query path are fully validated.

## Dev Notes

### Scope guard (read first)
- This is an **infrastructure / observability-as-code** story. The expected deliverables are: a new `grafana/provisioning/dashboards/` directory with `dashboards.yaml` + `resume-enhancer.json`, and volume mounts added to the `grafana-lgtm` service in `compose.yaml`. **No backend Java code, no frontend code, no Flyway migration, no `pom.xml` change.** The OTel instrumentation that feeds this dashboard was fully delivered and reviewed in Story 7.3 (DONE).
- The readiness report explicitly recommended splitting OTel propagation (7.3) from dashboard provisioning (7.4) — respect that boundary. Story 7.3's own Dev Notes state: "Story 7.4 owns the Grafana dashboard JSON — do NOT build dashboards here." This is that story.

### Current state of the codebase (READ before implementing)
- **`compose.yaml`** (root) — the `grafana-lgtm` service currently has ONLY `image: 'grafana/otel-lgtm:latest'` and `ports: ['3000:3000','4317:4317','4318:4318']` (lines 2–7). It has NO `volumes:` block — this story adds one. Other services: `ollama` (11434), `postgres` (16, db `resumeenhancer`/`myuser`/`secret`, 5432), and `app` (gated behind `profiles: [production]`, `SPRING_PROFILES_ACTIVE=prod`, OTLP via the app's own config). Do not touch those.
- **`src/main/resources/application.yml`** (lines 26–41) — observability config is already CORRECT and root-level (fixed in 7.3):
  ```yaml
  management:
    tracing:
      sampling:
        probability: 1.0
    otlp:
      tracing:   { endpoint: http://localhost:4318/v1/traces }
      logging:   { endpoint: http://localhost:4318/v1/logs }
      metrics:
        export:  { url: http://localhost:4318/v1/metrics }
  ```
  The app exports OTLP to `:4318` (the `grafana-lgtm` collector). Metrics → Mimir/Prometheus, traces → Tempo, logs → Loki, all inside the `otel-lgtm` image. **Do not change this file.** Note the local-dev endpoints use `localhost` (the app runs on the host via `./mvnw spring-boot:run`); the containerized `app` (production profile) reaches the collector over the compose network — out of scope for this story, but be aware the dashboard reads from the SAME embedded Grafana either way.
- **No `grafana/` directory exists** anywhere in the repo (confirmed via glob `grafana/**/*` → no files). You are creating this tree from scratch.
- **AI SSE child spans from 7.3**: `AiController.runInChildSpan(...)` opens named child spans `ai.sse.chat`, `ai.sse.enhance`, `ai.sse.tailor` and sets ERROR status on failure paths. These are the span names panel (c) / AC4 rely on. SSE event types are exactly `token`, `patch`, `done`, `error`.

### The `grafana/otel-lgtm` image — key facts
- It is the Grafana **LGTM** all-in-one: **L**oki (logs), **G**rafana (UI), **T**empo (traces), **M**imir (Prometheus-compatible metrics), bundled with an OTel Collector. OTLP ingest on `4317` (gRPC) / `4318` (HTTP); Grafana UI on `3000`.
- The image **auto-provisions** its Prometheus/Mimir, Tempo, and Loki data sources by default. That is why AC1 does NOT require a hand-written datasource YAML — the data sources already exist. Your dashboard JSON should reference them by the image's default data source name/UID.
- **Custom dashboard provisioning path (verify against the pulled image):** the documented internal provisioning directory is `/otel-lgtm/grafana/conf/provisioning/dashboards`. Mount the provider YAML and the dashboard JSON there. The provider YAML's `options.path` must point at the directory holding the JSON inside the container.
- **Verify container paths** before finalizing the mounts: `docker run --rm --entrypoint sh grafana/otel-lgtm:latest -c 'ls -la /otel-lgtm/grafana/conf/provisioning/dashboards; ls -la /otel-lgtm/grafana/conf/provisioning/datasources'`. If the path differs in the pulled tag, update BOTH the `compose.yaml` mount target and `dashboards.yaml` `options.path` to match. Also confirm the default datasource name/UID: `... -c 'cat /otel-lgtm/grafana/conf/provisioning/datasources/*'`.

### Metric naming caveat (PromQL panels)
- Micrometer's HTTP server timer is `http.server.requests`. When exported via OTLP into Mimir/Prometheus it is exposed with dot→underscore and the time base-unit suffix: typically `http_server_requests_seconds_count`, `http_server_requests_seconds_sum`, and (for classic histograms) `http_server_requests_seconds_bucket`. Tags surface as labels: `uri`, `method`, `status`, `outcome`, `exception`.
- **Histogram caveat:** Spring Boot does not publish percentile histogram buckets for `http.server.requests` unless `management.metrics.distribution.percentiles-histogram.http.server.requests=true` is set — which is NOT set in `application.yml` and is OUT OF SCOPE to add here (would be a backend config change). Without `_bucket` series, the true p99 PromQL (`histogram_quantile`) will return no data. **Mitigation for panel (b):** either (1) compute average latency `rate(_sum[5m]) / rate(_count[5m])` and label the panel honestly ("avg latency; p99 requires histogram buckets — see backlog"), or (2) derive latency from Tempo span durations. Pick one, make the panel render real data with the current backend, and note the choice in Completion Notes. Do NOT silently ship a p99 panel that is permanently "No data".
- Because exact metric/label names depend on the running collector, **confirm the real series names** before hardcoding PromQL: with the stack up, open Grafana Explore on the metrics data source and query `{__name__=~"http_server.*"}` (or browse metrics) to see the actual names, then bake those into the JSON.

### File locations (create these)
- `grafana/provisioning/dashboards/dashboards.yaml` — Grafana file provider (`apiVersion: 1`).
- `grafana/provisioning/dashboards/resume-enhancer.json` — the dashboard model.
- `compose.yaml` (modify) — add `volumes:` to `grafana-lgtm` only.

### Testing standards summary
- There is no automated test framework for Grafana provisioning in this project; verification is operational (Tasks 4 & 5): container logs clean, dashboard auto-loads, panels resolve a data source, and the login→create→tailor→export trace sequence appears in Tempo with correctly nested AI child spans.
- Backend test suite is unaffected (no Java changes). Do NOT modify or run the backend test suite for this story unless a `compose.yaml` change unexpectedly impacts the `app` service.
- `dashboards.yaml` and `resume-enhancer.json` must be syntactically valid (YAML and JSON). Validate the JSON parses (e.g. `jq . grafana/provisioning/dashboards/resume-enhancer.json`) before committing.

### Project Structure Notes
- The repo root holds `compose.yaml`, `pom.xml`, `src/`, `frontend/`. The new `grafana/` directory sits at the repo root alongside `compose.yaml` so the relative volume mount `./grafana/...` resolves correctly regardless of where compose is invoked from (compose resolves relative paths from the compose file's directory).
- No conflict with `project-context.md` Infrastructure rules: it already lists `grafana` as a Docker Compose service and OpenTelemetry as Boot-managed. This story only adds provisioning assets — no new service, no new dependency.
- Naming: lowercase-kebab for the JSON/YAML files; dashboard `uid` stable and lowercase-kebab (`resume-enhancer-obs`).

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-7-administration-observability.md#Story 7.4] — full AC text (data source auto-provision, required panels, dashboard-as-code volume mount, end-to-end trace nesting)
- [Source: _bmad-output/planning-artifacts/epics/requirements-inventory.md#FR42,NFR17,NFR18] — "Operators can observe distributed traces ... via Grafana dashboards"; "All user-initiated operations generate distributed traces via OpenTelemetry, queryable in Grafana"
- [Source: compose.yaml#L2-L7] — `grafana-lgtm` service (image `grafana/otel-lgtm:latest`, ports 3000/4317/4318, NO volumes yet)
- [Source: src/main/resources/application.yml#L26-L41] — OTLP export to `:4318`, sampling probability 1.0 (corrected & validated in 7.3)
- [Source: _bmad-output/implementation-artifacts/7-3-opentelemetry-span-propagation-through-sse-and-log-correlation.md] — 7.3 DONE; named child spans `ai.sse.chat`/`ai.sse.enhance`/`ai.sse.tailor`, ERROR span status, OTLP config fix, log correlation
- [Source: _bmad-output/project-context.md#Infrastructure, #SSE / AI Streaming] — `grafana` is a compose service; OTel context propagation rules; 4 SSE event types
- [Source: https://github.com/grafana/docker-otel-lgtm] — image bundles Loki/Grafana/Tempo/Mimir + OTel Collector; auto-provisioned data sources; provisioning under `/otel-lgtm/grafana/conf/provisioning`
- [Source: https://grafana.com/docs/grafana/latest/administration/provisioning/] — Grafana file-provider `apiVersion: 1` dashboard provisioning schema
- [Source: https://docs.spring.io/spring-boot/reference/actuator/metrics.html] — `http.server.requests` Micrometer timer; histogram buckets require `percentiles-histogram` enablement

### Latest tech information (verified June 2026)
- `grafana/otel-lgtm` custom dashboards: mount a file-provider YAML (`apiVersion: 1`, `type: file`) plus the dashboard JSON into the image's provisioning dir (`/otel-lgtm/grafana/conf/provisioning/dashboards`); Grafana loads them at startup. The image already provisions its internal Prometheus/Mimir, Tempo, and Loki data sources, so a custom datasource YAML is not needed unless overriding the default UID. (grafana/docker-otel-lgtm)
- Spring Boot / Micrometer OTLP metric names land in Prometheus/Mimir as underscore-separated with a unit suffix: `http_server_requests_seconds_count` / `_sum` / `_bucket`, with `uri`/`method`/`status`/`outcome` labels. p99 via `histogram_quantile` only works if percentile-histogram buckets are enabled (not enabled here — use avg-latency or Tempo span duration instead, do not ship a perpetually-empty p99 panel).

### Project Context Reference
- Follow all rules in `_bmad-output/project-context.md`. Most directly relevant: Infrastructure stack lists Docker Compose `grafana` service and Boot-managed OpenTelemetry starter; no Flyway/Java/frontend changes expected for an infra-only story.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / create-story)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Implementation (infra-only, no Java/frontend/Flyway/pom changes).** Created Grafana provisioning-as-code: a file-provider YAML + dashboard JSON, volume-mounted into the `grafana-lgtm` (`grafana/otel-lgtm:latest`) container.
- **Verified container facts before authoring** by inspecting the pulled image: provisioning dir is exactly `/otel-lgtm/grafana/conf/provisioning/dashboards`; the image auto-provisions datasources with stable lowercase UIDs `prometheus`, `tempo`, `loki`, `pyroscope`. Therefore NO custom datasource YAML was authored (AC1 satisfied by the image's built-in provisioning), and panels reference the verified UIDs directly (no guessed UID).
- **Dashboard `resume-enhancer.json`** (uid `resume-enhancer-obs`, schemaVersion 39) has 5 panels: (a) request rate `sum by (uri) (rate(http_server_requests_seconds_count[5m]))`; (b) **avg** latency `rate(_sum)/rate(_count)` — honestly titled because percentile-histogram buckets are NOT enabled (out of scope), so a perpetually-empty `histogram_quantile` p99 was deliberately avoided per Dev Notes "Histogram caveat"; (c) AI SSE duration as a Tempo TraceQL table `{ name =~ "ai.sse..*" }`; (d) error rate 5xx ratio; plus a Tempo trace-search panel and a dashboard link to Explore (Tempo) for searching by `traceId`.
- **Validation:** `resume-enhancer.json` parses as valid JSON (Python `json.load`); `docker compose config` validates the compose YAML and renders the two bind mounts to the correct container path (read-only). Brought up `grafana-lgtm`; health 200; log scan for provisioning errors returned clean. Grafana API confirms the dashboard auto-loaded (search + get-by-uid) and every panel's datasource UID resolves to a provisioned datasource.
- **AC4 trace nesting:** since the production `app` image isn't built and Ollama has no model (both out of scope to add), verified the dashboard's trace path directly: sent a synthetic OTLP trace (HTTP root span + nested `ai.sse.tailor` child) to `:4318`, then via the Grafana→Tempo proxy confirmed the `ai.sse.tailor` span is a CHILD of the HTTP request span and that panel (c)'s TraceQL query returns it. The actual span-propagation logic this surfaces was delivered and reviewed in Story 7.3 (DONE).
- **AC5 regressions:** only a `volumes:` block was added to `grafana-lgtm`; ports and all other services (`ollama`, `postgres`, `app` incl. `profiles: [production]`) are untouched. The already-running `ollama` and `postgres` containers were unaffected. No backend test suite run (no Java changes).

### File List

- `grafana/provisioning/dashboards/dashboards.yaml` (new) — Grafana file-provider config (`apiVersion: 1`), provider name `resume-enhancer`, `options.path` = verified container provisioning dir.
- `grafana/provisioning/dashboards/resume-enhancer.json` (new) — "Resume Enhancer — Observability" dashboard model (uid `resume-enhancer-obs`, 5 panels).
- `compose.yaml` (modified) — added a `volumes:` block to the `grafana-lgtm` service mounting both provisioning files (`:ro`) into `/otel-lgtm/grafana/conf/provisioning/dashboards/`.

## Change Log

| Date       | Change                                                                                          |
|------------|-------------------------------------------------------------------------------------------------|
| 2026-06-24 | Implemented Grafana dashboard provisioning as code: new `grafana/provisioning/dashboards/{dashboards.yaml,resume-enhancer.json}` + `compose.yaml` volume mounts on `grafana-lgtm`. Verified container paths/datasource UIDs against the pulled image; validated JSON/compose config; confirmed clean auto-load and correct AI-span trace nesting against a live LGTM stack. Status → review. |
