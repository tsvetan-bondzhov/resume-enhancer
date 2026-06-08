# Epic 4: AI Enhancement & Conversational Chat

Users can enhance their resume with AI suggestions (accept/reject), tailor it to a specific job description, and interact with the AI via a persistent chat panel that applies changes directly to the live document in real time via SSE streaming. The first story is an isolated AI spike to validate the full streaming pipeline before any resume integration.

### Story 4.1: AI Streaming Spike — Spring AI + Ollama + SSE End-to-End

As a developer,
I want an isolated end-to-end spike that proves Spring AI + Ollama + SseEmitter + frontend EventSource work together,
So that the full streaming pipeline is validated and risks are surfaced before dependent stories are built.

**Acceptance Criteria:**

**Given** Ollama is running via Docker Compose with a model available (e.g. `llama3` or `mistral`)
**When** a POST request is made to `POST /api/v1/ai/chat` with a simple prompt
**Then** the endpoint returns an SSE stream; `token` events arrive progressively; a `done` event closes the stream

**Given** the SSE endpoint is called
**When** `OllamaHealthGuard` is invoked at the controller entry point
**Then** if Ollama is unavailable, the endpoint immediately returns HTTP 503 with `ProblemDetail` detail "AI features are temporarily unavailable" — no Spring AI call is made

**Given** the SSE stream is active
**When** the `SseEmitter` async thread runs
**Then** OpenTelemetry span context is explicitly propagated via `Context.makeCurrent()` into the emitter thread; the trace ID appears in the logs for both the request and the async emission (NFR17, NFR18)

**Given** a minimal frontend test harness page exists at `/ai-test` (dev only)
**When** the user submits a prompt
**Then** a `lib/sseClient.ts` `EventSource` connection is opened; `token` events are appended to a text area in real time; the `done` event closes the connection; `error` events display the error message inline

**Given** the SSE stream receives a `patch` event with a valid `DocumentPatchEvent` JSON payload
**When** the event is dispatched
**Then** `useStreamingChat` hook parses the payload and dispatches it to `useResumeStore.applyPatch()` without error (unit test — no live resume needed for the spike)

**Given** `AiService` is implemented
**When** unit tests are run
**Then** `AiServiceTest.java` mocks `ChatClient` and verifies token and done event emission; the test does not require a live Ollama instance

**Given** the spike is complete
**When** the team reviews it
**Then** the chosen Ollama model, prompt format, and any Spring AI 2.0.0-M6 API constraints are documented in a brief note in `docs/ai-spike-findings.md`

### Story 4.2: DocumentPatchService & useResumeStore.applyPatch

As a developer,
I want the `DocumentPatchService` (backend) and `useResumeStore.applyPatch` (frontend) implemented and fully tested,
So that AI-generated patch events can be applied to a `ResumeDocument` in both layers with confidence.

**Acceptance Criteria:**

**Given** a `DocumentPatchEvent` record with a valid `sectionId`, `itemIndex`, `field`, and `newValue`
**When** `DocumentPatchService.apply(document, patchEvent)` is called
**Then** the correct field within the correct `ResumeSection` and `ResumeItem` is updated; the rest of the `ResumeDocument` is unchanged; the updated document is returned

**Given** a `DocumentPatchEvent` references a non-existent `sectionId`
**When** `DocumentPatchService.apply(document, patchEvent)` is called
**Then** a typed domain exception is thrown (not a silent no-op); `GlobalExceptionHandler` would map this to a 422 in a web context

**Given** `DocumentPatchService` is pure domain logic
**When** unit tests are run
**Then** `DocumentPatchServiceTest.java` uses no Spring context (`@ExtendWith(MockitoExtension.class)` only); all edge cases (invalid sectionId, null field, boundary itemIndex) are covered

**Given** `useResumeStore.applyPatch(event)` is called on the frontend
**When** the patch event is processed
**Then** the state update is immutable (`set(state => ...)`); the correct section/item/field is updated; all other state is preserved

**Given** `useResumeStore.applyPatch` is implemented
**When** frontend tests are run
**Then** `useResumeStore.test.ts` verifies correct patching of a nested field, immutable state update, and no mutation of original state object

### Story 4.3: AI Chat Panel & SSE Streaming Integration

As an authenticated user,
I want a persistent chat panel in the resume editor where I can submit natural-language requests to the AI,
So that I can make conversational edits to my resume without leaving the editor.

**Acceptance Criteria:**

**Given** the user is in the resume editor at `/resumes/:id`
**When** the page renders
**Then** the `ChatPanel` component is visible in the right column (288px); it has `role="log"`, `aria-live="polite"`, and `aria-label="AI conversation"` (UX-DR5)

