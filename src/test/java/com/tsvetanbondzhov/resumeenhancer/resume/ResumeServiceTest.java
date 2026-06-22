package com.tsvetanbondzhov.resumeenhancer.resume;

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
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.FullNameItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.CreateResumeRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.SaveAsRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.UpdateResumeRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Month;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeServiceTest {

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProfileRepository profileRepository;

    @InjectMocks
    private ResumeService resumeService;

    private static final String EMAIL = "user@example.com";
    private static final UUID RESUME_ID = UUID.randomUUID();

    private User buildUser() {
        User user = new User();
        user.setEmail(EMAIL);
        user.setRole("USER");
        user.setEnabled(true);
        user.setPasswordHash("hash");
        return user;
    }

    private Resume buildResume(User user) {
        Resume resume = new Resume();
        resume.setUser(user);
        resume.setName("My Resume");
        resume.setResumeContent(new ResumeDocument(List.of()));
        resume.setTailored(false);
        return resume;
    }

    // ─── createResume ─────────────────────────────────────────────────────────

    @Test
    void createResume_validRequest_returnsResumeDtoWithHttp201Fields() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.empty());

        Resume savedResume = buildResume(user);
        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        when(resumeRepository.save(captor.capture())).thenReturn(savedResume);

        CreateResumeRequest request = new CreateResumeRequest("My Resume", null);
        ResumeDto result = resumeService.createResume(EMAIL, request);

        Resume saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getName()).isEqualTo("My Resume");
        assertThat(saved.isTailored()).isFalse();
        assertThat(result.name()).isEqualTo("My Resume");
    }

    @Test
    void createResume_noProfileExists_returnsEmptyResumeDocument() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.empty());

        Resume savedResume = buildResume(user);
        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        when(resumeRepository.save(captor.capture())).thenReturn(savedResume);

        resumeService.createResume(EMAIL, new CreateResumeRequest("Empty Resume", null));

        Resume saved = captor.getValue();
        assertThat(saved.getResumeContent().sections()).isEmpty();
    }

    @Test
    void createResume_withProfile_buildsResumeDocumentFromProfile() {
        User user = buildUser();
        Profile profile = new Profile();
        profile.setUser(user);

        WorkExperience we = new WorkExperience();
        we.setProfile(profile);
        we.setJobTitle("Engineer");
        we.setCompany("Acme");
        profile.getWorkExperiences().add(we);

        Skill skill = new Skill();
        skill.setProfile(profile);
        skill.setName("Java");
        profile.getSkills().add(skill);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(profile));

        Resume savedResume = new Resume();
        savedResume.setUser(user);
        savedResume.setName("Profile Resume");
        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        when(resumeRepository.save(captor.capture())).thenReturn(savedResume);

        resumeService.createResume(EMAIL, new CreateResumeRequest("Profile Resume", null));

        Resume saved = captor.getValue();
        // buildFromProfile now always produces 9 sections in canonical order
        assertThat(saved.getResumeContent().sections()).hasSize(9);
        // FULL_NAME at index 0 — visible: false (no name set on this profile)
        assertThat(saved.getResumeContent().sections().get(0).sectionType())
                .isEqualTo(ResumeSectionType.FULL_NAME);
        assertThat(saved.getResumeContent().sections().get(0).visible()).isFalse();
        // SUMMARY at index 1 — visible: false (no summary set on this profile)
        assertThat(saved.getResumeContent().sections().get(1).sectionType())
                .isEqualTo(ResumeSectionType.SUMMARY);
        assertThat(saved.getResumeContent().sections().get(1).visible()).isFalse();
        // WORK_EXPERIENCE at index 2 — has 1 item
        assertThat(saved.getResumeContent().sections().get(2).sectionType())
                .isEqualTo(ResumeSectionType.WORK_EXPERIENCE);
        assertThat(saved.getResumeContent().sections().get(2).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(2).items().get(0))
                .isInstanceOf(WorkExperienceItem.class);
        assertThat(((WorkExperienceItem)
                saved.getResumeContent().sections().get(2).items().get(0)).jobTitle())
                .isEqualTo("Engineer");
        // SKILLS at index 4 — has 1 item
        assertThat(saved.getResumeContent().sections().get(4).sectionType())
                .isEqualTo(ResumeSectionType.SKILLS);
        assertThat(saved.getResumeContent().sections().get(4).items()).hasSize(1);
    }

    @Test
    void buildFromProfile_allSections() {
        User user = buildUser();
        Profile profile = new Profile();
        profile.setUser(user);
        profile.setFirstName("Jane");
        profile.setLastName("Doe");
        profile.setSummary("Experienced Java developer");
        profile.setLinkedInUrl("https://linkedin.com/in/test");
        profile.setContactEmail("user@example.com");

        WorkExperience we = new WorkExperience();
        we.setProfile(profile);
        we.setJobTitle("Engineer");
        we.setCompany("Acme");
        profile.getWorkExperiences().add(we);

        Education edu = new Education();
        edu.setProfile(profile);
        edu.setInstitution("MIT");
        edu.setDegree("BSc");
        profile.getEducation().add(edu);

        Skill skill = new Skill();
        skill.setProfile(profile);
        skill.setName("Java");
        profile.getSkills().add(skill);

        Certification cert = new Certification();
        cert.setProfile(profile);
        cert.setName("AWS Solutions Architect");
        cert.setIssuer("Amazon");
        cert.setIssueDate(LocalDate.of(2023, Month.JUNE, 1));
        profile.getCertifications().add(cert);

        Project proj = new Project();
        proj.setProfile(profile);
        proj.setName("Resume Enhancer");
        profile.getProjects().add(proj);

        Language lang = new Language();
        lang.setProfile(profile);
        lang.setName("Spanish");
        lang.setProficiencyLevel(LanguageProficiencyLevel.ADVANCED);
        profile.getLanguages().add(lang);

        Volunteering vol = new Volunteering();
        vol.setProfile(profile);
        vol.setRole("Mentor");
        vol.setOrganization("Code Club");
        profile.getVolunteering().add(vol);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(profile));

        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        Resume savedResume = new Resume();
        savedResume.setUser(user);
        savedResume.setName("All Sections Resume");
        when(resumeRepository.save(captor.capture())).thenReturn(savedResume);

        resumeService.createResume(EMAIL, new CreateResumeRequest("All Sections Resume", null));

        Resume saved = captor.getValue();
        assertThat(saved.getResumeContent().sections()).hasSize(9);

        // Canonical order assertions
        assertThat(saved.getResumeContent().sections().get(0).sectionType()).isEqualTo(ResumeSectionType.FULL_NAME);
        assertThat(saved.getResumeContent().sections().get(1).sectionType()).isEqualTo(ResumeSectionType.SUMMARY);
        assertThat(saved.getResumeContent().sections().get(2).sectionType()).isEqualTo(ResumeSectionType.WORK_EXPERIENCE);
        assertThat(saved.getResumeContent().sections().get(3).sectionType()).isEqualTo(ResumeSectionType.EDUCATION);
        assertThat(saved.getResumeContent().sections().get(4).sectionType()).isEqualTo(ResumeSectionType.SKILLS);
        assertThat(saved.getResumeContent().sections().get(5).sectionType()).isEqualTo(ResumeSectionType.CERTIFICATIONS);
        assertThat(saved.getResumeContent().sections().get(6).sectionType()).isEqualTo(ResumeSectionType.PROJECTS);
        assertThat(saved.getResumeContent().sections().get(7).sectionType()).isEqualTo(ResumeSectionType.LANGUAGES);
        assertThat(saved.getResumeContent().sections().get(8).sectionType()).isEqualTo(ResumeSectionType.VOLUNTEERING);

        // All sections visible (each has 1 item / non-blank summary / name set)
        saved.getResumeContent().sections().forEach(s ->
                assertThat(s.visible()).as("section %s should be visible", s.sectionType()).isTrue());

        // Each section has exactly 1 item of the correct subclass
        assertThat(saved.getResumeContent().sections().get(0).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(0).items().get(0)).isInstanceOf(FullNameItem.class);
        assertThat(saved.getResumeContent().sections().get(1).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(1).items().get(0)).isInstanceOf(SummaryItem.class);
        assertThat(saved.getResumeContent().sections().get(2).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(2).items().get(0)).isInstanceOf(WorkExperienceItem.class);
        assertThat(saved.getResumeContent().sections().get(3).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(3).items().get(0)).isInstanceOf(EducationItem.class);
        assertThat(saved.getResumeContent().sections().get(4).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(4).items().get(0)).isInstanceOf(SkillItem.class);
        assertThat(saved.getResumeContent().sections().get(5).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(5).items().get(0)).isInstanceOf(CertificationItem.class);
        assertThat(saved.getResumeContent().sections().get(6).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(6).items().get(0)).isInstanceOf(ProjectItem.class);
        assertThat(saved.getResumeContent().sections().get(7).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(7).items().get(0)).isInstanceOf(LanguageItem.class);
        assertThat(saved.getResumeContent().sections().get(8).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(8).items().get(0)).isInstanceOf(VolunteeringItem.class);

        // Spot-check key mapped fields
        FullNameItem nameItem = (FullNameItem) saved.getResumeContent().sections().get(0).items().get(0);
        assertThat(nameItem.firstName()).isEqualTo("Jane");
        assertThat(nameItem.lastName()).isEqualTo("Doe");

        SummaryItem summaryItem = (SummaryItem) saved.getResumeContent().sections().get(1).items().get(0);
        assertThat(summaryItem.text()).isEqualTo("Experienced Java developer");
        assertThat(summaryItem.linkedInUrl()).isEqualTo("https://linkedin.com/in/test");
        assertThat(summaryItem.contactEmail()).isEqualTo("user@example.com");

        CertificationItem certItem = (CertificationItem) saved.getResumeContent().sections().get(5).items().get(0);
        assertThat(certItem.name()).isEqualTo("AWS Solutions Architect");
        assertThat(certItem.issuer()).isEqualTo("Amazon");

        LanguageItem langItem = (LanguageItem) saved.getResumeContent().sections().get(7).items().get(0);
        assertThat(langItem.language()).isEqualTo("Spanish");
        assertThat(langItem.proficiency()).isEqualTo("ADVANCED");
    }

    @Test
    void buildFromProfile_emptySections() {
        User user = buildUser();
        Profile profile = new Profile();
        profile.setUser(user);
        // No summary, no items in any list

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(profileRepository.findByUser(user)).thenReturn(Optional.of(profile));

        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        Resume savedResume = new Resume();
        savedResume.setUser(user);
        savedResume.setName("Empty Profile Resume");
        when(resumeRepository.save(captor.capture())).thenReturn(savedResume);

        resumeService.createResume(EMAIL, new CreateResumeRequest("Empty Profile Resume", null));

        Resume saved = captor.getValue();
        assertThat(saved.getResumeContent().sections()).hasSize(9);

        // All sections visible: false
        saved.getResumeContent().sections().forEach(s ->
                assertThat(s.visible()).as("section %s should be invisible", s.sectionType()).isFalse());

        // FULL_NAME has 1 FullNameItem with null name fields
        assertThat(saved.getResumeContent().sections().get(0).sectionType()).isEqualTo(ResumeSectionType.FULL_NAME);
        assertThat(saved.getResumeContent().sections().get(0).items()).hasSize(1);
        FullNameItem emptyName = (FullNameItem) saved.getResumeContent().sections().get(0).items().get(0);
        assertThat(emptyName.firstName()).isNull();
        assertThat(emptyName.lastName()).isNull();

        // SUMMARY has 1 SummaryItem with empty text; all remaining sections have empty item lists
        assertThat(saved.getResumeContent().sections().get(1).sectionType()).isEqualTo(ResumeSectionType.SUMMARY);
        assertThat(saved.getResumeContent().sections().get(1).items()).hasSize(1);
        SummaryItem emptySummary = (SummaryItem) saved.getResumeContent().sections().get(1).items().get(0);
        assertThat(emptySummary.text()).isEmpty();

        for (int i = 2; i < 9; i++) {
            assertThat(saved.getResumeContent().sections().get(i).items())
                    .as("section at index %d should have empty items", i)
                    .isEmpty();
        }
    }

    // ─── listResumes ──────────────────────────────────────────────────────────

    @Test
    void listResumes_returnsOnlyCurrentUsersResumes() {
        User user = buildUser();
        Resume r1 = buildResume(user);
        Resume r2 = buildResume(user);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findAllByUser(user)).thenReturn(List.of(r1, r2));

        List<ResumeDto> result = resumeService.listResumes(EMAIL);

        assertThat(result).hasSize(2);
        verify(resumeRepository).findAllByUser(user);
    }

    // ─── getResume ────────────────────────────────────────────────────────────

    @Test
    void getResume_ownerAccess_returnsDto() {
        User user = buildUser();
        Resume resume = buildResume(user);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.of(resume));

        ResumeDto result = resumeService.getResume(EMAIL, RESUME_ID);

        assertThat(result.name()).isEqualTo("My Resume");
    }

    @Test
    void getResume_notOwner_throwsResumeAccessDeniedException() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.getResume(EMAIL, RESUME_ID))
                .isInstanceOf(ResumeAccessDeniedException.class)
                .hasMessageContaining("Access denied");
    }

    // ─── deleteResume ─────────────────────────────────────────────────────────

    @Test
    void deleteResume_ownerAccess_callsRepositoryDelete() {
        User user = buildUser();
        Resume resume = buildResume(user);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.of(resume));

        resumeService.deleteResume(EMAIL, RESUME_ID);

        verify(resumeRepository).delete(resume);
    }

    @Test
    void deleteResume_notOwner_throwsResumeAccessDeniedException() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.deleteResume(EMAIL, RESUME_ID))
                .isInstanceOf(ResumeAccessDeniedException.class);
    }

    // ─── updateResume ─────────────────────────────────────────────────────────

    @Test
    void updateResume_updatesTemplateId_whenProvided() {
        User user = buildUser();
        UUID newTemplateId = UUID.randomUUID();
        Resume resume = buildResume(user);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.of(resume));

        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        Resume savedResume = buildResume(user);
        savedResume.setTemplateId(newTemplateId);
        when(resumeRepository.saveAndFlush(captor.capture())).thenReturn(savedResume);

        UpdateResumeRequest request = new UpdateResumeRequest("My Resume", new ResumeDocument(List.of()), newTemplateId);
        resumeService.updateResume(EMAIL, RESUME_ID, request);

        assertThat(captor.getValue().getTemplateId()).isEqualTo(newTemplateId);
    }

    @Test
    void updateResume_preservesTemplateId_whenNull() {
        User user = buildUser();
        UUID existingTemplateId = UUID.randomUUID();
        Resume resume = buildResume(user);
        resume.setTemplateId(existingTemplateId);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.of(resume));

        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        when(resumeRepository.saveAndFlush(captor.capture())).thenReturn(resume);

        UpdateResumeRequest request = new UpdateResumeRequest("My Resume", new ResumeDocument(List.of()), null);
        resumeService.updateResume(EMAIL, RESUME_ID, request);

        assertThat(captor.getValue().getTemplateId()).isEqualTo(existingTemplateId);
    }

    // ─── cloneResume ──────────────────────────────────────────────────────────

    @Test
    void cloneResume_notOwner_throwsResumeAccessDeniedException() {
        User user = buildUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resumeService.cloneResume(EMAIL, RESUME_ID, new SaveAsRequest("Copy")))
                .isInstanceOf(ResumeAccessDeniedException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void cloneResume_createsIndependentCopy_withNewName() {
        User user = buildUser();
        UUID templateId = UUID.randomUUID();
        Resume original = new Resume();
        original.setUser(user);
        original.setName("Original");
        original.setTemplateId(templateId);
        original.setResumeContent(new ResumeDocument(List.of()));
        original.setTailored(false);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(resumeRepository.findByIdAndUser(RESUME_ID, user)).thenReturn(Optional.of(original));

        ArgumentCaptor<Resume> captor = ArgumentCaptor.forClass(Resume.class);
        Resume clonedResume = new Resume();
        clonedResume.setUser(user);
        clonedResume.setName("Copy of Original");
        clonedResume.setResumeContent(new ResumeDocument(List.of()));
        when(resumeRepository.save(captor.capture())).thenReturn(clonedResume);

        ResumeDto result = resumeService.cloneResume(EMAIL, RESUME_ID, new SaveAsRequest("Copy of Original"));

        Resume saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("Copy of Original");
        assertThat(saved.getTemplateId()).isEqualTo(templateId);
        assertThat(result.name()).isEqualTo("Copy of Original");
    }
}
