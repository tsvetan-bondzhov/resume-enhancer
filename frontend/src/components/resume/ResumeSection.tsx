import type { ResumeSectionDto, ResumeItemDto } from "@/types/api"
import WorkExperienceSectionRenderer from "@/components/resume/sections/WorkExperienceSectionRenderer"
import EducationSectionRenderer from "@/components/resume/sections/EducationSectionRenderer"
import SkillsSectionRenderer from "@/components/resume/sections/SkillsSectionRenderer"
import CertificationsSectionRenderer from "@/components/resume/sections/CertificationsSectionRenderer"
import LanguagesSectionRenderer from "@/components/resume/sections/LanguagesSectionRenderer"
import ProjectsSectionRenderer from "@/components/resume/sections/ProjectsSectionRenderer"
import VolunteeringSectionRenderer from "@/components/resume/sections/VolunteeringSectionRenderer"
import SummarySectionRenderer from "@/components/resume/sections/SummarySectionRenderer"
import GenericSectionRenderer from "@/components/resume/sections/GenericSectionRenderer"

interface ResumeSectionProps {
  section: ResumeSectionDto
  onTitleChange: (title: string) => void
  onFieldChange?: (itemId: string, field: string, value: string) => void
  onAddItem?: (position: number) => void
  onDeleteItem?: (itemId: string) => void
  onReorderItems?: (newItems: ResumeItemDto[]) => void
}

function renderSectionContent(
  section: ResumeSectionDto,
  onFieldChange: ((itemId: string, field: string, value: string) => void) | undefined,
  onAddItem: ((position: number) => void) | undefined,
  onDeleteItem: ((itemId: string) => void) | undefined,
  onReorderItems: ((newItems: ResumeItemDto[]) => void) | undefined,
) {
  switch (section.sectionType) {
    case "WORK_EXPERIENCE":
      return (
        <WorkExperienceSectionRenderer
          items={section.items.filter((i) => i.type === "WORK_EXPERIENCE").map((i) => {
            if (i.type === "WORK_EXPERIENCE") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "EDUCATION":
      return (
        <EducationSectionRenderer
          items={section.items.filter((i) => i.type === "EDUCATION").map((i) => {
            if (i.type === "EDUCATION") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "SKILLS":
      return (
        <SkillsSectionRenderer
          items={section.items.filter((i) => i.type === "SKILLS").map((i) => {
            if (i.type === "SKILLS") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "CERTIFICATIONS":
      return (
        <CertificationsSectionRenderer
          items={section.items.filter((i) => i.type === "CERTIFICATIONS").map((i) => {
            if (i.type === "CERTIFICATIONS") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "LANGUAGES":
      return (
        <LanguagesSectionRenderer
          items={section.items.filter((i) => i.type === "LANGUAGES").map((i) => {
            if (i.type === "LANGUAGES") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "PROJECTS":
      return (
        <ProjectsSectionRenderer
          items={section.items.filter((i) => i.type === "PROJECTS").map((i) => {
            if (i.type === "PROJECTS") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "VOLUNTEERING":
      return (
        <VolunteeringSectionRenderer
          items={section.items.filter((i) => i.type === "VOLUNTEERING").map((i) => {
            if (i.type === "VOLUNTEERING") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "SUMMARY":
      return (
        <SummarySectionRenderer
          items={section.items.filter((i) => i.type === "SUMMARY").map((i) => {
            if (i.type === "SUMMARY") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    case "UNKNOWN":
      return (
        <GenericSectionRenderer
          items={section.items.filter((i) => i.type === "UNKNOWN").map((i) => {
            if (i.type === "UNKNOWN") return i
            throw new Error("unexpected item type")
          })}
          onFieldChange={onFieldChange}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      )
    default: {
      const _exhaustive: never = section.sectionType
      void _exhaustive
      return null
    }
  }
}

export default function ResumeSection({
  section,
  onTitleChange,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: ResumeSectionProps) {
  return (
    <section aria-labelledby={`section-title-${section.sectionType}`} className="mb-6">
      {onTitleChange ? (
        <h2
          id={`section-title-${section.sectionType}`}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onTitleChange(e.currentTarget.textContent ?? "")}
          className="text-base font-semibold border-b-2 border-[var(--accent-color,theme(colors.zinc.200))] pb-1 mb-2 uppercase tracking-wide outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text"
          aria-label={`Edit section title: ${section.title}`}
        >
          {section.title}
        </h2>
      ) : (
        <h2
          id={`section-title-${section.sectionType}`}
          className="text-base font-semibold border-b-2 border-[var(--accent-color,theme(colors.zinc.200))] pb-1 mb-2 uppercase tracking-wide"
        >
          {section.title}
        </h2>
      )}
      {renderSectionContent(section, onFieldChange, onAddItem, onDeleteItem, onReorderItems)}
    </section>
  )
}
