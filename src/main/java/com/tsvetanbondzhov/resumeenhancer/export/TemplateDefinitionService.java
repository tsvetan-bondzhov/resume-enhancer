package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.springframework.stereotype.Component;

@Component
public class TemplateDefinitionService {

    private final ObjectMapper objectMapper;

    public TemplateDefinitionService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public TemplateDefinition resolve(ResumeTemplate template) {
        if (template == null || template.getTemplateDefinition() == null) {
            return TemplateDefinition.DEFAULT;
        }
        try {
            return objectMapper.convertValue(template.getTemplateDefinition(), TemplateDefinition.class);
        } catch (Exception e) {
            return TemplateDefinition.DEFAULT; // AC7: never throw on bad definition
        }
    }
}
