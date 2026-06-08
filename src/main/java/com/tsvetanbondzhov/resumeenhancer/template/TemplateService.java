package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class TemplateService {

    private final TemplateRepository templateRepository;

    public TemplateService(TemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    @Cacheable("templates")
    @Transactional(readOnly = true)
    public List<TemplateDto> listPublishedTemplates() {
        return templateRepository.findAllByIsPublishedTrue().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public TemplateDto getPublishedTemplate(UUID templateId) {
        return templateRepository.findByIdAndIsPublishedTrue(templateId)
                .map(this::toDto)
                .orElseThrow(() -> new TemplateNotFoundException("Template not found: " + templateId));
    }

    private TemplateDto toDto(ResumeTemplate template) {
        return new TemplateDto(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.isPrebuilt(),
                template.isPublished(),
                template.getTemplateDefinition() != null
                        ? Collections.unmodifiableMap(new HashMap<>(template.getTemplateDefinition()))
                        : Map.of(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }
}
