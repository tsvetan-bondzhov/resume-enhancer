package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Component
public class PdfParser {

    public ParsedResumeDto parse(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            try (PDDocument document = Loader.loadPDF(bytes)) {
                PDFTextStripper stripper = new PDFTextStripper();
                String rawText = stripper.getText(document);
                return SectionExtractor.extract(rawText != null ? rawText : "");
            }
        } catch (IOException e) {
            throw new FileValidationException("Failed to read PDF file. The file may be corrupted or password-protected.");
        } catch (Exception e) {
            throw new FileValidationException("Failed to read PDF file. The file may be corrupted or password-protected.");
        }
    }
}
