package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
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
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileUpdateRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.WorkExperienceDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.WorkExperienceRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
public class ProfileService {

    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;

    public ProfileService(ProfileRepository profileRepository, UserRepository userRepository) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public ProfileDto getProfile(String email) {
        User user = resolveUser(email);
        return profileRepository.findByUser(user)
                .map(this::toDto)
                .orElseGet(this::emptyProfileDto);
    }

    @Transactional
    public ProfileDto updateProfile(String email, ProfileUpdateRequest request) {
        User user = resolveUser(email);
        Profile profile = profileRepository.findByUser(user).orElseGet(() -> {
            Profile p = new Profile();
            p.setUser(user);
            return p;
        });

        profile.setSummary(request.summary());

        // PUT replace strategy: clear in-place and repopulate (orphanRemoval handles deletes)
        profile.getWorkExperiences().clear();
        List<WorkExperienceRequest> weList = request.workExperiences() != null
                ? request.workExperiences() : Collections.emptyList();
        weList.forEach(dto -> profile.getWorkExperiences().add(toEntity(dto, profile)));

        profile.getEducation().clear();
        List<EducationRequest> eduList = request.education() != null
                ? request.education() : Collections.emptyList();
        eduList.forEach(dto -> profile.getEducation().add(toEntity(dto, profile)));

        profile.getSkills().clear();
        List<SkillRequest> skillList = request.skills() != null
                ? request.skills() : Collections.emptyList();
        skillList.forEach(dto -> profile.getSkills().add(toEntity(dto, profile)));

        profile.getCertifications().clear();
        List<CertificationRequest> certList = request.certifications() != null
                ? request.certifications() : Collections.emptyList();
        certList.forEach(dto -> profile.getCertifications().add(toEntity(dto, profile)));

        profile.getLanguages().clear();
        List<LanguageRequest> langList = request.languages() != null
                ? request.languages() : Collections.emptyList();
        langList.forEach(dto -> profile.getLanguages().add(toEntity(dto, profile)));

        profile.getProjects().clear();
        List<ProjectRequest> projList = request.projects() != null
                ? request.projects() : Collections.emptyList();
        projList.forEach(dto -> profile.getProjects().add(toEntity(dto, profile)));

        profile.getVolunteering().clear();
        List<VolunteeringRequest> volList = request.volunteering() != null
                ? request.volunteering() : Collections.emptyList();
        volList.forEach(dto -> profile.getVolunteering().add(toEntity(dto, profile)));

        Profile saved = profileRepository.save(profile);
        return toDto(saved);
    }

    // ─── Entity → DTO mappers ───────────────────────────────────────────────

    private ProfileDto toDto(Profile profile) {
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
        return new ProfileDto(profile.getSummary(), workExperiences, education, skills,
                certifications, languages, projects, volunteering);
    }

    private WorkExperienceDto toDto(WorkExperience we) {
        return new WorkExperienceDto(
                we.getJobTitle(),
                we.getCompany(),
                we.getStartDate(),
                we.getEndDate(),
                we.isCurrent(),
                we.getDescription()
        );
    }

    private EducationDto toDto(Education edu) {
        return new EducationDto(
                edu.getInstitution(),
                edu.getDegree(),
                edu.getFieldOfStudy(),
                edu.getStartDate(),
                edu.getEndDate()
        );
    }

    private CertificationDto toDto(Certification c) {
        return new CertificationDto(c.getName(), c.getIssuer(), c.getIssueDate(), c.getExpirationDate());
    }

    private LanguageDto toDto(Language l) {
        return new LanguageDto(l.getName(), l.getProficiencyLevel());
    }

    private ProjectDto toDto(Project p) {
        return new ProjectDto(p.getName(), p.getDescription(), p.getTechnologies(),
                p.getLink(), p.getStartDate(), p.getEndDate(), p.isCurrent());
    }

    private VolunteeringDto toDto(Volunteering v) {
        return new VolunteeringDto(v.getRole(), v.getOrganization(), v.getDescription(),
                v.getStartDate(), v.getEndDate(), v.isCurrent());
    }

    // ─── Request → Entity converters ────────────────────────────────────────

    private WorkExperience toEntity(WorkExperienceRequest dto, Profile profile) {
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

    private Education toEntity(EducationRequest dto, Profile profile) {
        Education edu = new Education();
        edu.setProfile(profile);
        edu.setInstitution(dto.institution());
        edu.setDegree(dto.degree());
        edu.setFieldOfStudy(dto.fieldOfStudy());
        edu.setStartDate(dto.startDate());
        edu.setEndDate(dto.endDate());
        return edu;
    }

    private Skill toEntity(SkillRequest dto, Profile profile) {
        Skill skill = new Skill();
        skill.setProfile(profile);
        skill.setName(dto.name());
        return skill;
    }

    private Certification toEntity(CertificationRequest dto, Profile profile) {
        Certification c = new Certification();
        c.setProfile(profile);
        c.setName(dto.name());
        c.setIssuer(dto.issuer());
        c.setIssueDate(dto.issueDate());
        c.setExpirationDate(dto.expirationDate());
        return c;
    }

    private Language toEntity(LanguageRequest dto, Profile profile) {
        Language l = new Language();
        l.setProfile(profile);
        l.setName(dto.name());
        l.setProficiencyLevel(dto.proficiencyLevel());
        return l;
    }

    private Project toEntity(ProjectRequest dto, Profile profile) {
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

    private Volunteering toEntity(VolunteeringRequest dto, Profile profile) {
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

    // ─── Helpers ────────────────────────────────────────────────────────────

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user not found in database: " + email));
    }

    private ProfileDto emptyProfileDto() {
        return new ProfileDto(null, Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList());
    }
}
