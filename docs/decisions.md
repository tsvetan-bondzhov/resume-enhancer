# Architecture Decision Log

_Decisions that are resolved but not captured in the main architecture document._

---

## ADR-001: Ollama Model Selection

**Status:** Decided  
**Date:** 2026-05-14  
**Relevant Story:** Epic 4 — Story 4.1 (AI Streaming Spike)

### Decision

Use **`llama3.2`** (3B parameter variant) as the primary Ollama model for all AI features (chat, enhance, tailor).

### Rationale

- `llama3.2:3b` runs comfortably on developer hardware (8GB RAM) with acceptable inference latency for a local demo
- Strong instruction-following quality for structured output tasks (required for `DocumentPatchEvent` generation)
- Actively maintained by Meta; good Spring AI 2.0.0-M6 compatibility
- Upgrade path to `llama3.2:11b` or `llama3.3:70b` is a one-line config change (`spring.ai.ollama.chat.model`)

### Configuration

```yaml
# application.yml
spring:
  ai:
    ollama:
      chat:
        model: llama3.2
```

### Fallback / Alternatives

- If `llama3.2` is unavailable on the target machine, `mistral:7b` is an acceptable substitute with comparable instruction-following quality
- Model name is configurable — never hardcode `"llama3.2"` in prompt code; always read from `spring.ai.ollama.chat.model`

### Validation

Story 4.1 (AI Streaming Spike) must verify that `llama3.2` produces valid `DocumentPatchEvent` JSON from the enhance and tailor prompts before Epic 4 stories proceed. Document findings in `docs/ai-spike-findings.md`.
