package com.tsvetanbondzhov.resumeenhancer.upload;

import com.tsvetanbondzhov.resumeenhancer.upload.dto.ParsedResumeDto;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/upload")
public class UploadController {

    private final ParsingService parsingService;

    public UploadController(ParsingService parsingService) {
        this.parsingService = parsingService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ParsedResumeDto> upload(
            @RequestParam("file") MultipartFile file) {
        ParsedResumeDto result = parsingService.parse(file);
        return ResponseEntity.ok(result);
    }
}
