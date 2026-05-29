package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.Valid;

import java.util.List;

public record ProfileUpdateRequest(
        String summary,

        @Valid
        List<WorkExperienceRequest> workExperiences,

        @Valid
        List<EducationRequest> education,

        @Valid
        List<SkillRequest> skills
) {
}
