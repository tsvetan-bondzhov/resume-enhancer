package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class TemplateService {

    private static final Pattern DISALLOWED_CSS_UNIT = Pattern.compile("\\d+(rem|em)");

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

    @CacheEvict(value = "templates", allEntries = true)
    @Transactional
    public TemplateDto createTemplate(TemplateRequest request) {
        validateCssVariables(request);

        ResumeTemplate template = new ResumeTemplate();
        template.setName(request.name());
        template.setDescription(request.description());
        template.setTemplateDefinition(request.templateDefinition());
        template.setPrebuilt(true);
        template.setPublished(false);
        template.setOwnerId(null);
        return toDto(templateRepository.save(template));
    }

    @CacheEvict(value = "templates", allEntries = true)
    @Transactional
    public TemplateDto updateTemplate(UUID templateId, TemplateRequest request) {
        ResumeTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new TemplateNotFoundException("Template not found: " + templateId));

        validateCssVariables(request);

        template.setName(request.name());
        template.setDescription(request.description());
        template.setTemplateDefinition(request.templateDefinition());
        return toDto(templateRepository.save(template));
    }

    @CacheEvict(value = "templates", allEntries = true)
    @Transactional
    public void deleteTemplate(UUID templateId) {
        ResumeTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new TemplateNotFoundException("Template not found: " + templateId));
        templateRepository.delete(template);
    }

    @CacheEvict(value = "templates", allEntries = true)
    @Transactional
    public TemplateDto setPublished(UUID templateId, boolean published) {
        ResumeTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new TemplateNotFoundException("Template not found: " + templateId));
        template.setPublished(published);
        return toDto(templateRepository.save(template));
    }

    @Transactional(readOnly = true)
    public List<TemplateDto> listAllTemplates() {
        return templateRepository.findAll().stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Rejects {@code cssVariables} values that use rem/em units. Only px and in are accepted.
     * Shared by {@link #createTemplate(TemplateRequest)} and {@link #updateTemplate(UUID, TemplateRequest)}.
     */
    private void validateCssVariables(TemplateRequest request) {
        Object cssVarsRaw = request.templateDefinition().get("cssVariables");
        if (cssVarsRaw instanceof Map<?, ?> cssVars) {
            for (Map.Entry<?, ?> entry : cssVars.entrySet()) {
                String value = String.valueOf(entry.getValue());
                if (DISALLOWED_CSS_UNIT.matcher(value).find()) {
                    throw new TemplateValidationException(
                            "CSS variable '" + entry.getKey() + "' uses disallowed unit (rem/em). " +
                            "Only px and in are accepted. Value: " + value);
                }
            }
        }
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
