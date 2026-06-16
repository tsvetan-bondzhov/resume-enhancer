package com.tsvetanbondzhov.resumeenhancer.template;

import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateDto;
import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplateControllerTest {

    @Mock
    private TemplateService templateService;

    @InjectMocks
    private TemplateController templateController;

    private static final UUID TEMPLATE_ID = UUID.fromString("11111111-0000-0000-0000-000000000001");

    private TemplateDto buildTemplateDto(String name) {
        return new TemplateDto(TEMPLATE_ID, name, "A description", true, true,
                Map.of(), Instant.now(), Instant.now());
    }

    // Line 46: createTemplate returns 501 NOT_IMPLEMENTED
    @Test
    void createTemplate_returnsNotImplemented() {
        TemplateRequest request = new TemplateRequest("New Template", null, Map.of());

        ResponseEntity<Void> response = templateController.createTemplate(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_IMPLEMENTED);
    }

    // Line 53: updateTemplate delegates to service and returns 200 with TemplateDto
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

    // Line 59: deleteTemplate returns 501 NOT_IMPLEMENTED
    @Test
    void deleteTemplate_returnsNotImplemented() {
        ResponseEntity<Void> response = templateController.deleteTemplate(TEMPLATE_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_IMPLEMENTED);
    }
}