**Given** the user types a message and submits it
**When** the submit action is triggered
**Then** `POST /api/v1/ai/chat` is called via `lib/sseClient.ts`; a `StreamingIndicator` (pulsing `bg-blue-400` dot) appears in the chat panel (UX-DR11); focus is trapped to the input field while the panel is open (UX-DR14)

**Given** the SSE stream is active
**When** `token` events arrive
**Then** each token is appended to the current AI message bubble in real time; no full re-renders occur for each token

**Given** the SSE stream emits a `patch` event
**When** the event is received by `useStreamingChat`
**Then** the patch is dispatched to `useResumeStore.applyPatch()`; `ResumeCanvas` re-renders the updated section immediately

**Given** the SSE stream emits a `done` event
**When** the stream closes
**Then** the `StreamingIndicator` disappears; the AI's `done` summary is displayed as an inline chat bubble (not a Toast); focus returns to the chat input field

**Given** the SSE stream emits an `error` event or the connection fails
**When** the error state is entered
**Then** `ChatPanel` displays "AI is offline — check your Ollama connection" with a Retry button; the error is shown inline in the panel, not as a Toast (UX-DR5)

**Given** the `ChatPanel` is rendered
**When** `prefers-reduced-motion` is enabled in the OS
**Then** the `StreamingIndicator` pulse animation is disabled (UX-DR11)

**Given** `ChatPanel.test.tsx` is implemented
**When** tests run
**Then** the following are verified: message submission calls `sseClient`, token events append to the message, a done event clears the streaming indicator, and an error event shows the error state inline

### Story 4.4: AI Enhancement — Suggestions with Accept/Reject

As an authenticated user,
I want to request AI-generated improvement suggestions for my resume and accept or reject each one individually,
So that I can improve my resume quality while staying in control of every change.

**Acceptance Criteria:**

**Given** the user clicks "✦ Enhance" in the `AIActionBar`
**When** the action is triggered
**Then** the chat input is pre-filled with the enhance prompt template and focused; or the enhance request is sent directly to `POST /api/v1/ai/enhance` — the interaction follows the pattern established in the AI spike (UX-DR6)

**Given** `POST /api/v1/ai/enhance` is called
**When** the SSE stream begins
**Then** `OllamaHealthGuard` is checked first; if Ollama is unavailable, HTTP 503 is returned immediately with no stream opened

**Given** the SSE stream emits `patch` events
**When** each patch arrives
**Then** the changed text is rendered in `ResumeCanvas` wrapped in `DiffHighlight` `<mark>` elements: additions use `emerald-100/emerald-700`, rewrites use `amber-100/amber-700`; each mark has `aria-label="AI addition"` or `aria-label="AI rewrite"` and a small icon (never color-only) (UX-DR4)

**Given** AI diff highlights are visible in `ResumeCanvas`
**When** the user clicks "Accept" on a highlighted change
**Then** the `DiffHighlight` transitions to `hidden` state; the underlying text change is committed to `useResumeStore` and persisted

**Given** AI diff highlights are visible
**When** the user clicks "Reject" on a highlighted change
**Then** `useResumeStore.applyPatch()` is called with the original value to revert the field; the `DiffHighlight` transitions to `hidden`; the original text is restored in `ResumeCanvas`

**Given** the user interacts with the resume after AI suggestions appear
**When** any user interaction occurs (scroll, click outside)
**Then** all `DiffHighlight` components transition from `visible` to `faded` state (dimmed but still visible)

**Given** `DiffHighlight` is implemented
**When** frontend tests are run
**Then** `DiffHighlight.test.tsx` verifies: visible state renders `<mark>` with correct color classes and aria-label, faded state applies reduced opacity, hidden state removes the mark from the DOM

### Story 4.5: AI Job Description Tailoring

As an authenticated user,
I want to provide a job description and have the AI rewrite my resume to align with that role,
So that I can quickly create targeted versions of my resume for specific job applications.

**Acceptance Criteria:**

**Given** the user clicks "✦ Tailor to Job" in the `AIActionBar`
**When** the action is triggered
**Then** a shadcn/ui `Dialog` opens with a `<textarea>` for pasting the job description; Cancel and "Tailor Resume" buttons are shown (UX-DR6)

**Given** the user submits a non-empty job description
**When** "Tailor Resume" is clicked
**Then** the dialog closes; `POST /api/v1/ai/tailor` is called with `{resumeId, jobDescription}` as `TailorRequest`; an SSE stream begins; `StreamingIndicator` appears in the `AIActionBar` toolbar during active inference (UX-DR6)

