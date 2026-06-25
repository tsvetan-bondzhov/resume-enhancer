import React, { useRef } from "react"
import type { ResumeSectionDto, ResumeItemDto } from "@/types/api"
import { SectionIdContext } from "@/components/resume/sections/sectionRendererShared"
import WorkExperienceSectionRenderer from "@/components/resume/sections/WorkExperienceSectionRenderer"
import EducationSectionRenderer from "@/components/resume/sections/EducationSectionRenderer"
import SkillsSectionRenderer from "@/components/resume/sections/SkillsSectionRenderer"
import CertificationsSectionRenderer from "@/components/resume/sections/CertificationsSectionRenderer"
import LanguagesSectionRenderer from "@/components/resume/sections/LanguagesSectionRenderer"
import ProjectsSectionRenderer from "@/components/resume/sections/ProjectsSectionRenderer"
import VolunteeringSectionRenderer from "@/components/resume/sections/VolunteeringSectionRenderer"
import SummarySectionRenderer from "@/components/resume/sections/SummarySectionRenderer"
import FullNameSectionRenderer from "@/components/resume/sections/FullNameSectionRenderer"
import GenericSectionRenderer from "@/components/resume/sections/GenericSectionRenderer"

interface ResumeSectionProps {
  readonly section: ResumeSectionDto
  readonly onTitleChange: (title: string) => void
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
  readonly visibleItemIds?: ReadonlySet<string>
  readonly showTitle?: boolean
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
    case "FULL_NAME":
      return (
        <FullNameSectionRenderer
          items={section.items.filter((i) => i.type === "FULL_NAME").map((i) => {
            if (i.type === "FULL_NAME") return i
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
      return _exhaustive
    }
  }
}

const SECTION_TITLE_PLACEHOLDER = "Click to add section title"

export default function ResumeSection({
  section,
  onTitleChange,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
  visibleItemIds,
  showTitle = true,
}: ResumeSectionProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const isTitleEmpty = !section.title

  const handleTitleFocus = () => {
    if (titleRef.current?.textContent === SECTION_TITLE_PLACEHOLDER) {
      titleRef.current.textContent = ""
      titleRef.current.classList.remove("text-gray-300", "italic")
    }
  }

  const handleTitleBlur = (e: React.FocusEvent<HTMLHeadingElement>) => {
    const text = e.currentTarget.textContent ?? ""
    onTitleChange?.(text)
    if (!text && titleRef.current) {
      titleRef.current.textContent = SECTION_TITLE_PLACEHOLDER
      titleRef.current.classList.add("text-gray-300", "italic")
    }
  }

  const filteredSection = visibleItemIds
    ? { ...section, items: section.items.filter((item) => visibleItemIds.has(item.id)) }
    : section

  return (
    <SectionIdContext.Provider value={section.sectionType}>
      <section
        aria-labelledby={`section-title-${section.sectionType}`}
        style={{ marginBottom: "var(--section-spacing, 24px)" }}
        data-section-type={section.sectionType}
      >
          {showTitle && (
            <h2
              ref={titleRef}
              id={`section-title-${section.sectionType}`}
              contentEditable
              suppressContentEditableWarning
              onFocus={isTitleEmpty ? handleTitleFocus : undefined}
              onBlur={handleTitleBlur}
              style={isTitleEmpty ? undefined : { color: "var(--primary-color, inherit)" }}
              className={`text-base font-semibold border-b-2 border-[var(--accent-color,theme(colors.zinc.200))] pb-1 mb-2 uppercase tracking-wide outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text${isTitleEmpty ? " text-gray-300 italic" : ""}`}
              aria-label={`Edit section title: ${section.title}`}
            >
              {isTitleEmpty ? SECTION_TITLE_PLACEHOLDER : section.title}
            </h2>
          )}
        {renderSectionContent(filteredSection, onFieldChange, onAddItem, onDeleteItem, onReorderItems)}
      </section>
    </SectionIdContext.Provider>
  )
}
