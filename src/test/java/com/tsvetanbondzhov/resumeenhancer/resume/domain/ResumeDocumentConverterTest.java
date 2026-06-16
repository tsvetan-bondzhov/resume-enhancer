package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeDocumentConverterTest {

    @Mock
    private ObjectMapper objectMapper;

    private ResumeDocumentConverter converter;

    @BeforeEach
    void setUp() {
        converter = new ResumeDocumentConverter(objectMapper);
    }

    // ─── convertToDatabaseColumn ──────────────────────────────────────────────

    @Test
    void convertToDatabaseColumn_null_throwsIllegalStateException() {
        assertThatThrownBy(() -> converter.convertToDatabaseColumn(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("resumeContent must not be null");
    }

    @Test
    void convertToDatabaseColumn_serializationFailure_throwsIllegalStateException() throws Exception {
        ResumeDocument doc = new ResumeDocument(List.of());
        when(objectMapper.writeValueAsString(doc))
                .thenThrow(new JsonProcessingException("serialization error") {});

        assertThatThrownBy(() -> converter.convertToDatabaseColumn(doc))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to serialize ResumeDocument to JSON");
    }

    @Test
    void convertToDatabaseColumn_validDocument_returnsJson() throws Exception {
        ResumeDocument doc = new ResumeDocument(List.of());
        when(objectMapper.writeValueAsString(doc)).thenReturn("{\"sections\":[]}");

        String result = converter.convertToDatabaseColumn(doc);

        assertThat(result).isEqualTo("{\"sections\":[]}");
    }

    // ─── convertToEntityAttribute ─────────────────────────────────────────────

    @Test
    void convertToEntityAttribute_null_returnsEmptyDocument() {
        ResumeDocument result = converter.convertToEntityAttribute(null);

        assertThat(result).isNotNull();
        assertThat(result.sections()).isEmpty();
    }

    @Test
    void convertToEntityAttribute_blank_returnsEmptyDocument() {
        ResumeDocument result = converter.convertToEntityAttribute("   ");

        assertThat(result).isNotNull();
        assertThat(result.sections()).isEmpty();
    }

    @Test
    void convertToEntityAttribute_deserializationFailure_throwsIllegalStateException() throws Exception {
        when(objectMapper.readValue("{\"sections\":[]}", ResumeDocument.class))
                .thenThrow(new JsonProcessingException("bad json") {});

        assertThatThrownBy(() -> converter.convertToEntityAttribute("{\"sections\":[]}"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to deserialize ResumeDocument from JSON stored in database");
    }

    @Test
    void convertToEntityAttribute_validJson_returnsDocument() throws Exception {
        ResumeDocument expected = new ResumeDocument(List.of());
        when(objectMapper.readValue(eq("{\"sections\":[]}"), eq(ResumeDocument.class)))
                .thenReturn(expected);

        ResumeDocument result = converter.convertToEntityAttribute("{\"sections\":[]}");

        assertThat(result).isSameAs(expected);
    }
}
