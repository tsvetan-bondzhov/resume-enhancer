# Story 5.4: AI Enhancement — Suggestions with Accept/Reject

**Status:** review
**Epic:** 5 — AI Enhancement & Conversational Chat
**Story Key:** 5-4-ai-enhancement-suggestions-with-accept-reject
**Dependencies:** Story 5-1 done, Story 5-2 done, Story 5-3 done

---

## Story

As an authenticated user,
I want to request AI-generated improvement suggestions for my resume and accept or reject each one individually,
so that I can improve my resume quality while staying in control of every change.

---

## Acceptance Criteria

**AC1 — "✦ Enhance" button in AIActionBar triggers enhance flow**
**Given** the user is in the resume editor at `/resumes/:id`
**When** the page renders
**Then** an `AIActionBar` component is visible in the editor (below the `EditorToolbar`); it contains a "✦ Enhance" button with `text-blue-600` or `bg-blue-50` tint and the `✦` prefix icon

---

**AC2 — Enhance request fires POST /api/v1/ai/enhance with OllamaHealthGuard**
**Given** the user clicks "✦ Enhance"
**When** the request is triggered
**Then** `POST /api/v1/ai/enhance` is called with `{resumeId}`; `OllamaHealthGuard` is checked first on the backend; if Ollama is unavailable, HTTP 503 is returned with `ProblemDetail` detail "AI features are temporarily unavailable" and no SSE stream is opened

---

**AC3 — Patch events render DiffHighlight marks in ResumeCanvas**
**Given** the SSE stream emits `patch` events
**When** each patch arrives
**Then** the changed text is rendered in `ResumeCanvas` wrapped in `DiffHighlight` `<mark>` elements: additions use `bg-emerald-100 text-emerald-700`, rewrites use `bg-amber-100 text-amber-700`; each mark has `aria-label="AI addition"` or `aria-label="AI rewrite"` and a small icon (never color-only) (UX-DR4)

---

**AC4 — Accept removes DiffHighlight and commits the change**
**Given** AI diff highlights are visible in `ResumeCanvas`
**When** the user clicks "Accept" on a highlighted change
**Then** the `DiffHighlight` for that patch transitions to `hidden` state (removed from DOM); the underlying text change is already committed to `useResumeStore` via `applyPatch` (applied on patch arrival); no additional store action needed on accept — accept is purely a UI dismissal

---

**AC5 — Reject reverts the field and removes DiffHighlight**
**Given** AI diff highlights are visible
**When** the user clicks "Reject" on a highlighted change
**Then** `useResumeStore.applyPatch()` is called with the original `previousValue` to revert the field; the `DiffHighlight` transitions to `hidden` state; the original text is restored in `ResumeCanvas`

---

**AC6 — User interaction fades all DiffHighlight components**
**Given** AI diff highlights are visible in `ResumeCanvas`
**When** any user interaction occurs (scroll, click outside a DiffHighlight)
**Then** all `DiffHighlight` components transition from `visible` to `faded` state (reduced opacity, still visible)

---

**AC7 — DiffHighlight.test.tsx covers all states**
**Given** `DiffHighlight` is implemented
**When** frontend tests run
**Then** `DiffHighlight.test.tsx` verifies:
- `visible` state renders `<mark>` with correct color classes and `aria-label`
- `faded` state applies reduced opacity class
- `hidden` state removes the `<mark>` from the DOM (returns `null` or renders nothing)
- Accept button click fires the `onAccept` callback
- Reject button click fires the `onReject` callback

---

**AC8 — Backend: POST /api/v1/ai/enhance endpoint with SSE streaming**
**Given** `POST /api/v1/ai/enhance` is implemented
**When** called with `{resumeId}`
**Then** `AiController` handles the request; `OllamaHealthGuard` is checked; `AiService.streamEnhance(resumeDocument)` is called; the SSE stream emits `patch` events with `DocumentPatchEvent` JSON payloads, followed by a `done` event; event format matches the existing `patch` event shape: `{"sectionId":"...","itemIndex":0,"field":"...","newValue":"..."}`

---

**AC9 — Streaming state shown in AIActionBar during enhance**
**Given** the enhance SSE stream is active
**When** tokens are flowing
**Then** the `AIActionBar` shows a streaming indicator (e.g. disabled "✦ Enhance" button + `StreamingIndicator` dot) so the user knows inference is in progress; the button re-enables on `done` or `error`

---

**AC10 — Error state inline in AIActionBar (not Toast)**
**Given** the enhance stream returns an `error` event or HTTP 503
**When** the error is received
**Then** an inline error message appears in or below the `AIActionBar`; `toast.error` is NOT used for AI streaming errors

---

## Tasks / Subtasks

### Task 1: Create `DiffHighlight` component (AC: 3, 4, 5, 6, 7)

