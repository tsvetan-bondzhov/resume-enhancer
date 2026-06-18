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
        aiController = new AiController(aiService, healthGuard, objectMapper, resumeService, memory);
    }

    // ─── /chat — unavailable path ─────────────────────────────────────────────

    @Test
    void chat_returns503_when_ollama_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        ChatRequest request = new ChatRequest("Hello AI", null, null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void chat_response_body_has_problem_detail_when_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        ChatRequest request = new ChatRequest("Hello AI", null, null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().toString()).contains("unavailable");
    }

    // ─── /chat — available path ───────────────────────────────────────────────

    @Test
    void chat_returns200_with_sse_emitter_when_ollama_available() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("Hello", " world"));

        ChatRequest request = new ChatRequest("Say hello", null, null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        // Give the virtual thread a moment to process
        Thread.sleep(100);
    }

    @Test
    void chat_withConversationId_returns200_with_sse_emitter() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("Hello", " world"));

        ChatRequest request = new ChatRequest("Hello AI", null, "conv-123");
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        Thread.sleep(100);
        verify(aiService).streamChat(eq("Hello AI"), eq("conv-123"), any(ChatMemory.class));
    }

    @Test
    void chat_withoutConversationId_generates_conversationId_and_returns200() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString(), anyString(), any(ChatMemory.class)))
                .thenReturn(Flux.just("token1"));

        ChatRequest request = new ChatRequest("Hello AI", null, null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Thread.sleep(100);
        verify(aiService).streamChat(anyString(), matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"), any(ChatMemory.class));
    }

    // ─── /enhance — unavailable path ─────────────────────────────────────────

    @Test
    void enhance_returns503_when_ollama_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        EnhanceRequest request = new EnhanceRequest(UUID.randomUUID().toString());
        Authentication authentication = mock(Authentication.class);

        ResponseEntity<?> response = aiController.enhance(request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void enhance_response_body_has_problem_detail_when_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        EnhanceRequest request = new EnhanceRequest(UUID.randomUUID().toString());
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
        when(aiService.streamEnhance(any(ResumeDocument.class))).thenReturn(Flux.just("token1", "token2"));

        EnhanceRequest request = new EnhanceRequest(resumeId.toString());
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
        ChatRequest request = new ChatRequest(prompt, resumeId, conversationId);

        assertThat(request.prompt()).isEqualTo(prompt);
        assertThat(request.resumeId()).isEqualTo(resumeId);
        assertThat(request.conversationId()).isEqualTo(conversationId);
    }

    @Test
    void chatRequest_with_null_resumeId_and_null_conversationId() {
        ChatRequest request = new ChatRequest("prompt", null, null);

        assertThat(request.prompt()).isEqualTo("prompt");
        assertThat(request.resumeId()).isNull();
        assertThat(request.conversationId()).isNull();
    }

    @Test
    void enhanceRequest_record_construction_and_accessor() {
        String resumeId = UUID.randomUUID().toString();
        EnhanceRequest request = new EnhanceRequest(resumeId);

        assertThat(request.resumeId()).isEqualTo(resumeId);
    }
}
