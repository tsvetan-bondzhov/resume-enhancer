package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateControllerTest {

    @Mock
    private TemplateService templateService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TemplateController templateController;

    private static final UUID TEMPLATE_ID = UUID.fromString("11111111-0000-0000-0000-000000000001");
    private static final UUID OWNER_ID = UUID.fromString("22222222-0000-0000-0000-000000000001");

    private TemplateDto buildTemplateDto(String name) {
        return new TemplateDto(TEMPLATE_ID, name, "A description", true, true,
                Map.of(), Instant.now(), Instant.now());
    }

    private User buildPrincipal() {
        User principal = new User();
        principal.setEmail("user@example.com");
        User persisted = new User();
        persisted.setEmail("user@example.com");
        ReflectionTestUtils.setField(persisted, "id", OWNER_ID);
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(persisted));
        return principal;
    }

    @Test
    void getTemplate_resolvesOwnerIdAndDelegatesToSharedOrOwnedLookup() {
        User principal = buildPrincipal();
        TemplateDto dto = buildTemplateDto("Modern");
        when(templateService.getSharedOrOwnedTemplate(OWNER_ID, TEMPLATE_ID)).thenReturn(dto);

        TemplateDto result = templateController.getTemplate(principal, TEMPLATE_ID);

        assertThat(result.name()).isEqualTo("Modern");
        verify(templateService).getSharedOrOwnedTemplate(OWNER_ID, TEMPLATE_ID);
    }

    @Test
    void createTemplate_delegatesAndReturns201() {
        TemplateRequest request = new TemplateRequest("New Template", null, Map.of());
        TemplateDto dto = buildTemplateDto("New Template");
        when(templateService.createTemplate(request)).thenReturn(dto);

        ResponseEntity<TemplateDto> response = templateController.createTemplate(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("New Template");
        verify(templateService).createTemplate(request);
    }

    // updateTemplate delegates to service and returns 200 with TemplateDto
    @Test
    void updateTemplate_delegatesToServiceAndReturns200() {
        TemplateRequest request = new TemplateRequest("Updated", "desc", Map.of());
        TemplateDto dto = buildTemplateDto("Updated");
        when(templateService.updateTemplate(TEMPLATE_ID, request)).thenReturn(dto);

        ResponseEntity<TemplateDto> response = templateController.updateTemplate(TEMPLATE_ID, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Updated");
    }

    @Test
    void deleteTemplate_delegatesAndReturns204() {
        ResponseEntity<Void> response = templateController.deleteTemplate(TEMPLATE_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(templateService).deleteTemplate(TEMPLATE_ID);
    }

    @Test
    void publish_delegatesAndReturns200() {
        TemplateDto dto = buildTemplateDto("Published");
        when(templateService.setPublished(TEMPLATE_ID, true)).thenReturn(dto);

        ResponseEntity<TemplateDto> response = templateController.publishTemplate(TEMPLATE_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        verify(templateService).setPublished(TEMPLATE_ID, true);
    }

    @Test
    void unpublish_delegatesAndReturns200() {
        TemplateDto dto = buildTemplateDto("Unpublished");
        when(templateService.setPublished(TEMPLATE_ID, false)).thenReturn(dto);

        ResponseEntity<TemplateDto> response = templateController.unpublishTemplate(TEMPLATE_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        verify(templateService).setPublished(TEMPLATE_ID, false);
    }

    @Test
    void listAllTemplates_delegatesAndReturns200() {
        when(templateService.listAllTemplates()).thenReturn(List.of(buildTemplateDto("A"), buildTemplateDto("B")));

        List<TemplateDto> result = templateController.listAllTemplates();

        assertThat(result).hasSize(2);
        verify(templateService).listAllTemplates();
    }
}
