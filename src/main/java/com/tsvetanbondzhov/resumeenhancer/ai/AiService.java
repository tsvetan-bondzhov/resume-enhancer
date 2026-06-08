package com.tsvetanbondzhov.resumeenhancer.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final ChatClient chatClient;

    public AiService(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.build();
    }

    /**
     * Calls Ollama with a section extraction prompt. Returns raw JSON string.
     * Throws OllamaUnavailableException if Ollama is unreachable.
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
            throw new OllamaUnavailableException("Ollama is unavailable: " + e.getMessage(), e);
        }
    }

    private String buildPrompt(String sectionType, String sectionText) {
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