- [x] Create `frontend/src/components/resume/DiffHighlight.tsx`
- [x] Component props:
  ```typescript
  type DiffHighlightKind = "addition" | "rewrite"
  type DiffHighlightState = "visible" | "faded" | "hidden"

  interface DiffHighlightProps {
    readonly kind: DiffHighlightKind
    readonly state: DiffHighlightState
    readonly children: React.ReactNode
    readonly onAccept: () => void
    readonly onReject: () => void
  }
  ```
- [x] When `state === "hidden"`: return `null` (children are gone from DOM, revealing reverted text)
- [x] When `state === "visible"` or `"faded"`:
  ```tsx
  <mark
    role="mark"
    aria-label={kind === "addition" ? "AI addition" : "AI rewrite"}
    className={[
      kind === "addition"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700",
      state === "faded" ? "opacity-50" : "",
      "relative inline-block rounded-sm px-0.5",
    ].join(" ")}
  >
    {/* Icon — never color-only (UX-DR4, AC3) */}
    <span aria-hidden="true" className="mr-0.5 text-xs">
      {kind === "addition" ? "+" : "~"}
    </span>
    {children}
    {/* Accept/Reject controls */}
    <span className="inline-flex gap-0.5 ml-1 align-middle">
      <button
        type="button"
        aria-label="Accept AI change"
        onClick={onAccept}
        className="text-xs px-1 rounded bg-emerald-200 hover:bg-emerald-300"
      >✓</button>
      <button
        type="button"
        aria-label="Reject AI change"
        onClick={onReject}
        className="text-xs px-1 rounded bg-red-100 hover:bg-red-200"
      >✕</button>
    </span>
  </mark>
  ```
- [x] The `faded` transition happens via CSS class change — no animation library needed

---

### Task 2: Create `useDiffStore` Zustand store (AC: 3, 4, 5, 6)

- [x] Create `frontend/src/stores/useDiffStore.ts`
- [x] State shape:
  ```typescript
  interface DiffEntry {
    id: string              // unique per patch event (crypto.randomUUID())
    sectionId: string
    itemIndex: number
    field: string
    newValue: string
    previousValue: string   // captured BEFORE applyPatch fires, for reject revert
    kind: "addition" | "rewrite"  // "addition" if previousValue is null/"", else "rewrite"
    state: "visible" | "faded" | "hidden"
  }

  interface DiffState {
    diffs: DiffEntry[]
    addDiff: (entry: DiffEntry) => void
    acceptDiff: (id: string) => void      // sets state → "hidden"
    rejectDiff: (id: string) => void      // sets state → "hidden"; caller must also call applyPatch with previousValue
    fadeAll: () => void                   // sets all "visible" → "faded"
    clearAll: () => void                  // resets diffs to []
  }
  ```
- [x] Implement with standard Zustand immutable update pattern:
  ```typescript
  export const useDiffStore = create<DiffState>((set) => ({
    diffs: [],
    addDiff: (entry) =>
      set((state) => ({ ...state, diffs: [...state.diffs, entry] })),
    acceptDiff: (id) =>
      set((state) => ({
        ...state,
        diffs: state.diffs.map((d) =>
          d.id === id ? { ...d, state: "hidden" } : d
        ),
      })),
    rejectDiff: (id) =>
      set((state) => ({
        ...state,
        diffs: state.diffs.map((d) =>
          d.id === id ? { ...d, state: "hidden" } : d
        ),
      })),
    fadeAll: () =>
      set((state) => ({
        ...state,
        diffs: state.diffs.map((d) =>
          d.state === "visible" ? { ...d, state: "faded" } : d
        ),
      })),
    clearAll: () => set((state) => ({ ...state, diffs: [] })),
  }))
  ```
- [x] Store lives in `frontend/src/stores/useDiffStore.ts` — follows existing store naming convention

**Critical design note:** `DiffHighlight` overlays are NOT inserted into the live DOM inside `EditableField` spans — doing so would break the inline `contentEditable` fields. Instead, the section renderers read from `useDiffStore` and render a separate `DiffOverlay` layer positioned absolutely over the section. See Task 3 for the overlay approach.

---

### Task 3: Create `DiffOverlay` component for ResumeCanvas integration (AC: 3, 4, 5, 6)

Because `EditableField` uses `contentEditable` spans, injecting `<mark>` directly into those spans is not feasible without breaking editing. The overlay approach renders `DiffHighlight` entries as a separate layer:

