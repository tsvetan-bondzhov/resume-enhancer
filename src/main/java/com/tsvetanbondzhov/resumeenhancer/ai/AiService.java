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
     * Calls Ollama with a section extraction prompt built from
     * {@code prompts/resume-section-extraction.st}. Returns raw JSON string.
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
        try {
            PromptTemplate template = new PromptTemplate(
                    new ClassPathResource("prompts/resume-section-extraction.st"));
            return template.render(Map.of(
                    "sectionType", sectionType,
                    "sectionText", sectionText,
                    "fieldSchema", getFieldSchema(sectionType)
            ));
        } catch (Exception e) {
            log.warn("Failed to load prompt template, using inline fallback: {}", e.getMessage());
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

    private String getFieldSchema(String sectionType) {
        return switch (sectionType) {
            case "WORK_EXPERIENCE" -> "[{\"title\": \"\", \"company\": \"\", \"startDate\": \"YYYY-MM\", " +
                    "\"endDate\": \"YYYY-MM or Present\", \"description\": \"comma-separated achievements\"}]";
            case "EDUCATION" -> "[{\"degree\": \"\", \"institution\": \"\", " +
                    "\"graduationDate\": \"YYYY or YYYY-MM\", \"gpa\": \"\"}]";
            case "SKILLS" -> "[{\"skillName\": \"\", \"proficiency\": \"\", \"category\": \"\"}]";
            case "CERTIFICATIONS" -> "[{\"certificationName\": \"\", \"issuer\": \"\", " +
                    "\"issueDate\": \"YYYY-MM\", \"expirationDate\": \"YYYY-MM\"}]";
            case "PROJECTS" -> "[{\"projectName\": \"\", \"description\": \"\", " +
                    "\"technologies\": \"comma-separated\", \"link\": \"\"}]";
            case "SUMMARY" -> "[{\"text\": \"full summary prose\"}]";
            case "LANGUAGES" -> "[{\"language\": \"\", \"proficiency\": \"\"}]";
            case "VOLUNTEERING" -> "[{\"role\": \"\", \"organization\": \"\", " +
                    "\"startDate\": \"YYYY-MM\", \"endDate\": \"YYYY-MM or Present\", \"description\": \"\"}]";
            default -> "[{\"text\": \"raw content\"}]";
        };
    }
}
