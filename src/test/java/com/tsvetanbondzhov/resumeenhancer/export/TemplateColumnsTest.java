package com.tsvetanbondzhov.resumeenhancer.export;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateColumnsTest {

    @Test
    void constructor_storesLeftAndRightLists() {
        List<String> left = List.of("EDUCATION", "SKILLS");
        List<String> right = List.of("WORK_EXPERIENCE", "PROJECTS");

        TemplateColumns columns = new TemplateColumns(left, right);

        assertThat(columns.left()).isEqualTo(left);
        assertThat(columns.right()).isEqualTo(right);
    }

    @Test
    void constructor_acceptsEmptyLists() {
        TemplateColumns columns = new TemplateColumns(List.of(), List.of());

        assertThat(columns.left()).isEmpty();
        assertThat(columns.right()).isEmpty();
    }

    @Test
    void equalRecordsAreEqual() {
        TemplateColumns a = new TemplateColumns(List.of("SKILLS"), List.of("WORK_EXPERIENCE"));
        TemplateColumns b = new TemplateColumns(List.of("SKILLS"), List.of("WORK_EXPERIENCE"));

        assertThat(a).isEqualTo(b);
    }
}
