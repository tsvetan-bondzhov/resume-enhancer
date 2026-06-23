package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.profile.domain.Certification;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Education;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Language;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Project;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Skill;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Volunteering;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.WorkExperience;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.CertificationDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.CertificationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.EducationDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.EducationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.LanguageDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.LanguageRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.WorkExperienceDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.WorkExperienceRequest;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ProfileMapper {

    // ─── Profile → ProfileDto ────────────────────────────────────────────────

    public ProfileDto toDto(Profile profile) {
        List<WorkExperienceDto> workExperiences = profile.getWorkExperiences().stream()
                .map(this::toDto)
                .toList();
        List<EducationDto> education = profile.getEducation().stream()
                .map(this::toDto)
                .toList();
        List<SkillDto> skills = profile.getSkills().stream()
                .map(we -> new SkillDto(we.getName()))
                .toList();
        List<CertificationDto> certifications = profile.getCertifications().stream()
                .map(this::toDto)
                .toList();
        List<LanguageDto> languages = profile.getLanguages().stream()
                .map(this::toDto)
                .toList();
        List<ProjectDto> projects = profile.getProjects().stream()
                .map(this::toDto)
                .toList();
        List<VolunteeringDto> volunteering = profile.getVolunteering().stream()
                .map(this::toDto)
                .toList();
        return new ProfileDto(
                profile.getFirstName(),
                profile.getLastName(),
                profile.getSummary(),
                profile.getLinkedInUrl(),
                profile.getPersonalPageUrl(),
                profile.getBlogUrl(),
                profile.getContactEmail(),
                profile.getLocationCountry(),
                profile.getLocationCity(),
                workExperiences, education, skills,
                certifications, languages, projects, volunteering);
    }

    // ─── Entity → DTO helpers ────────────────────────────────────────────────

    public WorkExperienceDto toDto(WorkExperience we) {
        return new WorkExperienceDto(
                we.getJobTitle(),
                we.getCompany(),
                we.getStartDate(),
                we.getEndDate(),
                we.isCurrent(),
                we.getDescription()
        );
    }

    public EducationDto toDto(Education edu) {
        return new EducationDto(
                edu.getInstitution(),
                edu.getDegree(),
                edu.getFieldOfStudy(),
                edu.getStartDate(),
                edu.getEndDate()
        );
    }

    public CertificationDto toDto(Certification c) {
        return new CertificationDto(c.getName(), c.getIssuer(), c.getIssueDate(), c.getExpirationDate());
    }

    public LanguageDto toDto(Language l) {
        return new LanguageDto(l.getName(), l.getProficiencyLevel());
    }

    public ProjectDto toDto(Project p) {
        return new ProjectDto(p.getName(), p.getDescription(), p.getTechnologies(),
                p.getLink(), p.getStartDate(), p.getEndDate(), p.isCurrent());
    }

    public VolunteeringDto toDto(Volunteering v) {
        return new VolunteeringDto(v.getRole(), v.getOrganization(), v.getDescription(),
                v.getStartDate(), v.getEndDate(), v.isCurrent());
    }

    // ─── Request → Entity converters ────────────────────────────────────────

    public WorkExperience toEntity(WorkExperienceRequest dto, Profile profile) {
        WorkExperience we = new WorkExperience();
        we.setProfile(profile);
        we.setJobTitle(dto.jobTitle());
        we.setCompany(dto.company());
        we.setStartDate(dto.startDate());
        we.setEndDate(dto.endDate());
        we.setCurrent(dto.isCurrent());
        we.setDescription(dto.description());
        return we;
    }

    public Education toEntity(EducationRequest dto, Profile profile) {
        Education edu = new Education();
        edu.setProfile(profile);
        edu.setInstitution(dto.institution());
        edu.setDegree(dto.degree());
        edu.setFieldOfStudy(dto.fieldOfStudy());
        edu.setStartDate(dto.startDate());
        edu.setEndDate(dto.endDate());
        return edu;
    }

    public Skill toEntity(SkillRequest dto, Profile profile) {
        Skill skill = new Skill();
        skill.setProfile(profile);
        skill.setName(dto.name());
        return skill;
    }

    public Certification toEntity(CertificationRequest dto, Profile profile) {
        Certification c = new Certification();
        c.setProfile(profile);
        c.setName(dto.name());
        c.setIssuer(dto.issuer());
        c.setIssueDate(dto.issueDate());
        c.setExpirationDate(dto.expirationDate());
        return c;
    }

    public Language toEntity(LanguageRequest dto, Profile profile) {
        Language l = new Language();
        l.setProfile(profile);
        l.setName(dto.name());
        l.setProficiencyLevel(dto.proficiencyLevel());
        return l;
    }

    public Project toEntity(ProjectRequest dto, Profile profile) {
        Project p = new Project();
        p.setProfile(profile);
        p.setName(dto.name());
        p.setDescription(dto.description());
        p.setTechnologies(dto.technologies());
        p.setLink(dto.link());
        p.setStartDate(dto.startDate());
        p.setEndDate(dto.endDate());
        p.setCurrent(dto.isCurrent());
        return p;
    }

    public Volunteering toEntity(VolunteeringRequest dto, Profile profile) {
        Volunteering v = new Volunteering();
        v.setProfile(profile);
        v.setRole(dto.role());
        v.setOrganization(dto.organization());
        v.setDescription(dto.description());
        v.setStartDate(dto.startDate());
        v.setEndDate(dto.endDate());
        v.setCurrent(dto.isCurrent());
        return v;
    }
}
