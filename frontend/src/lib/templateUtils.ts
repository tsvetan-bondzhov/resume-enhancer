import type { ResumeSectionDto, TemplateDto } from "@/types/api"

/**
 * Returns visible sections ordered according to the user's document order.
 *
 * Rules:
 * - Visibility filtering is applied first: sections with `visible === false` are always excluded.
 * - `single-column` / `modern-accent`: returns visible sections in the user's stored array order
 *   (the template `sectionOrder` is no longer used as a sort key).
 * - `two-column`: sections are split into left/right groups using template `columns.left` /
 *   `columns.right` for column assignment only; ordering within each group follows the user's
 *   array order. Unassigned sections are appended to the right column.
 * - No template / no layout: user array order returned unchanged.
 * - Sections are NEVER silently dropped.
 *
 * Note: `sectionOrder` strings match `section.sectionType` values (e.g. "WORK_EXPERIENCE").
 */
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType

  if (layoutType === "two-column") {
    const leftIds = new Set(layout.columns?.left ?? [])
    const rightIds = new Set(layout.columns?.right ?? [])
    const leftSections = visibleSections.filter((s) => leftIds.has(s.sectionType))
    const rightSections = visibleSections.filter((s) => rightIds.has(s.sectionType))
    const unassigned = visibleSections.filter(
      (s) => !leftIds.has(s.sectionType) && !rightIds.has(s.sectionType)
    )
    return [...leftSections, ...rightSections, ...unassigned]
  }

  // single-column and modern-accent: user array order wins
  return visibleSections
}
