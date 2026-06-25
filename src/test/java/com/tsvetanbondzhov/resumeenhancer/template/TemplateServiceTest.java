package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import com.tsvetanbondzhov.resumeenhancer.template.dto.CustomTemplateRequest;
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

    @Mock
    private com.tsvetanbondzhov.resumeenhancer.auth.UserRepository userRepository;

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

    // ─── getSharedOrOwnedTemplate ─────────────────────────────────────────────

    @Test
    void getSharedOrOwnedTemplate_returnsPublishedTemplate_whenPublished() {
        ResumeTemplate t = buildTemplate("Modern", true);
        when(templateRepository.findByIdAndIsPublishedTrue(TEMPLATE_ID)).thenReturn(Optional.of(t));

        TemplateDto result = templateService.getSharedOrOwnedTemplate(OWNER_ID, TEMPLATE_ID);

        assertThat(result.name()).isEqualTo("Modern");
        verify(templateRepository, never()).findByIdAndOwnerId(any(), any());
    }

    @Test
    void getSharedOrOwnedTemplate_fallsBackToOwnCustomTemplate_whenNotPublished() {
        when(templateRepository.findByIdAndIsPublishedTrue(TEMPLATE_ID)).thenReturn(Optional.empty());
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID))
                .thenReturn(Optional.of(buildCustomTemplate("Mine", OWNER_ID)));

        TemplateDto result = templateService.getSharedOrOwnedTemplate(OWNER_ID, TEMPLATE_ID);

        assertThat(result.name()).isEqualTo("Mine");
        assertThat(result.isPublished()).isFalse();
    }

    @Test
    void getSharedOrOwnedTemplate_unknownId_throwsNotFound() {
        when(templateRepository.findByIdAndIsPublishedTrue(TEMPLATE_ID)).thenReturn(Optional.empty());
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.getSharedOrOwnedTemplate(OWNER_ID, TEMPLATE_ID))
                .isInstanceOf(TemplateNotFoundException.class)
                .hasMessageContaining(TEMPLATE_ID.toString());
    }

    @Test
    void getSharedOrOwnedTemplate_otherUsersPrivateCustom_throwsNotFound() {
        // Not published, and not owned by the caller → owner-scoped lookup misses → clean 404.
        when(templateRepository.findByIdAndIsPublishedTrue(TEMPLATE_ID)).thenReturn(Optional.empty());
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.getSharedOrOwnedTemplate(OWNER_ID, TEMPLATE_ID))
                .isInstanceOf(TemplateNotFoundException.class);
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

    // ─── Custom templates (Story 8.1) ─────────────────────────────────────────

    private static final UUID OWNER_ID = UUID.fromString("22222222-0000-0000-0000-000000000001");
    private static final UUID OTHER_OWNER_ID = UUID.fromString("33333333-0000-0000-0000-000000000001");

    private ResumeTemplate buildCustomTemplate(String name, UUID ownerId) {
        ResumeTemplate t = new ResumeTemplate();
        t.setName(name);
        t.setDescription("A custom description");
        t.setPrebuilt(false);
        t.setPublished(false);
        t.setOwnerId(ownerId);
        t.setTemplateDefinition(new HashMap<>(Map.of()));
        ReflectionTestUtils.setField(t, "id", TEMPLATE_ID);
        ReflectionTestUtils.setField(t, "createdAt", FIXED_NOW);
        ReflectionTestUtils.setField(t, "updatedAt", FIXED_NOW);
        return t;
    }

    @Test
    void createCustomTemplate_setsOwnerIdPrebuiltFalsePublishedFalse_andReturnsDto() {
        when(templateRepository.save(any(ResumeTemplate.class))).thenAnswer(invocation -> {
            ResumeTemplate saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", TEMPLATE_ID);
            ReflectionTestUtils.setField(saved, "createdAt", FIXED_NOW);
            ReflectionTestUtils.setField(saved, "updatedAt", FIXED_NOW);
            return saved;
        });

        CustomTemplateRequest request =
                new CustomTemplateRequest("My Template", "desc", new HashMap<>(Map.of()));

        TemplateDto result = templateService.createCustomTemplate(OWNER_ID, request);

        assertThat(result.name()).isEqualTo("My Template");
        assertThat(result.isPrebuilt()).isFalse();
        assertThat(result.isPublished()).isFalse();

        ArgumentCaptor<ResumeTemplate> captor = ArgumentCaptor.forClass(ResumeTemplate.class);
        verify(templateRepository).save(captor.capture());
        ResumeTemplate persisted = captor.getValue();
        assertThat(persisted.getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(persisted.isPrebuilt()).isFalse();
        assertThat(persisted.isPublished()).isFalse();
    }

    @Test
    void createCustomTemplate_remUnitInCssVariables_throwsTemplateValidationException() {
        Map<String, Object> cssVars = new HashMap<>(Map.of("--font-size-base", "1rem"));
        Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
        CustomTemplateRequest request = new CustomTemplateRequest("My Template", null, templateDef);

        assertThatThrownBy(() -> templateService.createCustomTemplate(OWNER_ID, request))
                .isInstanceOf(TemplateValidationException.class)
                .hasMessageContaining("rem");
        verify(templateRepository, never()).save(any());
    }

    @Test
    void listCustomTemplates_filtersByOwner() {
        ResumeTemplate t1 = buildCustomTemplate("Mine A", OWNER_ID);
        ResumeTemplate t2 = buildCustomTemplate("Mine B", OWNER_ID);
        when(templateRepository.findAllByOwnerId(OWNER_ID)).thenReturn(List.of(t1, t2));

        List<TemplateDto> result = templateService.listCustomTemplates(OWNER_ID);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(TemplateDto::name).containsExactly("Mine A", "Mine B");
        verify(templateRepository).findAllByOwnerId(OWNER_ID);
    }

    @Test
    void getCustomTemplate_ownSucceeds_returnsDto() {
        ResumeTemplate t = buildCustomTemplate("Mine", OWNER_ID);
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.of(t));

        TemplateDto result = templateService.getCustomTemplate(OWNER_ID, TEMPLATE_ID);

        assertThat(result.name()).isEqualTo("Mine");
        verify(templateRepository).findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID);
    }

    @Test
    void getCustomTemplate_otherUsersTemplate_throwsAccessDenied() {
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());
        when(templateRepository.findById(TEMPLATE_ID))
                .thenReturn(Optional.of(buildCustomTemplate("Not Yours", OTHER_OWNER_ID)));

        assertThatThrownBy(() -> templateService.getCustomTemplate(OWNER_ID, TEMPLATE_ID))
                .isInstanceOf(TemplateAccessDeniedException.class);
    }

    @Test
    void getCustomTemplate_unknownId_throwsNotFound() {
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> templateService.getCustomTemplate(OWNER_ID, TEMPLATE_ID))
                .isInstanceOf(TemplateNotFoundException.class)
                .hasMessageContaining(TEMPLATE_ID.toString());
    }

    @Test
    void updateCustomTemplate_ownSucceeds_returnsUpdatedDto() {
        ResumeTemplate t = buildCustomTemplate("Old Name", OWNER_ID);
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.of(t));
        when(templateRepository.save(any(ResumeTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomTemplateRequest request =
                new CustomTemplateRequest("New Name", "new desc", new HashMap<>(Map.of()));

        TemplateDto result = templateService.updateCustomTemplate(OWNER_ID, TEMPLATE_ID, request);

        assertThat(result.name()).isEqualTo("New Name");
        assertThat(t.getName()).isEqualTo("New Name");
        verify(templateRepository).save(t);
    }

    @Test
    void updateCustomTemplate_otherUsersTemplate_throwsAccessDenied() {
        // findByIdAndOwnerId empty (not the caller's), but findById finds it under another owner
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());
        when(templateRepository.findById(TEMPLATE_ID))
                .thenReturn(Optional.of(buildCustomTemplate("Not Yours", OTHER_OWNER_ID)));

        CustomTemplateRequest request =
                new CustomTemplateRequest("Hijack", null, new HashMap<>(Map.of()));

        assertThatThrownBy(() -> templateService.updateCustomTemplate(OWNER_ID, TEMPLATE_ID, request))
                .isInstanceOf(TemplateAccessDeniedException.class);
        verify(templateRepository, never()).save(any());
    }

    @Test
    void updateCustomTemplate_unknownId_throwsNotFound() {
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());
        when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.empty());

        CustomTemplateRequest request =
                new CustomTemplateRequest("Whatever", null, new HashMap<>(Map.of()));

        assertThatThrownBy(() -> templateService.updateCustomTemplate(OWNER_ID, TEMPLATE_ID, request))
                .isInstanceOf(TemplateNotFoundException.class)
                .hasMessageContaining(TEMPLATE_ID.toString());
        verify(templateRepository, never()).save(any());
    }

    @Test
    void deleteCustomTemplate_ownSucceeds_callsRepositoryDelete() {
        ResumeTemplate t = buildCustomTemplate("Mine", OWNER_ID);
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.of(t));

        templateService.deleteCustomTemplate(OWNER_ID, TEMPLATE_ID);

        verify(templateRepository).delete(t);
    }

    @Test
    void deleteCustomTemplate_otherUsersTemplate_throwsAccessDenied() {
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());
        when(templateRepository.findById(TEMPLATE_ID))
                .thenReturn(Optional.of(buildCustomTemplate("Not Yours", OTHER_OWNER_ID)));

        assertThatThrownBy(() -> templateService.deleteCustomTemplate(OWNER_ID, TEMPLATE_ID))
                .isInstanceOf(TemplateAccessDeniedException.class);
        verify(templateRepository, never()).delete(any());
    }

    @Test
    void listAllCustomTemplates_returnsAllOwnedTemplatesWithOwnerEmail() {
        ResumeTemplate t1 = buildCustomTemplate("Mine A", OWNER_ID);
        ResumeTemplate t2 = buildCustomTemplate("Other B", OTHER_OWNER_ID);
        when(templateRepository.findAllByOwnerIdIsNotNull()).thenReturn(List.of(t1, t2));

        com.tsvetanbondzhov.resumeenhancer.auth.domain.User u1 =
                new com.tsvetanbondzhov.resumeenhancer.auth.domain.User();
        ReflectionTestUtils.setField(u1, "id", OWNER_ID);
        u1.setEmail("owner-a@example.com");
        com.tsvetanbondzhov.resumeenhancer.auth.domain.User u2 =
                new com.tsvetanbondzhov.resumeenhancer.auth.domain.User();
        ReflectionTestUtils.setField(u2, "id", OTHER_OWNER_ID);
        u2.setEmail("owner-b@example.com");
        when(userRepository.findAllById(any())).thenReturn(List.of(u1, u2));

        var result = templateService.listAllCustomTemplates();

        assertThat(result).hasSize(2);
        assertThat(result).anyMatch(dto ->
                dto.name().equals("Mine A") && "owner-a@example.com".equals(dto.ownerEmail()));
        assertThat(result).anyMatch(dto ->
                dto.name().equals("Other B") && "owner-b@example.com".equals(dto.ownerEmail()));
        verify(templateRepository).findAllByOwnerIdIsNotNull();
    }

    @Test
    void deleteCustomTemplate_prebuiltTemplate_throwsAccessDenied() {
        // Prebuilt templates have ownerId == null, so findByIdAndOwnerId is empty but findById finds it
        when(templateRepository.findByIdAndOwnerId(TEMPLATE_ID, OWNER_ID)).thenReturn(Optional.empty());
        when(templateRepository.findById(TEMPLATE_ID))
                .thenReturn(Optional.of(buildTemplate("Prebuilt", true)));

        assertThatThrownBy(() -> templateService.deleteCustomTemplate(OWNER_ID, TEMPLATE_ID))
                .isInstanceOf(TemplateAccessDeniedException.class);
        verify(templateRepository, never()).delete(any());
    }
}
