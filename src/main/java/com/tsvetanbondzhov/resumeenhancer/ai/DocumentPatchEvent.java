package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DocumentPatchEvent(
        @NotBlank String sectionId,
        String op,
        Integer itemIndex,
        String field,
        String newValue,
        JsonNode item
) {
    public String effectiveOp() {
        if (op == null || op.isBlank()) return "modify";
        return op;
    }

    public static DocumentPatchEvent modify(String sectionId, int itemIndex, String field, String newValue) {
        return new DocumentPatchEvent(sectionId, "modify", itemIndex, field, newValue, null);
    }
}
