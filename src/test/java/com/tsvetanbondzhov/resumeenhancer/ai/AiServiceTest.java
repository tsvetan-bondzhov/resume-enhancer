package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.ai.chat.client.ChatClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.util.List;
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

    // ─── streamChat(prompt, conversationId, chatMemory, resumeContext) — success path ───────

    @Test
    @SuppressWarnings("unchecked")
    void streamChat_withConversationId_returns_flux_of_tokens() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.StreamResponseSpec streamSpec = mock(ChatClient.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("Hello", " world"));

        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();
        Flux<String> result = aiService.streamChat("test prompt", "conv-123", memory, null);

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

    // ─── streamEnhance — success path ───────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void streamEnhance_returnsPatchFlux() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.StreamResponseSpec streamSpec = mock(ChatClient.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(
                Flux.just(
                        "{\"sectionId\":\"WORK_EXPERIENCE\",",
                        "\"itemIndex\":0,\"field\":\"description\",\"newValue\":\"Led cross-functional teams\"}\n"
                )
        );

        ResumeDocument document = new ResumeDocument(List.of());
        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();
        Flux<String> result = aiService.streamEnhance(document, "conv-enhance-1", memory);

        StepVerifier.create(result)
                .expectNext("{\"sectionId\":\"WORK_EXPERIENCE\",")
                .expectNext("\"itemIndex\":0,\"field\":\"description\",\"newValue\":\"Led cross-functional teams\"}\n")
                .verifyComplete();
    }

    // ─── streamEnhance — exception path ─────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void streamEnhance_ollamaUnavailable_throwsOllamaUnavailableException() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenThrow(new RuntimeException("Connection refused"));

        ResumeDocument document = new ResumeDocument(List.of());
        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();

        assertThatThrownBy(() -> aiService.streamEnhance(document, "conv-enhance-2", memory))
                .isInstanceOf(OllamaUnavailableException.class)
                .hasMessageContaining("Ollama is unavailable");
    }

    // ─── buildEnhancePrompt — content verification ───────────────────────────

    @Test
    void buildEnhancePrompt_containsInstructionsAndResumeData() {
        ResumeDocument document = new ResumeDocument(List.of());
        String prompt = aiService.buildEnhancePrompt(document);

        assertThat(prompt).contains("resume coach");
        assertThat(prompt).contains("sectionId");
        assertThat(prompt).contains("itemIndex");
        assertThat(prompt).contains("newValue");
    }

    // ─── streamTailor — success path ────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void streamTailor_returnsPatchFlux() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.StreamResponseSpec streamSpec = mock(ChatClient.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(
                Flux.just(
                        "{\"sectionId\":\"WORK_EXPERIENCE\",",
                        "\"itemIndex\":0,\"field\":\"description\",\"newValue\":\"Led cloud-native backend development\"}\n"
                )
        );

        ResumeDocument document = new ResumeDocument(List.of());
        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();
        Flux<String> result = aiService.streamTailor(document, "Software Engineer at Google", "conv-tailor-1", memory);

        StepVerifier.create(result)
                .expectNext("{\"sectionId\":\"WORK_EXPERIENCE\",")
                .expectNext("\"itemIndex\":0,\"field\":\"description\",\"newValue\":\"Led cloud-native backend development\"}\n")
                .verifyComplete();
    }

    // ─── streamTailor — exception path ──────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void streamTailor_ollamaUnavailable_throwsOllamaUnavailableException() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenThrow(new RuntimeException("Connection refused"));

        ResumeDocument document = new ResumeDocument(List.of());
        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();

        assertThatThrownBy(() -> aiService.streamTailor(document, "Software Engineer at Google", "conv-tailor-2", memory))
                .isInstanceOf(OllamaUnavailableException.class)
                .hasMessageContaining("Ollama is unavailable");
    }

    // ─── buildTailorPrompt — content verification ───────────────────────────

    @Test
    void buildTailorPrompt_containsJobDescriptionAndResumeData() {
        ResumeDocument document = new ResumeDocument(List.of());
        String jobDescription = "Looking for a Java backend developer with Spring Boot expertise";
        String prompt = aiService.buildTailorPrompt(document, jobDescription);

        assertThat(prompt).contains("resume coach");
        assertThat(prompt).contains(jobDescription);
        assertThat(prompt).contains("sectionId");
        assertThat(prompt).contains("itemIndex");
        assertThat(prompt).contains("newValue");
        assertThat(prompt).contains("Job Description:");
    }

    // ─── streamChat(prompt, conversationId, chatMemory, resumeContext) — exception path ─────

    @Test
    @SuppressWarnings("unchecked")
    void streamChat_withConversationId_throws_OllamaUnavailableException_when_chatClient_fails() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenThrow(new RuntimeException("Connection refused"));

        MessageWindowChatMemory memory = MessageWindowChatMemory.builder().maxMessages(20).build();

        assertThatThrownBy(() -> aiService.streamChat("test", "conv-999", memory, null))
                .isInstanceOf(OllamaUnavailableException.class)
                .hasMessageContaining("Ollama is unavailable");
    }

    // ─── streamChatNoMemory — delegates to streamChat with memory ────────────

    @Test
    @SuppressWarnings("unchecked")
    void streamChatNoMemory_returns_flux_of_tokens() {
        ChatClient.ChatClientRequestSpec promptSpec = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.StreamResponseSpec streamSpec = mock(ChatClient.StreamResponseSpec.class);

        when(chatClient.prompt()).thenReturn(promptSpec);
        when(promptSpec.system(anyString())).thenReturn(promptSpec);
        when(promptSpec.user(anyString())).thenReturn(promptSpec);
        when(promptSpec.advisors(any(Consumer.class))).thenReturn(promptSpec);
        when(promptSpec.stream()).thenReturn(streamSpec);
        when(streamSpec.content()).thenReturn(Flux.just("token1", "token2"));

        Flux<String> result = aiService.streamChatNoMemory("test prompt");

        StepVerifier.create(result)
                .expectNext("token1")
                .expectNext("token2")
                .verifyComplete();
    }

    // ─── buildEnhancePrompt — with visible sections ──────────────────────────

    @Test
    void buildEnhancePrompt_includesSectionDataForVisibleSections() {
        ResumeSection visibleSection = new ResumeSection(
                ResumeSectionType.SUMMARY, "Summary", true, List.of());
        ResumeSection hiddenSection = new ResumeSection(
                ResumeSectionType.SKILLS, "Skills", false, List.of());
        ResumeDocument document = new ResumeDocument(List.of(visibleSection, hiddenSection));

        String prompt = aiService.buildEnhancePrompt(document);

        assertThat(prompt).contains("Section: SUMMARY");
        assertThat(prompt).doesNotContain("Section: SKILLS");
    }

    // ─── buildTailorPrompt — with visible sections ───────────────────────────

    @Test
    void buildTailorPrompt_includesSectionDataForVisibleSectionsOnly() {
        ResumeSection visibleSection = new ResumeSection(
                ResumeSectionType.WORK_EXPERIENCE, "Work Experience", true, List.of());
        ResumeSection hiddenSection = new ResumeSection(
                ResumeSectionType.EDUCATION, "Education", false, List.of());
        ResumeDocument document = new ResumeDocument(List.of(visibleSection, hiddenSection));
        String jobDescription = "Looking for a Java developer";

        String prompt = aiService.buildTailorPrompt(document, jobDescription);

        assertThat(prompt).contains("Section: WORK_EXPERIENCE");
        assertThat(prompt).doesNotContain("Section: EDUCATION");
        assertThat(prompt).contains(jobDescription);
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
