package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.ai.OllamaHealthGuard;
import com.tsvetanbondzhov.resumeenhancer.common.FileValidationException;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
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
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    // AC3/AC4: When Ollama unavailable, heuristic DTO returned, LlmSectionExtractor never called
    @Test
    void parse_ollamaUnavailable_returnsHeuristicDtoWithoutCallingLlm() {
        WorkExperienceItem workItem = new WorkExperienceItem(
            "id-1", "Engineer at Acme", null, null, null, false, null);
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text",
            List.of(workItem),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            null
        );
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(false);

        ParsedResumeDto result = parsingService.parse(file);

        assertThat(result).isEqualTo(heuristic);
        verify(llmSectionExtractor, never()).extract(any(), any());
    }

    // AC3: When Ollama available, LLM dto is returned (not heuristic)
    @Test
    void parse_ollamaAvailable_returnsLlmDto() {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text", List.of(), List.of(), List.of(),
            List.of(), List.of(), List.of(), List.of(), null);
        WorkExperienceItem llmWorkItem = new WorkExperienceItem(
            "llm-id", "Software Engineer", "Acme Corp", null, null, false, "Built services");
        ParsedResumeDto llmDto = new ParsedResumeDto(
            "raw text",
            List.of(llmWorkItem),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            null
        );
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(true);
        when(llmSectionExtractor.extract(any(), any())).thenReturn(llmDto);

        ParsedResumeDto result = parsingService.parse(file);

        // LLM dto is returned — NOT the heuristic dto
        assertThat(result).isEqualTo(llmDto);
        assertThat(result).isNotEqualTo(heuristic);
        assertThat(result.workExperiences()).hasSize(1);
        assertThat(result.workExperiences().get(0).jobTitle()).isEqualTo("Software Engineer");
        verify(llmSectionExtractor).extract(any(), any());
    }

    // AC3: When Ollama available but LLM throws, heuristic DTO is returned
    @Test
    void parse_ollamaAvailable_llmThrows_returnsHeuristicDto() {
        WorkExperienceItem workItem = new WorkExperienceItem(
            "heuristic-id", "Developer at Corp", null, null, null, false, null);
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text",
            List.of(workItem),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            null
        );
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(true);
        when(llmSectionExtractor.extract(any(), any()))
            .thenThrow(new RuntimeException("LLM extraction failed"));

        ParsedResumeDto result = parsingService.parse(file);

        assertThat(result).isEqualTo(heuristic);
    }

    // Lines 57-58: DOCX file path — docxParser.parse(file) is called and heuristic returned
    @Test
    void parse_docxFile_ollamaUnavailable_returnsHeuristicDto() {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw docx text", List.of(), List.of(), List.of(),
            List.of(), List.of(), List.of(), List.of(), null);
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            new byte[]{1, 2, 3});

        when(docxParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(false);

        ParsedResumeDto result = parsingService.parse(file);

        assertThat(result).isEqualTo(heuristic);
        verify(pdfParser, never()).parse(any());
        verify(llmSectionExtractor, never()).extract(any(), any());
    }

    // Line 60: unsupported file type — FileValidationException thrown
    @Test
    void parse_unsupportedFileType_throwsFileValidationException() {
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.txt", "text/plain", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> parsingService.parse(file))
            .isInstanceOf(FileValidationException.class)
            .hasMessageContaining("Unsupported file type");
    }

    // Lines 81-83: InterruptedException path — thread interrupted while waiting for LLM
    @Test
    void parse_ollamaAvailable_llmInterrupted_returnsHeuristicDto() throws InterruptedException {
        ParsedResumeDto heuristic = new ParsedResumeDto(
            "raw text", List.of(), List.of(), List.of(),
            List.of(), List.of(), List.of(), List.of(), null);
        MockMultipartFile file = new MockMultipartFile(
            "file", "resume.pdf", "application/pdf", new byte[]{1, 2, 3});

        when(pdfParser.parse(file)).thenReturn(heuristic);
        when(ollamaHealthGuard.isAvailable()).thenReturn(true);
        // Make the extractor block indefinitely so that interrupting the calling thread
        // causes CompletableFuture.get() to throw InterruptedException
        when(llmSectionExtractor.extract(any(), any())).thenAnswer(invocation -> {
            Thread.sleep(Long.MAX_VALUE);
            return null;
        });

        AtomicReference<ParsedResumeDto> result = new AtomicReference<>();
        AtomicReference<Throwable> thrown = new AtomicReference<>();

        Thread testThread = new Thread(() -> {
            try {
                result.set(parsingService.parse(file));
            } catch (Throwable t) {
                thrown.set(t);
            }
        });
        testThread.start();
        // Give the thread time to reach the blocking get() call
        Thread.sleep(200);
        testThread.interrupt();
        testThread.join(5000);

        assertThat(thrown.get()).isNull();
        assertThat(result.get()).isEqualTo(heuristic);
    }

    // Upload endpoint always HTTP 200 — verified via UploadController returning ResponseEntity.ok()
    // ParsingService never throws on Ollama failure (tested via ollamaUnavailable test above)
}
