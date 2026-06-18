package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.Map;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private static final String OLLAMA_UNAVAILABLE_PREFIX = "Ollama is unavailable: ";

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
                    // F3: map reactive mid-stream errors — try/catch only covers Flux assembly errors
                    .onErrorMap(e -> new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e));
        } catch (Exception e) {
            log.warn("Ollama streaming call failed: {}", e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    /**
     * Streams AI-generated enhancement suggestions for the given resume document.
     * The AI is instructed to emit one DocumentPatchEvent JSON object per line —
     * the controller parses each line into a patch SSE event.
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public Flux<String> streamEnhance(ResumeDocument document) {
        try {
            String prompt = buildEnhancePrompt(document);
            return chatClient.prompt()
                    .user(prompt)
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
     *
     * AiService is the ONLY class in the codebase that calls ChatClient directly.
     */
    public Flux<String> streamTailor(ResumeDocument document, String jobDescription) {
        try {
            String prompt = buildTailorPrompt(document, jobDescription);
            return chatClient.prompt()
                    .user(prompt)
                    .stream()
                    .content()
                    .onErrorMap(e -> new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e));
        } catch (Exception e) {
            log.warn("Ollama tailor call failed: {}", e.getMessage());
            throw new OllamaUnavailableException(OLLAMA_UNAVAILABLE_PREFIX + e.getMessage(), e);
        }
    }

    String buildTailorPrompt(ResumeDocument document, String jobDescription) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
                You are an expert resume coach. Rewrite the resume below to align with the job description.
                For each change, output exactly ONE JSON object on its own line in this format:
                {"sectionId":"<sectionType>","itemIndex":<0-based index>,"field":"<field name>","newValue":"<tailored text>"}

                Rules:
                - Output ONLY the JSON objects, one per line — no prose, no markdown, no explanations
                - sectionId must be the exact sectionType value (e.g. WORK_EXPERIENCE, SUMMARY, SKILLS)
                - itemIndex is the 0-based position of the item within that section's items array
                - field is the exact field name to rewrite (e.g. description, jobTitle, name, text)
                - newValue is the tailored text — aligned with the job's keywords and requirements
                - Only suggest changes for fields that have existing non-empty text
                - Limit to the most impactful changes (max 8 total)
                - Preserve factual accuracy — do not invent experience or qualifications

                Job Description:
                """);
        sb.append(jobDescription).append("\n\n");
        sb.append("Resume:\n");
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

    String buildEnhancePrompt(ResumeDocument document) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
                You are an expert resume coach. Analyze the resume below and suggest improvements.
                For each improvement, output exactly ONE JSON object on its own line in this format:
                {"sectionId":"<sectionType>","itemIndex":<0-based index>,"field":"<field name>","newValue":"<improved text>"}

                Rules:
                - Output ONLY the JSON objects, one per line — no prose, no markdown, no explanations
                - sectionId must be the exact sectionType value (e.g. WORK_EXPERIENCE, SUMMARY, SKILLS)
                - itemIndex is the 0-based position of the item within that section's items array
                - field is the exact field name to improve (e.g. description, jobTitle, name)
                - newValue is the improved text — concise, impactful, action-verb led
                - Only suggest changes for fields that have existing non-empty text
                - Limit suggestions to the most impactful improvements (max 5 total)

                Resume:
                """);

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
