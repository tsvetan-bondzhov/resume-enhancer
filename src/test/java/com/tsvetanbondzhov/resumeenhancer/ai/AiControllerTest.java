package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiControllerTest {

    @Mock
    private AiService aiService;

    @Mock
    private OllamaHealthGuard healthGuard;

    @Mock
    private ResumeService resumeService;

    private ObjectMapper objectMapper;

    private AiController aiController;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();
        DocumentPatchService documentPatchService = new DocumentPatchService(objectMapper);
        aiController = new AiController(aiService, healthGuard, objectMapper, resumeService, documentPatchService, memory);
    }

    // ─── /chat — unavailable path ─────────────────────────────────────────────

    @Test
    void chat_returns503_when_ollama_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        ChatRequest request = new ChatRequest("Hello AI", null, null, false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void chat_response_body_has_problem_detail_when_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        ChatRequest request = new ChatRequest("Hello AI", null, null, false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().toString()).contains("unavailable");
    }

    // ─── /chat — available path ───────────────────────────────────────────────

    @Test
    void chat_returns200_with_sse_emitter_when_ollama_available() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(ChatMemory.class), any(), anyBoolean()))
                .thenReturn(Flux.just("Hello", " world"));

        ChatRequest request = new ChatRequest("Say hello", null, null, false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        // Give the virtual thread a moment to process
        Thread.sleep(100);
    }

    @Test
    void chat_withConversationId_returns200_with_sse_emitter() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(ChatMemory.class), any(), anyBoolean()))
                .thenReturn(Flux.just("Hello", " world"));

        ChatRequest request = new ChatRequest("Hello AI", null, "conv-123", false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        Thread.sleep(100);
        verify(aiService).streamChat(eq("Hello AI"), eq("conv-123"), any(ChatMemory.class), any(), anyBoolean());
    }

    @Test
    void chat_withoutConversationId_generates_conversationId_and_returns200() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(ChatMemory.class), any(), anyBoolean()))
                .thenReturn(Flux.just("token1"));

        ChatRequest request = new ChatRequest("Hello AI", null, null, false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(100);
        verify(aiService).streamChat(anyString(), matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"), any(ChatMemory.class), any(), anyBoolean());
    }

    // ─── /enhance — unavailable path ─────────────────────────────────────────

    @Test
    void enhance_returns503_when_ollama_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        EnhanceRequest request = new EnhanceRequest(UUID.randomUUID().toString(), null);
        Authentication authentication = mock(Authentication.class);

        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void enhance_response_body_has_problem_detail_when_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        EnhanceRequest request = new EnhanceRequest(UUID.randomUUID().toString(), null);
        Authentication authentication = mock(Authentication.class);

        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().toString()).contains("unavailable");
    }

    // ─── /enhance — available path ───────────────────────────────────────────

    @Test
    void enhance_returns200_with_sse_emitter_when_ollama_available() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);

        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");

        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);
        when(aiService.streamEnhance(any(ResumeDocument.class), anyString(), any(ChatMemory.class))).thenReturn(Flux.just("token1", "token2"));

        EnhanceRequest request = new EnhanceRequest(resumeId.toString(), null);
        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        // Give the virtual thread a moment to process
        Thread.sleep(100);
    }

    // ─── ChatRequest and EnhanceRequest record coverage ──────────────────────

    @Test
    void chatRequest_record_construction_and_accessors() {
        String prompt = "Write my resume";
        String resumeId = "abc-123";
        String conversationId = "conv-456";
        ChatRequest request = new ChatRequest(prompt, resumeId, conversationId, false);

        assertThat(request.prompt()).isEqualTo(prompt);
        assertThat(request.resumeId()).isEqualTo(resumeId);
        assertThat(request.conversationId()).isEqualTo(conversationId);
    }

    @Test
    void chatRequest_with_null_resumeId_and_null_conversationId() {
        ChatRequest request = new ChatRequest("prompt", null, null, false);

        assertThat(request.prompt()).isEqualTo("prompt");
        assertThat(request.resumeId()).isNull();
        assertThat(request.conversationId()).isNull();
    }

    @Test
    void enhanceRequest_record_construction_and_accessor() {
        String resumeId = UUID.randomUUID().toString();
        EnhanceRequest request = new EnhanceRequest(resumeId, null);

        assertThat(request.resumeId()).isEqualTo(resumeId);
    }

    // ─── /tailor — unavailable path ──────────────────────────────────────────

    @Test
    void tailor_returns503_when_ollama_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        TailorRequest request = new TailorRequest(UUID.randomUUID().toString(), "Senior Java Developer role", null);
        Authentication authentication = mock(Authentication.class);

        ResponseEntity<?> response = aiController.tailor(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void tailor_response_body_has_problem_detail_when_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        TailorRequest request = new TailorRequest(UUID.randomUUID().toString(), "Senior Java Developer role", null);
        Authentication authentication = mock(Authentication.class);

        ResponseEntity<?> response = aiController.tailor(request, authentication);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().toString()).contains("unavailable");
    }

    // ─── /tailor — available path ─────────────────────────────────────────────

    @Test
    void tailor_returns200_with_sse_emitter_when_ollama_available() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);

        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");

        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);
        when(aiService.streamTailor(any(ResumeDocument.class), anyString(), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("token1", "token2"));

        TailorRequest request = new TailorRequest(resumeId.toString(), "Senior Java Developer", null);
        ResponseEntity<?> response = aiController.tailor(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        // Give the virtual thread a moment to process
        Thread.sleep(100);
    }

    @Test
    void tailorRequest_record_construction_and_accessors() {
        String resumeId = UUID.randomUUID().toString();
        String jobDesc = "We are looking for a Java developer";
        TailorRequest request = new TailorRequest(resumeId, jobDesc, null);

        assertThat(request.resumeId()).isEqualTo(resumeId);
        assertThat(request.jobDescription()).isEqualTo(jobDesc);
    }

    // ─── /enhance — SSE token + patch + done stream processing ──────────────

    @Test
    void enhance_streamsTokensAndCompletesNormally() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");
        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);

        // Stream with token, a valid patch JSON line, and then complete
        String patchJson = "{\"sectionId\":\"WORK_EXPERIENCE\",\"itemIndex\":0,\"field\":\"jobTitle\",\"newValue\":\"Senior\"}";
        when(aiService.streamEnhance(any(ResumeDocument.class), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("token1\n", patchJson + "\n", "token2"));

        EnhanceRequest request = new EnhanceRequest(resumeId.toString(), null);
        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        Thread.sleep(200);
    }

    @Test
    void enhance_streamsTokensWithEmptyLine_completesNormally() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");
        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);

        // Empty intermediate tokens (covers the !line.isEmpty() guard)
        when(aiService.streamEnhance(any(ResumeDocument.class), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("chunk1\n", "\n", "chunk2"));

        EnhanceRequest request = new EnhanceRequest(resumeId.toString(), null);
        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(200);
    }

    @Test
    void enhance_withRemainingBufferOnComplete_flushesPatch() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");
        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);

        // A patch JSON without trailing newline — will be flushed in doOnComplete
        String patchJson = "{\"sectionId\":\"SKILLS\",\"itemIndex\":0,\"field\":\"name\",\"newValue\":\"Kotlin\"}";
        when(aiService.streamEnhance(any(ResumeDocument.class), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just(patchJson));

        EnhanceRequest request = new EnhanceRequest(resumeId.toString(), null);
        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(200);
    }

    @Test
    void enhance_withStreamError_completesWithError() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");
        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);

        // Flux that emits an error — exercises doOnError in buildEnhanceDisposable
        when(aiService.streamEnhance(any(ResumeDocument.class), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.error(new RuntimeException("AI backend unavailable")));

        EnhanceRequest request = new EnhanceRequest(resumeId.toString(), null);
        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(200);
    }

    // ─── /tailor — SSE streaming paths ───────────────────────────────────────

    @Test
    void tailor_streamsTokensAndCompletesNormally() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");
        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);
        when(aiService.streamTailor(any(ResumeDocument.class), anyString(), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("token1\n", "token2"));

        TailorRequest request = new TailorRequest(resumeId.toString(), "Senior Java Developer", null);
        ResponseEntity<?> response = aiController.tailor(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(200);
    }

    @Test
    void tailor_withStreamError_completesWithError() throws InterruptedException {
        UUID resumeId = UUID.randomUUID();
        ResumeDocument document = new ResumeDocument(List.of());
        ResumeDto resumeDto = new ResumeDto(resumeId, "My Resume", null, document, false,
                Instant.now(), Instant.now());

        when(healthGuard.isAvailable()).thenReturn(true);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("user@example.com");
        when(resumeService.getResume(anyString(), any(UUID.class))).thenReturn(resumeDto);

        // Exercises doOnError in buildEnhanceDisposable (tailor reuses it) + trySendError
        when(aiService.streamTailor(any(ResumeDocument.class), anyString(), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.error(new RuntimeException("Model timeout")));

        TailorRequest request = new TailorRequest(resumeId.toString(), "Job description here", null);
        ResponseEntity<?> response = aiController.tailor(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(200);
    }

    // ─── /chat — SSE streaming paths ─────────────────────────────────────────

    @Test
    void chat_withStreamError_exercisesDoOnErrorPath() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(), any(), anyBoolean()))
                .thenReturn(Flux.error(new RuntimeException("Connection reset")));

        ChatRequest request = new ChatRequest("Say hello", null, null, false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(200);
    }

    @Test
    void chat_withTokens_exercisesDoOnNextAndDoOnComplete() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        // Provides actual tokens so doOnNext and doOnComplete fire
        when(aiService.streamChat(anyString(), anyString(), any(), any(), anyBoolean()))
                .thenReturn(Flux.just("Hello", " ", "world"));

        ChatRequest request = new ChatRequest("Say hello", null, "conv-existing", false);
        ResponseEntity<?> response = aiController.chat(request, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(300);
    }
}
