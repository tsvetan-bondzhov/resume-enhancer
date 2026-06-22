package com.tsvetanbondzhov.resumeenhancer.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentPatchService {

    private static final String FIELD_DESCRIPTION = "description";

    private final ObjectMapper objectMapper;

    public DocumentPatchService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Applies a DocumentPatchEvent to a ResumeDocument, returning a new updated document.
     * ResumeDocument is immutable (records + defensive copies) — this method creates a new instance.
     *
     * Supported operations (patch.op):
     *   "modify" (default) — update a single field on an existing item
     *   "add"              — insert a new item into a section
     *   "delete"           — remove an existing item by itemIndex
     *
     * @throws InvalidPatchException if the patch is structurally invalid.
     */
    public ResumeDocument apply(ResumeDocument document, DocumentPatchEvent patch) {
        ResumeSectionType targetType = resolveSection(document, patch.sectionId());

        List<ResumeSection> updatedSections = document.sections().stream()
                .map(section -> section.sectionType() == targetType
                        ? applyToSection(section, patch)
                        : section)
                .toList();

        return new ResumeDocument(updatedSections);
    }

    private ResumeSectionType resolveSection(ResumeDocument document, String sectionId) {
        ResumeSectionType targetType;
        try {
            targetType = ResumeSectionType.valueOf(sectionId);
        } catch (IllegalArgumentException e) {
            throw new InvalidPatchException("Section not found: sectionId='" + sectionId + "'");
        }

        boolean sectionFound = document.sections().stream()
                .anyMatch(s -> s.sectionType() == targetType);
        if (!sectionFound) {
            throw new InvalidPatchException("Section not found in document: sectionId='" + sectionId + "'");
        }
        return targetType;
    }

    private ResumeSection applyToSection(ResumeSection section, DocumentPatchEvent patch) {
        return switch (patch.effectiveOp()) {
            case "add"    -> applyAdd(section, patch);
            case "delete" -> applyDelete(section, patch);
            default       -> applyModify(section, patch);
        };
    }

    private ResumeSection applyModify(ResumeSection section, DocumentPatchEvent patch) {
        if ("type".equals(patch.field()) || "id".equals(patch.field())) {
            throw new InvalidPatchException("Field '" + patch.field() + "' is reserved and cannot be patched");
        }

        List<ResumeItem> items = section.items();
        int idx = resolveItemIndex(patch, items.size(), section.sectionType().name());

        List<ResumeItem> updatedItems = new ArrayList<>(items);
        updatedItems.set(idx, applyToItem(items.get(idx), patch));
        return new ResumeSection(section.sectionType(), section.title(), section.visible(), updatedItems);
    }

    private ResumeSection applyAdd(ResumeSection section, DocumentPatchEvent patch) {
        if (patch.item() == null) {
            throw new InvalidPatchException("'add' operation requires an 'item' field");
        }

        ResumeItem newItem;
        try {
            newItem = objectMapper.treeToValue(patch.item(), ResumeItem.class);
        } catch (Exception e) {
            throw new InvalidPatchException("Failed to deserialize new item for 'add' operation: " + e.getMessage());
        }

        newItem = withNewId(newItem);

        List<ResumeItem> updatedItems = new ArrayList<>(section.items());
        int insertAt = (patch.itemIndex() != null)
                ? Math.min(Math.max(patch.itemIndex(), 0), updatedItems.size())
                : updatedItems.size();
        updatedItems.add(insertAt, newItem);
        return new ResumeSection(section.sectionType(), section.title(), section.visible(), updatedItems);
    }

    private ResumeSection applyDelete(ResumeSection section, DocumentPatchEvent patch) {
        List<ResumeItem> items = section.items();
        int idx = resolveItemIndex(patch, items.size(), section.sectionType().name());

        List<ResumeItem> updatedItems = new ArrayList<>(items);
        updatedItems.remove(idx);
        return new ResumeSection(section.sectionType(), section.title(), section.visible(), updatedItems);
    }

    private int resolveItemIndex(DocumentPatchEvent patch, int size, String sectionName) {
        if (patch.itemIndex() == null) {
            throw new InvalidPatchException("itemIndex is required for '" + patch.effectiveOp() + "' operation");
        }
        if (patch.itemIndex() < 0 || patch.itemIndex() >= size) {
            throw new InvalidPatchException(
                    "itemIndex " + patch.itemIndex() + " is out of bounds for section '"
                    + sectionName + "' (size=" + size + ")");
        }
        return patch.itemIndex();
    }

    private ResumeItem withNewId(ResumeItem item) {
        String id = UUID.randomUUID().toString();
        return switch (item) {
            case WorkExperienceItem w  -> new WorkExperienceItem(id, w.jobTitle(), w.company(), w.startDate(), w.endDate(), w.isCurrent(), w.description());
            case EducationItem e       -> new EducationItem(id, e.institution(), e.degree(), e.fieldOfStudy(), e.startDate(), e.endDate());
            case SkillItem s           -> new SkillItem(id, s.name());
            case CertificationItem c   -> new CertificationItem(id, c.name(), c.issuer(), c.issueDate(), c.expirationDate());
            case LanguageItem l        -> new LanguageItem(id, l.language(), l.proficiency());
            case ProjectItem p         -> new ProjectItem(id, p.name(), p.description(), p.technologies(), p.link(), p.startDate(), p.endDate(), p.isCurrent());
            case VolunteeringItem v    -> new VolunteeringItem(id, v.role(), v.organization(), v.description(), v.startDate(), v.endDate(), v.isCurrent());
            case SummaryItem s         -> new SummaryItem(id, s.text(), s.linkedInUrl(), s.personalPageUrl(), s.blogUrl(), s.contactEmail(), s.locationCountry(), s.locationCity());
            case GenericItem g         -> new GenericItem(id, g.fields());
        };
    }

    private ResumeItem applyToItem(ResumeItem item, DocumentPatchEvent patch) {
        String field = patch.field();
        String newValue = patch.newValue();

        return switch (item) {
            case WorkExperienceItem w -> switch (field) {
                case "jobTitle"        -> new WorkExperienceItem(w.id(), newValue, w.company(), w.startDate(), w.endDate(), w.isCurrent(), w.description());
                case "company"         -> new WorkExperienceItem(w.id(), w.jobTitle(), newValue, w.startDate(), w.endDate(), w.isCurrent(), w.description());
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
                case "name"            -> new ProjectItem(p.id(), newValue, p.description(), p.technologies(), p.link(), p.startDate(), p.endDate(), p.isCurrent());
                case FIELD_DESCRIPTION -> new ProjectItem(p.id(), p.name(), newValue, p.technologies(), p.link(), p.startDate(), p.endDate(), p.isCurrent());
                case "technologies"    -> new ProjectItem(p.id(), p.name(), p.description(), newValue, p.link(), p.startDate(), p.endDate(), p.isCurrent());
                case "link"            -> new ProjectItem(p.id(), p.name(), p.description(), p.technologies(), newValue, p.startDate(), p.endDate(), p.isCurrent());
                default -> throw new InvalidPatchException("Unknown field '" + field + "' for PROJECTS");
            };
            case VolunteeringItem v -> switch (field) {
                case "role"            -> new VolunteeringItem(v.id(), newValue, v.organization(), v.description(), v.startDate(), v.endDate(), v.isCurrent());
                case "organization"    -> new VolunteeringItem(v.id(), v.role(), newValue, v.description(), v.startDate(), v.endDate(), v.isCurrent());
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
                var updatedFields = new java.util.HashMap<>(g.fields());
                updatedFields.put(field, newValue);
                yield new GenericItem(g.id(), updatedFields);
            }
        };
    }
}
