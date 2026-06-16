package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.stream.Collectors;

@Component
public class DocxParser {

    public ParsedResumeDto parse(MultipartFile file) {
        try (XWPFDocument document = new XWPFDocument(file.getInputStream())) {
            String rawText = document.getParagraphs().stream()
                    .map(XWPFParagraph::getText)
                    .collect(Collectors.joining("\n"));
            return SectionExtractor.extract(rawText);
        } catch (Exception e) {
            throw new FileValidationException("Failed to read DOCX file. The file may be corrupted or invalid.");
        }
    }
}