- [x] Create `frontend/src/components/resume/DiffOverlay.tsx`
- [x] Component receives diffs for a specific `sectionId` from `useDiffStore`
- [x] Renders a list of active (non-hidden) `DiffHighlight` entries for that section:
  ```tsx
  interface DiffOverlayProps {
    readonly sectionId: string
  }

  export default function DiffOverlay({ sectionId }: DiffOverlayProps) {
    const diffs = useDiffStore((state) =>
      state.diffs.filter((d) => d.sectionId === sectionId && d.state !== "hidden")
    )
    const acceptDiff = useDiffStore((state) => state.acceptDiff)
    const rejectDiff = useDiffStore((state) => state.rejectDiff)
    const applyPatch = useResumeStore((state) => state.applyPatch)

    if (diffs.length === 0) return null

    return (
      <div className="mt-1 flex flex-col gap-1">
        {diffs.map((diff) => (
          <DiffHighlight
            key={diff.id}
            kind={diff.kind}
            state={diff.state}
            onAccept={() => acceptDiff(diff.id)}
            onReject={() => {
              applyPatch({
                sectionId: diff.sectionId,
                itemIndex: diff.itemIndex,
                field: diff.field,
                newValue: diff.previousValue,
              })
              rejectDiff(diff.id)
            }}
          >
            {diff.newValue}
          </DiffHighlight>
        ))}
      </div>
    )
  }
  ```
- [x] `DiffOverlay` is rendered inside `ResumeSection` after the section items, before the section ends

**Alternative simpler approach (preferred):** Instead of trying to inject into editable fields, show the diff highlights as a summary panel below/beside each section. The changed text is already visible in the `EditableField` (because `applyPatch` applied it). `DiffHighlight` shows the change label, original value (for context), and Accept/Reject buttons. This is clean, accessible, and avoids DOM injection issues.

---

### Task 4: Extend `useStreamingChat` with `startEnhanceStream` (AC: 2, 3, 9, 10)

- [x] Open `frontend/src/hooks/useStreamingChat.ts`
- [x] Add `startEnhanceStream(resumeId: string): () => void` alongside existing methods:
  - Uses the same `fetch`+`ReadableStream` pattern as `startStreamWithPost`
  - Calls `POST /api/v1/ai/enhance` with body `{ resumeId }`
  - On `patch` event: capture `previousValue` from `useResumeStore.getState()` BEFORE calling `applyPatch`, then add a `DiffEntry` to `useDiffStore`, then call `applyPatch`
  - On `done` event: call `options.onDone?.(summary)`; set streaming false
  - On `error` event: call `options.onError?.(detail)`; set streaming false
  - Token events from enhance stream are displayed in `ChatPanel` (via `useChatStore`) — same as chat
- [x] Capture `previousValue` logic (critical — must happen before `applyPatch`):
  ```typescript
  // Inside patch event handling in startEnhanceStream:
  const resumeState = useResumeStore.getState()
  const sections = resumeState.currentResume?.content.sections ?? []
  const section = sections.find((s) => s.sectionType === parsed.sectionId)
  const item = section?.items[parsed.itemIndex]
  const previousValue = item ? (item as Record<string, unknown>)[parsed.field] as string ?? "" : ""

  // Add diff entry BEFORE applying patch
  const diffId = crypto.randomUUID()
  const kind = previousValue ? "rewrite" : "addition"
  useDiffStore.getState().addDiff({
    id: diffId,
    sectionId: parsed.sectionId,
    itemIndex: parsed.itemIndex,
    field: parsed.field,
    newValue: parsed.newValue,
    previousValue,
    kind,
    state: "visible",
  })

  // Then apply the patch (live update to ResumeCanvas)
  applyPatch(parsed)
  ```
- [x] Import `useDiffStore` at top of file: `import { useDiffStore } from "@/stores/useDiffStore"`
- [x] Add `startEnhanceStream` to the return value: `return { startStream, startStreamWithPost, startEnhanceStream }`
- [x] Do NOT remove or modify `startStream` or `startStreamWithPost` — backward compatibility required

---

### Task 5: Create `AIActionBar` component (AC: 1, 9, 10)

- [x] Create `frontend/src/components/resume/AIActionBar.tsx`
- [x] Props:
  ```typescript
  interface AIActionBarProps {
    readonly resumeId: string | undefined
  }
  ```
- [x] Renders below `EditorToolbar` in the center column (see Task 7 for wiring)
- [x] Contains "✦ Enhance" button:
  - `variant="outline"`, `size="sm"`, `className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"`
  - Disabled when `isStreaming` is true
  - Shows `StreamingIndicator` inline when streaming
- [x] On click: calls `startEnhanceStream(resumeId)` from `useStreamingChat`
- [x] Error state: local `errorMessage` state; shown inline below the button (never `toast.error`)
- [x] Skeleton implementation:
  ```tsx
  export default function AIActionBar({ resumeId }: AIActionBarProps) {
    const isStreaming = useChatStore((state) => state.isStreaming)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const cleanupRef = useRef<(() => void) | null>(null)

    const { startEnhanceStream } = useStreamingChat({
      onDone: () => { setErrorMessage(null) },
      onError: (detail) => { setErrorMessage(detail) },
    })

    function handleEnhance() {
      if (!resumeId || isStreaming) return
      setErrorMessage(null)
      const cleanup = startEnhanceStream(resumeId)
      cleanupRef.current = cleanup
    }

    useEffect(() => () => { cleanupRef.current?.() }, [])

    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-card shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isStreaming || !resumeId}
          onClick={handleEnhance}
          className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          ✦ Enhance
          {isStreaming && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 motion-safe:animate-pulse ml-1"
              aria-hidden="true"
            />
          )}
        </Button>
        {errorMessage !== null && (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
  ```
