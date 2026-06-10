package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = WorkExperienceItem.class,  name = "WORK_EXPERIENCE"),
    @JsonSubTypes.Type(value = EducationItem.class,       name = "EDUCATION"),
    @JsonSubTypes.Type(value = SkillItem.class,           name = "SKILLS"),
    @JsonSubTypes.Type(value = CertificationItem.class,   name = "CERTIFICATIONS"),
    @JsonSubTypes.Type(value = LanguageItem.class,        name = "LANGUAGES"),
    @JsonSubTypes.Type(value = ProjectItem.class,         name = "PROJECTS"),
    @JsonSubTypes.Type(value = VolunteeringItem.class,    name = "VOLUNTEERING"),
    @JsonSubTypes.Type(value = SummaryItem.class,         name = "SUMMARY"),
    @JsonSubTypes.Type(value = GenericItem.class,         name = "UNKNOWN")
})
public sealed interface ResumeItem
    permits WorkExperienceItem, EducationItem, SkillItem, CertificationItem,
            LanguageItem, ProjectItem, VolunteeringItem, SummaryItem, GenericItem {}
