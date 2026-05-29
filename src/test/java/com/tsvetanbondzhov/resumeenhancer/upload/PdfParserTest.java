package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.PdfParser;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class PdfParserTest {

    private final PdfParser pdfParser = new PdfParser();

    private static byte[] sample1Bytes;
    private static byte[] sample2Bytes;

    @BeforeAll
    static void generateSamples() throws Exception {
        sample1Bytes = SampleFileGenerator.generatePdfResume("Jane Doe");
        sample2Bytes = SampleFileGenerator.generatePdfResume("John Smith");
    }

    @Test
    void parse_resumeSample1_returnsNonEmptyRawText() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume-sample-1.pdf", "application/pdf", sample1Bytes);

        ParsedResumeDto result = pdfParser.parse(file);

        assertThat(result).isNotNull();
        assertThat(result.rawText()).isNotBlank();
    }

    @Test
    void parse_resumeSample2_returnsNonEmptyRawText() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume-sample-2.pdf", "application/pdf", sample2Bytes);

        ParsedResumeDto result = pdfParser.parse(file);

        assertThat(result).isNotNull();
        assertThat(result.rawText()).isNotBlank();
    }

    @Test
    void parse_corruptedBytes_throwsFileValidationException() {
        byte[] corruptedBytes = new byte[]{0, 1, 2, 3, 4, 5};
        MockMultipartFile file = new MockMultipartFile(
                "file", "corrupted.pdf", "application/pdf", corruptedBytes);

        assertThatThrownBy(() -> pdfParser.parse(file))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Failed to read PDF file");
    }
}
