package com.tsvetanbondzhov.resumeenhancer.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ClassPathResource;
import org.springframework.ai.chat.client.ChatClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
        stubChatClient("[{\"jobTitle\":\"Engineer\"}]");

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

    // ─── extractResumeSection — all section types ────────────────────────────

    @ParameterizedTest
    @CsvSource({
        "WORK_EXPERIENCE, Engineer at Acme Corp",
        "EDUCATION,       BSc Computer Science",
        "SKILLS,          Java",
        "CERTIFICATIONS,  AWS Certified",
        "PROJECTS,        Open-source tool",
        "SUMMARY,         Experienced developer",
        "LANGUAGES,       English",
        "VOLUNTEERING,    Mentor at code club",
        "UNKNOWN_TYPE,    some raw text",
        "CUSTOM_SECTION,  custom content"
    })
    void extractResumeSection_handles_all_section_types_without_throwing(
            String sectionType, String sectionText) {
        stubChatClient("[]");

        String result = aiService.extractResumeSection(sectionType, sectionText);

        assertThat(result).isEqualTo("[]");
    }

    // ─── getPromptTemplateName — routing ─────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
        "WORK_EXPERIENCE, prompts/resume-extraction-work-experience.st",
        "EDUCATION,       prompts/resume-extraction-education.st",
        "SKILLS,          prompts/resume-extraction-skills.st",
        "CERTIFICATIONS,  prompts/resume-extraction-certifications.st",
        "PROJECTS,        prompts/resume-extraction-projects.st",
        "SUMMARY,         prompts/resume-extraction-summary.st",
        "LANGUAGES,       prompts/resume-extraction-languages.st",
        "VOLUNTEERING,    prompts/resume-extraction-volunteering.st"
    })
    void getPromptTemplateName_returns_section_specific_template(String sectionType, String expectedTemplate) {
        assertThat(aiService.getPromptTemplateName(sectionType)).isEqualTo(expectedTemplate);
    }

    @Test
    void getPromptTemplateName_returns_default_template_for_unknown_section_type() {
        assertThat(aiService.getPromptTemplateName("UNKNOWN_TYPE"))
                .isEqualTo("prompts/resume-extraction-default.st");
    }

    @Test
    void getPromptTemplateName_returns_default_template_for_empty_section_type() {
        assertThat(aiService.getPromptTemplateName(""))
                .isEqualTo("prompts/resume-extraction-default.st");
    }

    // ─── template files exist on classpath ───────────────────────────────────

    @ParameterizedTest
    @ValueSource(strings = {
        "prompts/resume-extraction-work-experience.st",
        "prompts/resume-extraction-education.st",
        "prompts/resume-extraction-skills.st",
        "prompts/resume-extraction-certifications.st",
        "prompts/resume-extraction-projects.st",
        "prompts/resume-extraction-summary.st",
        "prompts/resume-extraction-languages.st",
        "prompts/resume-extraction-volunteering.st",
        "prompts/resume-extraction-default.st"
    })
    void template_file_exists_on_classpath(String templatePath) {
        assertThat(new ClassPathResource(templatePath).exists())
                .as("Template file missing: %s", templatePath)
                .isTrue();
    }

    // ─── streamChat — success path ───────────────────────────────────────────

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

    // ─── streamChat — exception path ─────────────────────────────────────────

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

    // ─── helper ──────────────────────────────────────────────────────────────

    private void stubChatClient(String returnValue) {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.ChatClientRequestSpec userSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec callSpec = mock(ChatClient.CallResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.user(any(Consumer.class))).thenReturn(userSpec);
        when(userSpec.call()).thenReturn(callSpec);
        when(callSpec.content()).thenReturn(returnValue);
    }
}
