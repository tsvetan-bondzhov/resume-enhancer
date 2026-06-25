package com.tsvetanbondzhov.resumeenhancer.export;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST endpoint for exporting a resume as a downloadable file.
 * <p>
 * <strong>No OllamaHealthGuard</strong> — export has no AI dependency (AC2).
 * Security: endpoint is under {@code /api/v1/**} and therefore JWT-protected
 * by {@code SecurityConfig} — no additional security annotations needed.
 */
@RestController
@RequestMapping("/api/v1/resumes")
@Tag(name = "Export")
public class ExportController {

    private final ExportService exportService;

    public ExportController(ExportService exportService) {
        this.exportService = exportService;
    }

    @GetMapping("/{resumeId}/export")
    public ResponseEntity<byte[]> exportResume(
            Authentication authentication,
            @PathVariable UUID resumeId,
            @RequestParam String format,
            @RequestParam(defaultValue = "ats") String mode) {

        String normalizedFormat = format.toLowerCase();
        String normalizedMode = mode.toLowerCase();
        if (!"ats".equals(normalizedMode) && !"visual".equals(normalizedMode)) {
            throw new UnsupportedExportFormatException(
                    "Unsupported export mode. Use 'ats' or 'visual'.");
        }
        ExportService.ExportResult result = exportService.exportResume(
                authentication.getName(), resumeId, normalizedFormat, normalizedMode);

        // F1: name and content come from a single DB fetch — no race window.
        // F2: null guard on name in case resume.getName() returns null.
        // F5: '"' excluded from allowed chars to prevent Content-Disposition header injection.
        String rawName = result.name() != null ? result.name() : "resume";
        String filename = rawName.replaceAll("[^a-zA-Z0-9\\-_ .]", "_")
                .replace("\"", "_") + "." + normalizedFormat;

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, resolveContentType(normalizedFormat))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .body(result.content());
    }

    private String resolveContentType(String format) {
        return switch (format) {
            case "pdf" -> "application/pdf";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> throw new UnsupportedExportFormatException(
                    "Unsupported export format. Use 'pdf' or 'docx'.");
        };
    }
}
