package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Education;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Skill;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.WorkExperience;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.EducationRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileDto;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.ProfileUpdateRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.SkillRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.dto.WorkExperienceRequest;
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ProfileService profileService;

    private static final String EMAIL = "user@example.com";

    private User buildUser() {
        User user = new User();
        user.setEmail(EMAIL);
        user.setRole("USER");
        user.setEnabled(true);
        user.setPasswordHash("hash");
        return user;
    }

    // ─── getProfile ──────────────────────────────────────────────────────────

    @Test
    void getProfile_noProfileExists_returnsEmptyProfileDto() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.empty());

        ProfileDto result = profileService.getProfile(EMAIL);

        assertThat(result.summary()).isNull();
        assertThat(result.workExperiences()).isEmpty();
        assertThat(result.education()).isEmpty();
        assertThat(result.skills()).isEmpty();
        verify(profileRepository, never()).save(any());
    }

    @Test
    void getProfile_profileExists_mapsCollectionsCorrectly() {
        User user = buildUser();
        Profile profile = new Profile();
        profile.setUser(user);
        profile.setSummary("Experienced developer");

        WorkExperience we = new WorkExperience();
        we.setProfile(profile);
        we.setJobTitle("Engineer");
        we.setCompany("Acme");
        we.setStartDate(LocalDate.of(2020, 1, 1));
        we.setEndDate(null);
        we.setCurrent(true);
        we.setDescription("Built things");
        profile.getWorkExperiences().add(we);

        Education edu = new Education();
        edu.setProfile(profile);
        edu.setInstitution("MIT");
        edu.setDegree("BSc");
        edu.setFieldOfStudy("CS");
        edu.setStartDate(LocalDate.of(2015, 9, 1));
        edu.setEndDate(LocalDate.of(2019, 6, 1));
        profile.getEducation().add(edu);

        Skill skill = new Skill();
        skill.setProfile(profile);
        skill.setName("Java");
        profile.getSkills().add(skill);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(profile));

        ProfileDto result = profileService.getProfile(EMAIL);

        assertThat(result.summary()).isEqualTo("Experienced developer");
        assertThat(result.workExperiences()).hasSize(1);
        assertThat(result.workExperiences().get(0).jobTitle()).isEqualTo("Engineer");
        assertThat(result.workExperiences().get(0).isCurrent()).isTrue();
        assertThat(result.education()).hasSize(1);
        assertThat(result.education().get(0).institution()).isEqualTo("MIT");
        assertThat(result.skills()).hasSize(1);
        assertThat(result.skills().get(0).name()).isEqualTo("Java");
    }

    // ─── updateProfile ───────────────────────────────────────────────────────

    @Test
    void updateProfile_noProfileExists_createsProfileBoundToUser() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.empty());

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "Summary text",
                List.of(new WorkExperienceRequest("Dev", "Corp", LocalDate.of(2020, 1, 1), null, true, "Work")),
                List.of(new EducationRequest("Uni", "MSc", "CS", LocalDate.of(2018, 9, 1), LocalDate.of(2020, 6, 1))),
                List.of(new SkillRequest("Java"))
        );

        ArgumentCaptor<Profile> captor = ArgumentCaptor.forClass(Profile.class);
        when(profileRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        ProfileDto result = profileService.updateProfile(EMAIL, request);

        Profile saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getSummary()).isEqualTo("Summary text");
        assertThat(saved.getWorkExperiences()).hasSize(1);
        assertThat(saved.getWorkExperiences().get(0).getJobTitle()).isEqualTo("Dev");
        assertThat(saved.getEducation()).hasSize(1);
        assertThat(saved.getEducation().get(0).getInstitution()).isEqualTo("Uni");
        assertThat(saved.getSkills()).hasSize(1);
        assertThat(saved.getSkills().get(0).getName()).isEqualTo("Java");

        assertThat(result.summary()).isEqualTo("Summary text");
        assertThat(result.workExperiences()).hasSize(1);
    }

    @Test
    void updateProfile_profileExists_replacesChildCollections() {
        User user = buildUser();

        Profile existingProfile = new Profile();
        existingProfile.setUser(user);
        existingProfile.setSummary("Old summary");

        WorkExperience oldWe = new WorkExperience();
        oldWe.setJobTitle("OldJob");
        oldWe.setCompany("OldCorp");
        oldWe.setProfile(existingProfile);
        existingProfile.getWorkExperiences().add(oldWe);

        Skill oldSkill = new Skill();
        oldSkill.setName("OldSkill");
        oldSkill.setProfile(existingProfile);
        existingProfile.getSkills().add(oldSkill);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(existingProfile));

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "New summary",
                List.of(new WorkExperienceRequest("NewJob", "NewCorp", null, null, false, null)),
                List.of(),
                List.of(new SkillRequest("NewSkill"))
        );

        ArgumentCaptor<Profile> captor = ArgumentCaptor.forClass(Profile.class);
        when(profileRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        ProfileDto result = profileService.updateProfile(EMAIL, request);

        Profile saved = captor.getValue();
        // Old entries replaced
        assertThat(saved.getWorkExperiences()).hasSize(1);
        assertThat(saved.getWorkExperiences().get(0).getJobTitle()).isEqualTo("NewJob");
        assertThat(saved.getEducation()).isEmpty();
        assertThat(saved.getSkills()).hasSize(1);
        assertThat(saved.getSkills().get(0).getName()).isEqualTo("NewSkill");
        assertThat(saved.getSummary()).isEqualTo("New summary");

        assertThat(result.summary()).isEqualTo("New summary");
    }
}
