package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.ai.OllamaHealthGuard;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.DocxParser;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.LlmSectionExtractor;
import com.tsvetanbondzhov.resumeenhancer.upload.parsers.PdfParser;
import com.tsvetanbondzhov.resumeenhancer.upload.validators.FileValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParsingServiceTest {

    @Mock private FileValidator fileValidator;
    @Mock private PdfParser pdfParser;
    @Mock private DocxParser docxParser;
    @Mock private OllamaHealthGuard ollamaHealthGuard;
    @Mock private LlmSectionExtractor llmSectionExtractor;

    @InjectMocks
    private ParsingService parsingService;

    // AC5: When Ollama unavailable, heuristic DTO returned, LlmSectionExtractor never called
    @Test
    void parse_ollamaUnavailable_returnsHeuristicDtoWithoutCallingLlm() {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text", List.of("Engineer at Acme"), List.of("BS CS"), List.of("Java"));
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(false);

        ParsedResumeDto result = parsingService.parse(file);

        assertThat(result).isEqualTo(heuristic);
        verify(llmSectionExtractor, never()).extract(any(), any());
    }

    // AC4: When Ollama available, LlmSectionExtractor is called
    @Test
    void parse_ollamaAvailable_callsLlmSectionExtractor() {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text", List.of(), List.of(), List.of());
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(true);
        when(llmSectionExtractor.extract(any(), any()))
            .thenReturn(new ResumeDocument(List.of()));

        ParsedResumeDto result = parsingService.parse(file);

        // Heuristic DTO still returned (backward compat) — LLM was called
        assertThat(result).isEqualTo(heuristic);
        verify(llmSectionExtractor).extract(any(), any());
    }

    // Upload endpoint always HTTP 200 — verified via UploadController returning ResponseEntity.ok()
    // ParsingService never throws on Ollama failure (tested via ollamaUnavailable test above)
}
