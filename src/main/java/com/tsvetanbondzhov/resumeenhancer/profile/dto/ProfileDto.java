package com.tsvetanbondzhov.resumeenhancer.profile.dto;

import java.util.List;

public record ProfileDto(
        String summary,
        List<WorkExperienceDto> workExperiences,
        List<EducationDto> education,
        List<SkillDto> skills,
        List<CertificationDto> certifications,
        List<LanguageDto> languages,
        List<ProjectDto> projects,
        List<VolunteeringDto> volunteering
) {
}
