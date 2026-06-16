package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ResumeItemDtoTest {

    @Test
    void constructor_withNonNullFields_storesUnmodifiableCopy() {
        Map<String, String> mutable = new HashMap<>();
        mutable.put("name", "Alice");
        mutable.put("role", "Engineer");

        ResumeItemDto dto = new ResumeItemDto(mutable, false);

        assertThat(dto.fields()).containsEntry("name", "Alice");
        assertThat(dto.fields()).containsEntry("role", "Engineer");
        // Mutation of the original map must not affect the stored copy
        mutable.put("extra", "value");
        assertThat(dto.fields()).doesNotContainKey("extra");
    }

    @Test
    void constructor_withNullFields_substitutesEmptyMap() {
        ResumeItemDto dto = new ResumeItemDto(null, true);

        assertThat(dto.fields()).isEmpty();
        assertThat(dto.lowConfidence()).isTrue();
    }

    @Test
    void constructor_storedFieldsIsUnmodifiable() {
        ResumeItemDto dto = new ResumeItemDto(Map.of("key", "value"), false);

        assertThatThrownBy(() -> dto.fields().put("new", "entry"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
