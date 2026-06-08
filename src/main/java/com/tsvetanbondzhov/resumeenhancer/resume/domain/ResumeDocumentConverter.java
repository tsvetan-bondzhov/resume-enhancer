package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.stereotype.Component;

import java.util.List;

@Converter(autoApply = false)
@Component
public class ResumeDocumentConverter implements AttributeConverter<ResumeDocument, String> {

    private final ObjectMapper objectMapper;

    public ResumeDocumentConverter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String convertToDatabaseColumn(ResumeDocument attribute) {
        if (attribute == null) {
            throw new IllegalStateException("resumeContent must not be null");
        }
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize ResumeDocument to JSON", e);
        }
    }

    @Override
    public ResumeDocument convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new ResumeDocument(List.of());
        }
        try {
            return objectMapper.readValue(dbData, ResumeDocument.class);
        } catch (JsonProcessingException e) {
            // dbData is intentionally omitted from the message to prevent raw DB content from leaking into logs.
            throw new IllegalStateException("Failed to deserialize ResumeDocument from JSON stored in database", e);
        }
    }
}
