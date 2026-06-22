package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class DocumentPatchService {

    private static final String FIELD_DESCRIPTION = "description";

    /**
     * Applies a DocumentPatchEvent to a ResumeDocument, returning a new updated document.
     * ResumeDocument is immutable (records + defensive copies) — this method creates a new instance.
     *
     * @throws InvalidPatchException if sectionId is not found, itemIndex is out of bounds,
     *                               or field is a reserved discriminant ("type" or "id").
     */
    public ResumeDocument apply(ResumeDocument document, DocumentPatchEvent patch) {
        // Guard: reserved discriminant fields must never be patched
        if ("type".equals(patch.field()) || "id".equals(patch.field())) {
            throw new InvalidPatchException(
                    "Field '" + patch.field() + "' is reserved and cannot be patched");
        }

        // Find the target section
        ResumeSectionType targetType;
        try {
            targetType = ResumeSectionType.valueOf(patch.sectionId());
        } catch (IllegalArgumentException e) {
            throw new InvalidPatchException(
                    "Section not found: sectionId='" + patch.sectionId() + "'");
        }

        boolean sectionFound = document.sections().stream()
                .anyMatch(s -> s.sectionType() == targetType);
        if (!sectionFound) {
            throw new InvalidPatchException(
                    "Section not found in document: sectionId='" + patch.sectionId() + "'");
        }

        // Rebuild document with the patched section
        List<ResumeSection> updatedSections = document.sections().stream()
                .map(section -> section.sectionType() == targetType
                        ? applyToSection(section, patch)
                        : section)
                .toList();

        return new ResumeDocument(updatedSections);
    }

    private ResumeSection applyToSection(ResumeSection section, DocumentPatchEvent patch) {
        List<ResumeItem> items = section.items();
        if (patch.itemIndex() < 0 || patch.itemIndex() >= items.size()) {
            throw new InvalidPatchException(
                    "itemIndex " + patch.itemIndex() + " is out of bounds for section '"
                    + patch.sectionId() + "' (size=" + items.size() + ")");
        }

        List<ResumeItem> updatedItems = new ArrayList<>(items);
        updatedItems.set(patch.itemIndex(), applyToItem(items.get(patch.itemIndex()), patch));
        return new ResumeSection(section.sectionType(), section.title(), section.visible(), updatedItems);
    }

    private ResumeItem applyToItem(ResumeItem item, DocumentPatchEvent patch) {
        String field = patch.field();
        String newValue = patch.newValue();

        return switch (item) {
            case WorkExperienceItem w -> switch (field) {
                case "jobTitle"    -> new WorkExperienceItem(w.id(), newValue, w.company(), w.startDate(), w.endDate(), w.isCurrent(), w.description());
                case "company"     -> new WorkExperienceItem(w.id(), w.jobTitle(), newValue, w.startDate(), w.endDate(), w.isCurrent(), w.description());
                case FIELD_DESCRIPTION -> new WorkExperienceItem(w.id(), w.jobTitle(), w.company(), w.startDate(), w.endDate(), w.isCurrent(), newValue);
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for WORK_EXPERIENCE");
            };
            case EducationItem e -> switch (field) {
                case "institution"  -> new EducationItem(e.id(), newValue, e.degree(), e.fieldOfStudy(), e.startDate(), e.endDate());
                case "degree"       -> new EducationItem(e.id(), e.institution(), newValue, e.fieldOfStudy(), e.startDate(), e.endDate());
                case "fieldOfStudy" -> new EducationItem(e.id(), e.institution(), e.degree(), newValue, e.startDate(), e.endDate());
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for EDUCATION");
            };
            case SkillItem s -> switch (field) {
                case "name" -> new SkillItem(s.id(), newValue);
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for SKILLS");
            };
            case CertificationItem c -> switch (field) {
                case "name"   -> new CertificationItem(c.id(), newValue, c.issuer(), c.issueDate(), c.expirationDate());
                case "issuer" -> new CertificationItem(c.id(), c.name(), newValue, c.issueDate(), c.expirationDate());
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for CERTIFICATIONS");
            };
            case LanguageItem l -> switch (field) {
                case "language"    -> new LanguageItem(l.id(), newValue, l.proficiency());
                case "proficiency" -> new LanguageItem(l.id(), l.language(), newValue);
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for LANGUAGES");
            };
            case ProjectItem p -> switch (field) {
                case "name"         -> new ProjectItem(p.id(), newValue, p.description(), p.technologies(), p.link(), p.startDate(), p.endDate(), p.isCurrent());
                case FIELD_DESCRIPTION -> new ProjectItem(p.id(), p.name(), newValue, p.technologies(), p.link(), p.startDate(), p.endDate(), p.isCurrent());
                case "technologies" -> new ProjectItem(p.id(), p.name(), p.description(), newValue, p.link(), p.startDate(), p.endDate(), p.isCurrent());
                case "link"         -> new ProjectItem(p.id(), p.name(), p.description(), p.technologies(), newValue, p.startDate(), p.endDate(), p.isCurrent());
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for PROJECTS");
            };
            case VolunteeringItem v -> switch (field) {
                case "role"         -> new VolunteeringItem(v.id(), newValue, v.organization(), v.description(), v.startDate(), v.endDate(), v.isCurrent());
                case "organization" -> new VolunteeringItem(v.id(), v.role(), newValue, v.description(), v.startDate(), v.endDate(), v.isCurrent());
                case FIELD_DESCRIPTION -> new VolunteeringItem(v.id(), v.role(), v.organization(), newValue, v.startDate(), v.endDate(), v.isCurrent());
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for VOLUNTEERING");
            };
            case SummaryItem s -> switch (field) {
                case "text"            -> new SummaryItem(s.id(), newValue, s.linkedInUrl(), s.personalPageUrl(), s.blogUrl(), s.contactEmail(), s.locationCountry(), s.locationCity());
                case "linkedInUrl"     -> new SummaryItem(s.id(), s.text(), newValue, s.personalPageUrl(), s.blogUrl(), s.contactEmail(), s.locationCountry(), s.locationCity());
                case "personalPageUrl" -> new SummaryItem(s.id(), s.text(), s.linkedInUrl(), newValue, s.blogUrl(), s.contactEmail(), s.locationCountry(), s.locationCity());
                case "blogUrl"         -> new SummaryItem(s.id(), s.text(), s.linkedInUrl(), s.personalPageUrl(), newValue, s.contactEmail(), s.locationCountry(), s.locationCity());
                case "contactEmail"    -> new SummaryItem(s.id(), s.text(), s.linkedInUrl(), s.personalPageUrl(), s.blogUrl(), newValue, s.locationCountry(), s.locationCity());
                case "locationCountry" -> new SummaryItem(s.id(), s.text(), s.linkedInUrl(), s.personalPageUrl(), s.blogUrl(), s.contactEmail(), newValue, s.locationCity());
                case "locationCity"    -> new SummaryItem(s.id(), s.text(), s.linkedInUrl(), s.personalPageUrl(), s.blogUrl(), s.contactEmail(), s.locationCountry(), newValue);
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for SUMMARY");
            };
            case GenericItem g -> {
                // GenericItem uses a Map<String, String> — patch any key freely
                var updatedFields = new java.util.HashMap<>(g.fields());
                updatedFields.put(field, newValue);
                yield new GenericItem(g.id(), updatedFields);
            }
        };
    }
}
