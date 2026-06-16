package com.tsvetanbondzhov.resumeenhancer.export;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TemplateLayoutTest {

    @Test
    void resolvedSectionOrder_returnsEmptyList_whenColumnsNullAndSectionOrderNull() {
        TemplateLayout layout = new TemplateLayout("header", null, null, Map.of());

        assertThat(layout.resolvedSectionOrder()).isEmpty();
    }

    @Test
    void resolvedSectionOrder_returnsSectionOrder_whenColumnsNullAndSectionOrderPresent() {
        List<String> order = List.of("SUMMARY", "WORK_EXPERIENCE");
        TemplateLayout layout = new TemplateLayout("header", order, null, Map.of());

        assertThat(layout.resolvedSectionOrder()).isEqualTo(order);
    }

    @Test
    void resolvedSectionOrder_throwsIllegalStateException_whenColumnsPresent() {
        TemplateColumns columns = new TemplateColumns(List.of("SKILLS"), List.of("WORK_EXPERIENCE"));
        TemplateLayout layout = new TemplateLayout("header", List.of("SUMMARY"), columns, Map.of());

        assertThatThrownBy(layout::resolvedSectionOrder)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Use columns.left/right for two-column layouts");
    }
}
