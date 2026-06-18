package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeService;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
import static org.mockito.Mockito.mock;
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
        aiController = new AiController(aiService, healthGuard, objectMapper, resumeService);
    }

    // ─── /chat — unavailable path ─────────────────────────────────────────────

    @Test
    void chat_returns503_when_ollama_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        ChatRequest request = new ChatRequest("Hello AI", null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void chat_response_body_has_problem_detail_when_unavailable() {
        when(healthGuard.isAvailable()).thenReturn(false);

        ChatRequest request = new ChatRequest("Hello AI", null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().toString()).contains("unavailable");
    }

    // ─── /chat — available path ───────────────────────────────────────────────

    @Test
    void chat_returns200_with_sse_emitter_when_ollama_available() throws InterruptedException {
        when(healthGuard.isAvailable()).thenReturn(true);
        when(aiService.streamChat(anyString())).thenReturn(Flux.just("Hello", " world"));

        ChatRequest request = new ChatRequest("Say hello", null);
        ResponseEntity<?> response = aiController.chat(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(SseEmitter.class);
        // Give the virtual thread a moment to process
        Thread.sleep(100);
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
        ChatRequest request = new ChatRequest(prompt, resumeId);

        assertThat(request.prompt()).isEqualTo(prompt);
        assertThat(request.resumeId()).isEqualTo(resumeId);
    }

    @Test
    void chatRequest_with_null_resumeId() {
        ChatRequest request = new ChatRequest("prompt", null);

        assertThat(request.prompt()).isEqualTo("prompt");
        assertThat(request.resumeId()).isNull();
    }

    @Test
    void enhanceRequest_record_construction_and_accessor() {
        String resumeId = UUID.randomUUID().toString();
        EnhanceRequest request = new EnhanceRequest(resumeId);

        assertThat(request.resumeId()).isEqualTo(resumeId);
    }
}