- [x] Import `Button` from `@/components/ui/button`; `useChatStore` from `@/stores/useChatStore`; `useStreamingChat` from `@/hooks/useStreamingChat`

---

### Task 6: Create `DiffHighlight.test.tsx` (AC: 7)

- [x] Create `frontend/src/components/resume/DiffHighlight.test.tsx`
- [x] Use Vitest + React Testing Library
- [x] Test cases:
  1. **visible addition** — renders `<mark>` with `bg-emerald-100`, `aria-label="AI addition"`, `+` icon, Accept + Reject buttons
  2. **visible rewrite** — renders `<mark>` with `bg-amber-100`, `aria-label="AI rewrite"`, `~` icon
  3. **faded state** — renders `<mark>` with `opacity-50` class
  4. **hidden state** — renders nothing (null); `<mark>` not in the DOM
  5. **Accept button click** — fires `onAccept` callback
  6. **Reject button click** — fires `onReject` callback
- [x] No mock needed — `DiffHighlight` is a pure presentational component with no store dependencies

---

### Task 7: Wire `AIActionBar` and `DiffOverlay` into `EditorPage` and `ResumeSection` (AC: 1, 6)

- [x] Open `frontend/src/pages/EditorPage.tsx`
- [x] Import `AIActionBar`:
  ```tsx
  import AIActionBar from "@/components/resume/AIActionBar"
  ```
- [x] Add `AIActionBar` to the center column, between `EditorToolbar` and `ResumeCanvas`:
  ```tsx
  // BEFORE:
  <EditorToolbar ... />
  {error !== null && !isLoading ? ...
  // AFTER:
  <EditorToolbar ... />
  <AIActionBar resumeId={id} />
  {error !== null && !isLoading ? ...
  ```
- [x] Add `fadeAll` call on user interaction: wire a `onClick` handler on the center column wrapper that calls `useDiffStore.getState().fadeAll()` when the user clicks anywhere in the canvas area (but not on `DiffHighlight` accept/reject buttons — event propagation stops at those)
  ```tsx
  // In EditorPage center column container:
  <div
    className="flex flex-col h-full overflow-hidden"
    onClick={() => useDiffStore.getState().fadeAll()}
  >
    ...
  </div>
  ```
- [x] Import `useDiffStore` in `EditorPage.tsx`:
  ```tsx
  import { useDiffStore } from "@/stores/useDiffStore"
  ```
- [x] Clear diffs on resume unmount (in the existing cleanup `useEffect`):
  ```tsx
  useEffect(() => {
    return () => {
      setCurrentResume(null)
      useChatStore.getState().clearMessages()
      useDiffStore.getState().clearAll()  // ADD THIS
    }
  }, [setCurrentResume])
  ```
- [x] Add `DiffOverlay` to `ResumeSection.tsx`: render `<DiffOverlay sectionId={section.sectionType} />` at the bottom of each section container (inside the section wrapper, after items)

---

### Task 8: Backend — `EnhanceRequest` record and `POST /api/v1/ai/enhance` endpoint (AC: 2, 8)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/EnhanceRequest.java`:
  ```java
  package com.tsvetanbondzhov.resumeenhancer.ai;

  import jakarta.validation.constraints.NotBlank;

  public record EnhanceRequest(
          @NotBlank String resumeId
  ) {}
  ```
- [x] Add `streamEnhance` method to `AiService`:
  ```java
  public Flux<String> streamEnhance(ResumeDocument document) {
      try {
          String resumeJson = buildEnhancePrompt(document);
          return chatClient.prompt()
                  .user(resumeJson)
                  .stream()
                  .content()
                  .onErrorMap(e -> new OllamaUnavailableException("Ollama is unavailable: " + e.getMessage(), e));
      } catch (Exception e) {
          log.warn("Ollama enhance call failed: {}", e.getMessage());
          throw new OllamaUnavailableException("Ollama is unavailable: " + e.getMessage(), e);
      }
  }
  ```
  - `buildEnhancePrompt(document)` builds a prompt asking the AI to suggest improvements and return them as a series of `DocumentPatchEvent` JSON objects, one per SSE `patch` event. The prompt must instruct the model to output `{"sectionId":"...","itemIndex":0,"field":"...","newValue":"..."}` for each patch.
