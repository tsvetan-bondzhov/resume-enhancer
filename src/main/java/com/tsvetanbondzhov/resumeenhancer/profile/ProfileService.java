package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Education;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Skill;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.WorkExperience;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.EducationDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.EducationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileUpdateRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillRequest;
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
        return new ProfileDto(profile.getSummary(), workExperiences, education, skills);
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

    // ─── Helpers ────────────────────────────────────────────────────────────

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user not found in database: " + email));
    }

    private ProfileDto emptyProfileDto() {
        return new ProfileDto(null, Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
    }
}
