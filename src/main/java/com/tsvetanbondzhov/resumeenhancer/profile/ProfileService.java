package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.CertificationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.EducationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.LanguageRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileUpdateRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProjectRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.VolunteeringRequest;
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
    private final ProfileMapper profileMapper;

    public ProfileService(ProfileRepository profileRepository,
                          UserRepository userRepository,
                          ProfileMapper profileMapper) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
        this.profileMapper = profileMapper;
    }

    @Transactional(readOnly = true)
    public ProfileDto getProfile(String email) {
        User user = resolveUser(email);
        return profileRepository.findByUser(user)
                .map(profileMapper::toDto)
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
        profile.setLinkedInUrl(request.linkedInUrl());
        profile.setPersonalPageUrl(request.personalPageUrl());
        profile.setBlogUrl(request.blogUrl());
        profile.setContactEmail(request.contactEmail());
        profile.setLocationCountry(request.locationCountry());
        profile.setLocationCity(request.locationCity());

        // PUT replace strategy: clear in-place and repopulate (orphanRemoval handles deletes)
        profile.getWorkExperiences().clear();
        List<WorkExperienceRequest> weList = request.workExperiences() != null
                ? request.workExperiences() : Collections.emptyList();
        weList.forEach(dto -> profile.getWorkExperiences().add(profileMapper.toEntity(dto, profile)));

        profile.getEducation().clear();
        List<EducationRequest> eduList = request.education() != null
                ? request.education() : Collections.emptyList();
        eduList.forEach(dto -> profile.getEducation().add(profileMapper.toEntity(dto, profile)));

        profile.getSkills().clear();
        List<SkillRequest> skillList = request.skills() != null
                ? request.skills() : Collections.emptyList();
        skillList.forEach(dto -> profile.getSkills().add(profileMapper.toEntity(dto, profile)));

        profile.getCertifications().clear();
        List<CertificationRequest> certList = request.certifications() != null
                ? request.certifications() : Collections.emptyList();
        certList.forEach(dto -> profile.getCertifications().add(profileMapper.toEntity(dto, profile)));

        profile.getLanguages().clear();
        List<LanguageRequest> langList = request.languages() != null
                ? request.languages() : Collections.emptyList();
        langList.forEach(dto -> profile.getLanguages().add(profileMapper.toEntity(dto, profile)));

        profile.getProjects().clear();
        List<ProjectRequest> projList = request.projects() != null
                ? request.projects() : Collections.emptyList();
        projList.forEach(dto -> profile.getProjects().add(profileMapper.toEntity(dto, profile)));

        profile.getVolunteering().clear();
        List<VolunteeringRequest> volList = request.volunteering() != null
                ? request.volunteering() : Collections.emptyList();
        volList.forEach(dto -> profile.getVolunteering().add(profileMapper.toEntity(dto, profile)));

        Profile saved = profileRepository.save(profile);
        return profileMapper.toDto(saved);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user not found in database: " + email));
    }

    private ProfileDto emptyProfileDto() {
        return new ProfileDto(null, null, null, null, null, null, null,
                Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList());
    }
}