- [x] Add `enhance` endpoint to `AiController`:
  ```java
  @PostMapping(value = "/enhance", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<?> enhance(@Valid @RequestBody EnhanceRequest request, Principal principal) {
      // OllamaHealthGuard first — same pattern as /chat
      if (!healthGuard.isAvailable()) {
          ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                  HttpStatus.SERVICE_UNAVAILABLE,
                  "AI features are temporarily unavailable");
          problem.setTitle("Service Unavailable");
          return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
      }
      // Load resume from ResumeService/ResumeRepository using request.resumeId() and principal
      // ... (see Dev Notes for resume ownership pattern)
      // Stream patch events
      SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
      // Same executor + OTel pattern as /chat endpoint
      ...
      return ResponseEntity.ok(emitter);
  }
  ```
- [x] The enhance endpoint must load the resume and verify ownership (same pattern as `ResumeController.getResume()`)
- [x] `patch` events emitted by the enhance endpoint must parse the AI's raw output into `DocumentPatchEvent` objects and serialize them with `objectMapper.writeValueAsString(patchEvent)`
- [x] `done` event: `{"summary": "Enhancement complete — N suggestions applied"}`

---

### Task 9: Backend unit test for `AiService.streamEnhance` (AC: 8)

- [x] Open `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java`
- [x] Add test: `streamEnhance_returnsPatchFlux` — mocks `ChatClient` to emit a series of patch JSON strings and verifies the flux emits correctly
- [x] Add test: `streamEnhance_ollamaUnavailable_throwsOllamaUnavailableException` — same unavailability pattern as existing `streamChat` tests
- [x] Do NOT modify existing `streamChat` tests — they are passing and must remain green

---

### Task 10: Update `EditorPage.test.tsx` to mock `AIActionBar` (regression guard)

- [x] Open `frontend/src/pages/EditorPage.test.tsx`
- [x] Add mock for `AIActionBar`:
  ```typescript
  vi.mock("@/components/resume/AIActionBar", () => ({
    default: ({ resumeId }: { resumeId: string | undefined }) => (
      <div data-testid="ai-action-bar" data-resume-id={resumeId ?? ""} />
    ),
  }))
  ```
- [x] All existing `EditorPage.test.tsx` tests must continue to pass with 0 regressions

---

## Developer Context & Guardrails

### Files to Create (NEW)

| File | Purpose |
|------|---------|
| `frontend/src/components/resume/DiffHighlight.tsx` | Pure UI component — renders `<mark>` in visible/faded/hidden states with Accept/Reject |
| `frontend/src/components/resume/DiffHighlight.test.tsx` | Unit tests for all DiffHighlight states |
| `frontend/src/components/resume/DiffOverlay.tsx` | Renders DiffHighlight list for a given sectionId from useDiffStore |
| `frontend/src/components/resume/AIActionBar.tsx` | Toolbar row with "✦ Enhance" button and streaming indicator |
| `frontend/src/stores/useDiffStore.ts` | Zustand store managing DiffEntry list and state transitions |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/EnhanceRequest.java` | Request record for POST /api/v1/ai/enhance |

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/hooks/useStreamingChat.ts` | Add `startEnhanceStream` method; import `useDiffStore` |
| `frontend/src/pages/EditorPage.tsx` | Add `AIActionBar`, wire fadeAll on click, add clearAll to unmount cleanup |
| `frontend/src/pages/EditorPage.test.tsx` | Add `vi.mock` for `AIActionBar` |
| `frontend/src/components/resume/ResumeSection.tsx` | Add `<DiffOverlay sectionId={section.sectionType} />` at bottom of each section |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java` | Add `streamEnhance(ResumeDocument)` method |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java` | Add `enhance` endpoint |
| `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java` | Add `streamEnhance` tests |

### Critical Implementation Details

**DiffHighlight must NOT inject into contentEditable:**
`EditableField` uses `contentEditable` spans — injecting a React `<mark>` into the span's children would conflict with the browser's text editing model and cause React reconciliation errors. The `DiffOverlay` approach renders diff highlights as a separate sibling layer below the section items. The user sees the AI-applied text in the editable field AND the diff summary in the overlay.

**previousValue capture is the most critical ordering concern:**
In `startEnhanceStream`, the `previousValue` MUST be captured from `useResumeStore.getState()` BEFORE `applyPatch` is called. If you call `applyPatch` first, the original value is gone and Reject cannot revert. Order: capture → `addDiff` → `applyPatch`.

**`useDiffStore` is a NEW store — do NOT add diff state to `useChatStore` or `useResumeStore`:**
Diff lifecycle (visible/faded/hidden, accept/reject) is orthogonal to chat message state and resume document state. A dedicated store keeps concerns separated and makes it trivial to clear diffs independently.

**`startEnhanceStream` reuses the exact same `fetch`+`ReadableStream` + SSE parsing pattern as `startStreamWithPost`:**
Do NOT reinvent the SSE parsing logic. Extract the shared `parseSSEBuffer` logic if duplication is significant (optional refactor), or copy the same buffer/eventName/dataLine parsing loop. The cleanup, OTel, and token patterns are identical.

