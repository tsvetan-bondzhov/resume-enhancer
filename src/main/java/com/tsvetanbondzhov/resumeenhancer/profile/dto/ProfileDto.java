package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.util.List;

public record ProfileDto(
        String summary,
        String linkedInUrl,
        String personalPageUrl,
        String blogUrl,
        String contactEmail,
        String locationCountry,
        String locationCity,
        List<WorkExperienceDto> workExperiences,
        List<EducationDto> education,
        List<SkillDto> skills,
        List<CertificationDto> certifications,
        List<LanguageDto> languages,
        List<ProjectDto> projects,
        List<VolunteeringDto> volunteering
) {
}
