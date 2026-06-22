package com.tsvetanbondzhov.resumeenhancer.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeAccessDeniedException;
import com.tsvetanbondzhov.resumeenhancer.resume.ResumeRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.template.TemplateRepository;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExportServiceTest {

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private TemplateRepository templateRepository;

    @Mock
    private UserRepository userRepository;

    private ExportService exportService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        DocumentRenderer pdfRenderer = mock(DocumentRenderer.class);
        when(pdfRenderer.render(any(), any())).thenReturn(new byte[]{1, 2, 3});
        exportService = new ExportService(
                resumeRepository,
                templateRepository,
                userRepository,
                Map.of("pdf", pdfRenderer),
                objectMapper
        );
    }

    // ─── ExportResult.equals ─────────────────────────────────────────────────

    @Test
    void exportResult_equals_sameInstance_returnsTrue() {
        ExportService.ExportResult result = new ExportService.ExportResult(new byte[]{1}, "name");
        assertThat(result).isEqualTo(result);
    }

    @Test
    void exportResult_equals_null_returnsFalse() {
        ExportService.ExportResult result = new ExportService.ExportResult(new byte[]{1}, "name");
        assertThat(result).isNotEqualTo(null);
    }

    @Test
    void exportResult_equals_differentClass_returnsFalse() {
        ExportService.ExportResult result = new ExportService.ExportResult(new byte[]{1}, "name");
        assertThat(result).isNotEqualTo("not an ExportResult");
    }

    @Test
    void exportResult_equals_sameContentAndName_returnsTrue() {
        ExportService.ExportResult a = new ExportService.ExportResult(new byte[]{1, 2}, "resume");
        ExportService.ExportResult b = new ExportService.ExportResult(new byte[]{1, 2}, "resume");
        assertThat(a).isEqualTo(b);
    }

    @Test
    void exportResult_equals_differentContent_returnsFalse() {
        ExportService.ExportResult a = new ExportService.ExportResult(new byte[]{1}, "resume");
        ExportService.ExportResult b = new ExportService.ExportResult(new byte[]{2}, "resume");
        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void exportResult_equals_differentName_returnsFalse() {
        ExportService.ExportResult a = new ExportService.ExportResult(new byte[]{1}, "resume-a");
        ExportService.ExportResult b = new ExportService.ExportResult(new byte[]{1}, "resume-b");
        assertThat(a).isNotEqualTo(b);
    }

    // ─── ExportResult.hashCode ───────────────────────────────────────────────

    @Test
    void exportResult_hashCode_equalObjectsHaveSameHashCode() {
        ExportService.ExportResult a = new ExportService.ExportResult(new byte[]{1, 2}, "resume");
        ExportService.ExportResult b = new ExportService.ExportResult(new byte[]{1, 2}, "resume");
        assertThat(a.hashCode()).isEqualTo(b.hashCode());
    }

    // ─── ExportResult.toString ───────────────────────────────────────────────

    @Test
    void exportResult_toString_containsNameAndContent() {
        ExportService.ExportResult result = new ExportService.ExportResult(new byte[]{42}, "my-resume");
        String str = result.toString();
        assertThat(str).contains("my-resume");
        assertThat(str).contains("ExportResult");
    }

    // ─── exportResume — null templateId falls back to DEFAULT template ────────

    @Test
    void exportResume_nullTemplateId_usesFallbackTemplate() {
        User user = new User();
        Resume resume = new Resume();
        resume.setName("Test Resume");
        resume.setTemplateId(null); // null templateId → fallback
        resume.setResumeContent(new ResumeDocument(List.of()));

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(any(UUID.class), any(User.class)))
                .thenReturn(Optional.of(resume));

        ExportService.ExportResult result =
                exportService.exportResume("user@example.com", UUID.randomUUID(), "pdf");

        assertThat(result).isNotNull();
        assertThat(result.name()).isEqualTo("Test Resume");
        assertThat(result.content()).isNotEmpty();
    }

    // ─── exportResume — unpublished template falls back to DEFAULT ────────────

    @Test
    void exportResume_unpublishedTemplate_usesFallbackTemplate() {
        UUID templateId = UUID.randomUUID();
        User user = new User();
        Resume resume = new Resume();
        resume.setName("Unpublished Template Resume");
        resume.setTemplateId(templateId);
        resume.setResumeContent(new ResumeDocument(List.of()));

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(any(UUID.class), any(User.class)))
                .thenReturn(Optional.of(resume));
        // templateRepository returns empty → template is unpublished or missing → fallback
        when(templateRepository.findByIdAndIsPublishedTrue(templateId))
                .thenReturn(Optional.empty());

        ExportService.ExportResult result =
                exportService.exportResume("user@example.com", UUID.randomUUID(), "pdf");

        assertThat(result).isNotNull();
        assertThat(result.name()).isEqualTo("Unpublished Template Resume");
    }

    // ─── exportResume — resume not found → ResumeAccessDeniedException ────────

    @Test
    void exportResume_resumeNotFound_throwsResumeAccessDeniedException() {
        User user = new User();
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(any(UUID.class), any(User.class)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                exportService.exportResume("user@example.com", UUID.randomUUID(), "pdf"))
                .isInstanceOf(ResumeAccessDeniedException.class);
    }

    // ─── exportResume — user not found → IllegalStateException ───────────────

    @Test
    void exportResume_userNotFound_throwsIllegalStateException() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                exportService.exportResume("missing@example.com", UUID.randomUUID(), "pdf"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not found in database");
    }

    // ─── exportResume — unsupported format → UnsupportedExportFormatException ─

    @Test
    void exportResume_unsupportedFormat_throwsUnsupportedExportFormatException() {
        User user = new User();
        Resume resume = new Resume();
        resume.setName("Format Test");
        resume.setTemplateId(null);
        resume.setResumeContent(new ResumeDocument(List.of()));

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(any(UUID.class), any(User.class)))
                .thenReturn(Optional.of(resume));

        assertThatThrownBy(() ->
                exportService.exportResume("user@example.com", UUID.randomUUID(), "txt"))
                .isInstanceOf(UnsupportedExportFormatException.class);
    }
}
