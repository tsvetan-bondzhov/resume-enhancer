package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.template.dto.CustomTemplateRequest;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resume-templates")
@Tag(name = "Template")
public class TemplateController {

    private final TemplateService templateService;
    private final UserRepository userRepository;

    public TemplateController(TemplateService templateService, UserRepository userRepository) {
        this.templateService = templateService;
        this.userRepository = userRepository;
    }

    /**
     * Resolves the authenticated user's persisted UUID. The JWT filter populates a lightweight
     * principal with only email/role set — it carries no id — so the full user must be loaded.
     */
    private UUID resolveOwnerId(User principal) {
        return userRepository.findByEmail(principal.getEmail())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found in database"))
                .getId();
    }

    @GetMapping
    public List<TemplateDto> listPublishedTemplates() {
        return templateService.listPublishedTemplates();
    }

    @GetMapping("/{templateId}")
    public TemplateDto getPublishedTemplate(@PathVariable UUID templateId) {
        return templateService.getPublishedTemplate(templateId);
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public List<TemplateDto> listAllTemplates() {
        return templateService.listAllTemplates();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TemplateDto> createTemplate(@Valid @RequestBody TemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createTemplate(request));
    }

    @PutMapping("/{templateId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TemplateDto> updateTemplate(@PathVariable UUID templateId,
                                                      @Valid @RequestBody TemplateRequest request) {
        return ResponseEntity.ok(templateService.updateTemplate(templateId, request));
    }

    @PatchMapping("/{templateId}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TemplateDto> publishTemplate(@PathVariable UUID templateId) {
        return ResponseEntity.ok(templateService.setPublished(templateId, true));
    }

    @PatchMapping("/{templateId}/unpublish")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TemplateDto> unpublishTemplate(@PathVariable UUID templateId) {
        return ResponseEntity.ok(templateService.setPublished(templateId, false));
    }

    @DeleteMapping("/{templateId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID templateId) {
        templateService.deleteTemplate(templateId);
        return ResponseEntity.noContent().build();
    }

    // ─── Custom (user-owned) templates — authenticated, NOT admin-only ────────

    @PostMapping("/custom")
    public ResponseEntity<TemplateDto> createCustomTemplate(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody CustomTemplateRequest request) {
        TemplateDto created = templateService.createCustomTemplate(resolveOwnerId(principal), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/custom")
    public List<TemplateDto> listCustomTemplates(@AuthenticationPrincipal User principal) {
        return templateService.listCustomTemplates(resolveOwnerId(principal));
    }

    @PutMapping("/custom/{templateId}")
    public ResponseEntity<TemplateDto> updateCustomTemplate(
            @AuthenticationPrincipal User principal,
            @PathVariable UUID templateId,
            @Valid @RequestBody CustomTemplateRequest request) {
        return ResponseEntity.ok(
                templateService.updateCustomTemplate(resolveOwnerId(principal), templateId, request));
    }

    @DeleteMapping("/custom/{templateId}")
    public ResponseEntity<Void> deleteCustomTemplate(
            @AuthenticationPrincipal User principal,
            @PathVariable UUID templateId) {
        templateService.deleteCustomTemplate(resolveOwnerId(principal), templateId);
        return ResponseEntity.noContent().build();
    }
}