**Given** the dialog submit is attempted with an empty job description
**When** "Tailor Resume" is clicked
**Then** an inline validation error "Job description is required" appears; the request is not submitted

**Given** `POST /api/v1/ai/tailor` is called
**When** the SSE stream emits `patch` events
**Then** each patch is applied to `useResumeStore` and rendered in `ResumeCanvas` with `DiffHighlight` overlays; accept/reject follows the same pattern as Story 4.4

**Given** the tailoring stream completes with a `done` event
**When** the stream closes
**Then** the resume gets a "Tailored" badge visible on the `ResumeDashboardCard` and `ResumeSidebarItem`; the `StreamingIndicator` in the toolbar disappears

**Given** Ollama is unavailable when the tailor request is submitted
**When** `OllamaHealthGuard` fails
**Then** HTTP 503 is returned; the dialog shows an inline error "AI features are temporarily unavailable — try again later"; no SSE stream is opened

**Given** `TailorController` and `AiService` are implemented for tailoring
**When** unit tests are run
**Then** `AiServiceTest.java` covers the tailor prompt invocation with a mock `ChatClient`; an integration test verifies the 503 response when Ollama is unavailable (mock `OllamaHealthGuard`)

### Story 4.6: AI Q&A Chat (Without Document Edits)

As an authenticated user,
I want to ask the AI questions about resume writing or the tailoring process without triggering document edits,
So that I can get guidance and context while keeping my document unchanged.

**Acceptance Criteria:**

**Given** the user submits a question in the `ChatPanel` (e.g. "What makes a good summary section?")
**When** the AI processes the message
**Then** the response is delivered as `token` events only — no `patch` events are emitted; `ResumeCanvas` is not modified

**Given** the AI response contains only `token` events
**When** the `done` event arrives
**Then** the full response is displayed in the `ChatPanel` as a chat bubble; the `done` summary is shown inline; `useResumeStore` state is unchanged

**Given** the user asks a follow-up question in the same session
**When** the follow-up is submitted
**Then** `MessageWindowChatMemory` (scoped per conversation/session ID) includes prior messages in the context window; the AI's response references the prior conversation

**Given** the user starts a new editor session (new page load)
**When** a chat message is submitted
**Then** the chat history is ephemeral — no prior session messages are included in the new session's context; `MessageWindowChatMemory` is session-scoped

**Given** the AI explicitly asks a follow-up question in its response (FR26)
**When** the user reads the AI response
**Then** the question is displayed in the chat bubble; the user can respond naturally via the chat input; the AI uses the follow-up answer in the next inference

**Given** `AiService` processes a chat message
**When** `DocumentPatchService` is not involved
**Then** no `patch` events are emitted; the response consists only of `token` and `done` events

### Story 4.7: Accessibility Audit & Focus Management for AI Features

As a user with accessibility needs,
I want all AI-related UI components to meet WCAG 2.1 AA standards with correct focus management,
So that I can use the AI features fully with keyboard navigation and assistive technologies.

**Acceptance Criteria:**

**Given** the `DiffHighlight` component renders AI-changed text
**When** audited for accessibility
**Then** every `<mark>` element has an explicit `aria-label` ("AI addition" or "AI rewrite") and a visible icon alongside the color indicator — color is never the sole differentiator (UX-DR4, NFR19)

**Given** a `Dialog` component opens (tailor JD modal, or confirm dialogs from Epic 3)
**When** the dialog opens
**Then** focus moves to the first interactive element inside the dialog; when the dialog closes, focus returns to the trigger element that opened it (UX-DR14, NFR20)

**Given** AI suggestions or streaming responses appear in the `ChatPanel`
**When** a new message is appended
**Then** `role="status"` or the `aria-live="polite"` region on the panel announces the update; a screen reader user receives the notification without a focus change

**Given** a skip link "Skip to resume canvas" pointing to `#resume-canvas` is implemented
**When** a keyboard user reaches the page
**Then** the skip link is visually hidden but becomes visible on focus; activating it moves focus to the `ResumeCanvas` container (UX-DR14)

**Given** the production color combinations are audited via Lighthouse
**When** the Lighthouse accessibility score is checked
**Then** the score is ≥90; all combinations verified: `blue-600` on white ≥4.5:1, `zinc-900` on `zinc-50` ≥4.5:1, all interactive states (UX-DR13, NFR19)

**Given** all icon-only controls in AI components are implemented (StreamingIndicator, action icons)
**When** audited
**Then** each icon-only control has an accessible label via `aria-label` or `<title>`; no control is identifiable by icon alone

---
