package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeAccessDeniedException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateRepository;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Orchestrates the resume export pipeline.
 * <p>
 * Resolves the resume and its template, applies the AC7 fallback when a template
 * is unpublished, and dispatches to the appropriate {@link DocumentRenderer}.
 * <p>
 * <strong>No OllamaHealthGuard call</strong> — export has no AI dependency (AC2).
 */
@Service
public class ExportService {

    private static final String ACCESS_DENIED_MSG = "Access denied or resume not found";

    private final ResumeRepository resumeRepository;
    private final TemplateRepository templateRepository;
    private final UserRepository userRepository;
    private final Map<String, DocumentRenderer> renderers;
    private final ObjectMapper objectMapper;

    public ExportService(ResumeRepository resumeRepository,
                         TemplateRepository templateRepository,
                         UserRepository userRepository,
                         Map<String, DocumentRenderer> renderers,
                         ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.templateRepository = templateRepository;
        this.userRepository = userRepository;
        this.renderers = renderers;
        this.objectMapper = objectMapper;
    }

    /**
     * Result of a successful export containing the rendered bytes and the resume name.
     * Consolidates name + content in a single DB round-trip to avoid race conditions
     * where a concurrent delete could cause a 403 between two separate fetches (F1).
     */
    public record ExportResult(byte[] content, String name) {
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            ExportResult r = (ExportResult) o;
            return Arrays.equals(content, r.content) && Objects.equals(name, r.name);
        }

        @Override
        public int hashCode() {
            return 31 * Arrays.hashCode(content) + Objects.hashCode(name);
        }

        @Override
        public String toString() {
            return "ExportResult{content=" + Arrays.toString(content) + ", name=" + name + "}";
        }
    }

    /**
     * Exports a resume belonging to {@code userEmail} as the given {@code format}.
     *
     * @param userEmail authenticated user's email
     * @param resumeId  UUID of the resume to export
     * @param format    "pdf" or "docx"
     * @param mode      "ats" (default, flat) or "visual" (styled). Selects the
     *                  renderer bean keyed as {@code format} or {@code format + "-visual"}.
     * @return {@link ExportResult} with rendered bytes and the resume's name
     */
    @Transactional(readOnly = true)
    public ExportResult exportResume(String userEmail, UUID resumeId, String format, String mode) {
        User user = resolveUser(userEmail);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));

        String name = resume.getName();
        ResumeDocument doc = resume.getResumeContent();
        ResumeTemplate template = resolveTemplate(resume.getTemplateId());

        byte[] content = switch (format.toLowerCase()) {
            case "pdf", "docx" -> {
                // Visual mode resolves to a "<format>-visual" bean (e.g. "docx-visual").
                // "pdf-visual" intentionally has no bean — the client renders visual PDFs.
                String rendererKey = format.toLowerCase()
                        + ("visual".equals(mode) ? "-visual" : "");
                DocumentRenderer renderer = renderers.get(rendererKey);
                if (renderer == null) {
                    throw new UnsupportedExportFormatException(
                            "Unsupported export format/mode combination.");
                }
                yield renderer.render(doc, template);
            }
            default -> throw new UnsupportedExportFormatException(
                    "Unsupported export format. Use 'pdf' or 'docx'.");
        };
        return new ExportResult(content, name);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Loads the template by ID (published only). Falls back to a synthetic
     * DEFAULT template if the templateId is null or the template is unpublished (AC7).
     */
    private ResumeTemplate resolveTemplate(UUID templateId) {
        if (templateId != null) {
            return templateRepository.findByIdAndIsPublishedTrue(templateId)
                    .orElseGet(this::buildFallbackTemplate);
        }
        return buildFallbackTemplate();
    }

    /**
     * Builds a minimal {@link ResumeTemplate} backed by {@link TemplateDefinition#DEFAULT}
     * for use when the resume has no template or the template is unpublished (AC7).
     */
    private ResumeTemplate buildFallbackTemplate() {
        ResumeTemplate fallback = new ResumeTemplate();
        Map<String, Object> defaultMap = objectMapper.convertValue(
                TemplateDefinition.DEFAULT,
                new TypeReference<Map<String, Object>>() {});
        fallback.setTemplateDefinition(defaultMap);
        return fallback;
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user not found in database"));
    }
}
