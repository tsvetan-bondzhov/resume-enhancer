package com.tsvetanbondzhov.resumeenhancer.resume;

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
import com.tsvetanbondzhov.resumeenhancer.profile.repository.ProfileRepository;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.Resume;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.FullNameItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.CreateResumeRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.ResumeDto;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.SaveAsRequest;
import com.tsvetanbondzhov.resumeenhancer.resume.dto.UpdateResumeRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ResumeService {

    private static final String ACCESS_DENIED_MSG = "Access denied or resume not found";

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
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));
        return toDto(resume);
    }

    @Transactional
    public void deleteResume(String email, UUID resumeId) {
        User user = resolveUser(email);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));
        resumeRepository.delete(resume);
    }

    @Transactional
    public ResumeDto cloneResume(String email, UUID resumeId, SaveAsRequest request) {
        User user = resolveUser(email);
        Resume original = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));

        Resume clone = new Resume();
        clone.setUser(user);
        clone.setName(request.name());
        clone.setTemplateId(original.getTemplateId());
        clone.setResumeContent(deepCopyDocument(original.getResumeContent()));
        clone.setTailored(false); // clones are new drafts — always start untailored

        return toDto(resumeRepository.save(clone));
    }

    @Transactional
    public ResumeDto markAsTailored(String email, UUID resumeId) {
        User user = resolveUser(email);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));
        resume.setTailored(true);
        return toDto(resumeRepository.saveAndFlush(resume));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    @Transactional
    public ResumeDto updateResume(String email, UUID resumeId, UpdateResumeRequest request) {
        User user = resolveUser(email);
        Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
                .orElseThrow(() -> new ResumeAccessDeniedException(ACCESS_DENIED_MSG));
        resume.setName(request.name());
        resume.setResumeContent(request.content());
        // Only overwrite templateId when explicitly provided — null means "keep existing"
        if (request.templateId() != null) {
            resume.setTemplateId(request.templateId());
        }
        // flush ensures @PreUpdate fires (sets updatedAt) before toDto reads the field
        return toDto(resumeRepository.saveAndFlush(resume));
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user not found in database"));
    }

    private ResumeDocument buildFromProfile(Profile profile) {
        List<ResumeSection> sections = new ArrayList<>();

        // FULL_NAME section — added first (candidate's full name header)
        boolean nameVisible = (profile.getFirstName() != null && !profile.getFirstName().isBlank())
                || (profile.getLastName() != null && !profile.getLastName().isBlank());
        List<ResumeItem> nameItems = List.of(new FullNameItem(
                UUID.randomUUID().toString(),
                profile.getFirstName(),
                profile.getLastName()
        ));
        sections.add(new ResumeSection(ResumeSectionType.FULL_NAME, "Name", nameVisible, nameItems));

        // SUMMARY section
        String summaryText = profile.getSummary() != null ? profile.getSummary() : "";
        boolean summaryVisible = profile.getSummary() != null && !profile.getSummary().isBlank();
        List<ResumeItem> summaryItems = List.of(new SummaryItem(
                UUID.randomUUID().toString(),
                summaryText,
                profile.getLinkedInUrl(),
                profile.getPersonalPageUrl(),
                profile.getBlogUrl(),
                profile.getContactEmail(),
                profile.getLocationCountry(),
                profile.getLocationCity()
        ));
        sections.add(new ResumeSection(ResumeSectionType.SUMMARY, "Summary", summaryVisible, summaryItems));

        // Work Experience section
        List<ResumeItem> expItems = (profile.getWorkExperiences() != null
                ? profile.getWorkExperiences() : List.<WorkExperience>of()).stream()
                .<ResumeItem>map(we -> new WorkExperienceItem(
                        UUID.randomUUID().toString(),
                        we.getJobTitle(),
                        we.getCompany(),
                        we.getStartDate(),
                        we.getEndDate(),
                        we.isCurrent(),
                        we.getDescription()
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.WORK_EXPERIENCE, "Work Experience", !expItems.isEmpty(), expItems));

        // Education section
        List<ResumeItem> eduItems = (profile.getEducation() != null
                ? profile.getEducation() : List.<Education>of()).stream()
                .<ResumeItem>map(edu -> new EducationItem(
                        UUID.randomUUID().toString(),
                        edu.getInstitution(),
                        edu.getDegree(),
                        edu.getFieldOfStudy(),
                        edu.getStartDate(),
                        edu.getEndDate()
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.EDUCATION, "Education", !eduItems.isEmpty(), eduItems));

        // Skills section
        List<ResumeItem> skillItems = (profile.getSkills() != null
                ? profile.getSkills() : List.<Skill>of()).stream()
                .<ResumeItem>map(s -> new SkillItem(
                        UUID.randomUUID().toString(),
                        s.getName()
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.SKILLS, "Skills", !skillItems.isEmpty(), skillItems));

        // Certifications section
        List<ResumeItem> certItems = (profile.getCertifications() != null
                ? profile.getCertifications() : List.<Certification>of()).stream()
                .<ResumeItem>map(cert -> new CertificationItem(
                        UUID.randomUUID().toString(),
                        cert.getName(),
                        cert.getIssuer(),
                        cert.getIssueDate(),
                        cert.getExpirationDate()
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.CERTIFICATIONS, "Certifications", !certItems.isEmpty(), certItems));

        // Projects section
        List<ResumeItem> projectItems = (profile.getProjects() != null
                ? profile.getProjects() : List.<Project>of()).stream()
                .<ResumeItem>map(proj -> new ProjectItem(
                        UUID.randomUUID().toString(),
                        proj.getName(),
                        proj.getDescription(),
                        proj.getTechnologies(),
                        proj.getLink(),
                        proj.getStartDate(),
                        proj.getEndDate(),
                        proj.isCurrent()
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.PROJECTS, "Projects", !projectItems.isEmpty(), projectItems));

        // Languages section
        List<ResumeItem> langItems = (profile.getLanguages() != null
                ? profile.getLanguages() : List.<Language>of()).stream()
                .<ResumeItem>map(lang -> new LanguageItem(
                        UUID.randomUUID().toString(),
                        lang.getName(),
                        lang.getProficiencyLevel() != null
                                ? lang.getProficiencyLevel().name()
                                : null
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.LANGUAGES, "Languages", !langItems.isEmpty(), langItems));

        // Volunteering section
        List<ResumeItem> volItems = (profile.getVolunteering() != null
                ? profile.getVolunteering() : List.<Volunteering>of()).stream()
                .<ResumeItem>map(vol -> new VolunteeringItem(
                        UUID.randomUUID().toString(),
                        vol.getRole(),
                        vol.getOrganization(),
                        vol.getDescription(),
                        vol.getStartDate(),
                        vol.getEndDate(),
                        vol.isCurrent()
                ))
                .toList();
        sections.add(new ResumeSection(ResumeSectionType.VOLUNTEERING, "Volunteering", !volItems.isEmpty(), volItems));

        return new ResumeDocument(sections);
    }

    /**
     * Produces an independent copy of {@code source} for use as a clone's content.
     * All {@code ResumeItem} subtypes are immutable Java records — reference copy via
     * {@code List.copyOf()} is safe and sufficient. No new item instances are needed.
     */
    private ResumeDocument deepCopyDocument(ResumeDocument source) {
        if (source == null) {
            return new ResumeDocument(List.of());
        }
        List<ResumeSection> copiedSections = source.sections().stream()
                .map(section -> new ResumeSection(
                        section.sectionType(),
                        section.title(),
                        section.visible(),
                        List.copyOf(section.items())  // items are immutable records — reference copy is safe
                ))
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
