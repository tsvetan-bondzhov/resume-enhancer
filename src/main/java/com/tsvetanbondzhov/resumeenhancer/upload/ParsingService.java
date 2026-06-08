package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.ai.OllamaHealthGuard;
import com.tsvetanbondzhov.resumeenhancer.ai.OllamaUnavailableException;
import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.RawSection;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.DocxParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.PdfParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.SectionExtractor;
import com.tsvetanbondzhov.resumeenhancer.upload.validators.FileValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class ParsingService {

    private static final Logger log = LoggerFactory.getLogger(ParsingService.class);
    private static final String MIME_PDF = "application/pdf";
    private static final String MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private static final int LLM_TIMEOUT_SECONDS = 30;

    private final FileValidator fileValidator;
    private final PdfParser pdfParser;
    private final DocxParser docxParser;
    private final OllamaHealthGuard ollamaHealthGuard;
    private final LlmSectionExtractor llmSectionExtractor;

    public ParsingService(
            FileValidator fileValidator,
            PdfParser pdfParser,
            DocxParser docxParser,
            OllamaHealthGuard ollamaHealthGuard,
            LlmSectionExtractor llmSectionExtractor) {
        this.fileValidator = fileValidator;
        this.pdfParser = pdfParser;
        this.docxParser = docxParser;
        this.ollamaHealthGuard = ollamaHealthGuard;
        this.llmSectionExtractor = llmSectionExtractor;
    }

    public ParsedResumeDto parse(MultipartFile file) {
        fileValidator.validate(file);

        String contentType = file.getContentType();
        ParsedResumeDto heuristicResult;

        if (MIME_PDF.equals(contentType)) {
            heuristicResult = pdfParser.parse(file);
        } else if (MIME_DOCX.equals(contentType)) {
            heuristicResult = docxParser.parse(file);
        } else {
            throw new FileValidationException("Unsupported file type. Only PDF and DOCX files are accepted.");
        }

        // Try LLM enhancement path
        if (!ollamaHealthGuard.isAvailable()) {
            log.info("Ollama unavailable — returning heuristic ParsedResumeDto");
            return heuristicResult;
        }

        try {
            String rawText = heuristicResult.rawText();
            List<RawSection> rawSections = SectionExtractor.segmentByHeaders(rawText);

            // AC10: Enforce 30-second total timeout via CompletableFuture
            CompletableFuture<ResumeDocument> future = CompletableFuture.supplyAsync(() ->
                llmSectionExtractor.extract(rawSections, rawText)
            );

            ResumeDocument resumeDocument = future.get(LLM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("LLM parsing complete: {} sections extracted", resumeDocument.sections().size());

            // Return heuristic DTO (backward compat) — ResumeDocument is assembled for future use
            return heuristicResult;

        } catch (TimeoutException e) {
            log.warn("LLM parsing timed out after {}s — returning heuristic fallback", LLM_TIMEOUT_SECONDS);
            return heuristicResult;
        } catch (OllamaUnavailableException e) {
            log.warn("Ollama unavailable during LLM extraction — returning heuristic fallback");
            return heuristicResult;
        } catch (Exception e) {
            log.warn("LLM parsing failed — returning heuristic fallback: {}", e.getMessage());
            return heuristicResult;
        }
    }
}
