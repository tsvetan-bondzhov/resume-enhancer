package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.export.renderers.PdfRenderer;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeAccessDeniedException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateRepository;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
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
    private final TemplateDefinitionService templateDefinitionService;
    private final PdfRenderer pdfRenderer;
    private final ObjectMapper objectMapper;

    public ExportService(ResumeRepository resumeRepository,
                         TemplateRepository templateRepository,
                         UserRepository userRepository,
                         TemplateDefinitionService templateDefinitionService,
                         PdfRenderer pdfRenderer,
                         ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.templateRepository = templateRepository;
        this.userRepository = userRepository;
        this.templateDefinitionService = templateDefinitionService;
        this.pdfRenderer = pdfRenderer;
        this.objectMapper = objectMapper;
    }

    /**
     * Result of a successful export containing the rendered bytes and the resume name.
     * Consolidates name + content in a single DB round-trip to avoid race conditions
     * where a concurrent delete could cause a 403 between two separate fetches (F1).
     */
    public record ExportResult(byte[] content, String name) {}

    /**
     * Exports a resume belonging to {@code userEmail} as the given {@code format}.
     *
     * @param userEmail authenticated user's email
     * @param resumeId  UUID of the resume to export
     * @param format    "pdf" (DOCX not yet implemented — story 6-2)
     * @return {@link ExportResult} with rendered bytes and the resume's name
     */
    @Transactional(readOnly = true)
    public ExportResult exportResume(String userEmail, UUID resumeId, String format) {
        User user = resolveUser(userEmail);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));

        String name = resume.getName();
        ResumeDocument doc = resume.getResumeContent();
        ResumeTemplate template = resolveTemplate(resume.getTemplateId());

        byte[] content = switch (format.toLowerCase()) {
            case "pdf" -> pdfRenderer.render(doc, template);
            case "docx" -> throw new UnsupportedExportFormatException(
                    "DOCX export not yet implemented");
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
