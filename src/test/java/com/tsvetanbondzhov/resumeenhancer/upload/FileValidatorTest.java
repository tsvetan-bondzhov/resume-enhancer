package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.upload.validators.FileValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class FileValidatorTest {

    private final FileValidator fileValidator = new FileValidator();

    @Test
    void validate_validPdf_doesNotThrow() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.pdf", "application/pdf", new byte[1024]);

        assertThatCode(() -> fileValidator.validate(file)).doesNotThrowAnyException();
    }

    @Test
    void validate_validDocx_doesNotThrow() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                new byte[1024]);

        assertThatCode(() -> fileValidator.validate(file)).doesNotThrowAnyException();
    }

    @Test
    void validate_invalidMime_throwsFileValidationException() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.txt", "text/plain", new byte[1024]);

        assertThatThrownBy(() -> fileValidator.validate(file))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Unsupported file type");
    }

    @Test
    void validate_fileTooLarge_throwsFileValidationException() {
        byte[] largeContent = new byte[9 * 1024 * 1024]; // 9MB — exceeds the 8MB limit
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.pdf", "application/pdf", largeContent);

        assertThatThrownBy(() -> fileValidator.validate(file))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("8MB");
    }

    @Test
    void validate_nullContentType_throwsFileValidationException() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.pdf", null, new byte[1024]);

        assertThatThrownBy(() -> fileValidator.validate(file))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Unsupported file type");
    }
}
