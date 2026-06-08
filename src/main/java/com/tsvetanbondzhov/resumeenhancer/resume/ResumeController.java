package com.tsvetanbondzhov.resumeenhancer.resume;

import com.tsvetanbondzhov.resumeenhancer.resume.dto.CreateResumeRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.SaveAsRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.UpdateResumeRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resumes")
@Tag(name = "Resume")
public class ResumeController {

    private final ResumeService resumeService;

    public ResumeController(ResumeService resumeService) {
        this.resumeService = resumeService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResumeDto createResume(Authentication authentication,
                                  @Valid @RequestBody CreateResumeRequest request) {
        return resumeService.createResume(authentication.getName(), request);
    }

    @GetMapping
    public List<ResumeDto> listResumes(Authentication authentication) {
        return resumeService.listResumes(authentication.getName());
    }

    @GetMapping("/{resumeId}")
    public ResumeDto getResume(Authentication authentication,
                               @PathVariable UUID resumeId) {
        return resumeService.getResume(authentication.getName(), resumeId);
    }

    @DeleteMapping("/{resumeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResume(Authentication authentication,
                             @PathVariable UUID resumeId) {
        resumeService.deleteResume(authentication.getName(), resumeId);
    }

    @PostMapping("/{resumeId}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public ResumeDto cloneResume(Authentication authentication,
                                 @PathVariable UUID resumeId,
                                 @Valid @RequestBody SaveAsRequest request) {
        return resumeService.cloneResume(authentication.getName(), resumeId, request);
    }

    @PutMapping("/{resumeId}")
    public ResumeDto updateResume(Authentication authentication,
                                  @PathVariable UUID resumeId,
                                  @Valid @RequestBody UpdateResumeRequest request) {
        return resumeService.updateResume(authentication.getName(), resumeId, request);
    }
}
