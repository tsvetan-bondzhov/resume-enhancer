package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.CertificationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.EducationItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.LanguageItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ProjectItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.VolunteeringItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.WorkExperienceItem;

import java.util.List;

/**
 * Data transfer object representing the result of resume parsing (heuristic or LLM).
 *
 * <p>Architecture note: This record resides in {@code upload.dto} and imports typed item records
 * from {@code resume.domain}. This is intentional and consistent with the existing pattern —
 * {@code LlmSectionExtractor} (also in the {@code upload} package) already imports all 8 item
 * types from {@code resume.domain}. The {@code upload} package is a consumer of
 * {@code resume.domain} types; this direction of dependency (upload → resume.domain) is correct.
 * If the architecture is ever hardened to forbid cross-package imports, {@code ParsedResumeDto}
 * could be moved to {@code resume.dto}. Until then, leaving it here avoids a disruptive
 * package reorganisation with no functional benefit.</p>
 *
 * @param rawText        the full raw text extracted from the uploaded file
 * @param workExperiences typed work-experience items (empty list when none found)
 * @param education       typed education items (empty list when none found)
 * @param skills          typed skill items (empty list when none found)
 * @param certifications  typed certification items (empty list when none found)
 * @param languages       typed language items (empty list when none found)
 * @param projects        typed project items (empty list when none found)
 * @param volunteering    typed volunteering items (empty list when none found)
 * @param summary         single summary item, or {@code null} when no summary section found
 */
public record ParsedResumeDto(
        String rawText,
        List<WorkExperienceItem> workExperiences,
        List<EducationItem> education,
        List<SkillItem> skills,
        List<CertificationItem> certifications,
        List<LanguageItem> languages,
        List<ProjectItem> projects,
        List<VolunteeringItem> volunteering,
        SummaryItem summary
) {}