**Backend enhance endpoint must verify resume ownership:**
The `resume` package's `ResumeController` already has the ownership pattern:
- Inject `ResumeRepository` (or a `ResumeService` if one exists)
- Call `resumeRepository.findById(UUID.fromString(request.resumeId())).orElseThrow(ResumeNotFoundException::new)`
- Check that `resume.getUser().getId().equals(authenticatedUserId)` — throw `ResumeAccessDeniedException` if not
- Look at `ResumeController` for the exact ownership guard pattern

**AI prompt engineering for patch output:**
The enhance prompt must instruct the model to output structured `DocumentPatchEvent` JSON. The backend must parse the AI's token stream to detect complete JSON objects (not raw text tokens). The simplest approach: the AI outputs one JSON object per line; the backend accumulates tokens and detects line breaks to parse each `DocumentPatchEvent`. Alternative: output all patches as a JSON array in the `done` event. **Recommended for Story 5.4:** Have the AI output patch JSON objects one per line as the stream flows — parse each completed line as a `DocumentPatchEvent` and emit a `patch` SSE event. This is the most natural streaming approach.

**`ResumeDocument` is needed in `AiService.streamEnhance`:**
The enhance endpoint must pass the full `ResumeDocument` to `AiService`. Use `ResumeDocumentConverter` (already in `resume/domain/`) to convert the JPA `Resume` entity's stored JSON to the `ResumeDocument` record. Do NOT call the converter anywhere outside the resume domain layer — if `AiController` needs `ResumeDocument`, have a service method in the `resume` package return it, or load it from `ResumeController`'s established pattern.

**`aiActionBar` loading/disabled state:**
`isStreaming` in `useChatStore` is the single source of truth for whether any AI operation is in flight. The `AIActionBar` reads this to disable the Enhance button. Both `startStreamWithPost` (chat) and `startEnhanceStream` (enhance) call `setStreaming(true/false)` — so the Enhance button is correctly disabled during an active chat stream too.

**`DiffOverlay` click propagation:**
The Accept and Reject buttons inside `DiffHighlight` must call `e.stopPropagation()` so that clicking them does NOT trigger the `fadeAll` handler on the `EditorPage` center column wrapper. Without this, accepting/rejecting would also fade remaining diffs unintentionally.
```tsx
// In DiffHighlight accept/reject buttons:
onClick={(e) => { e.stopPropagation(); onAccept() }}
onClick={(e) => { e.stopPropagation(); onReject() }}
```

**`SecurityConfig` permit-all for `/api/v1/ai/enhance`:**
The `/api/v1/ai/enhance` endpoint requires authentication (like all `/api/v1/**` routes). No `SecurityConfig` changes needed — the existing `JwtAuthenticationFilter` covers it. Do NOT add it to permit-all.

**`useStreamingChat` dual-hook usage:**
`AIActionBar` creates its own `useStreamingChat({ onDone, onError })` instance — this is separate from the `ChatPanel`'s `useStreamingChat` instance. Both share `useChatStore.isStreaming` as the single streaming state flag via the same store. This is correct behavior — only one stream can be active at a time (the button is disabled while `isStreaming` is true).

