package com.tsvetanbondzhov.resumeenhancer.export;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateDefinitionTest {

    @Test
    void default_constant_hasExpectedLayoutType() {
        assertThat(TemplateDefinition.DEFAULT.layoutType()).isEqualTo("single-column");
    }

    @Test
    void default_constant_hasCssVariables() {
        Map<String, Object> css = TemplateDefinition.DEFAULT.cssVariables();
        assertThat(css).containsKey("--primary-color");
        assertThat(css).containsKey("--accent-color");
        assertThat(css).containsKey("--font-family-sans");
        assertThat(css).containsKey("--page-margin-top");
        assertThat(css).containsKey("--text-color");
    }

    @Test
    void default_constant_hasLayout() {
        TemplateLayout layout = TemplateDefinition.DEFAULT.layout();
        assertThat(layout).isNotNull();
        assertThat(layout.headerFormat()).isEqualTo("name-contact");
        assertThat(layout.sectionOrder()).contains("WORK_EXPERIENCE", "EDUCATION", "SKILLS");
    }

    @Test
    void default_constant_hasMetadata() {
        Map<String, Object> metadata = TemplateDefinition.DEFAULT.metadata();
        assertThat(metadata).containsEntry("version", "1.0");
        assertThat(metadata).containsEntry("atsCompatible", true);
        assertThat(metadata).containsEntry("pageSize", "letter");
    }

    @Test
    void isTwoColumn_returnsTrueForTwoColumnLayout() {
        TemplateDefinition def = new TemplateDefinition(
                "two-column",
                Map.of(),
                new TemplateLayout("name-contact", null, new TemplateColumns(List.of(), List.of()), Map.of()),
                Map.of()
        );
        assertThat(def.isTwoColumn()).isTrue();
    }

    @Test
    void isTwoColumn_returnsFalseForSingleColumnLayout() {
        TemplateDefinition def = new TemplateDefinition(
                "single-column",
                Map.of(),
                new TemplateLayout("name-contact", List.of(), null, Map.of()),
                Map.of()
        );
        assertThat(def.isTwoColumn()).isFalse();
    }

    @Test
    void isModernAccent_returnsTrueForModernAccentLayout() {
        TemplateDefinition def = new TemplateDefinition(
                "modern-accent",
                Map.of(),
                new TemplateLayout("name-contact", List.of(), null, Map.of()),
                Map.of()
        );
        assertThat(def.isModernAccent()).isTrue();
    }

    @Test
    void isModernAccent_returnsFalseForSingleColumnLayout() {
        TemplateDefinition def = new TemplateDefinition(
                "single-column",
                Map.of(),
                new TemplateLayout("name-contact", List.of(), null, Map.of()),
                Map.of()
        );
        assertThat(def.isModernAccent()).isFalse();
    }

    @Test
    void default_isTwoColumn_returnsFalse() {
        assertThat(TemplateDefinition.DEFAULT.isTwoColumn()).isFalse();
    }

    @Test
    void default_isModernAccent_returnsFalse() {
        assertThat(TemplateDefinition.DEFAULT.isModernAccent()).isFalse();
    }

    @Test
    void constructor_storesAllFields() {
        Map<String, Object> css = Map.of("--color", "#fff");
        TemplateLayout layout = new TemplateLayout("name-contact", List.of("SKILLS"), null, Map.of());
        Map<String, Object> metadata = Map.of("version", "2.0");

        TemplateDefinition def = new TemplateDefinition("single-column", css, layout, metadata);

        assertThat(def.layoutType()).isEqualTo("single-column");
        assertThat(def.cssVariables()).isEqualTo(css);
        assertThat(def.layout()).isEqualTo(layout);
        assertThat(def.metadata()).isEqualTo(metadata);
    }
}
