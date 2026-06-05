package com.tsvetanbondzhov.resumeenhancer.resume;

import com.tsvetanbondzhov.resumeenhancer.auth.UserRepository;
import com.tsvetanbondzhov.resumeenhancer.auth.domain.User;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Education;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Profile;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.Skill;
import com.tsvetanbondzhov.resumeenhancer.profile.domain.WorkExperience;
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.CreateResumeRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.SaveAsRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;

    public ResumeService(ResumeRepository resumeRepository,
                         UserRepository userRepository,
                         ProfileRepository profileRepository) {
        this.resumeRepository = resumeRepository;
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
    }

    @Transactional
    public ResumeDto createResume(String email, CreateResumeRequest request) {
        User user = resolveUser(email);
        // profileId is intentionally absent from CreateResumeRequest: each user has exactly one
        // profile (1-to-1 with User via ProfileRepository.findByUser). Multi-profile support is
        // out of scope for v1; if it is added later, profileId should become an optional request
        // field and this lookup should be updated accordingly.
        ResumeDocument content = profileRepository.findByUser(user)
                .map(this::buildFromProfile)
                .orElseGet(() -> new ResumeDocument(List.of()));

        Resume resume = new Resume();
        resume.setUser(user);
        resume.setName(request.name());
        resume.setTemplateId(request.templateId());
        resume.setResumeContent(content);
        resume.setTailored(false);

        return toDto(resumeRepository.save(resume));
    }

    @Transactional(readOnly = true)
    public List<ResumeDto> listResumes(String email) {
        User user = resolveUser(email);
        return resumeRepository.findAllByUser(user).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ResumeDto getResume(String email, UUID resumeId) {
        User user = resolveUser(email);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException("Access denied or resume not found"));
        return toDto(resume);
    }

    @Transactional
    public void deleteResume(String email, UUID resumeId) {
        User user = resolveUser(email);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException("Access denied or resume not found"));
        resumeRepository.delete(resume);
    }

    @Transactional
    public ResumeDto cloneResume(String email, UUID resumeId, SaveAsRequest request) {
        User user = resolveUser(email);
        Resume original = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException("Access denied or resume not found"));

        Resume clone = new Resume();
        clone.setUser(user);
        clone.setName(request.name());
        clone.setTemplateId(original.getTemplateId());
        clone.setResumeContent(deepCopyDocument(original.getResumeContent()));
        clone.setTailored(false); // clones are new drafts — always start untailored

        return toDto(resumeRepository.save(clone));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user not found in database"));
    }

    private ResumeDocument buildFromProfile(Profile profile) {
        List<ResumeSection> sections = new ArrayList<>();

        // Work Experience section
        List<ResumeItem> expItems = (profile.getWorkExperiences() != null
                ? profile.getWorkExperiences() : List.<WorkExperience>of()).stream()
                .map(we -> new ResumeItem(
                        UUID.randomUUID().toString(),
                        Map.of(
                                "jobTitle", we.getJobTitle() != null ? we.getJobTitle() : "",
                                "company", we.getCompany() != null ? we.getCompany() : "",
                                "startDate", we.getStartDate() != null ? we.getStartDate().toString() : "",
                                "endDate", we.getEndDate() != null ? we.getEndDate().toString() : "",
                                "description", we.getDescription() != null ? we.getDescription() : ""
                        )
                ))
                .toList();
        sections.add(new ResumeSection("experience", "Work Experience", true, expItems));

        // Education section
        List<ResumeItem> eduItems = (profile.getEducation() != null
                ? profile.getEducation() : List.<Education>of()).stream()
                .map(edu -> new ResumeItem(
                        UUID.randomUUID().toString(),
                        Map.of(
                                "institution", edu.getInstitution() != null ? edu.getInstitution() : "",
                                "degree", edu.getDegree() != null ? edu.getDegree() : "",
                                "fieldOfStudy", edu.getFieldOfStudy() != null ? edu.getFieldOfStudy() : ""
                        )
                ))
                .toList();
        sections.add(new ResumeSection("education", "Education", true, eduItems));

        // Skills section
        List<ResumeItem> skillItems = (profile.getSkills() != null
                ? profile.getSkills() : List.<Skill>of()).stream()
                .map(s -> new ResumeItem(
                        UUID.randomUUID().toString(),
                        Map.of("name", s.getName() != null ? s.getName() : "")
                ))
                .toList();
        sections.add(new ResumeSection("skills", "Skills", true, skillItems));

        return new ResumeDocument(sections);
    }

    /**
     * Produces an independent copy of {@code source} for use as a clone's content.
     * Reconstruction via {@code new ResumeSection(...)} and {@code new ResumeItem(...)}
     * is sufficient: the compact constructors on those records already call
     * {@code List.copyOf()} / {@code Map.copyOf()}, so each new instance owns its
     * own collection. No additional defensive copying is needed inside this method.
     */
    private ResumeDocument deepCopyDocument(ResumeDocument source) {
        if (source == null) {
            return new ResumeDocument(List.of());
        }
        List<ResumeSection> copiedSections = source.sections().stream()
                .map(section -> {
                    List<ResumeItem> copiedItems = section.items().stream()
                            .map(item -> new ResumeItem(item.id(), item.fields()))
                            .toList();
                    return new ResumeSection(section.id(), section.title(), section.visible(), copiedItems);
                })
                .toList();
        return new ResumeDocument(copiedSections);
    }

    private ResumeDto toDto(Resume resume) {
        return new ResumeDto(
                resume.getId(),
                resume.getName(),
                resume.getTemplateId(),
                resume.getResumeContent(),
                resume.isTailored(),
                resume.getCreatedAt(),
                resume.getUpdatedAt()
        );
    }
}
