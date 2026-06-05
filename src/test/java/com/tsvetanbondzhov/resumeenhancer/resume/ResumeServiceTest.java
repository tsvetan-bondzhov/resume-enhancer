package com.tsvetanbondzhov.resumeenhancer.resume;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Skill;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.WorkExperience;
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.CreateResumeRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.SaveAsRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
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
        assertThat(saved.getResumeContent().sections()).hasSize(3);
        // Work Experience section has 1 item
        assertThat(saved.getResumeContent().sections().get(0).id()).isEqualTo("experience");
        assertThat(saved.getResumeContent().sections().get(0).items()).hasSize(1);
        assertThat(saved.getResumeContent().sections().get(0).items().get(0).fields().get("jobTitle")).isEqualTo("Engineer");
        // Skills section has 1 item
        assertThat(saved.getResumeContent().sections().get(2).id()).isEqualTo("skills");
        assertThat(saved.getResumeContent().sections().get(2).items()).hasSize(1);
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
