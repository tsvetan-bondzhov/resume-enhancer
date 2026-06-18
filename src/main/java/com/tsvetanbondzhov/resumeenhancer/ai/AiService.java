package com.tsvetanbondzhov.resumeenhancer.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final ChatClient chatClient;

    public AiService(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.build();
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
            throw new OllamaUnavailableException("Ollama is unavailable: " + e.getMessage(), e);
        }
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
