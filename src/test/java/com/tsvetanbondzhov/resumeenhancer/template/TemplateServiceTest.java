package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateServiceTest {

    @Mock
    private TemplateRepository templateRepository;

    @InjectMocks
    private TemplateService templateService;

    private static final UUID TEMPLATE_ID = UUID.fromString("11111111-0000-0000-0000-000000000001");
    private static final Instant FIXED_NOW = Instant.parse("2024-01-15T10:00:00Z");

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
        ReflectionTestUtils.setField(t, "createdAt", FIXED_NOW);
        ReflectionTestUtils.setField(t, "updatedAt", FIXED_NOW);
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

    // ─── createTemplate (AC1) ─────────────────────────────────────────────────

    @Test
    void createTemplate_setsPrebuiltTrueAndPublishedFalse_andReturnsDto() {
        when(templateRepository.save(any(ResumeTemplate.class))).thenAnswer(invocation -> {
            ResumeTemplate saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", TEMPLATE_ID);
            ReflectionTestUtils.setField(saved, "createdAt", FIXED_NOW);
            ReflectionTestUtils.setField(saved, "updatedAt", FIXED_NOW);
            return saved;
        });

        TemplateRequest request = new TemplateRequest("New Template", "desc", new HashMap<>(Map.of()));

        TemplateDto result = templateService.createTemplate(request);

        assertThat(result.name()).isEqualTo("New Template");
        assertThat(result.isPrebuilt()).isTrue();
        assertThat(result.isPublished()).isFalse();

        ArgumentCaptor<ResumeTemplate> captor = ArgumentCaptor.forClass(ResumeTemplate.class);
        verify(templateRepository).save(captor.capture());
        ResumeTemplate persisted = captor.getValue();
        assertThat(persisted.isPrebuilt()).isTrue();
        assertThat(persisted.isPublished()).isFalse();
        assertThat(persisted.getOwnerId()).isNull();
    }

    @Test
    void createTemplate_remUnitInCssVariables_throwsTemplateValidationException() {
        Map<String, Object> cssVars = new HashMap<>(Map.of("--font-size-base", "1rem"));
        Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
        TemplateRequest request = new TemplateRequest("New Template", null, templateDef);

        assertThatThrownBy(() -> templateService.createTemplate(request))
                .isInstanceOf(TemplateValidationException.class)
                .hasMessageContaining("rem");
        verify(templateRepository, never()).save(any());
    }

    // ─── deleteTemplate (AC3) ─────────────────────────────────────────────────

    @Test
    void deleteTemplate_present_callsRepositoryDelete() {
        ResumeTemplate t = buildTemplate("Minimal", true);
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));

        templateService.deleteTemplate(TEMPLATE_ID);

        verify(templateRepository).delete(t);
    }

    @Test
    void deleteTemplate_missing_throwsNotFoundException() {
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.deleteTemplate(TEMPLATE_ID))
                .isInstanceOf(TemplateNotFoundException.class)
                .hasMessageContaining(TEMPLATE_ID.toString());
        verify(templateRepository, never()).delete(any());
    }

    // ─── setPublished (AC4) ───────────────────────────────────────────────────

    @Test
    void setPublished_true_flipsFlagAndReturnsDto() {
        ResumeTemplate t = buildTemplate("Minimal", false);
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));
        when(templateRepository.save(any(ResumeTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        TemplateDto result = templateService.setPublished(TEMPLATE_ID, true);

        assertThat(result.isPublished()).isTrue();
        assertThat(t.isPublished()).isTrue();
        verify(templateRepository).save(t);
    }

    @Test
    void setPublished_false_flipsFlagAndReturnsDto() {
        ResumeTemplate t = buildTemplate("Minimal", true);
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));
        when(templateRepository.save(any(ResumeTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        TemplateDto result = templateService.setPublished(TEMPLATE_ID, false);

        assertThat(result.isPublished()).isFalse();
        assertThat(t.isPublished()).isFalse();
        verify(templateRepository).save(t);
    }

    @Test
    void setPublished_missing_throwsNotFoundException() {
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.setPublished(TEMPLATE_ID, true))
                .isInstanceOf(TemplateNotFoundException.class)
                .hasMessageContaining(TEMPLATE_ID.toString());
        verify(templateRepository, never()).save(any());
    }

    // ─── listAllTemplates (AC5) ───────────────────────────────────────────────

    @Test
    void listAllTemplates_returnsPublishedAndUnpublished() {
        ResumeTemplate published = buildTemplate("Published", true);
        ResumeTemplate draft = buildTemplate("Draft", false);
        when(templateRepository.findAll()).thenReturn(List.of(published, draft));

        List<TemplateDto> result = templateService.listAllTemplates();

        assertThat(result).hasSize(2);
        assertThat(result).anyMatch(dto -> dto.name().equals("Published") && dto.isPublished());
        assertThat(result).anyMatch(dto -> dto.name().equals("Draft") && !dto.isPublished());
        verify(templateRepository).findAll();
    }
}