**Enhance stream token events → ChatPanel:**
When the enhance stream emits `token` events (AI narrating what it's doing), those tokens should be displayed in the `ChatPanel` as an assistant message bubble — same as chat token events. The `startEnhanceStream` implementation should add an assistant message to `useChatStore` at the start and append tokens to it, identical to `startStreamWithPost`. This gives the user visibility into what the AI is enhancing.

### Anti-Patterns to Avoid

- Do NOT inject `<mark>` into `contentEditable` spans — breaks React/browser reconciliation
- Do NOT add diff state to `useChatStore` or `useResumeStore` — use the new `useDiffStore`
- Do NOT call `applyPatch` before capturing `previousValue` — reject revert will be broken
- Do NOT use `toast.error` for AI enhance errors — error is inline in `AIActionBar`
- Do NOT call `ChatClient` from `AiController` directly — goes through `AiService.streamEnhance`
- Do NOT skip `OllamaHealthGuard` check in `AiController.enhance` — AC2 explicitly requires it
- Do NOT add `startEnhanceStream` to `ChatPanel` — it belongs in `AIActionBar` only
- Do NOT create a new React context or prop-drilled state for diffs — `useDiffStore` handles it
- Do NOT hardcode API URLs — use `/api/v1/ai/enhance` (proxied by Vite dev; relative URL)
- Do NOT use `@Async` on the backend enhance endpoint — use `SseEmitter` + `ExecutorService` (same as `/chat`)

---

## Dev Notes

### Key Architecture Decisions from Prior Stories

**Backend SSE pipeline established (Story 5.1):**
- `POST /api/v1/ai/chat` → `AiController.chat()` → `OllamaHealthGuard` → `SseEmitter` + virtual thread
- `ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()` — already instantiated in `AiController`
- OTel: `Context otelContext = Context.current()` captured before `executor.execute()`; `otelContext.makeCurrent()` inside thread
- SSE event format: `emitter.send(SseEmitter.event().name("patch").data(objectMapper.writeValueAsString(patchEvent)))`
- `Disposable` from `tokenFlux.subscribe()` — `emitter.onCompletion(disposable::dispose)` etc.

**Frontend SSE pattern (Story 5.3 — `startStreamWithPost`):**
The complete buffer+eventName+dataLine SSE parsing loop is in `useStreamingChat.ts` lines 97–174. `startEnhanceStream` uses the exact same pattern. Key: buffer accumulates across `reader.read()` calls; split by `\n`; dispatch on blank line; flush remaining buffer after reader signals `done`.

**`applyPatch` is fully implemented (Story 5.2):**
`useResumeStore.applyPatch` is at `frontend/src/stores/useResumeStore.ts` lines 177–204. It is lenient: unknown sectionId, out-of-bounds itemIndex, or unknown field → no-op (does not throw). The backend `DocumentPatchService` is strict (throws `InvalidPatchException`). The reject revert will always succeed on the frontend even if the original patch was a no-op.

**`ResumeCanvas.state` prop already exists:**
`ResumeCanvasProps` at line 17 already has `readonly state?: "idle" | "streaming" | "diff" | "print-preview"`. The `"diff"` state is pre-planned for this story. You may optionally pass `state="diff"` when diffs are active to enable future diff-specific styling in `ResumeCanvas`. For Story 5.4, this is optional — the `DiffOverlay` renders outside `ResumeCanvas`.

**`ResumeSection.tsx` structure:**
`ResumeSection.tsx` delegates to per-type renderers. Add `<DiffOverlay sectionId={section.sectionType} />` at the bottom of the section wrapper in `ResumeSection.tsx`. The section wrapper already exists — add the overlay as the last child.

**Package structure for backend AI domain:**
All AI files live in `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/`:
- `AiController.java` — REST controller
- `AiService.java` — ChatClient caller (only class that touches ChatClient)
- `ChatRequest.java` — POST /ai/chat body
- `DocumentPatchEvent.java` — patch record
- `DocumentPatchService.java` — applies patches to ResumeDocument
- `OllamaHealthGuard.java` — availability check
- `OllamaUnavailableException.java` — typed domain exception
- `InvalidPatchException.java` — typed domain exception
- New: `EnhanceRequest.java` — POST /ai/enhance body

**`ResumeRepository` + ownership pattern:**
`ResumeController.java` already loads a resume and verifies ownership. The `AiController.enhance()` endpoint can inject `ResumeRepository` directly (it's in the same Spring context) — OR call a shared service method. Prefer injecting a `ResumeService` if it exists; otherwise inject `ResumeRepository` with `@Autowired` / constructor injection. The owned-resume check pattern: `resume.getUser().getId()` vs `authenticatedUserId` from `SecurityContextHolder`.

### Git Context

Recent commits:
- `a0b2a56 feat(5-3)`: ChatPanel + startStreamWithPost — SSE POST streaming for production chat panel
- `5c1a2ef feat(5-2)`: DocumentPatchService + useResumeStore.applyPatch — both layers fully tested
- `790ba77 feat(5-1)`: Spring AI streaming SSE + useStreamingChat hook — OTel propagation established

### Package and File Location Rules

- New frontend components: `frontend/src/components/resume/` — `PascalCase.tsx`
- New frontend tests: co-located alongside source as `PascalCase.test.tsx`
- New Zustand stores: `frontend/src/stores/useDiffStore.ts` — follows `use<Domain>Store.ts` naming
- New Java records: `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/` package
- All paths use `@/` alias from `frontend/src/`

### Testing Notes

**`DiffHighlight.test.tsx`:** Pure presentational — no store mocks needed. Pass props directly and verify DOM output. Use `screen.queryByRole("mark")` to verify `<mark>` presence/absence.

**`useDiffStore.test.ts`:** Optional but recommended. Test `addDiff`, `acceptDiff` (state → hidden), `rejectDiff` (state → hidden), `fadeAll` (visible → faded), `clearAll` (empty array). Use `create` from zustand/vanilla in tests to avoid test cross-contamination.

**Backend `AiServiceTest.java`:** Follow the existing test pattern for `streamChat` (mock `ChatClient.Builder`, mock `ChatClient`, mock `.stream().content()` to return `Flux.just(...)`). The enhance test verifies the returned `Flux` emits the expected tokens.

**`EditorPage.test.tsx` regression guard:** Add `vi.mock("@/components/resume/AIActionBar", ...)` before any existing tests import or render `EditorPage`. All 579+ existing frontend tests must remain green.

---

## File List

### To Create

- `frontend/src/components/resume/DiffHighlight.tsx`
- `frontend/src/components/resume/DiffHighlight.test.tsx`
- `frontend/src/components/resume/DiffOverlay.tsx`
- `frontend/src/components/resume/AIActionBar.tsx`
- `frontend/src/stores/useDiffStore.ts`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/EnhanceRequest.java`

### To Modify

- `frontend/src/hooks/useStreamingChat.ts`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/pages/EditorPage.test.tsx`
- `frontend/src/components/resume/ResumeSection.tsx`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed infinite re-render loop in `DiffOverlay`: replaced bare `.filter()` selector with `useShallow` from `zustand/react/shallow` — the filter produces a new array reference on every state read, causing Zustand to trigger re-renders continuously without the shallow equality check.

### Completion Notes List

- AC1: `AIActionBar` rendered below `EditorToolbar` in center column; "✦ Enhance" button with `text-blue-600 border-blue-200 hover:bg-blue-50` styling confirmed.
- AC2: `POST /api/v1/ai/enhance` endpoint implemented in `AiController`; `OllamaHealthGuard` checked first; ownership verified via `ResumeService.getResume()` (same pattern as `ResumeController`); HTTP 503 + `ProblemDetail` on unavailability.
- AC3: `DiffHighlight` `<mark>` rendered with emerald/amber classes + `+`/`~` icon (never color-only) + `aria-label`; `DiffOverlay` renders per-section diff list from `useDiffStore`.
- AC4: Accept calls `acceptDiff(id)` → state transitions to `hidden`; no additional `applyPatch` needed (patch already applied on arrival). `DiffHighlight` returns `null` when hidden.
- AC5: Reject calls `applyPatch(previousValue)` then `rejectDiff(id)`. `previousValue` captured BEFORE `applyPatch` in `startEnhanceStream` — critical ordering preserved.
- AC6: Center column `div` in `EditorPage` has `onClick={() => useDiffStore.getState().fadeAll()}`; accept/reject buttons call `e.stopPropagation()` to prevent unintended fade.
- AC7: `DiffHighlight.test.tsx` — 6 test cases covering all states and callbacks; all pass (586/586 frontend tests green).
- AC8: Backend `AiService.streamEnhance` streams tokens from Ollama; `AiController.enhance` parses line-buffered JSON into `DocumentPatchEvent` SSE events; `done` event sent on completion.
- AC9: `AIActionBar` reads `useChatStore.isStreaming` to disable button and show streaming dot; re-enables on `done`/`error`.
- AC10: Error messages rendered inline in `AIActionBar` via `role="alert"` paragraph; `toast.error` never called for AI streaming errors.
- All 586 frontend tests pass; 36 AiService backend tests pass; 0 new lint errors introduced.

### File List

#### Created
- `frontend/src/components/resume/DiffHighlight.tsx`
- `frontend/src/components/resume/DiffHighlight.test.tsx`
- `frontend/src/components/resume/DiffOverlay.tsx`
- `frontend/src/components/resume/AIActionBar.tsx`
- `frontend/src/stores/useDiffStore.ts`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/EnhanceRequest.java`

#### Modified
- `frontend/src/hooks/useStreamingChat.ts`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/pages/EditorPage.test.tsx`
- `frontend/src/components/resume/ResumeSection.tsx`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/ai/AiController.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/ai/AiServiceTest.java`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

**Review date:** 2026-06-18

**F1 — PATCHED:** `startEnhanceStream` buffer-flush path (lines 308–331 in `useStreamingChat.ts`) was missing `token` and `patch` handlers — inconsistent with the established `startStreamWithPost` flush pattern. Fixed: added `token` append and full `patch` diff-capture + `applyPatch` sequence to the flush, matching the main stream loop.

**F2 — DEFERRED (pre-existing pattern):** `UUID.fromString(request.resumeId())` in `AiController.enhance()` throws `IllegalArgumentException` → caught by global fallback → HTTP 500, should be 400. Same pattern used throughout `ResumeController`. Deferred as pre-existing codebase pattern; no scope in 5-4.

**Verdict:** 1 patch applied, 1 deferred. 586/586 frontend tests green after fix. Review passes.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-18 | Story created with exhaustive context from Epic 5, Stories 5.1–5.3, and full codebase analysis. Ready for dev. | claude-sonnet-4-6 |
| 2026-06-18 | Implemented all 10 tasks: DiffHighlight, useDiffStore, DiffOverlay, startEnhanceStream, AIActionBar, DiffHighlight tests, EditorPage/ResumeSection wiring, EnhanceRequest, AiService.streamEnhance, AiController.enhance, AiServiceTest additions, EditorPage.test mock. Fixed DiffOverlay infinite re-render via useShallow. 586/586 frontend tests + 36 AiService backend tests green. | claude-sonnet-4-6 |
