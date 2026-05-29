package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.DocxParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.PdfParser;
import com.tsvetanbondzhov.resumeenhancer.upload.validators.FileValidator;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ParsingService {

    private static final String MIME_PDF = "application/pdf";
    private static final String MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    private final FileValidator fileValidator;
    private final PdfParser pdfParser;
    private final DocxParser docxParser;

    public ParsingService(FileValidator fileValidator, PdfParser pdfParser, DocxParser docxParser) {
        this.fileValidator = fileValidator;
        this.pdfParser = pdfParser;
        this.docxParser = docxParser;
    }

    public ParsedResumeDto parse(MultipartFile file) {
        fileValidator.validate(file);

        String contentType = file.getContentType();
        if (MIME_PDF.equals(contentType)) {
            return pdfParser.parse(file);
        } else if (MIME_DOCX.equals(contentType)) {
            return docxParser.parse(file);
        } else {
            throw new FileValidationException("Unsupported file type. Only PDF and DOCX files are accepted.");
        }
    }
}
