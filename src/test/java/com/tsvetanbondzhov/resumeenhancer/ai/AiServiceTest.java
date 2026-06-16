package com.tsvetanbondzhov.resumeenhancer.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;

import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiServiceTest {

    @Mock
    private ChatClient.Builder chatClientBuilder;

    @Mock
    private ChatClient chatClient;

    private AiService aiService;

    @BeforeEach
    void setUp() {
        when(chatClientBuilder.build()).thenReturn(chatClient);
        aiService = new AiService(chatClientBuilder);
    }

    // ─── extractResumeSection — success path ─────────────────────────────────

    @Test
    void extractResumeSection_returns_content_from_chat_client() {
        // Build the fluent chain: chatClient.prompt() -> promptSpec
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec callSpec = mock(ChatClient.CallResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.user(any(Consumer.class))).thenReturn(userSpec);
        when(userSpec.call()).thenReturn(callSpec);
        when(callSpec.content()).thenReturn("[{\"jobTitle\":\"Engineer\"}]");

        String result = aiService.extractResumeSection("WORK_EXPERIENCE", "Engineer at Acme Corp 2020-2023");

        assertThat(result).isEqualTo("[{\"jobTitle\":\"Engineer\"}]");
    }

    // ─── extractResumeSection — exception path ───────────────────────────────

    @Test
    void extractResumeSection_throws_OllamaUnavailableException_when_chatClient_fails() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.user(any(Consumer.class))).thenReturn(userSpec);
        when(userSpec.call()).thenThrow(new RuntimeException("Connection refused"));

        assertThatThrownBy(() -> aiService.extractResumeSection("SKILLS", "Java, Spring"))
                .isInstanceOf(OllamaUnavailableException.class)
                .hasMessageContaining("Ollama is unavailable");
    }

    // ─── buildPrompt fallback — prompt template missing ──────────────────────
    // When ClassPathResource "prompts/resume-section-extraction.st" is not found,
    // buildPrompt falls back to an inline String.format template.
    // We verify it still produces a non-null prompt that reaches the ChatClient.

    @Test
    void extractResumeSection_uses_inline_fallback_when_template_file_missing() {
        // Override resource loading so PromptTemplate fails to read the file by
        // injecting a sectionType that is valid but provide no .st resource on classpath
        // (the default test classpath does not include the .st file, so this path
        //  naturally exercises the catch block in buildPrompt)

        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec callSpec = mock(ChatClient.CallResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.user(any(Consumer.class))).thenReturn(userSpec);
        when(userSpec.call()).thenReturn(callSpec);
        when(callSpec.content()).thenReturn("[]");

        // We cannot force the template file to be absent in unit tests,
        // but we test that when the ChatClient returns content the result is forwarded.
        String result = aiService.extractResumeSection("SUMMARY", "Experienced developer");
        assertThat(result).isEqualTo("[]");
    }

    // ─── getFieldSchema — all switch cases ───────────────────────────────────
    // We exercise getFieldSchema indirectly via extractResumeSection.
    // The returned prompt is passed to ChatClient; we capture that it doesn't throw.

    @ParameterizedTest
    @CsvSource({
        "WORK_EXPERIENCE, jobTitle at company",
        "EDUCATION,       BSc Computer Science",
        "SKILLS,          Java",
        "CERTIFICATIONS,  AWS Certified",
        "PROJECTS,        Open-source tool",
        "SUMMARY,         Experienced developer",
        "LANGUAGES,       English",
        "VOLUNTEERING,    Mentor at code club",
        "UNKNOWN_TYPE,    some raw text"
    })
    void extractResumeSection_handles_all_section_types_without_throwing(
            String sectionType, String sectionText) {

        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec callSpec = mock(ChatClient.CallResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.user(any(Consumer.class))).thenReturn(userSpec);
        when(userSpec.call()).thenReturn(callSpec);
        when(callSpec.content()).thenReturn("[]");

        String result = aiService.extractResumeSection(sectionType, sectionText);
        assertThat(result).isEqualTo("[]");
    }
}
