package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public List<TemplateDto> listPublishedTemplates() {
        return templateService.listPublishedTemplates();
    }

    @GetMapping("/{templateId}")
    public TemplateDto getPublishedTemplate(@PathVariable UUID templateId) {
        return templateService.getPublishedTemplate(templateId);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> createTemplate(@Valid @RequestBody TemplateRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    @PutMapping("/{templateId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateTemplate(@PathVariable UUID templateId,
                                               @Valid @RequestBody TemplateRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    @DeleteMapping("/{templateId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID templateId) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
