package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateServiceTest {

    @Mock
    private TemplateRepository templateRepository;

    @InjectMocks
    private TemplateService templateService;

    private static final UUID TEMPLATE_ID = UUID.fromString("11111111-0000-0000-0000-000000000001");

    private ResumeTemplate buildTemplate(String name, boolean isPublished) {
        ResumeTemplate t = new ResumeTemplate();
        t.setName(name);
        t.setDescription("A description");
        t.setPrebuilt(true);
        t.setPublished(isPublished);
        t.setOwnerId(null);
        t.setTemplateDefinition(Map.of());
        // Populate BaseEntity fields so toDto() does not map null id/timestamps
        ReflectionTestUtils.setField(t, "id", TEMPLATE_ID);
        ReflectionTestUtils.setField(t, "createdAt", Instant.now());
        ReflectionTestUtils.setField(t, "updatedAt", Instant.now());
        return t;
    }

    // ─── listPublishedTemplates ───────────────────────────────────────────────

    @Test
    void listPublishedTemplates_returnsOnlyPublishedTemplates() {
        ResumeTemplate t1 = buildTemplate("Minimal", true);
        ResumeTemplate t2 = buildTemplate("Classic", true);

        when(templateRepository.findAllByIsPublishedTrue()).thenReturn(List.of(t1, t2));

        List<TemplateDto> result = templateService.listPublishedTemplates();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).name()).isEqualTo("Minimal");
        assertThat(result.get(1).name()).isEqualTo("Classic");
        verify(templateRepository).findAllByIsPublishedTrue();
    }

    @Test
    void listPublishedTemplates_emptyWhenNonePublished() {
        when(templateRepository.findAllByIsPublishedTrue()).thenReturn(List.of());

        List<TemplateDto> result = templateService.listPublishedTemplates();

        assertThat(result).isEmpty();
        verify(templateRepository).findAllByIsPublishedTrue();
    }

    // ─── getPublishedTemplate ─────────────────────────────────────────────────

    @Test
    void getPublishedTemplate_returnsDto_whenFound() {
        ResumeTemplate t = buildTemplate("Modern", true);
        when(templateRepository.findByIdAndIsPublishedTrue(TEMPLATE_ID)).thenReturn(Optional.of(t));

        TemplateDto result = templateService.getPublishedTemplate(TEMPLATE_ID);

        assertThat(result.name()).isEqualTo("Modern");
        assertThat(result.isPrebuilt()).isTrue();
        assertThat(result.isPublished()).isTrue();
    }

    @Test
    void getPublishedTemplate_throwsNotFoundException_whenNotFound() {
        when(templateRepository.findByIdAndIsPublishedTrue(TEMPLATE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.getPublishedTemplate(TEMPLATE_ID))
                .isInstanceOf(TemplateNotFoundException.class)
                .hasMessageContaining(TEMPLATE_ID.toString());
    }

    // ─── updateTemplate — CSS unit validation (AC3) ───────────────────────────

    @Test
    void updateTemplate_remUnitInCssVariables_throwsTemplateValidationException() {
        ResumeTemplate t = buildTemplate("Minimal", true);
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));

        Map<String, Object> cssVars = new HashMap<>(Map.of(
                "--font-size-base", "1rem",   // DISALLOWED
                "--accent-color", "#3b82f6"
        ));
        Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
        TemplateRequest request = new TemplateRequest("Minimal Updated", null, templateDef);

        assertThatThrownBy(() -> templateService.updateTemplate(TEMPLATE_ID, request))
                .isInstanceOf(TemplateValidationException.class)
                .hasMessageContaining("rem");
    }

    @Test
    void updateTemplate_emUnitInCssVariables_throwsTemplateValidationException() {
        ResumeTemplate t = buildTemplate("Minimal", true);
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));

        Map<String, Object> cssVars = new HashMap<>(Map.of(
                "--line-height-base", "1.5em"  // DISALLOWED
        ));
        Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
        TemplateRequest request = new TemplateRequest("Minimal Updated", null, templateDef);

        assertThatThrownBy(() -> templateService.updateTemplate(TEMPLATE_ID, request))
                .isInstanceOf(TemplateValidationException.class)
                .hasMessageContaining("em");
    }

    @Test
    void updateTemplate_pxAndInUnitsAccepted_templatePersisted() {
        ResumeTemplate t = buildTemplate("Minimal", true);
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));
        when(templateRepository.save(any(ResumeTemplate.class))).thenReturn(t);

        Map<String, Object> cssVars = new HashMap<>(Map.of(
                "--font-size-base", "11px",
                "--page-margin-top", "0.75in"
        ));
        Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
        TemplateRequest request = new TemplateRequest("Minimal", null, templateDef);

        TemplateDto result = templateService.updateTemplate(TEMPLATE_ID, request);

        assertThat(result).isNotNull();
        verify(templateRepository).save(any(ResumeTemplate.class));
    }
}
