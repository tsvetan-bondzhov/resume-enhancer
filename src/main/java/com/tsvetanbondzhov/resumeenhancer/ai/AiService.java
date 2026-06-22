package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private static final String OLLAMA_UNAVAILABLE_PREFIX = "Ollama is unavailable: ";

    private final ChatClient chatClient;
    private final String chatSystemPrompt;

    public AiService(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.build();
        this.chatSystemPrompt = loadPrompt("prompts/chat-system.st");
    }

    /**
     * Calls Ollama with a section-specific extraction prompt.
     * Returns raw JSON string. Throws OllamaUnavailableException if Ollama is unreachable.
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public String extractResumeSection(String sectionType, String sectionText) {
        try {
            String prompt = buildPrompt(sectionType, sectionText);
            return chatClient.prompt()
                    .user(u -> u.text(prompt))
                    .call()
                    .content();
        } catch (Exception e) {
            log.warn("Ollama call failed for sectionType={}: {}", sectionType, e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    /**
     * Streams a chat response from Ollama for the given prompt.
     * Returns a Flux<String> where each emission is one streaming token chunk.
     * Throws OllamaUnavailableException if Ollama is unreachable.
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public Flux<String> streamChat(String prompt) {
        try {
            return chatClient.prompt()
                    .user(prompt)
                    .stream()
                    .content()
                    .onErrorMap(e -> new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e));
        } catch (Exception e) {
            log.warn("Ollama streaming call failed: {}", e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    /**
     * Streams a chat response with MessageWindowChatMemory for multi-turn Q&A.
     * The conversationId scopes the memory so each session keeps its own history.
     * Memory is ephemeral (in-memory only, not persisted to DB — AC4).
     * When resumeContext is non-empty it is prepended to the system prompt so the
     * LLM can give resume-specific answers rather than generic advice.
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public Flux<String> streamChat(String prompt, String conversationId, ChatMemory chatMemory, String resumeContext) {
        try {
            String systemPrompt = resumeContext == null || resumeContext.isBlank()
                    ? chatSystemPrompt
                    : chatSystemPrompt + "\n" + resumeContext;
            return chatClient.prompt()
                    .system(systemPrompt)
                    .user(prompt)
                    .advisors(a -> a
                            .param(ChatMemory.CONVERSATION_ID, conversationId)
                            .advisors(MessageChatMemoryAdvisor.builder(chatMemory).build()))
                    .stream()
                    .content()
                    .onErrorMap(e -> new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e));
        } catch (Exception e) {
            log.warn("Ollama streaming call failed: {}", e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    /**
     * Backward-compatible no-memory overload delegate.
     * Creates a fresh ephemeral memory window that is never reused — effectively no chat history.
     * Used by the single-arg public API and legacy callers.
     */
    Flux<String> streamChatNoMemory(String prompt) {
        return streamChat(prompt, UUID.randomUUID().toString(),
                MessageWindowChatMemory.builder().maxMessages(1).build(), null);
    }

    /**
     * Streams AI-generated enhancement suggestions for the given resume document.
     * The AI is instructed to emit one DocumentPatchEvent JSON object per line —
     * the controller parses each line into a patch SSE event.
     * When conversationId and chatMemory are provided the exchange is stored in
     * the shared chat memory so the user can follow up in the chat panel.
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public Flux<String> streamEnhance(ResumeDocument document, String conversationId, ChatMemory chatMemory) {
        try {
            String prompt = buildEnhancePrompt(document);
            return chatClient.prompt()
                    .system(chatSystemPrompt)
                    .user(prompt)
                    .advisors(a -> a
                            .param(ChatMemory.CONVERSATION_ID, conversationId)
                            .advisors(MessageChatMemoryAdvisor.builder(chatMemory).build()))
                    .stream()
                    .content()
                    .onErrorMap(e -> new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e));
        } catch (Exception e) {
            log.warn("Ollama enhance call failed: {}", e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    /**
     * Streams AI-generated tailoring suggestions aligned to the provided job description.
     * The AI is instructed to emit one DocumentPatchEvent JSON object per line —
     * the controller parses each line into a patch SSE event.
     * When conversationId and chatMemory are provided the exchange is stored in
     * the shared chat memory so the user can follow up in the chat panel.
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public Flux<String> streamTailor(ResumeDocument document, String jobDescription, String conversationId, ChatMemory chatMemory) {
        try {
            String prompt = buildTailorPrompt(document, jobDescription);
            return chatClient.prompt()
                    .system(chatSystemPrompt)
                    .user(prompt)
                    .advisors(a -> a
                            .param(ChatMemory.CONVERSATION_ID, conversationId)
                            .advisors(MessageChatMemoryAdvisor.builder(chatMemory).build()))
                    .stream()
                    .content()
                    .onErrorMap(e -> new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e));
        } catch (Exception e) {
            log.warn("Ollama tailor call failed: {}", e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    String buildTailorPrompt(ResumeDocument document, String jobDescription) {
        String template = loadPrompt("prompts/tailor-user.st");
        return template
                .replace("{jobDescription}", jobDescription)
                .replace("{resumeContent}", buildResumeContent(document));
    }

    String buildEnhancePrompt(ResumeDocument document) {
        String template = loadPrompt("prompts/enhance-user.st");
        return template.replace("{resumeContent}", buildResumeContent(document));
    }

    private String buildResumeContent(ResumeDocument document) {
        StringBuilder sb = new StringBuilder();
        for (var section : document.sections()) {
            if (!section.visible()) continue;
            sb.append("Section: ").append(section.sectionType()).append("\n");
            var items = section.items();
            for (int i = 0; i < items.size(); i++) {
                sb.append("  Item ").append(i).append(": ").append(items.get(i)).append("\n");
            }
        }
        return sb.toString();
    }

    private String buildPrompt(String sectionType, String sectionText) {
        try {
            String templateName = getPromptTemplateName(sectionType);
            PromptTemplate template = new PromptTemplate(new ClassPathResource(templateName));
            return template.render(Map.of("sectionText", sectionText));
        } catch (Exception e) {
            log.warn("Failed to load prompt template for {}, using inline fallback: {}", sectionType, e.getMessage());
            return String.format("""
                    You are a resume parsing expert. Extract structured data from the following resume section.
                    Return ONLY a valid JSON array. Do not include markdown, code blocks, or explanations.
                    Use null for any field not present in the text.

                    Section type: %s
                    Section text:
                    %s

                    Return the JSON array now:
                    """, sectionType, sectionText);
        }
    }

    private String loadPrompt(String resourcePath) {
        try {
            ClassPathResource resource = new ClassPathResource(resourcePath);
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("Failed to load prompt from {}: {}", resourcePath, e.getMessage());
            return "";
        }
    }

    String getPromptTemplateName(String sectionType) {
        return switch (sectionType) {
            case "WORK_EXPERIENCE" -> "prompts/resume-extraction-work-experience.st";
            case "EDUCATION"       -> "prompts/resume-extraction-education.st";
            case "SKILLS"          -> "prompts/resume-extraction-skills.st";
            case "CERTIFICATIONS"  -> "prompts/resume-extraction-certifications.st";
            case "PROJECTS"        -> "prompts/resume-extraction-projects.st";
            case "SUMMARY"         -> "prompts/resume-extraction-summary.st";
            case "LANGUAGES"       -> "prompts/resume-extraction-languages.st";
            case "VOLUNTEERING"    -> "prompts/resume-extraction-volunteering.st";
            default                -> "prompts/resume-extraction-default.st";
        };
    }
}
