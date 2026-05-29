package com.tsvetanbondzhov.resumeenhancer.upload.validators;

import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class FileValidator {

    private static final String MIME_PDF = "application/pdf";
    private static final String MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024; // 10MB

    public void validate(MultipartFile file) {
        String contentType = file.getContentType();

        if (contentType == null || (!MIME_PDF.equals(contentType) && !MIME_DOCX.equals(contentType))) {
            throw new FileValidationException("Unsupported file type. Only PDF and DOCX files are accepted.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new FileValidationException("File exceeds the 10MB size limit.");
        }
    }
}
