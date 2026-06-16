package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UploadControllerTest {

    @Mock
    private ParsingService parsingService;

    @InjectMocks
    private UploadController uploadController;

    // Lines 25-26: parsingService.parse(file) and ResponseEntity.ok(result)
    @Test
    void upload_validFile_returns200WithParsedDto() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});
        ParsedResumeDto expected = new ParsedResumeDto(
                "raw text", List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of(), null);

        when(parsingService.parse(file)).thenReturn(expected);

        ResponseEntity<ParsedResumeDto> response = uploadController.upload(file);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(expected);
    }
}
