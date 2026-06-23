package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import jakarta.validation.Valid;
import java.util.List;

public record ProfileUpdateRequest(
        String firstName,
        String lastName,
        String summary,
        String linkedInUrl,
        String personalPageUrl,
        String blogUrl,
        String contactEmail,
        String locationCountry,
        String locationCity,

        @Valid
        List<WorkExperienceRequest> workExperiences,

        @Valid
        List<EducationRequest> education,

        @Valid
        List<SkillRequest> skills,

        @Valid
        List<CertificationRequest> certifications,

        @Valid
        List<LanguageRequest> languages,

        @Valid
        List<ProjectRequest> projects,

        @Valid
        List<VolunteeringRequest> volunteering
) {
}
