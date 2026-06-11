package com.tsvetanbondzhov.resumeenhancer.profile;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Certification;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Education;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Language;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.LanguageProficiencyLevel;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Project;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Skill;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Volunteering;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.WorkExperience;
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
                null, null, null, null, null, null,  // contact fields
                List.of(new WorkExperienceRequest("Dev", "Corp", LocalDate.of(2020, 1, 1), null, true, "Work")),
                List.of(new EducationRequest("Uni", "MSc", "CS", LocalDate.of(2018, 9, 1), LocalDate.of(2020, 6, 1))),
                List.of(new SkillRequest("Java")),
                List.of(),    // certifications
                List.of(),    // languages
                List.of(),    // projects
                List.of()     // volunteering
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
                null, null, null, null, null, null,  // contact fields
                List.of(new WorkExperienceRequest("NewJob", "NewCorp", null, null, false, null)),
                List.of(),
                List.of(new SkillRequest("NewSkill")),
                List.of(),    // certifications
                List.of(),    // languages
                List.of(),    // projects
                List.of()     // volunteering
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

    @Test
    void updateProfile_newProfile_includesAllFourNewLists() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.empty());

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "Summary",
                null, null, null, null, null, null,  // contact fields
                List.of(),
                List.of(),
                List.of(),
                List.of(new CertificationRequest("AWS Cloud", "Amazon", LocalDate.of(2023, 1, 1), null)),
                List.of(new LanguageRequest("English", LanguageProficiencyLevel.NATIVE)),
                List.of(new ProjectRequest("MyApp", "A cool app", "Java, React", "https://github.com/test", null, null, false)),
                List.of(new VolunteeringRequest("Mentor", "Code.org", "Teaching kids", null, null, false))
        );

        ArgumentCaptor<Profile> captor = ArgumentCaptor.forClass(Profile.class);
        when(profileRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        ProfileDto result = profileService.updateProfile(EMAIL, request);

        Profile saved = captor.getValue();
        assertThat(saved.getCertifications()).hasSize(1);
        assertThat(saved.getCertifications().get(0).getName()).isEqualTo("AWS Cloud");
        assertThat(saved.getLanguages()).hasSize(1);
        assertThat(saved.getLanguages().get(0).getProficiencyLevel()).isEqualTo(LanguageProficiencyLevel.NATIVE);
        assertThat(saved.getProjects()).hasSize(1);
        assertThat(saved.getProjects().get(0).getName()).isEqualTo("MyApp");
        assertThat(saved.getVolunteering()).hasSize(1);
        assertThat(saved.getVolunteering().get(0).getRole()).isEqualTo("Mentor");

        assertThat(result.certifications()).hasSize(1);
        assertThat(result.languages()).hasSize(1);
        assertThat(result.projects()).hasSize(1);
        assertThat(result.volunteering()).hasSize(1);
    }

    @Test
    void updateProfile_existingProfile_replacesAllFourNewLists() {
        User user = buildUser();

        Profile existingProfile = new Profile();
        existingProfile.setUser(user);

        Certification oldCert = new Certification();
        oldCert.setName("OldCert");
        oldCert.setProfile(existingProfile);
        existingProfile.getCertifications().add(oldCert);

        Language oldLang = new Language();
        oldLang.setName("French");
        oldLang.setProficiencyLevel(LanguageProficiencyLevel.BEGINNER);
        oldLang.setProfile(existingProfile);
        existingProfile.getLanguages().add(oldLang);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(existingProfile));

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                null,
                null, null, null, null, null, null,  // contact fields
                List.of(),
                List.of(),
                List.of(),
                List.of(new CertificationRequest("NewCert", null, null, null)),
                List.of(new LanguageRequest("Spanish", LanguageProficiencyLevel.ADVANCED)),
                List.of(),
                List.of()
        );

        ArgumentCaptor<Profile> captor = ArgumentCaptor.forClass(Profile.class);
        when(profileRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        profileService.updateProfile(EMAIL, request);

        Profile saved = captor.getValue();
        assertThat(saved.getCertifications()).hasSize(1);
        assertThat(saved.getCertifications().get(0).getName()).isEqualTo("NewCert");
        assertThat(saved.getLanguages()).hasSize(1);
        assertThat(saved.getLanguages().get(0).getName()).isEqualTo("Spanish");
        assertThat(saved.getProjects()).isEmpty();
        assertThat(saved.getVolunteering()).isEmpty();
    }

    @Test
    void getProfile_profileWithAllSections_mapsAllFourNewCollections() {
        User user = buildUser();
        Profile profile = new Profile();
        profile.setUser(user);

        Certification cert = new Certification();
        cert.setProfile(profile);
        cert.setName("AWS");
        cert.setIssuer("Amazon");
        cert.setIssueDate(LocalDate.of(2023, 5, 1));
        profile.getCertifications().add(cert);

        Language lang = new Language();
        lang.setProfile(profile);
        lang.setName("English");
        lang.setProficiencyLevel(LanguageProficiencyLevel.NATIVE);
        profile.getLanguages().add(lang);

        Project project = new Project();
        project.setProfile(profile);
        project.setName("ResumeApp");
        project.setTechnologies("Java, React");
        profile.getProjects().add(project);

        Volunteering vol = new Volunteering();
        vol.setProfile(profile);
        vol.setRole("Tutor");
        vol.setOrganization("LocalSchool");
        profile.getVolunteering().add(vol);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(profile));

        ProfileDto result = profileService.getProfile(EMAIL);

        assertThat(result.certifications()).hasSize(1);
        assertThat(result.certifications().get(0).name()).isEqualTo("AWS");
        assertThat(result.languages()).hasSize(1);
        assertThat(result.languages().get(0).proficiencyLevel()).isEqualTo(LanguageProficiencyLevel.NATIVE);
        assertThat(result.projects()).hasSize(1);
        assertThat(result.projects().get(0).name()).isEqualTo("ResumeApp");
        assertThat(result.volunteering()).hasSize(1);
        assertThat(result.volunteering().get(0).role()).isEqualTo("Tutor");
    }
}
